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

    // Kiểm tra xem From có phải là email cá nhân (Gmail/Yahoo/Outlook) hoặc Sandbox hay không
    const isPublicEmailProvider =
      fromEmail.includes('@gmail.com') ||
      fromEmail.includes('@yahoo.') ||
      fromEmail.includes('@outlook.') ||
      fromEmail.includes('@hotmail.') ||
      fromEmail.includes('onboarding@resend.dev');

    // 1. Nếu địa chỉ gửi là Gmail cá nhân HOẶC Resend chưa có domain:
    // BẮT BUỘC gửi qua SMTP Gmail (Resend không cho phép gửi bằng đuôi @gmail.com)
    if (hasSmtp && (isPublicEmailProvider || !hasResend)) {
      this.logger.log(`[MailService] Người gửi là Gmail (${fromEmail}) -> Gửi trực tiếp qua Gmail SMTP...`);
      return await this.sendViaSmtp(options, {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser!,
        pass: smtpPass!,
        from: fromEmail.includes('<') ? fromEmail : `EngNest <${smtpUser}>`,
      });
    }

    // 2. Khi domain riêng engnest.vn đã kích hoạt trên Resend (fromEmail là @engnest.vn)
    if (hasResend && !isPublicEmailProvider) {
      try {
        this.logger.log(`[MailService] Sử dụng Resend API (Domain: ${fromEmail}) để gửi email...`);
        return await this.sendViaResend(options, resendApiKey!, fromEmail);
      } catch (resendErr: any) {
        this.logger.error(`[MailService] Gửi qua Resend thất bại: ${resendErr?.message || resendErr}`);
        // Fallback tự động sang SMTP nếu có cấu hình
        if (hasSmtp) {
          this.logger.warn(`[MailService] Tự động chuyển tiếp sang SMTP gửi dự phòng...`);
          return await this.sendViaSmtp(options, {
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            user: smtpUser!,
            pass: smtpPass!,
            from: `EngNest <${smtpUser}>`,
          });
        }
        throw resendErr;
      }
    }

    // 3. Fallback SMTP
    if (hasSmtp) {
      return await this.sendViaSmtp(options, {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser!,
        pass: smtpPass!,
        from: fromEmail.includes('<') ? fromEmail : `EngNest <${smtpUser}>`,
      });
    }

    // 4. Fallback Resend Sandbox nếu không có SMTP
    if (hasResend) {
      return await this.sendViaResend(options, resendApiKey!, fromEmail);
    }

    // 5. Mock môi trường dev
    const mockId = 'mock_msg_' + Date.now();
    this.logger.warn(`[MailService] Chưa cấu hình SMTP hoặc RESEND_API_KEY. Mock ID: ${mockId}`);
    return { messageId: mockId };
  }

  // Phương thức gửi qua SMTP (Gmail tối ưu hoặc máy chủ SMTP riêng)
  private async sendViaSmtp(
    options: SendMailOptions,
    config: { host: string; port: number; secure: boolean; user: string; pass: string; from: string },
  ): Promise<{ messageId: string }> {
    const cleanPass = config.pass.replace(/\s+/g, '');
    const cleanUser = config.user.trim();
    const isGmail = config.host.includes('gmail') || cleanUser.endsWith('@gmail.com');

    if (!this.smtpTransporter) {
      const transportConfig: any = isGmail
        ? {
            service: 'gmail',
            auth: {
              user: cleanUser,
              pass: cleanPass,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
          }
        : {
            host: config.host,
            port: config.port,
            secure: config.port === 465 || config.secure,
            auth: {
              user: cleanUser,
              pass: cleanPass,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
          };

      this.smtpTransporter = nodemailer.createTransport(transportConfig);
    }

    const info = await this.smtpTransporter.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    this.logger.log(`✅ [MailService] Đã gửi email thành công qua SMTP (${isGmail ? 'Gmail Service' : config.host})! ID: ${info.messageId}`);
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
