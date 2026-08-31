import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MandatesController } from './mandates.controller';
import { MandatesService } from './mandates.service';
import { MandateRetrySequencerService } from './mandate-retry-sequencer.service';
import { MandateRetrySequencerProcessor } from './mandate-retry-sequencer.processor';
import { AuthModule } from '../auth/auth.module';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { RecoveryModule } from '../recovery/recovery.module';
import { PolicyModule } from '../policy/policy.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'mandate-retry-sequencer' }),
    AuthModule,
    RazorpayModule,
    RecoveryModule,
    PolicyModule,
  ],
  controllers: [MandatesController],
  providers: [
    MandatesService,
    MandateRetrySequencerService,
    MandateRetrySequencerProcessor,
  ],
  exports: [MandatesService],
})
export class MandatesModule {}
