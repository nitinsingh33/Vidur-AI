import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CheckoutSweepService } from './checkout-sweep.service';
import { CheckoutSweepProcessor } from './checkout-sweep.processor';
import { CheckoutSweepController } from './checkout-sweep.controller';
import { RiskModule } from '../risk/risk.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'checkout-sweep' }),
    RiskModule,
    AuthModule,
  ],
  controllers: [CheckoutSweepController],
  providers: [CheckoutSweepService, CheckoutSweepProcessor],
  exports: [CheckoutSweepService],
})
export class CheckoutSweepModule {}
