import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateMandateDto {
  @IsUUID()
  customerId: string;

  @IsNumber()
  @IsPositive()
  maxAmount: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsIn(['upi', 'emandate'])
  method?: 'upi' | 'emandate';

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly', 'yearly', 'as_presented'])
  frequency?: string;

  /** How many months out the mandate authorization should be valid for. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  validForMonths?: number;
}
