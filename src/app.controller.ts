import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { PaymentsService } from './modules/payments/payments.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post()
  async handleRootPost(@Body() payload: any) {
    // Nếu payload gửi tới root chứa thông tin Webhook của PayOS, tự động xử lý thanh toán
    if (payload && (payload.data || payload.signature || payload.orderCode)) {
      return this.paymentsService.handlePayOSWebhook(payload);
    }
    return {
      success: true,
      message: 'BrightLingo API is running',
      timestamp: new Date().toISOString(),
    };
  }
}

