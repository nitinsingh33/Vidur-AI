import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { InvoicesService } from './invoices.service';
import { InvoiceOverdueSweepService } from './invoice-overdue-sweep.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly sweepService: InvoiceOverdueSweepService,
  ) {}

  @Get()
  findAll(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.invoicesService.findAllForMerchant(request.user.merchantId);
  }

  @Post()
  create(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(request.user.merchantId, dto);
  }

  @Get(':id')
  findOne(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.invoicesService.findOne(id, request.user.merchantId);
  }

  @Patch(':id/mark-paid')
  markPaid(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.invoicesService.markPaid(id, request.user.merchantId, {
      id: request.user.sub,
    });
  }

  /** Runs the same sweep the scheduled job runs, scoped to the caller's merchant. */
  @Post('sweep-overdue')
  runSweep(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.sweepService.sweepOnce(request.user.merchantId);
  }
}
