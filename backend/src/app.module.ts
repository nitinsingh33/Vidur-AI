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


@Module({
  imports: [
    PrismaModule, 
    PaymentsModule,
    CustomersModule,
    RecoveryCasesModule,
    AnalyticsModule,
    RiskModule,
    RecoveryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
