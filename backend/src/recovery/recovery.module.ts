import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RecoveryController } from './recovery.controller';
import { RecoveryService } from './recovery.service';
import { RecoveryStrategyService } from './recovery-strategy.service';

@Module({
  imports: [PrismaModule],
  controllers: [RecoveryController],
  providers: [
    RecoveryStrategyService,
    RecoveryService,
  ],
  exports: [
    RecoveryStrategyService,
    RecoveryService,
  ],
})
export class RecoveryModule {}