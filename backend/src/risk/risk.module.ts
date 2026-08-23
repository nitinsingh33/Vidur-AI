import { Module } from '@nestjs/common';
import { RiskController } from './risk.controller';
import { RiskEngineService } from './risk-engine.service';
import { RiskService } from './risk.service';

@Module({
  controllers: [RiskController],
  providers: [
    RiskEngineService,
    RiskService,
  ],
  exports: [
    RiskEngineService,
    RiskService,
  ],
})
export class RiskModule {}
