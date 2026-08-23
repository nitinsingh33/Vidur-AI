import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { RecoveryService } from './recovery.service';

@Controller('recovery')
export class RecoveryController {
  constructor(
    private readonly recoveryService: RecoveryService,
  ) {}

  @Post('cases/:recoveryCaseId/strategy')
  createStrategy(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
  ) {
    return this.recoveryService.createStrategyForCase(
      recoveryCaseId,
    );
  }
}