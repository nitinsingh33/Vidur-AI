import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

/**
 * Every field is optional — a merchant can just click "Launch" and get a
 * realistic default, or override the amount/customer name shown in the
 * resulting case. None of these fields are ever used to claim a recovery
 * happened; they only shape the real record the scenario creates.
 */
export class LaunchScenarioDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  customerName?: string;
}
