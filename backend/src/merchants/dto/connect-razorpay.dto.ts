import { IsString, MinLength } from 'class-validator';

export class ConnectRazorpayDto {
  @IsString()
  @MinLength(1)
  keyId: string;

  @IsString()
  @MinLength(1)
  keySecret: string;

  @IsString()
  @MinLength(1)
  webhookSecret: string;
}
