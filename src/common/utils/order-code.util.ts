/**
 * Sinh mã đơn hàng duy nhất, dễ đọc, không đoán tuần tự theo BA Mục 7.2 & 8.1
 * Ví dụ: BL-8921, BL-4729
 */
export function generateOrderCode(prefix = 'BL'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${digits}`;
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}
