import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { MerchantsService } from './merchants.service';

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get()
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
}
