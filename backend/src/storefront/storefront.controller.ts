import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { StorefrontService } from './storefront.service';
import { CreateStorefrontOrderDto } from './dto/create-storefront-order.dto';

/**
 * Fully public — no JwtAuthGuard. This is the customer-facing storefront
 * API, not the merchant dashboard. Merchant scoping happens by slug/order id
 * rather than a bearer token, the same "ownership-obscuring 404" convention
 * used elsewhere in this codebase (see RecoveryCasesController).
 */
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get(':slug')
  getStorefront(@Param('slug') slug: string) {
    return this.storefrontService.getStorefront(slug);
  }

  @Get(':slug/products/:productId')
  getProduct(
    @Param('slug') slug: string,
    @Param('productId') productId: string,
  ) {
    return this.storefrontService.getProduct(slug, productId);
  }

  @Post(':slug/checkout')
  createOrder(
    @Param('slug') slug: string,
    @Body() dto: CreateStorefrontOrderDto,
  ) {
    return this.storefrontService.createOrder(slug, dto);
  }

  @Post('orders/:orderId/abandon-signal')
  recordAbandonSignal(@Param('orderId') orderId: string) {
    return this.storefrontService.recordAbandonSignal(orderId);
  }

  @Get('orders/:orderId/status')
  getOrderStatus(@Param('orderId') orderId: string) {
    return this.storefrontService.getOrderStatus(orderId);
  }
}
