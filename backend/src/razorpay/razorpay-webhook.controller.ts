import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
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
}
