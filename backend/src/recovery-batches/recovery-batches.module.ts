import { Module } from '@nestjs/common';
import { RecoveryBatchesController } from './recovery-batches.controller';
import { RecoveryBatchesService } from './recovery-batches.service';
import { RiskModule } from '../risk/risk.module';
import { RecoveryQueueModule } from '../recovery-queue/recovery-queue.module';

@Module({
  imports: [RiskModule, RecoveryQueueModule],
  controllers: [RecoveryBatchesController],
  providers: [RecoveryBatchesService],
})
export class RecoveryBatchesModule {}
