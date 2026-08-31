import { Processor, WorkerHost } from '@nestjs/bullmq';
import { PromiseToPaySweepService } from './promise-to-pay-sweep.service';

@Processor('promise-to-pay-sweep')
export class PromiseToPaySweepProcessor extends WorkerHost {
  constructor(
    private readonly promiseToPaySweepService: PromiseToPaySweepService,
  ) {
    super();
  }

  process() {
    return this.promiseToPaySweepService.sweepOnce();
  }
}
