import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { RazorpayWebhookService } from './razorpay-webhook.service';

/**
 * Public surface: Razorpay calls this directly, with no merchant JWT, so it
 * carries no JwtAuthGuard. Authenticity is instead established entirely by
 * verifying X-Razorpay-Signature against the raw request body (see
 * RazorpayWebhookService / RazorpayService.verifyWebhookSignature).
 */
@Controller('razorpay/webhook')
export class RazorpayWebhookController {
  constructor(private readonly webhookService: RazorpayWebhookService) {}

  /** Shared-account path — Vidur's own sandbox, what FashionKart/demo uses. */
  @Post()
  @HttpCode(HttpStatus.OK)
  handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Headers('x-razorpay-event-id') eventId: string | undefined,
  ) {
    return this.webhookService.handleWebhook(
      request.rawBody,
      signature,
      eventId,
    );
  }

  /**
   * A merchant who has connected their own Razorpay account points their
   * Razorpay dashboard's webhook URL here instead. `merchantId` is known
   * from the URL itself (not from anything inside the payload), and the
   * signature is verified against *that* merchant's own stored webhook
   * secret — a webhook signed with a different merchant's secret is
   * rejected here regardless of what merchantId is claimed anywhere else.
   */
  @Post('merchant/:merchantId')
  @HttpCode(HttpStatus.OK)
  handleForMerchant(
    @Req() request: RawBodyRequest<Request>,
    @Param('merchantId') merchantId: string,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Headers('x-razorpay-event-id') eventId: string | undefined,
  ) {
    return this.webhookService.handleWebhook(
      request.rawBody,
      signature,
      eventId,
      merchantId,
    );
  }
}
