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
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [options.to],
            subject: options.subject,
            html: options.html,
            text: options.text,
          }),
        });

        const data: any = await response.json();
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
