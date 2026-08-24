import { Controller, Get, Param } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';


@Controller('razorpay')
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