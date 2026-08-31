import { Module } from '@nestjs/common';
import { RiskController } from './risk.controller';
import { RiskEngineService } from './risk-engine.service';
import { RiskService } from './risk.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RiskController],
  providers: [RiskEngineService, RiskService],
  exports: [RiskEngineService, RiskService],
})
export class RiskModule {}
