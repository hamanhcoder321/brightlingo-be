import { registerAs } from '@nestjs/config';

export const mailConfig = registerAs('mail', () => ({
  resendApiKey: process.env.RESEND_API_KEY || '',
  fromEmail: process.env.MAIL_FROM || 'hotro@engnest.vn',
  supportEmail: process.env.SUPPORT_EMAIL || 'hotro@engnest.vn',
  supportPhone: process.env.SUPPORT_PHONE || '1900 8989',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
}));
