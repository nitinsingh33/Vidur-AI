import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { PolicyAction } from '../../generated/prisma/enums';

export class UpdatePolicyDto {
  @IsOptional()
  @IsEnum(PolicyAction)
  decision?: PolicyAction;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxRetries?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxContacts?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxAmount?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
