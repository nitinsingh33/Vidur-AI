import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { ConnectRazorpayDto } from './dto/connect-razorpay.dto';
import { MerchantsService } from './merchants.service';

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.merchantsService.findAll();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMe(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.merchantsService.findOne(request.user.merchantId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: UpdateMerchantDto,
  ) {
    return this.merchantsService.update(request.user.merchantId, dto);
  }

  @Post('me/razorpay-credentials')
  @UseGuards(JwtAuthGuard)
  connectRazorpay(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: ConnectRazorpayDto,
  ) {
    return this.merchantsService.connectRazorpay(
      request.user.merchantId,
      { id: request.user.sub, role: request.user.role },
      dto,
    );
  }

  @Delete('me/razorpay-credentials')
  @UseGuards(JwtAuthGuard)
  disconnectRazorpay(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.merchantsService.disconnectRazorpay(request.user.merchantId, {
      id: request.user.sub,
      role: request.user.role,
    });
  }
}
