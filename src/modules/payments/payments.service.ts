import { Injectable, Logger, OnModuleInit, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS } from '@payos/node';
import { DatabaseService } from '@/core/database';
import { EmailService } from '@/modules/email';
import { PaymentLoggerService } from './payment-logger.service';
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
    private readonly paymentLogger: PaymentLoggerService,
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
    // Ghi nhận sự kiện nhận Webhook vào file logs/payments.log
    this.paymentLogger.logWebhookReceived('PAYOS', webhookBody);

    if (!this.payos) {
      this.paymentLogger.logServerError({
        context: 'PayOS Init Check',
        errorMessage: 'PayOS service is not initialized',
        payload: webhookBody,
      });
      throw new BadRequestException('PayOS service is not initialized');
    }

    // Bước 1: Kiểm tra tính hợp lệ của chữ ký Webhook (HMAC-SHA256)
    let verifiedData: any;
    try {
      verifiedData = await this.payos.webhooks.verify(webhookBody);
      this.logger.log(`✅ PayOS Webhook signature verified successfully: OrderCode #${verifiedData.orderCode}`);
    } catch (verifyErr: any) {
      this.paymentLogger.logSignatureFailed('PAYOS', webhookBody, verifyErr?.message || String(verifyErr));
      throw new UnauthorizedException('Chữ ký Webhook không hợp lệ');
    }

    const orderCodeStr = String(verifiedData.orderCode);
    const amount = Number(verifiedData.amount);
    const externalTxId = String(verifiedData.reference || verifiedData.paymentLinkId || orderCodeStr);

    // Kiểm tra trạng thái giao dịch từ Webhook (nếu bị hủy hoặc thất bại)
    if (webhookBody.code && webhookBody.code !== '00') {
      this.paymentLogger.logCancelled({
        orderCode: orderCodeStr,
        reason: webhookBody.desc || 'Giao dịch bị hủy hoặc không thành công từ PayOS',
        details: webhookBody,
      });
      return { success: false, code: webhookBody.code, message: webhookBody.desc };
    }

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
      `SELECT id, order_code, total_amount, status, customer_email, customer_name, customer_phone 
       FROM orders 
       WHERE order_code = $1 OR order_code = $2`,
      [orderCodeStr, `BL-${orderCodeStr}`],
    );

    if (orderRes.rows.length === 0) {
      this.paymentLogger.logServerError({
        context: 'Match Order',
        errorMessage: `Không tìm thấy đơn hàng với mã #${orderCodeStr} trong Database`,
        orderCode: orderCodeStr,
        payload: webhookBody,
      });
      return { success: true, isMatched: false, message: 'Order not found' };
    }

    const order = orderRes.rows[0];

    // Sử dụng Database Transaction để đảm bảo tính toàn vẹn tuyệt đối (ACID)
    const client = await this.db.getPool().connect();
    try {
      await client.query('BEGIN');

      // Bước 4: Lưu giao dịch vào bảng payments
      await client.query(
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

      // Bước 5: Cập nhật đơn hàng sang PAID & Thống kê khách hàng (BR-03, BR-12)
      if (order.status === 'PENDING') {
        await client.query(
          `UPDATE orders 
           SET status = 'PAID', paid_at = NOW(), updated_at = NOW() 
           WHERE id = $1`,
          [order.id],
        );

        if (order.customer_email) {
          await client.query(
            `INSERT INTO customers (email, full_name, phone, total_orders, total_spent)
             VALUES ($1, $2, $3, 1, $4)
             ON CONFLICT (email) DO UPDATE 
             SET total_orders = customers.total_orders + 1,
                 total_spent = customers.total_spent + EXCLUDED.total_spent,
                 updated_at = NOW()`,
            [
              order.customer_email,
              order.customer_name || 'Học viên',
              order.customer_phone || null,
              order.total_amount,
            ],
          );
        }

        this.logger.log(`🎉 Order #${order.order_code} transitioned to PAID via PayOS!`);
      }

      await client.query('COMMIT');

      // Ghi log thanh toán thành công vào file logs/payments.log
      this.paymentLogger.logSuccess({
        orderCode: order.order_code,
        amount,
        gateway: 'PAYOS',
        externalTransactionId: externalTxId,
        customerEmail: order.customer_email,
        customerName: order.customer_name,
        bankAccountNumber: verifiedData.accountNumber,
        transactionDate: verifiedData.transactionDateTime,
        notes: `PayOS PaymentLinkId: ${verifiedData.paymentLinkId || 'N/A'}`,
      });
    } catch (dbErr: any) {
      await client.query('ROLLBACK');
      this.paymentLogger.logServerError({
        context: 'PayOS Webhook Transaction Rollback',
        errorMessage: dbErr?.message || String(dbErr),
        orderCode: orderCodeStr,
        stack: dbErr?.stack,
        payload: webhookBody,
      });
      // Ném lỗi ra để PayOS nhận HTTP Error và tự động Retry, tuyệt đối không nuốt lỗi
      throw dbErr;
    } finally {
      client.release();
    }

    // Tự động gửi link tài liệu số qua email (Chỉ chạy sau khi Transaction đã Commit thành công)
    try {
      this.logger.log(`📧 Đang kích hoạt gửi email tài liệu cho đơn hàng #${order.order_code} tới ${order.customer_email}...`);
      const emailResult = await this.emailService.sendDeliveryEmail(order.id, false);
      if (emailResult.success) {
        this.paymentLogger.logEmailSuccess(order.order_code, order.customer_email, emailResult.providerMessageId);
      } else {
        this.paymentLogger.logEmailFailed(order.order_code, order.customer_email, emailResult.error || 'Unknown error');
      }
    } catch (emailErr: any) {
      this.logger.error(`Failed to auto-deliver email for order #${order.order_code}:`, emailErr);
      this.paymentLogger.logEmailFailed(order.order_code, order.customer_email, emailErr?.message || String(emailErr));
    }

    return { success: true, code: '00', message: 'Payment confirmed successfully' };
  }

  // Ghi log hủy đơn (từ Web hoặc Timeout)
  logOrderCancelled(orderCode: string, reason?: string, details?: any) {
    this.paymentLogger.logCancelled({ orderCode, reason, details });
  }

  // Ghi log đơn hết hạn
  logOrderExpired(orderCode: string, details?: any) {
    this.paymentLogger.logExpired(orderCode, details);
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
