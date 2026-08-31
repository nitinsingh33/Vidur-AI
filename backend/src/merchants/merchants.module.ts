import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CredentialEncryptionModule } from '../credential-encryption/credential-encryption.module';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';

@Module({
  imports: [AuthModule, CredentialEncryptionModule, RazorpayModule],
  controllers: [MerchantsController],
  providers: [MerchantsService],
})
export class MerchantsModule {}
