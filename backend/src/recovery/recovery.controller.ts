import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AgentOrJwtGuard } from '../auth/agent-or-jwt.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecoveryService } from './recovery.service';

@Controller('recovery')
export class RecoveryController {
  constructor(
    private readonly recoveryService: RecoveryService,
  ) {}

  @Get('cases/:recoveryCaseId')
  @UseGuards(AgentOrJwtGuard)
  getCase(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
  ) {
    return this.recoveryService.getCaseById(
      recoveryCaseId,
    );
  }

  @Get('cases/:recoveryCaseId/ml-features')
  @UseGuards(AgentOrJwtGuard)
  getMlFeatures(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
  ) {
    return this.recoveryService.getMlFeatures(
      recoveryCaseId,
    );
  }

  @Post('cases/:recoveryCaseId/diagnosis')
  @UseGuards(AgentOrJwtGuard)
  recordDiagnosis(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
    @Body()
    body: {
      reasoning: string;
    },
  ) {
    return this.recoveryService.recordDiagnosis(
      recoveryCaseId,
      body.reasoning,
    );
  }

  @Post('cases/:recoveryCaseId/strategy')
  @UseGuards(AgentOrJwtGuard)
  createStrategy(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
  ) {
    return this.recoveryService.createStrategyForCase(
      recoveryCaseId,
    );
  }

  @Post('cases/:recoveryCaseId/execute')
  @UseGuards(AgentOrJwtGuard)
  executeRecoveryAction(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
  ) {
    return this.recoveryService.executeRecoveryAction(
      recoveryCaseId,
    );
  }

  @Post('cases/:recoveryCaseId/observe')
  @UseGuards(AgentOrJwtGuard)
  observeRecovery(
    @Param(
      'recoveryCaseId',
     new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
  ) {
    return this.recoveryService.observeRecovery(
      recoveryCaseId,
    );
  }

  @Post('cases/:recoveryCaseId/run-agent')
  @UseGuards(JwtAuthGuard)
  runAgent(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
  ) {
    return this.recoveryService.runAgent(
      recoveryCaseId,
    );
  }

}