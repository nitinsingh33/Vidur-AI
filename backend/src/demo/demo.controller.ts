import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DemoModeGuard } from './demo-mode.guard';
import { DemoService } from './demo.service';
import { FashionKartDemoResetService } from './fashionkart-demo-reset.service';
import { TriggerPaymentFailureDto } from './dto/trigger-payment-failure.dto';

/**
 * Demo-only surface for Feature #1 ("detect revenue at risk"). Every route
 * here is authenticated (JwtAuthGuard) and scoped to the caller's own
 * merchantId from the JWT — no merchantId/customerId is ever accepted from
 * the request body, so this cannot mutate another merchant's data.
 *
 * DemoModeGuard additionally blocks every route here in production unless
 * DEMO_MODE=true is explicitly set — reset-fashionkart included, so it can
 * never run against production by accident.
 */
@Controller('demo')
@UseGuards(JwtAuthGuard, DemoModeGuard)
export class DemoController {
  constructor(
    private readonly demoService: DemoService,
    private readonly fashionKartDemoResetService: FashionKartDemoResetService,
  ) {}

  @Post('payment-failure')
  triggerPaymentFailure(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: TriggerPaymentFailureDto,
  ) {
    return this.demoService.triggerPaymentFailure(request.user.merchantId, dto);
  }

  @Post('reset')
  reset(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.demoService.reset(request.user.merchantId);
  }

  /**
   * The safe, scoped reset — see FashionKartDemoResetService's own doc
   * comment for exactly what it deletes and why. ADMIN-only in addition to
   * the guards above: an OPERATOR/FINANCE_MANAGER can view demo pages but
   * must not be able to trigger a destructive reset.
   */
  @Post('reset-fashionkart')
  resetFashionKart(@Req() request: Request & { user: AuthenticatedUser }) {
    if (request.user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only an ADMIN may reset FashionKart demo data.',
      );
    }

    return this.fashionKartDemoResetService.reset(request.user.merchantId, {
      id: request.user.sub,
    });
  }
}
