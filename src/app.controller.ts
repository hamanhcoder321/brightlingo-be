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

  @Get('api/health')
  getHealth() {
    const rawDb = process.env.DATABASE_URL || '';
    let dbTarget = 'NOT_SET';
    if (rawDb) {
      try {
        const parts = rawDb.split('@');
        dbTarget = parts.length > 1 ? parts[1].split('?')[0] : 'CONFIGURED';
      } catch {
        dbTarget = 'CONFIGURED';
      }
    }
    return {
      status: 'ok',
      nodeEnv: process.env.NODE_ENV || 'development',
      hasDatabaseUrl: Boolean(rawDb),
      databaseTarget: dbTarget,
      hasPayosClientId: Boolean(process.env.PAYOS_CLIENT_ID),
      hasR2Bucket: Boolean(process.env.R2_BUCKET_NAME),
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  async handleRootPost(@Body() payload: any) {
    // Nếu payload gửi tới root chứa thông tin Webhook của PayOS, tự động xử lý thanh toán
    if (payload && (payload.data || payload.signature || payload.orderCode)) {
      return this.paymentsService.handlePayOSWebhook(payload);
    }
    return {
      success: true,
      message: 'EngNest API is running',
      timestamp: new Date().toISOString(),
    };
  }
}

