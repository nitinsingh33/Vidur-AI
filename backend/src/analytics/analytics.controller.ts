import {
  Controller,
  Get,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get('revenue-at-risk')
  getRevenueAtRisk(
    @Query('merchantId', new ParseUUIDPipe({ optional: true }))
    merchantId?: string,
  ) {
    return this.analyticsService.getRevenueAtRisk(merchantId);
  }

  @Get('revenue-recovered')
  getRevenueRecovered(
    @Query('merchantId', new ParseUUIDPipe({ optional: true }))
    merchantId?: string,
  ) {
    return this.analyticsService.getRevenueRecovered(merchantId);
  }

  @Get('summary')
  getSummary(
    @Query('merchantId', new ParseUUIDPipe({ optional: true }))
    merchantId?: string,
  ) {
    return this.analyticsService.getSummary(merchantId);
  }
}