import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue-at-risk')
  getRevenueAtRisk(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.analyticsService.getRevenueAtRisk(request.user.merchantId);
  }

  @Get('revenue-recovered')
  getRevenueRecovered(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.analyticsService.getRevenueRecovered(request.user.merchantId);
  }

  @Get('summary')
  getSummary(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.analyticsService.getSummary(request.user.merchantId);
  }
}
