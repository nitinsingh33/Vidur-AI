import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RecoveryLabService } from './recovery-lab.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LaunchScenarioDto } from './dto/launch-scenario.dto';

@Controller('recovery-lab')
@UseGuards(JwtAuthGuard)
export class RecoveryLabController {
  constructor(private readonly recoveryLabService: RecoveryLabService) {}

  @Post('payment-failure')
  launchPaymentFailure(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: LaunchScenarioDto,
  ) {
    return this.recoveryLabService.launchPaymentFailure(
      request.user.merchantId,
      dto,
    );
  }

  @Post('checkout-abandonment')
  launchCheckoutAbandonment(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: LaunchScenarioDto,
  ) {
    return this.recoveryLabService.launchCheckoutAbandonment(
      request.user.merchantId,
      dto,
    );
  }

  @Post('subscription-failure')
  launchSubscriptionFailure(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: LaunchScenarioDto,
  ) {
    return this.recoveryLabService.launchSubscriptionFailure(
      request.user.merchantId,
      dto,
    );
  }

  @Post('invoice-overdue')
  launchInvoiceOverdue(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: LaunchScenarioDto,
  ) {
    return this.recoveryLabService.launchInvoiceOverdue(
      request.user.merchantId,
      dto,
    );
  }

  @Post('mandate-failure')
  launchMandateFailure(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: LaunchScenarioDto,
  ) {
    return this.recoveryLabService.launchMandateFailure(
      request.user.merchantId,
      dto,
    );
  }

  @Post('promise-to-pay')
  launchPromiseToPay(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: LaunchScenarioDto,
  ) {
    return this.recoveryLabService.launchPromiseToPay(
      request.user.merchantId,
      dto,
      request.user.sub,
    );
  }
}
