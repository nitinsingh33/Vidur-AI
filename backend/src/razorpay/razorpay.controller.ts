import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';


@Controller('razorpay')
@UseGuards(JwtAuthGuard)
export class RazorpayController {
  constructor(
    private readonly razorpayService: RazorpayService,
  ) {}

  @Get('orders/:orderId')
  getOrders(
    @Param('orderId') orderId: string,
  ) {
    return this.razorpayService.getOrder(orderId);
  }
}