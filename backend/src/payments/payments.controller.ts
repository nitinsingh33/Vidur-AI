import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  /**
   * Lets the frontend poll for the Payment (and its RecoveryCase) that a
   * Razorpay webhook creates asynchronously after a live Test Mode payment
   * fails, using the real Razorpay payment id the client-side Checkout.js
   * failure event already has. Declared before `:id` so it isn't shadowed.
   */
  @Get('by-external-id/:externalId')
  findByExternalId(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('externalId') externalId: string,
  ) {
    return this.paymentsService.findByExternalId(
      request.user.merchantId,
      externalId,
    );
  }

  @Get()
  findAll(
    @Query('merchantId') merchantId?: string,
    @Query('customerId') customerId?: string,
    @Query('orderId') orderId?: string,
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.paymentsService.findAll({
      merchantId,
      customerId,
      orderId,
      status,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.paymentsService.findOne(id);
  }
}
