import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { PolicyService } from './policy.service';

@Controller('policies')
export class PolicyController {
  constructor(
    private readonly policyService: PolicyService,
  ) {}

  @Post('check/:recoveryCaseId/:actionType')
  checkPolicy(
    @Param(
      'recoveryCaseId',
      new ParseUUIDPipe(),
    )
    recoveryCaseId: string,
    @Param('actionType') actionType: string,
  ) {
    return this.policyService.checkForRecoveryCase(
      recoveryCaseId,
      actionType,
    );
  }
}