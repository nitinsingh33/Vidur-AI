import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { MlService } from './ml.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ml')
@UseGuards(JwtAuthGuard)
export class MlController {
  constructor(private readonly mlService: MlService) {}

  @Post('predict-recovery')
  predictRecovery(@Body() input: Record<string, unknown>) {
    return this.mlService.predictRecovery(input as any);
  }
}
