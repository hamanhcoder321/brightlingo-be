import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '@/core/database';
import { MailService } from '@/core/mail';
import { ConfigService } from '@nestjs/config';
import { formatVND } from '@/common/utils';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly configService: ConfigService,
  ) {}

  // Gửi email tài liệu tự động sau khi Paid (BR-05) hoặc Resend từ CMS (BR-06)
  async sendDeliveryEmail(orderId: string, isResend = false, adminId?: number, adminName?: string) {
    // 1. Kiểm tra trạng thái đơn hàng (BR-05: Chỉ Paid mới được gửi)
    const orderRes = await this.db.query(
      `SELECT o.*, c.resource_link 
       FROM orders o
       JOIN courses c ON o.course_id = c.id
       WHERE o.id = $1`,
      [orderId],
    );

    if (orderRes.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderId}`);
    }

    const order = orderRes.rows[0];
    if (order.status !== 'PAID') {
      throw new BadRequestException('Chỉ có thể gửi tài liệu cho đơn hàng đã thanh toán (PAID)');
    }

    // 2. Lấy Email Template đang kích hoạt (BR-11)
    const templateRes = await this.db.query(
      `SELECT * FROM email_templates 
       WHERE code = 'ORDER_PAID_RESOURCE_DELIVERY' AND is_active = true 
       LIMIT 1`,
    );

    let template = templateRes.rows[0];
    if (!template) {
      // Fallback template mặc định
      template = {
        id: null,
        subject: `[BrightLingo] Kích hoạt thành công khóa học: {{course_name}} (Đơn hàng #{{order_code}})`,
        body_html: `<p>Xin chào {{customer_name}}, đơn hàng #{{order_code}} đã thanh toán thành công. Truy cập tài liệu tại: <a href="{{resource_link}}">{{resource_link}}</a></p>`,
        body_text: `Xin chào {{customer_name}}, đơn hàng #{{order_code}} đã thanh toán thành công. Link: {{resource_link}}`,
      };
    }

    // 3. Render các placeholder theo tài liệu BA Mục 9.3
    const supportEmail = this.configService.get<string>('mail.supportEmail', 'hotro@brightlingo.com');
    const supportPhone = this.configService.get<string>('mail.supportPhone', '0988.123.456');
    const siteName = this.configService.get<string>('app.name', 'BrightLingo');
    const paymentTime = order.paid_at ? new Date(order.paid_at).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');
    const amountPaid = formatVND(order.total_amount);

    const replacements: Record<string, string> = {
      '{{customer_name}}': order.customer_name,
      '{{course_name}}': order.course_title,
      '{{order_code}}': order.order_code,
      '{{amount_paid}}': amountPaid,
      '{{payment_time}}': paymentTime,
      '{{resource_link}}': order.resource_link, // Render link thật tại backend (BR-11)
      '{{support_email}}': supportEmail,
      '{{support_phone}}': supportPhone,
      '{{site_name}}': siteName,
    };

    let subject = template.subject;
    let html = template.body_html;
    let text = template.body_text || '';

    for (const [key, val] of Object.entries(replacements)) {
      subject = subject.replaceAll(key, val);
      html = html.replaceAll(key, val);
      text = text.replaceAll(key, val);
    }

    // 4. Gửi email qua MailService (Resend)
    let emailStatus = 'SENT';
    let providerMsgId = null;
    let lastError = null;

    try {
      const result = await this.mail.sendMail({
        to: order.customer_email,
        subject,
        html,
        text,
      });
      providerMsgId = result.messageId;
    } catch (err: any) {
      emailStatus = 'FAILED';
      lastError = err?.message || 'Unknown email delivery error';
      this.logger.error(`Failed to send delivery email for order #${order.order_code}:`, err);
    }

    // 5. Ghi lịch sử gửi vào bảng email_logs (Mục 9.4)
    const logRes = await this.db.query(
      `SELECT resend_count FROM email_logs WHERE order_id = $1 ORDER BY id DESC LIMIT 1`,
      [order.id],
    );
    const prevResendCount = logRes.rows.length > 0 ? logRes.rows[0].resend_count : 0;
    const currentResendCount = isResend ? prevResendCount + 1 : prevResendCount;

    await this.db.query(
      `INSERT INTO email_logs (
        order_id, recipient_email, template_id, status,
        provider_message_id, send_at, last_error, resend_count
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
      [
        order.id,
        order.customer_email,
        template.id || null,
        emailStatus,
        providerMsgId,
        lastError,
        currentResendCount,
      ],
    );

    // 6. Ghi Audit Log nếu đây là thao tác Resend từ Admin (BR-06)
    if (isResend) {
      await this.db.query(
        `INSERT INTO audit_logs (
          admin_id, admin_name, action, target_entity, target_id, details
        ) VALUES ($1, $2, 'RESEND_EMAIL', 'orders', $3, $4)`,
        [
          adminId || null,
          adminName || 'Admin CMS',
          order.id,
          JSON.stringify({
            orderCode: order.order_code,
            resendCount: currentResendCount,
            recipient: order.customer_email,
          }),
        ],
      );
    }

    return {
      success: emailStatus === 'SENT',
      providerMessageId: providerMsgId,
      resendCount: currentResendCount,
    };
  }
}
