import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { BankNotiWebhookDto } from './dto/banknoti-webhook.dto';

@Controller(['api/webhooks', 'webhooks'])
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Webhook chính thức nhận từ PayOS khi khách chuyển khoản thành công
  @Post('payos')
  @HttpCode(HttpStatus.OK)
  async handlePayOSWebhook(@Body() webhookPayload: any) {
    return this.paymentsService.handlePayOSWebhook(webhookPayload);
  }

  // Đăng ký Webhook URL với PayOS (Tự động bù đuôi nếu thiếu)
  @Post('payos/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPayOSWebhook(@Body('webhookUrl') webhookUrl: string) {
    return this.paymentsService.confirmWebhook(webhookUrl);
  }

  // Chuyển đổi môi trường Webhook linh hoạt (local hoặc production)
  @Post('payos/switch-env')
  @HttpCode(HttpStatus.OK)
  async switchPayOSEnvironment(
    @Body() switchEnvDto: { target: 'local' | 'prod' | 'production'; url?: string },
  ) {
    const isTargetProduction =
      switchEnvDto.target === 'prod' || switchEnvDto.target === 'production';
    const resolvedWebhookUrl = isTargetProduction
      ? 'https://brightlingo-be.onrender.com/api/webhooks/payos'
      : (switchEnvDto.url || '');
    return this.paymentsService.confirmWebhook(resolvedWebhookUrl);
  }

  // Webhook dự phòng từ BankNoti
  @Post('banknoti')
  @HttpCode(HttpStatus.OK)
  async handleBankNotiWebhook(@Body() bankNotiPayload: BankNotiWebhookDto) {
    return this.paymentsService.handleBankNotiWebhook(bankNotiPayload);
  }
}
