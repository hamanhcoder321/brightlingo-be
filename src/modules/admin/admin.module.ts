import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { OrdersModule } from '@/modules/orders/orders.module';
import { LeadsModule } from '@/modules/leads/leads.module';
import { SettingsModule } from '@/modules/settings/settings.module';

@Module({
  imports: [OrdersModule, LeadsModule, SettingsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
