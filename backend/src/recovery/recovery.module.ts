import { Module } from '@nestjs/common';
import { RecoveryController } from './recovery.controller';
import { RecoveryService } from './recovery.service';
import { RecoveryStrategyService } from './recovery-strategy.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [
    RecoveryController,
  ],
  providers: [
    RecoveryService,
    RecoveryStrategyService,
  ],
})
export class RecoveryModule {}