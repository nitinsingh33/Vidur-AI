import { Module } from '@nestjs/common';
import { SyntheticInvoiceService } from './synthetic-invoice.service';

@Module({
  providers: [SyntheticInvoiceService],
  exports: [SyntheticInvoiceService],
})
export class InvoicesModule {}
