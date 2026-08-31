import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoiceOverdueSweepService } from './invoice-overdue-sweep.service';
import { InvoiceOverdueSweepProcessor } from './invoice-overdue-sweep.processor';
import { RiskModule } from '../risk/risk.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'invoice-overdue-sweep' }),
    RiskModule,
    AuthModule,
  ],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoiceOverdueSweepService,
    InvoiceOverdueSweepProcessor,
  ],
  exports: [InvoicesService, InvoiceOverdueSweepService],
})
export class InvoicesModule {}
