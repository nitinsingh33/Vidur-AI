import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class RecoveryQueueService {
  constructor(
    @InjectQueue('recovery')
    private readonly recoveryQueue: Queue,
  ) {}

  async addRecoveryJob(recoveryCaseId: string) {
    return this.recoveryQueue.add('recover', {
      recoveryCaseId,
    });
  }
}
