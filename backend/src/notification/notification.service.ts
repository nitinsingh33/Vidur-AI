import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class NotificationService {
  private readonly resend: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new InternalServerErrorException(
        'RESEND_API_KEY is not configured.',
      );
    }

    this.resend = new Resend(apiKey);
  }

  async sendRecoveryNotification(
    to: string,
    subject: string,
    message: string,
  ) {
    const { data, error } =
      await this.resend.emails.send({
        from: 'RecoverAI <onboarding@resend.dev>',
        to,
        subject,
        text: message,
      });

    if (error) {
      throw new InternalServerErrorException(
        `Notification delivery failed: ${error.message}`,
      );
    }

    return {
      successful: true,
      provider: 'resend',
      messageId: data?.id ?? null,
    };
  }
}