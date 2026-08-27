import { Module } from '@nestjs/common';

import { EscalationController } from './escalation.controller';
import { EscalationService } from './escalation.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EscalationController],
  providers: [EscalationService],
  exports: [EscalationService],
})
export class EscalationModule {}