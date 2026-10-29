import { registerAs } from '@nestjs/config';

export const mailConfig = registerAs('mail', () => ({
  resendApiKey: process.env.RESEND_API_KEY || '',
  fromEmail: process.env.MAIL_FROM || 'EngNest <vanmanh8930@gmail.com>',
  supportEmail: process.env.SUPPORT_EMAIL || 'hotro@engnest.vn',
  supportPhone: process.env.SUPPORT_PHONE || '1900 8989',
  relayUrl: process.env.MAIL_RELAY_URL || 'https://brightlingo-fe.vercel.app/api/mail/send',
  relaySecret: process.env.MAIL_RELAY_SECRET || 'engnest_secret_mail_relay_2026',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false',
    user: process.env.SMTP_USER || 'vanmanh8930@gmail.com',
    pass: (process.env.SMTP_PASS || 'rtpr qddq qjlj endl').replace(/\s+/g, ''),
  },
}));
