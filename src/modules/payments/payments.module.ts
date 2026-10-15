import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentLoggerService } from './payment-logger.service';
import { EmailModule } from '@/modules/email';

@Module({
  imports: [EmailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentLoggerService],
  exports: [PaymentsService, PaymentLoggerService],
})
export class PaymentsModule {}
