import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  findAll(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.subscriptionsService.findAllForMerchant(
      request.user.merchantId,
    );
  }

  @Post()
  create(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.create(request.user.merchantId, dto);
  }

  @Get(':id')
  findOne(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.subscriptionsService.findOne(id, request.user.merchantId);
  }

  @Delete(':id')
  delete(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (request.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only an ADMIN may delete a subscription.');
    }

    return this.subscriptionsService.delete(id, request.user.merchantId);
  }
}
