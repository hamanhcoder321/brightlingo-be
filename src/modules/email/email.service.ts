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
       LEFT JOIN courses c ON (o.course_id = c.id OR o.course_slug = c.slug)
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
      // Fallback template mặc định chuẩn giao diện BrightLingo
      template = {
        id: null,
        subject: `[BrightLingo] Kích hoạt thành công khóa học: {{course_name}} (Đơn hàng #{{order_code}})`,
        body_html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #0B6E6E; color: #ffffff; font-weight: bold; font-size: 20px; padding: 10px 20px; border-radius: 8px;">
              BrightLingo
            </div>
            <h2 style="color: #0B6E6E; margin-top: 16px; margin-bottom: 8px;">Kích hoạt khóa học & Giao tài liệu thành công!</h2>
            <p style="color: #64748b; font-size: 14px; margin: 0;">Cảm ơn bạn đã lựa chọn học cùng BrightLingo</p>
          </div>

          <p>Xin chào <strong>{{customer_name}}</strong>,</p>
          <p>Hệ thống đã xác nhận thanh toán thành công cho đơn hàng <strong>#{{order_code}}</strong> với số tiền <strong>{{amount_paid}}đ</strong>.</p>

          <div style="background-color: #F0FDF4; border-left: 4px solid #16A34A; padding: 16px; margin: 20px 0; border-radius: 6px;">
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #15803D; font-weight: 600; text-transform: uppercase;">Khóa học / Tài liệu của bạn:</p>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #166534;">{{course_name}}</p>
          </div>

          <p>Bạn có thể truy cập trọn bộ tài liệu, video bài giảng độc quyền và bài tập thực hành theo đường dẫn Google Drive bảo mật bên dưới:</p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="{{resource_link}}" style="background-color: #0B6E6E; color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(11, 110, 110, 0.25);">
              👉 TẢI TÀI LIỆU & BÀI HỌC TRỌN ĐỜI
            </a>
          </div>

          <div style="background-color: #F8FAFC; border: 1px dashed #CBD5E1; padding: 14px; border-radius: 8px; font-size: 13px; color: #64748b;">
            <p style="margin: 0 0 6px 0; font-weight: 600; color: #475569;">💡 Lưu ý quan trọng:</p>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Bạn có thể tải về điện thoại, máy tính để học trọn đời không giới hạn thời gian.</li>
              <li>Nếu nút trên không mở được, hãy copy đường dẫn dự phòng này vào trình duyệt: <br><strong style="color: #0B6E6E;">{{resource_link}}</strong></li>
            </ul>
          </div>

          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 28px 0;" />

          <div style="font-size: 13px; color: #64748b; line-height: 1.5;">
            <p style="margin: 0 0 4px 0;"><strong>Cần hỗ trợ kỹ thuật hoặc tài liệu?</strong></p>
            <p style="margin: 0;">Hotline / Zalo: <strong>{{support_phone}}</strong> | Email: <strong>{{support_email}}</strong></p>
          </div>
        </div>`,
        body_text: `Xin chào {{customer_name}},\n\nĐơn hàng #{{order_code}} ({{course_name}}) đã thanh toán thành công với số tiền {{amount_paid}}đ.\n\nTruy cập và tải tài liệu trọn đời tại: {{resource_link}}\n\nHotline hỗ trợ: {{support_phone}} | Email: {{support_email}}`,
      };
    }

    // 3. Render các placeholder theo tài liệu BA Mục 9.3
    let supportEmail = this.configService.get<string>('mail.supportEmail', 'support@brightlingo.vn');
    let supportPhone = this.configService.get<string>('mail.supportPhone', '1900 8989');

    try {
      const settingsRes = await this.db.query(
        `SELECT key, value FROM settings WHERE key IN ('support_phone', 'support_email')`,
      );
      for (const row of settingsRes.rows) {
        if (row.key === 'support_phone' && row.value) supportPhone = row.value;
        if (row.key === 'support_email' && row.value) supportEmail = row.value;
      }
    } catch {
      // Fallback to defaults
    }

    const siteName = this.configService.get<string>('app.name', 'BrightLingo');
    const paymentTime = order.paid_at ? new Date(order.paid_at).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');
    const amountPaid = formatVND(order.total_amount);
    const resourceLink = order.resource_link || 'https://brightlingo.vn/lien-he';

    const replacements: Record<string, string> = {
      '{{customer_name}}': order.customer_name || 'Học viên',
      '{{course_name}}': order.course_title || 'Khóa học BrightLingo',
      '{{order_code}}': order.order_code,
      '{{amount_paid}}': amountPaid,
      '{{payment_time}}': paymentTime,
      '{{resource_link}}': resourceLink, // Render link thật tại backend (BR-11)
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
      error: lastError,
      providerMessageId: providerMsgId,
      resendCount: currentResendCount,
    };
  }
}
