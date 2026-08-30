import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class NotificationService {
  private resend: Resend | null = null;

  /**
   * Constructed lazily, on first send, rather than in the constructor.
   * NotificationModule is imported by RecoveryModule (always loaded), so
   * throwing here at DI-construction time would crash the entire backend
   * on boot in any environment missing RESEND_API_KEY, not just email
   * routes.
   */
  private getClient(): Resend {
    if (this.resend) {
      return this.resend;
    }

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new InternalServerErrorException(
        'RESEND_API_KEY is not configured.',
      );
    }

    this.resend = new Resend(apiKey);
    return this.resend;
  }

  async sendRecoveryNotification(to: string, subject: string, message: string) {
    const { data, error } = await this.getClient().emails.send({
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
