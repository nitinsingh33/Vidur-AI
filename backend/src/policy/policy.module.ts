import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { PolicyController } from './policy.controller';
import { PolicyService } from './policy.service';

@Module({
  imports: [PrismaModule],
  controllers: [PolicyController],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}