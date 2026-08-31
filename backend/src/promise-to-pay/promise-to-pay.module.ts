import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { PromiseToPayController } from './promise-to-pay.controller';
import { PromiseToPayService } from './promise-to-pay.service';
import { PromiseToPaySweepService } from './promise-to-pay-sweep.service';
import { PromiseToPaySweepProcessor } from './promise-to-pay-sweep.processor';
import { AuthModule } from '../auth/auth.module';
import { RecoveryAutoModule } from '../recovery-auto/recovery-auto.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'promise-to-pay-sweep' }),
    AuthModule,
    RecoveryAutoModule,
  ],
  controllers: [PromiseToPayController],
  providers: [
    PromiseToPayService,
    PromiseToPaySweepService,
    PromiseToPaySweepProcessor,
  ],
  exports: [PromiseToPayService, PromiseToPaySweepService],
})
export class PromiseToPayModule {}
