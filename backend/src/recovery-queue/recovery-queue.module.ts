import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RecoveryQueueService } from './recovery-queue.service';
import { RecoveryQueueProcessor } from './recovery-queue.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'recovery',
    }),
  ],
  providers: [
    RecoveryQueueService,
    RecoveryQueueProcessor,
  ],
  exports: [RecoveryQueueService],
})
export class RecoveryQueueModule {}