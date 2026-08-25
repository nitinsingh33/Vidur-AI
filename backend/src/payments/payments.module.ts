import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SyntheticPaymentService } from './sythetic-payment.service';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    SyntheticPaymentService,
  ],
  exports: [
    PaymentsService,
    SyntheticPaymentService,
  ],
})
export class PaymentsModule {}