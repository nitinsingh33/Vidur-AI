import {
  Body,
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
import { PromiseToPayService } from './promise-to-pay.service';
import { PromiseToPaySweepService } from './promise-to-pay-sweep.service';
import { CreatePromiseDto } from './dto/create-promise.dto';

@Controller('promises')
@UseGuards(JwtAuthGuard)
export class PromiseToPayController {
  constructor(
    private readonly promiseToPayService: PromiseToPayService,
    private readonly sweepService: PromiseToPaySweepService,
  ) {}

  @Get()
  findAll(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.promiseToPayService.findAllForMerchant(
      request.user.merchantId,
    );
  }

  @Get(':id')
  findOne(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.promiseToPayService.findOne(id, request.user.merchantId);
  }

  @Post()
  create(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreatePromiseDto,
  ) {
    return this.promiseToPayService.create(request.user.merchantId, dto, {
      id: request.user.sub,
    });
  }

  /** Runs the same verification sweep the scheduled job runs, scoped to the caller's merchant. */
  @Post('sweep-now')
  runSweep(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.sweepService.sweepOnce(request.user.merchantId);
  }
}
