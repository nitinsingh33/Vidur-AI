import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RazorpayService } from './razorpay.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('razorpay')
@UseGuards(JwtAuthGuard)
export class RazorpayController {
  constructor(private readonly razorpayService: RazorpayService) {}

  @Get('orders/:orderId')
  getOrders(@Param('orderId') orderId: string) {
    return this.razorpayService.getOrder(orderId);
  }

  /**
   * Creates a real Razorpay Test/Live Mode order for the caller's merchant
   * so the frontend can open Checkout.js against it. This is the entry
   * point for the real payment-failure detection flow (see
   * RazorpayWebhookController for what happens after Razorpay reports the
   * attempt failed).
   */
  @Post('checkout')
  createCheckout(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.razorpayService.createCheckoutOrder({
      merchantId: request.user.merchantId,
      amount: dto.amount,
      customerName: dto.customerName,
    });
  }
}
