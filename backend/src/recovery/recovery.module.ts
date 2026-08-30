import { Module } from '@nestjs/common';
import { RecoveryController } from './recovery.controller';
import { RecoveryService } from './recovery.service';
import { RecoveryStrategyService } from './recovery-strategy.service';
import { PaymentsModule } from '../payments/payments.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PaymentsModule, InvoicesModule, AuthModule, NotificationModule],
  controllers: [RecoveryController],
  providers: [RecoveryService, RecoveryStrategyService],
  exports: [RecoveryService],
})
export class RecoveryModule {}
