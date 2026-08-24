import {
  Controller,
  Get,
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

  @Get('cases/:recoveryCaseId')
  getCase(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
  ) {
    return this.recoveryService.getCaseById(
      recoveryCaseId,
    );
  }

  @Get('cases/:recoveryCaseId/ml-features')
  getMlFeatures(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
  ) {
    return this.recoveryService.getMlFeatures(
      recoveryCaseId,
    );
  }

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