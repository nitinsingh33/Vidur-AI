import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgentOrJwtGuard } from '../auth/agent-or-jwt.guard';
import { PolicyService } from './policy.service';
import { UpdatePolicyDto } from './dto/update-policy.dto';

@Controller('policies')
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.policyService.findAllForMerchant(request.user.merchantId);
  }

  /** Changing a guardrail (e.g. requiring approval on an action type) is an admin-only decision. */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    if (request.user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only an admin can change recovery policies.',
      );
    }

    return this.policyService.update(request.user.merchantId, id, dto, {
      id: request.user.sub,
    });
  }

  /**
   * Backfills any newly-introduced DEFAULT_POLICIES entry (e.g.
   * SEND_VOICE_MESSAGE) for merchants that signed up before it existed.
   * Admin-only, additive-only, and idempotent — see
   * PolicyService.syncDefaultPolicies.
   */
  @Post('sync-defaults')
  @UseGuards(JwtAuthGuard)
  syncDefaults(@Req() request: Request & { user: AuthenticatedUser }) {
    if (request.user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only an admin can sync default recovery policies.',
      );
    }

    return this.policyService.syncDefaultPolicies(request.user.merchantId, {
      id: request.user.sub,
    });
  }

  @Post('check/:recoveryCaseId/:actionType')
  @UseGuards(AgentOrJwtGuard)
  checkPolicy(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
    @Param('actionType') actionType: string,
  ) {
    return this.policyService.checkForRecoveryCase(recoveryCaseId, actionType);
  }
}
