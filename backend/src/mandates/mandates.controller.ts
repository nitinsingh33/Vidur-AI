import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { MandatesService } from './mandates.service';
import { MandateRetrySequencerService } from './mandate-retry-sequencer.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMandateDto } from './dto/create-mandate.dto';

@Controller('mandates')
@UseGuards(JwtAuthGuard)
export class MandatesController {
  constructor(
    private readonly mandatesService: MandatesService,
    private readonly sequencerService: MandateRetrySequencerService,
  ) {}

  @Get()
  findAll(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.mandatesService.findAllForMerchant(request.user.merchantId);
  }

  @Post()
  create(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreateMandateDto,
  ) {
    return this.mandatesService.create(request.user.merchantId, dto);
  }

  @Get(':id')
  findOne(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.mandatesService.findOne(id, request.user.merchantId);
  }

  /** Runs the same throttled auto-retry sweep the scheduled job runs, scoped to the caller's merchant. */
  @Post('run-retry-sequencer')
  runSequencer(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.sequencerService.sweepOnce(request.user.merchantId);
  }

  @Delete(':id')
  delete(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (request.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only an ADMIN may delete a mandate.');
    }

    return this.mandatesService.delete(id, request.user.merchantId);
  }
}
