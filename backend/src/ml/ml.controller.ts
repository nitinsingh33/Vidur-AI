import { Body, Controller, Post } from '@nestjs/common';
import { MlService } from './ml.service';

@Controller('ml')
export class MlController {
  constructor(private readonly mlService: MlService) {}

  @Post('predict-recovery')
  predictRecovery(@Body() input: Record<string, unknown>) {
    return this.mlService.predictRecovery(input as any);
  }
}