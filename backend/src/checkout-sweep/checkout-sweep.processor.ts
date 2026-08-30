import { Processor, WorkerHost } from '@nestjs/bullmq';
import { CheckoutSweepService } from './checkout-sweep.service';

@Processor('checkout-sweep')
export class CheckoutSweepProcessor extends WorkerHost {
  constructor(private readonly checkoutSweepService: CheckoutSweepService) {
    super();
  }

  process() {
    return this.checkoutSweepService.sweepOnce();
  }
}
