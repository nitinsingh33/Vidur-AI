import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { RiskService } from './risk.service';

@Controller('risk')
export class RiskController {
  constructor(
    private readonly riskService: RiskService,
  ) {}

  @Post('assess/:paymentId')
  assessPayment(
    @Param('paymentId', new ParseUUIDPipe())
    paymentId: string,
  ) {
    return this.riskService.assessPayment(paymentId);
  }
}