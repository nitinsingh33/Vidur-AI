import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { EscalationService } from './escalation.service';

@Controller('escalation')
export class EscalationController {
  constructor(
    private readonly escalationService: EscalationService,
  ) {}

  @Post('cases/:recoveryCaseId')
  escalate(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
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