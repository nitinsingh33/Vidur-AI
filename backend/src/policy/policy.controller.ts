import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PolicyService } from './policy.service';

@Controller('policies')
export class PolicyController {
  constructor(
    private readonly policyService: PolicyService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.policyService.findAllForMerchant(request.user.merchantId);
  }

  @Post('check/:recoveryCaseId/:actionType')
  checkPolicy(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
    @Param('actionType') actionType: string,
  ) {
    return this.policyService.checkForRecoveryCase(
      recoveryCaseId,
      actionType,
    );
  }
}