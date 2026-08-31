import { Module } from '@nestjs/common';
import { RecoveryLabController } from './recovery-lab.controller';
import { RecoveryLabService } from './recovery-lab.service';
import { PaymentsModule } from '../payments/payments.module';
import { RiskModule } from '../risk/risk.module';
import { CheckoutSweepModule } from '../checkout-sweep/checkout-sweep.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { RecoveryAutoModule } from '../recovery-auto/recovery-auto.module';
import { PromiseToPayModule } from '../promise-to-pay/promise-to-pay.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PaymentsModule,
    RiskModule,
    CheckoutSweepModule,
    InvoicesModule,
    RecoveryAutoModule,
    PromiseToPayModule,
    AuthModule,
  ],
  controllers: [RecoveryLabController],
  providers: [RecoveryLabService],
})
export class RecoveryLabModule {}
