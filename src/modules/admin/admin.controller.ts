import { Controller, Get, Param, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { OrdersService } from '@/modules/orders/orders.service';

@Controller('api/admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('dashboard')
  async getDashboardSummary() {
    return this.adminService.getDashboardSummary();
  }

  // Danh sách toàn bộ đơn hàng thực tế cho CMS
  @Get('orders')
  async getOrders(@Query() params: any) {
    return this.ordersService.findAll(params);
  }

  // Chi tiết đơn hàng cho CMS
  @Get('orders/:id')
  async getOrderById(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
