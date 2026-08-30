import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnalyticsModule } from './analytics/analytics.module';
import { CustomersModule } from './customers/customers.module';
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
import { DemoModule } from './demo/demo.module';
import { CheckoutSweepModule } from './checkout-sweep/checkout-sweep.module';
import { InvoicesModule } from './invoices/invoices.module';

/**
 * Local dev has no REDIS_URL and just talks to the Redis container on
 * localhost. A managed Redis (e.g. Upstash) hands out a rediss:// URL,
 * which BullMQ's ioredis connection needs `tls: {}` to actually use.
 */
function buildRedisConnection() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return {
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: Number(url.port),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    // Required by BullMQ for any connection used by a Worker: without these,
    // ioredis's default retry ceiling gets exhausted against a proxied/managed
    // Redis (e.g. Upstash) that periodically drops idle connections, and the
    // resulting errors surface as unhandled ECONNRESET/EPIPE crashes instead
    // of a graceful reconnect.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

@Module({
  imports: [
    PrismaModule,
    AuditModule,

    BullModule.forRoot({
      connection: buildRedisConnection(),
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
    DemoModule,
    CheckoutSweepModule,
    InvoicesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
