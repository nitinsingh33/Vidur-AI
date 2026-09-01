import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { RiskModule } from '../risk/risk.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { DemoModeGuard } from './demo-mode.guard';
import { FashionKartDemoResetService } from './fashionkart-demo-reset.service';

@Module({
  imports: [AuthModule, PaymentsModule, RiskModule],
  controllers: [DemoController],
  providers: [DemoService, DemoModeGuard, FashionKartDemoResetService],
})
export class DemoModule {}
