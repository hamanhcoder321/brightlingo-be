import { Injectable, Logger, OnModuleInit, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS } from '@payos/node';
import { DatabaseService } from '@/core/database';
import { EmailService } from '@/modules/email';
import { BankNotiWebhookDto } from './dto/banknoti-webhook.dto';

export interface CreatePaymentLinkOptions {
  orderCode: number;
  amount: number;
  description: string;
  cancelUrl?: string;
  returnUrl?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);
  private payos: PayOS | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    const clientId = this.configService.get<string>('payment.payosClientId');
    const apiKey = this.configService.get<string>('payment.payosApiKey');
    const checksumKey = this.configService.get<string>('payment.payosChecksumKey');

    if (clientId && apiKey && checksumKey) {
      this.payos = new PayOS({ clientId, apiKey, checksumKey });
      this.logger.log('✅ PayOS SDK initialized successfully with active credentials');
    } else {
      this.logger.warn('⚠️ PayOS credentials not fully configured in .env');
    }
  }

  // 1. Tạo Link Thanh toán & VietQR chính thức từ PayOS
  async createPaymentLink(options: CreatePaymentLinkOptions) {
    if (!this.payos) {
      this.logger.warn('PayOS not initialized, falling back to static VietQR QuickLink');
      return this.createFallbackPaymentInfo(options);
    }

    try {
      // Chuẩn hóa description: PayOS chỉ nhận tối đa 25 ký tự, chữ/số, không dấu tiếng Việt
      const cleanDesc = options.description
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .trim()
        .slice(0, 25);

      const frontendUrl = this.configService.get<string>('app.corsOrigins.0', 'http://localhost:3000');

      const paymentResponse = await this.payos.paymentRequests.create({
        orderCode: options.orderCode,
        amount: options.amount,
        description: cleanDesc,
        cancelUrl: options.cancelUrl || `${frontendUrl}/checkout/cancel`,
        returnUrl: options.returnUrl || `${frontendUrl}/checkout/success`,
        items: options.items || [
          {
            name: 'BrightLingo Course',
            quantity: 1,
            price: options.amount,
          },
        ],
      });

      this.logger.log(`Created PayOS Payment Link #${paymentResponse.orderCode} (PaymentLinkId: ${paymentResponse.paymentLinkId})`);

      // Sinh URL ảnh VietQR hiển thị trực tiếp trên giao diện
      const qrCodeUrl = `https://img.vietqr.io/image/${paymentResponse.bin}-${paymentResponse.accountNumber}-compact2.png?amount=${paymentResponse.amount}&addInfo=${encodeURIComponent(
        paymentResponse.description,
      )}&accountName=${encodeURIComponent(paymentResponse.accountName)}`;

      return {
        orderCode: String(paymentResponse.orderCode),
        amount: paymentResponse.amount,
        bankName: 'MBBANK',
        accountName: paymentResponse.accountName,
        accountNumber: paymentResponse.accountNumber,
        qrCodeUrl,
        checkoutUrl: paymentResponse.checkoutUrl,
        paymentLinkId: paymentResponse.paymentLinkId,
        expiresInSeconds: 600, // 10 phút
      };
    } catch (err: any) {
      this.logger.error('Failed to create PayOS payment link:', err?.message || err);
      // Fallback an toàn nếu có sự cố mạng
      return this.createFallbackPaymentInfo(options);
    }
  }

  // 2. Xử lý Webhook tự động từ PayOS
  async handlePayOSWebhook(webhookBody: any) {
    this.logger.log(`Received PayOS Webhook: ${JSON.stringify(webhookBody)}`);

    if (!this.payos) {
      throw new BadRequestException('PayOS service is not initialized');
    }

    // Bước 1: Kiểm tra tính hợp lệ của chữ ký Webhook (HMAC-SHA256)
    let verifiedData: any;
    try {
      verifiedData = await this.payos.webhooks.verify(webhookBody);
      this.logger.log(`✅ PayOS Webhook signature verified successfully: OrderCode #${verifiedData.orderCode}`);
    } catch (verifyErr: any) {
      this.logger.error('❌ PayOS Webhook signature verification failed:', verifyErr?.message || verifyErr);
      throw new UnauthorizedException('Chữ ký Webhook không hợp lệ');
    }

    const orderCodeStr = String(verifiedData.orderCode);
    const amount = Number(verifiedData.amount);
    const externalTxId = String(verifiedData.reference || verifiedData.paymentLinkId || orderCodeStr);

    // Bước 2: Kiểm tra Idempotency chống xử lý trùng lặp giao dịch (BR-04)
    const existingPayment = await this.db.query(
      `SELECT id FROM payments WHERE external_transaction_id = $1`,
      [externalTxId],
    );

    if (existingPayment.rows.length > 0) {
      this.logger.warn(`Duplicate PayOS transaction received: ${externalTxId}. Skipping.`);
      return { success: true, message: 'Duplicate transaction ignored (Idempotent).' };
    }

    // Bước 3: Tìm đơn hàng trong DB theo order_code
    const orderRes = await this.db.query(
      `SELECT id, order_code, total_amount, status, customer_email 
       FROM orders 
       WHERE order_code = $1 OR order_code = $2`,
      [orderCodeStr, `BL-${orderCodeStr}`],
    );

    if (orderRes.rows.length === 0) {
      this.logger.warn(`Order not found for PayOS orderCode: ${orderCodeStr}`);
      return { success: true, isMatched: false, message: 'Order not found' };
    }

    const order = orderRes.rows[0];

    // Bước 4: Lưu giao dịch vào bảng payments
    await this.db.query(
      `INSERT INTO payments (
        order_id, order_code, gateway, account_number,
        transaction_date, amount, description, bill_id,
        external_transaction_id, is_matched, webhook_payload
      ) VALUES ($1, $2, 'PAYOS', $3, $4, $5, $6, $7, $8, true, $9)`,
      [
        order.id,
        order.order_code,
        verifiedData.accountNumber || null,
        verifiedData.transactionDateTime ? new Date(verifiedData.transactionDateTime) : new Date(),
        amount,
        verifiedData.description || '',
        verifiedData.paymentLinkId || null,
        externalTxId,
        JSON.stringify(webhookBody),
      ],
    );

    // Bước 5: Cập nhật đơn hàng sang PAID & kích hoạt gửi tài liệu qua Email (BR-03, BR-05)
    if (order.status === 'PENDING') {
      await this.db.query(
        `UPDATE orders 
         SET status = 'PAID', paid_at = NOW(), updated_at = NOW() 
         WHERE id = $1`,
        [order.id],
      );

      this.logger.log(`🎉 Order #${order.order_code} transitioned to PAID via PayOS!`);

      // Tự động gửi link tài liệu số qua email
      try {
        await this.emailService.sendDeliveryEmail(order.id, false);
      } catch (emailErr) {
        this.logger.error(`Failed to auto-deliver email for order #${order.order_code}:`, emailErr);
      }
    }

    return { success: true, code: '00', message: 'Payment confirmed successfully' };
  }

  // 3. Đăng ký Webhook URL với PayOS (Tùy chọn tiện ích)
  async confirmWebhook(webhookUrl: string) {
    if (!this.payos) {
      throw new BadRequestException('PayOS service is not initialized');
    }
    const result = await this.payos.webhooks.confirm(webhookUrl);
    this.logger.log(`PayOS webhook confirmed for URL: ${webhookUrl}`);
    return result;
  }

  // Fallback tĩnh khi chưa có internet hoặc PayOS gặp sự cố tạm thời
  private createFallbackPaymentInfo(options: CreatePaymentLinkOptions) {
    const bankName = this.configService.get<string>('payment.bankName', 'MBBANK');
    const accountNumber = this.configService.get<string>('payment.accountNumber', '0399046519');
    const accountName = this.configService.get<string>('payment.accountName', 'HA VAN MANH');
    const orderCodeStr = String(options.orderCode);

    const qrCodeUrl = `https://img.vietqr.io/image/${bankName}-${accountNumber}-compact2.png?amount=${options.amount}&addInfo=BL${orderCodeStr}&accountName=${encodeURIComponent(
      accountName,
    )}`;

    return {
      orderCode: orderCodeStr,
      amount: options.amount,
      bankName,
      accountName,
      accountNumber,
      qrCodeUrl,
      checkoutUrl: qrCodeUrl,
      paymentLinkId: 'fallback_' + Date.now(),
      expiresInSeconds: 600,
    };
  }

  // Xử lý BankNoti dự phòng nếu cần
  async handleBankNotiWebhook(payload: BankNotiWebhookDto) {
    this.logger.log(`Received BankNoti webhook: ${JSON.stringify(payload)}`);
    return { success: true, gateway: 'BANKNOTI' };
  }
}
