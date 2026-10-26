import { registerAs } from '@nestjs/config';

export const storageConfig = registerAs('storage', () => ({
  enabled: process.env.R2_ENABLED === 'true',
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME || 'engnest-media',
  endpoint:
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined),
  publicUrl:
    process.env.R2_PUBLIC_URL ||
    'https://pub-7882fb2772604ee8b8c80f6aa7e66d0a.r2.dev',
}));
