import { Module } from '@nestjs/common';
import { RecoveryController } from './recovery.controller';
import { RecoveryService } from './recovery.service';
import { RecoveryStrategyService } from './recovery-strategy.service';
import { PaymentsModule } from '../payments/payments.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PaymentsModule, InvoicesModule, AuthModule],
  controllers: [
    RecoveryController,
  ],
  providers: [
    RecoveryService,
    RecoveryStrategyService,
  ],
})
export class RecoveryModule {}