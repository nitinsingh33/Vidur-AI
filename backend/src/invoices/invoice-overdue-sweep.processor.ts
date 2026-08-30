import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InvoiceOverdueSweepService } from './invoice-overdue-sweep.service';

@Processor('invoice-overdue-sweep')
export class InvoiceOverdueSweepProcessor extends WorkerHost {
  constructor(
    private readonly invoiceOverdueSweepService: InvoiceOverdueSweepService,
  ) {
    super();
  }

  process() {
    return this.invoiceOverdueSweepService.sweepOnce();
  }
}
