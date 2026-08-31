import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * The merchant records this after a genuine conversation with the customer
 * about an overdue receivable (see PromiseToPayService.create) — there is no
 * predefined/seeded promise anywhere in the system.
 */
export class CreatePromiseDto {
  @IsUUID()
  recoveryCaseId: string;

  @IsNumber()
  @IsPositive()
  promisedAmount: number;

  @IsDateString()
  promisedDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
