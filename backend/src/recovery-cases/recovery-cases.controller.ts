import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  RecoveryCaseStatus,
  RiskLevel,
} from '../generated/prisma/enums';
import { RecoveryCasesService } from './recovery-cases.service';

@Controller('recovery-cases')
export class RecoveryCasesController {
  constructor(
    private readonly recoveryCasesService: RecoveryCasesService,
  ) {}

  @Get()
  findAll(
    @Query('merchantId') merchantId?: string,
    @Query('status') status?: RecoveryCaseStatus,
    @Query('riskLevel') riskLevel?: RiskLevel,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.recoveryCasesService.findAll({
      merchantId,
      status,
      riskLevel,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.recoveryCasesService.findOne(id);
  }
}