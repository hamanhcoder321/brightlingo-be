import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '@/core/database';

@Injectable()
export class CouponsService {
  constructor(private readonly db: DatabaseService) {}

  // Áp dụng coupon và tính toán chiết khấu (BR-07)
  async applyCoupon(code: string, courseId: string, currentPrice: number) {
    if (!code) {
      throw new BadRequestException('Mã giảm giá không được để trống');
    }

    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,50}$/.test(cleanCode)) {
      throw new BadRequestException('Mã giảm giá chứa ký tự không hợp lệ');
    }

    const res = await this.db.query(
      `SELECT * FROM coupons 
       WHERE code = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
         AND (start_date IS NULL OR start_date <= NOW())
         AND (end_date IS NULL OR end_date >= NOW())`,
      [cleanCode],
    );

    if (res.rows.length === 0) {
      throw new BadRequestException('Mã giảm giá không hợp lệ hoặc đã hết hạn');
    }

    const coupon = res.rows[0];

    // Kiểm tra giới hạn số lượt dùng
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      throw new BadRequestException('Mã giảm giá đã hết lượt sử dụng');
    }

    // Kiểm tra phạm vi áp dụng (scope = SPECIFIC thì phải có trong coupon_courses)
    if (coupon.scope === 'SPECIFIC') {
      const scopeRes = await this.db.query(
        `SELECT id FROM coupon_courses WHERE coupon_id = $1 AND course_id = $2`,
        [coupon.id, courseId],
      );
      if (scopeRes.rows.length === 0) {
        throw new BadRequestException('Mã giảm giá không áp dụng cho khóa học này');
      }
    }

    // Kiểm tra giá trị đơn hàng tối thiểu
    if (coupon.min_order_amount && currentPrice < coupon.min_order_amount) {
      throw new BadRequestException(`Đơn hàng tối thiểu phải từ ${coupon.min_order_amount.toLocaleString('vi-VN')}đ`);
    }

    // Tính toán số tiền được giảm
    let discountAmount = 0;
    if (coupon.type === 'PERCENT') {
      discountAmount = Math.round((currentPrice * coupon.value) / 100);
      if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
        discountAmount = coupon.max_discount_amount;
      }
    } else {
      discountAmount = coupon.value;
    }

    const finalPrice = Math.max(0, currentPrice - discountAmount);

    return {
      code: coupon.code,
      discountAmount,
      finalPrice,
      isApplied: true,
      message: `Đã áp dụng mã giảm giá ${coupon.code} thành công!`,
    };
  }
}
