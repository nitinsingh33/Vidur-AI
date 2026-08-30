import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AuthenticatedUser,
  JwtAuthGuard,
} from '../auth/jwt-auth.guard';
import { DemoModeGuard } from './demo-mode.guard';
import { DemoService } from './demo.service';
import { TriggerPaymentFailureDto } from './dto/trigger-payment-failure.dto';

/**
 * Demo-only surface for Feature #1 ("detect revenue at risk"). Every route
 * here is authenticated (JwtAuthGuard) and scoped to the caller's own
 * merchantId from the JWT — no merchantId/customerId is ever accepted from
 * the request body, so this cannot mutate another merchant's data.
 */
@Controller('demo')
@UseGuards(JwtAuthGuard, DemoModeGuard)
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('payment-failure')
  triggerPaymentFailure(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: TriggerPaymentFailureDto,
  ) {
    return this.demoService.triggerPaymentFailure(
      request.user.merchantId,
      dto,
    );
  }

  @Post('reset')
  reset(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.demoService.reset(request.user.merchantId);
  }
}
