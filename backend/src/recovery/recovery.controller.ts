import {
  Body,
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
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
  ) {
    return this.recoveryService.getCaseById(
      recoveryCaseId,
    );
  }

  @Get('cases/:recoveryCaseId/ml-features')
  getMlFeatures(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
  ) {
    return this.recoveryService.getMlFeatures(
      recoveryCaseId,
    );
  }

  @Post('cases/:recoveryCaseId/diagnosis')
  recordDiagnosis(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
    @Body()
    body: {
      reasoning: string;
    },
  ) {
    return this.recoveryService.recordDiagnosis(
      recoveryCaseId,
      body.reasoning,
    );
  }

  @Post('cases/:recoveryCaseId/strategy')
  createStrategy(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
  ) {
    return this.recoveryService.createStrategyForCase(
      recoveryCaseId,
    );
  }

  @Post('cases/:recoveryCaseId/execute')
  executeRecoveryAction(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
  ) {
    return this.recoveryService.executeRecoveryAction(
      recoveryCaseId,
    );
  }

  @Post('cases/:recoveryCaseId/observe')
  observeRecovery(
    @Param(
      'recoveryCaseId',
     new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
  ) {
    return this.recoveryService.observeRecovery(
      recoveryCaseId,
    );
  }

}