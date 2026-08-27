import { Module } from '@nestjs/common';
import { RecoveryCasesController } from './recovery-cases.controller';
import { RecoveryCasesService } from './recovery-cases.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RecoveryCasesController],
  providers: [RecoveryCasesService],
})
export class RecoveryCasesModule {}