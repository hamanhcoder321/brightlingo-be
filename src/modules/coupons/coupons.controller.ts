import { Controller, Post, Body } from '@nestjs/common';
import { CouponsService } from './coupons.service';

export class ApplyCouponDto {
  code: string;
  courseId: string;
  originalPrice: number;
}

@Controller('api/coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('apply')
  async apply(@Body() dto: ApplyCouponDto) {
    return this.couponsService.applyCoupon(dto.code, dto.courseId, dto.originalPrice);
  }
}
