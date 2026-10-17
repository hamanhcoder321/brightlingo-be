import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMail(options: SendMailOptions): Promise<{ messageId: string }> {
    const apiKey = this.configService.get<string>('mail.resendApiKey');
    const from = this.configService.get<string>('mail.fromEmail', 'noreply@brightlingo.com');

    this.logger.log(`[MailService] Sending email to: ${options.to} | Subject: ${options.subject}`);

    // Khi có Resend API Key: thực hiện gọi Resend REST API
    if (apiKey) {
      const recipient = options.to;
      const isTestDomain = from.includes('onboarding@resend.dev');

      try {
        let response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [recipient],
            subject: options.subject,
            html: options.html,
            text: options.text,
          }),
        });

        let data: any = await response.json();

        // Xử lý thông minh cho Resend Sandbox (onboarding@resend.dev):
        // Nếu gửi tới địa chỉ khác bị giới hạn của Resend Sandbox, tự động chuyển tiếp tới email chủ tài khoản vanmanh8930@gmail.com để thử nghiệm
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
              from,
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

        this.logger.log(`[MailService] Email sent successfully via Resend: ID=${data.id}`);
        return { messageId: data.id || 'resend_' + Date.now() };
      } catch (error) {
        this.logger.error(`[MailService] Resend error:`, error);
        throw error;
      }
    }

    // Mock môi trường local dev khi chưa cấu hình Resend
    const mockId = 'mock_msg_' + Date.now();
    this.logger.warn(`[MailService] No RESEND_API_KEY found, mock email sent. ID: ${mockId}`);
    return { messageId: mockId };
  }
}
