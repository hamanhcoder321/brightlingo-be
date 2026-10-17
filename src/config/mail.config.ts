import { registerAs } from '@nestjs/config';

export const mailConfig = registerAs('mail', () => ({
  resendApiKey: process.env.RESEND_API_KEY || '',
  fromEmail: process.env.MAIL_FROM || 'noreply@brightlingo.com',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@brightlingo.vn',
  supportPhone: process.env.SUPPORT_PHONE || '1900 8989',
}));
