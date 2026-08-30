import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AgentOrJwtGuard } from '../auth/agent-or-jwt.guard';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecoveryService } from './recovery.service';

/** Approving/rejecting a spend-affecting action is a finance/admin decision, not an operator one. */
const APPROVAL_ROLES = ['ADMIN', 'FINANCE_MANAGER'];

@Controller('recovery')
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Get('cases/:recoveryCaseId')
  @UseGuards(AgentOrJwtGuard)
  getCase(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
  ) {
    return this.recoveryService.getCaseById(recoveryCaseId);
  }

  @Get('cases/:recoveryCaseId/ml-features')
  @UseGuards(AgentOrJwtGuard)
  getMlFeatures(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
  ) {
    return this.recoveryService.getMlFeatures(recoveryCaseId);
  }

  @Post('cases/:recoveryCaseId/diagnosis')
  @UseGuards(AgentOrJwtGuard)
  recordDiagnosis(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
    @Body()
    body: {
      reasoning: string;
    },
  ) {
    return this.recoveryService.recordDiagnosis(recoveryCaseId, body.reasoning);
  }

  @Post('cases/:recoveryCaseId/strategy')
  @UseGuards(AgentOrJwtGuard)
  createStrategy(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
  ) {
    return this.recoveryService.createStrategyForCase(recoveryCaseId);
  }

  @Post('cases/:recoveryCaseId/execute')
  @UseGuards(AgentOrJwtGuard)
  executeRecoveryAction(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
  ) {
    return this.recoveryService.executeRecoveryAction(recoveryCaseId);
  }

  @Post('cases/:recoveryCaseId/observe')
  @UseGuards(AgentOrJwtGuard)
  observeRecovery(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
  ) {
    return this.recoveryService.observeRecovery(recoveryCaseId);
  }

  @Post('cases/:recoveryCaseId/run-agent')
  @UseGuards(JwtAuthGuard)
  runAgent(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
  ) {
    return this.recoveryService.runAgent(recoveryCaseId);
  }

  @Post('cases/:recoveryCaseId/actions/:actionId/approve')
  @UseGuards(JwtAuthGuard)
  approveAction(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('recoveryCaseId', new ParseUUIDPipe()) recoveryCaseId: string,
    @Param('actionId', new ParseUUIDPipe()) actionId: string,
  ) {
    if (!APPROVAL_ROLES.includes(request.user.role)) {
      throw new ForbiddenException(
        'Only an admin or finance manager can approve a recovery action.',
      );
    }

    return this.recoveryService.approveAction(recoveryCaseId, actionId, {
      id: request.user.sub,
      merchantId: request.user.merchantId,
    });
  }

  @Post('cases/:recoveryCaseId/actions/:actionId/reject')
  @UseGuards(JwtAuthGuard)
  rejectAction(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('recoveryCaseId', new ParseUUIDPipe()) recoveryCaseId: string,
    @Param('actionId', new ParseUUIDPipe()) actionId: string,
  ) {
    if (!APPROVAL_ROLES.includes(request.user.role)) {
      throw new ForbiddenException(
        'Only an admin or finance manager can reject a recovery action.',
      );
    }

    return this.recoveryService.rejectAction(recoveryCaseId, actionId, {
      id: request.user.sub,
      merchantId: request.user.merchantId,
    });
  }
}
