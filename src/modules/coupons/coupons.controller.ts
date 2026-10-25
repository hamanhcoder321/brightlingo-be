import { Controller, Post, Body } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { ApplyCouponDto } from './dto/coupon.dto';

@Controller('api/coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // Học viên áp dụng mã giảm giá khi thanh toán khóa học
  @Post('apply')
  async applyCoupon(@Body() applyCouponDto: ApplyCouponDto) {
    return this.couponsService.applyCoupon(
      applyCouponDto.code,
      applyCouponDto.courseId,
      applyCouponDto.originalPrice,
    );
  }
}
