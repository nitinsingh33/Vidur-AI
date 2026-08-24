import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

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