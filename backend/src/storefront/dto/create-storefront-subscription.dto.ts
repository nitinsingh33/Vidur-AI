import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { StorefrontCustomerDto } from './create-storefront-order.dto';

/**
 * No amount/plan field on purpose — FashionKart Plus is a single fixed
 * membership tier priced server-side (StorefrontService.createSubscription),
 * the same "never trust a client-supplied amount" rule the one-off checkout
 * DTO already follows.
 */
export class CreateStorefrontSubscriptionDto {
  @ValidateNested()
  @Type(() => StorefrontCustomerDto)
  customer: StorefrontCustomerDto;
}
