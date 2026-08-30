import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CustomersService } from './customers.service';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.customersService.findAllForMerchant(request.user.merchantId);
  }

  @Post()
  create(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(request.user.merchantId, dto);
  }

  @Get(':id')
  findOne(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.customersService.findOne(id, request.user.merchantId);
  }
}
