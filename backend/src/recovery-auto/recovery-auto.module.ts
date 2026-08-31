import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RecoveryModule } from '../recovery/recovery.module';
import { PolicyModule } from '../policy/policy.module';
import { EscalationModule } from '../escalation/escalation.module';
import { MlModule } from '../ml/ml.module';
import { RecoveryAutoOrchestratorService } from './recovery-auto-orchestrator.service';
import { RecoveryAutoRetrySweepService } from './recovery-auto-retry-sweep.service';

/**
 * Deliberately depended-on only in one direction (this module imports
 * RecoveryModule/PolicyModule/EscalationModule/MlModule; none of them import
 * this one) so registering it does not introduce a module cycle. The three
 * call sites that need it (RazorpayWebhookService, CheckoutSweepService,
 * InvoiceOverdueSweepService) resolve RecoveryAutoOrchestratorService lazily
 * via ModuleRef instead of constructor injection, since RecoveryModule
 * already imports RazorpayModule — a constructor-injected edge from
 * RazorpayModule back to this module would cycle back through RecoveryModule.
 */
@Module({
  imports: [
    RecoveryModule,
    PolicyModule,
    EscalationModule,
    MlModule,
    BullModule.registerQueue({ name: 'recovery-auto-retry' }),
  ],
  providers: [RecoveryAutoOrchestratorService, RecoveryAutoRetrySweepService],
  exports: [RecoveryAutoOrchestratorService],
})
export class RecoveryAutoModule {}
