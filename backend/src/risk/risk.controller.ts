import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RiskService } from './risk.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('risk')
@UseGuards(JwtAuthGuard)
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Post('assess/:paymentId')
  assessPayment(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('paymentId', new ParseUUIDPipe())
    paymentId: string,
  ) {
    return this.riskService.assessPayment(paymentId, request.user.merchantId);
  }

  @Post('assess-order/:orderId')
  assessOrderAbandonment(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('orderId', new ParseUUIDPipe())
    orderId: string,
  ) {
    return this.riskService.assessOrderAbandonment(
      orderId,
      request.user.merchantId,
    );
  }

  @Post('assess-invoice/:invoiceId')
  assessInvoiceOverdue(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('invoiceId', new ParseUUIDPipe())
    invoiceId: string,
  ) {
    return this.riskService.assessInvoiceOverdue(
      invoiceId,
      request.user.merchantId,
    );
  }

  @Post('assess-subscription/:subscriptionId')
  assessSubscriptionFailure(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('subscriptionId', new ParseUUIDPipe())
    subscriptionId: string,
  ) {
    return this.riskService.assessSubscriptionFailure(
      subscriptionId,
      request.user.merchantId,
    );
  }
}
