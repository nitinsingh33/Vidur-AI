import { Module } from '@nestjs/common';
import { RecoveryCasesController } from './recovery-cases.controller';
import { RecoveryCasesService } from './recovery-cases.service';

@Module({
  controllers: [RecoveryCasesController],
  providers: [RecoveryCasesService],
})
export class RecoveryCasesModule {}