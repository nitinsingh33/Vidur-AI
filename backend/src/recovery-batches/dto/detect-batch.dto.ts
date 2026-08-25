import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class DetectBatchDto {
  @IsUUID()
  merchantId: string;

  /** How many cases to detect per scenario type (failed payment / abandoned checkout / overdue invoice). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limitPerType?: number;
}
