/**
 * Các đường dẫn hệ thống cấm không được dùng làm slug khóa học theo BR-01
 */
export const RESERVED_SYSTEM_SLUGS = [
  'admin',
  'api',
  'checkout',
  'payment',
  'policies',
  'chinh-sach',
  'dieu-khoan',
  'register',
  'tu-van',
  'auth',
  'login',
  'dashboard',
  'webhooks',
] as const;
