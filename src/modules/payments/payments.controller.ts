import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { BankNotiWebhookDto } from './dto/banknoti-webhook.dto';

@Controller('api/webhooks')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Webhook chính thức nhận từ PayOS khi khách chuyển khoản thành công
  @Post('payos')
  @HttpCode(HttpStatus.OK)
  async handlePayOSWebhook(@Body() payload: any) {
    return this.paymentsService.handlePayOSWebhook(payload);
  }

  // Đăng ký Webhook URL với PayOS
  @Post('payos/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPayOSWebhook(@Body('webhookUrl') webhookUrl: string) {
    return this.paymentsService.confirmWebhook(webhookUrl);
  }

  // Webhook dự phòng từ BankNoti
  @Post('banknoti')
  @HttpCode(HttpStatus.OK)
  async handleBankNotiWebhook(@Body() payload: BankNotiWebhookDto) {
    return this.paymentsService.handleBankNotiWebhook(payload);
  }
}
