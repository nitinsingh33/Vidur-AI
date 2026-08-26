import { IsString, MinLength } from 'class-validator';

export class UpdateMerchantDto {
  @IsString()
  @MinLength(2)
  name: string;
}
