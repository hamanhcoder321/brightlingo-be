import { Controller, Post, Param, Req, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { AuthGuard } from '@/modules/auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('api/admin/emails')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  // Gửi lại tài liệu qua email từ CMS Admin (BR-06)
  @Post('resend/:orderId')
  async resend(@Param('orderId') orderId: string, @Req() req: any) {
    const adminId = req?.user?.id || req?.user?.sub ? Number(req.user.id || req.user.sub) : undefined;
    const adminName = req?.user?.name || req?.user?.email || 'Admin CMS';
    return this.emailService.sendDeliveryEmail(orderId, true, adminId, adminName);
  }
}
