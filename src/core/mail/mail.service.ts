import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private smtpTransporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendMail(options: SendMailOptions): Promise<{ messageId: string }> {
    const resendApiKey = this.configService.get<string>('mail.resendApiKey');
    const fromEmail = this.configService.get<string>('mail.fromEmail', 'hotro@engnest.vn');

    const smtpUser = this.configService.get<string>('mail.smtp.user');
    const smtpPass = this.configService.get<string>('mail.smtp.pass');
    const smtpHost = this.configService.get<string>('mail.smtp.host', 'smtp.gmail.com');
    const smtpPort = this.configService.get<number>('mail.smtp.port', 587);
    const smtpSecure = this.configService.get<boolean>('mail.smtp.secure', false);

    this.logger.log(`[MailService] Chuẩn bị gửi email tới: ${options.to} | Tiêu đề: "${options.subject}"`);

    const hasSmtp = Boolean(smtpUser && smtpPass);
    const hasResend = Boolean(resendApiKey);
    const isResendSandbox = fromEmail.includes('onboarding@resend.dev');

    // 1. Nếu cấu hình SMTP (ví dụ Gmail / Google Workspace) VÀ Resend vẫn đang ở Sandbox (chưa active domain engnest):
    // Ưu tiên gửi ngay qua SMTP để khách hàng thật nhận được 100%
    if (hasSmtp && (!hasResend || isResendSandbox)) {
      try {
        this.logger.log(`[MailService] Sử dụng máy chủ SMTP (${smtpHost}) để gửi email tới người mua...`);
        return await this.sendViaSmtp(options, {
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          user: smtpUser!,
          pass: smtpPass!,
          from: fromEmail.includes('@') && !isResendSandbox ? fromEmail : `EngNest <${smtpUser}>`,
        });
      } catch (smtpErr: any) {
        this.logger.error(`[MailService] Gửi qua SMTP thất bại: ${smtpErr?.message || smtpErr}. Đang thử phương án dự phòng...`);
      }
    }

    // 2. Khi domain engnest đã được Verify trên Resend (hoặc khi chỉ cấu hình Resend)
    if (hasResend) {
      try {
        this.logger.log(`[MailService] Sử dụng Resend API (From: ${fromEmail}) để gửi email...`);
        return await this.sendViaResend(options, resendApiKey!, fromEmail);
      } catch (resendErr: any) {
        this.logger.error(`[MailService] Gửi qua Resend thất bại: ${resendErr?.message || resendErr}`);
        // Tự động Fallback sang SMTP nếu có cấu hình
        if (hasSmtp) {
          this.logger.warn(`[MailService] Tự động chuyển tiếp sang SMTP gửi dự phòng...`);
          return await this.sendViaSmtp(options, {
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            user: smtpUser!,
            pass: smtpPass!,
            from: fromEmail.includes('@') && !isResendSandbox ? fromEmail : `EngNest <${smtpUser}>`,
          });
        }
        throw resendErr;
      }
    }

    // 3. Nếu chỉ cấu hình SMTP
    if (hasSmtp) {
      return await this.sendViaSmtp(options, {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser!,
        pass: smtpPass!,
        from: fromEmail.includes('@') && !isResendSandbox ? fromEmail : `EngNest <${smtpUser}>`,
      });
    }

    // 4. Môi trường Local dev khi chưa điền thông tin gửi mail
    const mockId = 'mock_msg_' + Date.now();
    this.logger.warn(`[MailService] Chưa cấu hình SMTP hoặc RESEND_API_KEY. Giả lập gửi mail thành công (Mock ID: ${mockId})`);
    return { messageId: mockId };
  }

  // Phương thức gửi qua SMTP (Gmail, Google Workspace, Mail server riêng)
  private async sendViaSmtp(
    options: SendMailOptions,
    config: { host: string; port: number; secure: boolean; user: string; pass: string; from: string },
  ): Promise<{ messageId: string }> {
    if (!this.smtpTransporter) {
      this.smtpTransporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
    }

    const info = await this.smtpTransporter.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    this.logger.log(`✅ [MailService] Đã gửi email thành công qua SMTP! MessageId: ${info.messageId}`);
    return { messageId: info.messageId || 'smtp_' + Date.now() };
  }

  // Phương thức gửi qua Resend REST API (Khi domain engnest.vn đã active DNS)
  private async sendViaResend(
    options: SendMailOptions,
    apiKey: string,
    fromEmail: string,
  ): Promise<{ messageId: string }> {
    const recipient = options.to;
    const isTestDomain = fromEmail.includes('onboarding@resend.dev');

    let response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    let data: any = await response.json();

    // Fallback an toàn cho tài khoản Resend Sandbox chưa kích hoạt domain:
    if (!response.ok && isTestDomain && data.message?.includes('You can only send testing emails')) {
      const testEmail = 'vanmanh8930@gmail.com';
      this.logger.warn(
        `[MailService] Resend Sandbox giới hạn gửi: Tự động chuyển tiếp email tài liệu tới ${testEmail} (Email người mua: ${recipient})`,
      );

      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [testEmail],
          subject: `[Thử nghiệm - Người nhận: ${recipient}] ${options.subject}`,
          html: options.html,
          text: options.text,
        }),
      });
      data = await response.json();
    }

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send email via Resend API');
    }

    this.logger.log(`✅ [MailService] Đã gửi email thành công qua Resend! ID: ${data.id}`);
    return { messageId: data.id || 'resend_' + Date.now() };
  }
}
