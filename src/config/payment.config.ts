import { registerAs } from '@nestjs/config';

export const paymentConfig = registerAs('payment', () => ({
  // Cấu hình PayOS (Ưu tiên số 1)
  payosClientId: process.env.PAYOS_CLIENT_ID || '',
  payosApiKey: process.env.PAYOS_API_KEY || '',
  payosChecksumKey: process.env.PAYOS_CHECKSUM_KEY || '',

  // Cấu hình tài khoản ngân hàng thụ hưởng (MBBank)
  bankName: process.env.PAYMENT_BANK_NAME || 'MBBANK',
  accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || '0399046519',
  accountName: process.env.PAYMENT_ACCOUNT_NAME || 'HA VAN MANH',
  orderCodePrefix: process.env.PAYMENT_ORDER_PREFIX || 'BL',

  // Cấu hình BankNoti dự phòng
  banknotiApiToken: process.env.BANKNOTI_API_TOKEN || '',
  banknotiWebhookSecret: process.env.BANKNOTI_WEBHOOK_SECRET || '',
}));
