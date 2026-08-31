import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AgentOrJwtGuard } from '../auth/agent-or-jwt.guard';
import { EscalationService } from './escalation.service';

@Controller('escalation')
@UseGuards(AgentOrJwtGuard)
export class EscalationController {
  constructor(private readonly escalationService: EscalationService) {}

  @Post('cases/:recoveryCaseId')
  escalate(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
    @Body()
    body: {
      reason: string;
    },
  ) {
    return this.escalationService.escalateRecoveryCase(
      recoveryCaseId,
      body.reason,
    );
  }
}
