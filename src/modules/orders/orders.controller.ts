import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Tạo đơn hàng mới và khởi tạo liên kết thanh toán VietQR
  @Post()
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  // Khách hàng kiểm tra trạng thái thanh toán đơn hàng (Polling ở Bước 2)
  @Get(':id/status')
  async getOrderPaymentStatus(@Param('id') orderId: string) {
    return this.ordersService.getStatus(orderId);
  }
}
