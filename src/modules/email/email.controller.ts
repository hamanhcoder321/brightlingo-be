import { Controller, Post, Param } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('api/admin/emails')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  // Gửi lại tài liệu qua email từ CMS Admin (BR-06)
  @Post('resend/:orderId')
  async resend(@Param('orderId') orderId: string) {
    return this.emailService.sendDeliveryEmail(orderId, true);
  }
}
