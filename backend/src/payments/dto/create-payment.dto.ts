import {
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaymentMethod, PaymentStatus } from '../../generated/prisma/enums';

export class CreatePaymentDto {
  @IsUUID()
  merchantId: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsNumberString()
  amount: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  failureReason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  attemptNumber?: number;

  @IsOptional()
  @IsString()
  externalId?: string;
}
