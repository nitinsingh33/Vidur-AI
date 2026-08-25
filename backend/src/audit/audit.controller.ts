import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('cases/:recoveryCaseId')
  findByCase(
    @Param('recoveryCaseId', new ParseUUIDPipe())
    recoveryCaseId: string,
  ) {
    return this.auditService.findByCase(recoveryCaseId);
  }
}
