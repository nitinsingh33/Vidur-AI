import { Processor, WorkerHost } from '@nestjs/bullmq';
import { MandateRetrySequencerService } from './mandate-retry-sequencer.service';

@Processor('mandate-retry-sequencer')
export class MandateRetrySequencerProcessor extends WorkerHost {
  constructor(private readonly sequencerService: MandateRetrySequencerService) {
    super();
  }

  process() {
    return this.sequencerService.sweepOnce();
  }
}
