import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckoutSweepService } from './checkout-sweep.service';

@Controller('checkout-sweep')
@UseGuards(JwtAuthGuard)
export class CheckoutSweepController {
  constructor(private readonly checkoutSweepService: CheckoutSweepService) {}

  /**
   * Runs the same sweep the scheduled job runs, scoped to the caller's
   * merchant — lets a merchant (or a judge in a demo) see checkout-drop-off
   * detection happen immediately instead of waiting for the next interval.
   */
  @Post('run')
  run(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.checkoutSweepService.sweepOnce(request.user.merchantId);
  }
}
