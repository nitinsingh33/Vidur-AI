import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('recovery')
  sendRecoveryNotification(
    @Body()
    body: {
      to: string;
      subject: string;
      message: string;
    },
  ) {
    return this.notificationService.sendRecoveryNotification(
      body.to,
      body.subject,
      body.message,
    );
  }
}
