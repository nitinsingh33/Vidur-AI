import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RecoveryCaseStatus, RiskLevel } from '../generated/prisma/enums';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecoveryCasesService } from './recovery-cases.service';

@Controller('recovery-cases')
@UseGuards(JwtAuthGuard)
export class RecoveryCasesController {
  constructor(private readonly recoveryCasesService: RecoveryCasesService) {}

  @Get()
  findAll(
    @Req() request: Request & { user: AuthenticatedUser },
    @Query('status') status?: RecoveryCaseStatus,
    @Query('riskLevel') riskLevel?: RiskLevel,
    @Query('rootCause') rootCause?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.recoveryCasesService.findAll({
      merchantId: request.user.merchantId,
      status,
      riskLevel,
      rootCause,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  findOne(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.recoveryCasesService.findOne(id, request.user.merchantId);
  }
}
