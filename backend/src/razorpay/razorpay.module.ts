import { Module } from '@nestjs/common';
import { RazorpayController } from './razorpay.controller';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { RazorpayService } from './razorpay.service';
import { RazorpayWebhookService } from './razorpay-webhook.service';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { RiskModule } from '../risk/risk.module';
import { EscalationModule } from '../escalation/escalation.module';
import { CredentialEncryptionModule } from '../credential-encryption/credential-encryption.module';

@Module({
  imports: [
    AuthModule,
    PaymentsModule,
    RiskModule,
    EscalationModule,
    CredentialEncryptionModule,
  ],
  controllers: [RazorpayController, RazorpayWebhookController],
  providers: [RazorpayService, RazorpayWebhookService],
  exports: [RazorpayService],
})
export class RazorpayModule {}
