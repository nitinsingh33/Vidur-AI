import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnalyticsModule } from './analytics/analytics.module';
import { CustomersModule } from './customers/customers.module'
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RecoveryCasesModule } from './recovery-cases/recovery-cases.module';
import { RiskModule } from './risk/risk.module';
import { RecoveryModule } from './recovery/recovery.module';
import { MlModule } from './ml/ml.module';
import { PolicyModule } from './policy/policy.module';
import { RazorpayModule } from './razorpay/razorpay.module';
import { NotificationModule } from './notification/notification.module';
import { EscalationModule } from './escalation/escalation.module';
import { BullModule } from '@nestjs/bullmq';
import { RecoveryQueueModule } from './recovery-queue/recovery-queue.module';
import { AuditModule } from './audit/audit.module';
import { RecoveryBatchesModule } from './recovery-batches/recovery-batches.module';
import { MerchantsModule } from './merchants/merchants.module';
import { AuthModule } from './auth/auth.module';


@Module({
  imports: [
    PrismaModule,
    AuditModule,

    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),

    PaymentsModule,
    CustomersModule,
    RecoveryCasesModule,
    AnalyticsModule,
    RiskModule,
    RecoveryModule,
    MlModule,
    PolicyModule,
    RazorpayModule,
    NotificationModule,
    EscalationModule,
    RecoveryQueueModule,
    RecoveryBatchesModule,
    MerchantsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
