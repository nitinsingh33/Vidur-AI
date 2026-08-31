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

  /**
   * Promise-to-Pay scenario only: how many minutes from now the promised
   * date should be — a fast local demo path so a judge doesn't have to wait
   * days for the real verification sweep to become relevant. Positive means
   * the promise isn't due yet; zero or negative lets it be resolved
   * immediately by "Run sweep now". The verification logic itself
   * (PromiseToPaySweepService) is completely unmodified either way.
   */
  @IsOptional()
  @IsNumber()
  promisedInMinutes?: number;
}
