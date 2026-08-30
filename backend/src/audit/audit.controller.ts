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
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Req() request: Request & { user: AuthenticatedUser },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findByMerchant(
      request.user.merchantId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('cases/:recoveryCaseId')
  @UseGuards(JwtAuthGuard)
  findByCase(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
  ) {
    return this.auditService.findByCase(
      recoveryCaseId,
      request.user.merchantId,
    );
  }
}
