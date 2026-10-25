import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsAdminController } from './coupons-admin.controller';
import { CouponsService } from './coupons.service';

@Module({
  controllers: [CouponsController, CouponsAdminController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
