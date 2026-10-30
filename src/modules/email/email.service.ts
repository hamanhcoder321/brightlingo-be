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
    // 1. Kiểm tra trạng thái đơn hàng (BR-05: Chỉ Paid mới được gửi, hỗ trợ tìm theo cả id hoặc order_code)
    const orderRes = await this.db.query(
      `SELECT o.*, c.resource_link 
       FROM orders o
       LEFT JOIN courses c ON (o.course_id = c.id OR o.course_slug = c.slug)
       WHERE o.id = $1 OR o.order_code = $1`,
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
      // Fallback template mặc định chuẩn giao diện EngNest
      template = {
        id: null,
        subject: `[EngNest] Kích hoạt thành công khóa học: {{course_name}} (Đơn hàng #{{order_code}})`,
        body_html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #0B6E6E; color: #ffffff; font-weight: bold; font-size: 20px; padding: 10px 20px; border-radius: 8px;">
              EngNest
            </div>
            <h2 style="color: #0B6E6E; margin-top: 16px; margin-bottom: 8px;">Kích hoạt khóa học & Giao tài liệu thành công!</h2>
            <p style="color: #64748b; font-size: 14px; margin: 0;">Cảm ơn bạn đã lựa chọn học cùng EngNest</p>
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
    const { supportEmail, supportPhone, siteName } = await this.getBrandingSettings();
    const paymentTime = order.paid_at ? new Date(order.paid_at).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');
    const amountPaid = formatVND(order.total_amount);
    const resourceLink = order.resource_link || 'https://engnest.vn/giao-tai-lieu-so';

    const replacements: Record<string, string> = {
      '{{customer_name}}': order.customer_name || 'Học viên',
      '{ho_ten}': order.customer_name || 'Học viên',
      '{{course_name}}': order.course_title || 'Khóa học EngNest',
      '{{course_title}}': order.course_title || 'Khóa học EngNest',
      '{ten_khoa_hoc}': order.course_title || 'Khóa học EngNest',
      '{{order_code}}': order.order_code,
      '{ma_don}': order.order_code,
      '{{amount_paid}}': amountPaid,
      '{so_tien}': amountPaid,
      '{{payment_time}}': paymentTime,
      '{thoi_gian}': paymentTime,
      '{{resource_link}}': resourceLink, // Render link thật tại backend (BR-11)
      '{link_drive}': resourceLink,
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

  private mapTemplateRow(row: any) {
    return {
      id: String(row.id),
      name: row.name,
      title: row.name,
      code: row.code,
      template_key: row.code,
      subject: row.subject,
      body_html: row.body_html,
      body_text: row.body_text || '',
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async getTemplates() {
    const res = await this.db.query(`SELECT * FROM email_templates ORDER BY id ASC`);
    return res.rows.map((r) => this.mapTemplateRow(r));
  }

  async getTemplateById(id: string) {
    const isNum = !isNaN(Number(id));
    const res = isNum
      ? await this.db.query(`SELECT * FROM email_templates WHERE id = $1 LIMIT 1`, [Number(id)])
      : await this.db.query(
          `SELECT * FROM email_templates WHERE code = $1 OR code = 'ORDER_PAID_RESOURCE_DELIVERY' ORDER BY id ASC LIMIT 1`,
          [id],
        );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy mẫu email: ${id}`);
    }
    return this.mapTemplateRow(res.rows[0]);
  }

  async updateTemplate(id: string, data: { title?: string; name?: string; subject?: string; body_html?: string; body_text?: string; is_active?: boolean }) {
    const existing = await this.getTemplateById(id);
    const nextName = data.title || data.name || existing.name;
    const nextSubject = data.subject ?? existing.subject;
    const nextHtml = data.body_html ?? existing.body_html;
    const nextText = data.body_text ?? existing.body_text;
    const nextActive = data.is_active !== undefined ? data.is_active : existing.is_active;

    const res = await this.db.query(
      `UPDATE email_templates
       SET name = $1, subject = $2, body_html = $3, body_text = $4, is_active = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [nextName, nextSubject, nextHtml, nextText, nextActive, Number(existing.id)],
    );
    return this.mapTemplateRow(res.rows[0]);
  }

  // Thông tin thương hiệu/hỗ trợ lấy từ bảng settings (CMS), fallback về cấu hình môi trường.
  private async getBrandingSettings() {
    let supportEmail = this.configService.get<string>('mail.supportEmail', 'hotro@engnest.vn');
    let supportPhone = this.configService.get<string>('mail.supportPhone', '1900 8989');
    let siteName = 'EngNest';

    try {
      const settingsRes = await this.db.query(
        `SELECT key, value FROM settings WHERE key IN ('support_phone', 'support_email', 'site_name')`,
      );
      for (const row of settingsRes.rows) {
        if (row.key === 'support_phone' && row.value) supportPhone = row.value;
        if (row.key === 'support_email' && row.value) supportEmail = row.value;
        if (row.key === 'site_name' && row.value) siteName = row.value;
      }
    } catch {
      // Fallback to defaults
    }

    return { supportEmail, supportPhone, siteName };
  }

  async sendTestEmail(id: string, targetEmail: string) {
    if (!targetEmail) {
      throw new BadRequestException('Vui lòng nhập địa chỉ email nhận thử nghiệm');
    }
    const tpl = await this.getTemplateById(id);
    const { supportEmail, supportPhone, siteName } = await this.getBrandingSettings();
    const replacements: Record<string, string> = {
      '{{customer_name}}': 'Học viên Thử Nghiệm',
      '{ho_ten}': 'Học viên Thử Nghiệm',
      '{{course_name}}': 'Khóa học HSK 1-3 Toàn Diện (Bản Test)',
      '{{course_title}}': 'Khóa học HSK 1-3 Toàn Diện (Bản Test)',
      '{ten_khoa_hoc}': 'Khóa học HSK 1-3 Toàn Diện (Bản Test)',
      '{{order_code}}': 'BL-TEST-9999',
      '{ma_don}': 'BL-TEST-9999',
      '{{amount_paid}}': '799.000',
      '{so_tien}': '799.000',
      '{{payment_time}}': new Date().toLocaleString('vi-VN'),
      '{thoi_gian}': new Date().toLocaleString('vi-VN'),
      '{{resource_link}}': 'https://drive.google.com/drive/folders/test-engnest-demo',
      '{link_drive}': 'https://drive.google.com/drive/folders/test-engnest-demo',
      '{{support_email}}': supportEmail,
      '{{support_phone}}': supportPhone,
      '{{site_name}}': siteName,
    };

    let subject = `[TEST] ${tpl.subject}`;
    let html = tpl.body_html;
    let text = tpl.body_text || '';
    for (const [k, v] of Object.entries(replacements)) {
      subject = subject.replaceAll(k, v);
      html = html.replaceAll(k, v);
      text = text.replaceAll(k, v);
    }

    await this.mail.sendMail({
      to: targetEmail,
      subject,
      html,
      text,
    });

    return {
      success: true,
      message: `Đã gửi email thử nghiệm tới ${targetEmail}`,
    };
  }
}
