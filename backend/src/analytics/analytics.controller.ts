import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
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

  @Get('payment-health')
  getPaymentHealth(
    @Req() request: Request & { user: AuthenticatedUser },
    @Query('days') days?: string,
  ) {
    const parsedDays = Number(days);
    return this.analyticsService.getPaymentHealth(
      request.user.merchantId,
      Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : undefined,
    );
  }

  @Get('recovery-funnel')
  getRecoveryFunnel(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.analyticsService.getRecoveryFunnel(request.user.merchantId);
  }

  @Get('risk-signal-breakdown')
  getRiskSignalBreakdown(
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.analyticsService.getRiskSignalBreakdown(
      request.user.merchantId,
    );
  }
}
