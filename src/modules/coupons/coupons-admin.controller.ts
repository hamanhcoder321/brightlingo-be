import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto, QueryCouponDto } from './dto/coupon.dto';

@UseGuards(AuthGuard)
@Controller(['api/admin/coupons', 'admin/coupons'])
export class CouponsAdminController {
  constructor(private readonly couponsService: CouponsService) {}

  // Lấy danh sách mã giảm giá kèm lọc và phân trang
  @Get()
  async getCoupons(@Query() filterQuery: QueryCouponDto) {
    return this.couponsService.findAllForAdmin(filterQuery);
  }

  // Xem chi tiết 1 mã giảm giá theo ID
  @Get(':id')
  async getCouponById(@Param('id') couponId: string) {
    return this.couponsService.findById(couponId);
  }

  // Tạo mới mã giảm giá (toàn khóa hoặc từng khóa)
  @Post()
  async createCoupon(
    @Body() createCouponDto: CreateCouponDto,
    @Req() authenticatedRequest: any,
  ) {
    return this.couponsService.create(
      createCouponDto,
      authenticatedRequest.user,
      authenticatedRequest.ip,
    );
  }

  // Cập nhật thông tin mã giảm giá
  @Put(':id')
  async updateCoupon(
    @Param('id') couponId: string,
    @Body() updateCouponDto: UpdateCouponDto,
    @Req() authenticatedRequest: any,
  ) {
    return this.couponsService.update(
      couponId,
      updateCouponDto,
      authenticatedRequest.user,
      authenticatedRequest.ip,
    );
  }

  // Bật / Đóng nhanh trạng thái mã giảm giá (ACTIVE <=> INACTIVE)
  @Patch(':id/status')
  async toggleCouponStatus(
    @Param('id') couponId: string,
    @Req() authenticatedRequest: any,
  ) {
    return this.couponsService.toggleStatus(
      couponId,
      authenticatedRequest.user,
      authenticatedRequest.ip,
    );
  }

  // Xóa mã giảm giá (Soft Delete)
  @Delete(':id')
  async deleteCoupon(
    @Param('id') couponId: string,
    @Req() authenticatedRequest: any,
  ) {
    return this.couponsService.remove(
      couponId,
      authenticatedRequest.user,
      authenticatedRequest.ip,
    );
  }
}
