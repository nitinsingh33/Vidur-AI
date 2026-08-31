import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RecoveryBatchesService } from './recovery-batches.service';
import { DetectBatchDto } from './dto/detect-batch.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('recovery-batches')
@UseGuards(JwtAuthGuard)
export class RecoveryBatchesController {
  constructor(
    private readonly recoveryBatchesService: RecoveryBatchesService,
  ) {}

  @Post('detect')
  detectBatch(@Body() dto: DetectBatchDto) {
    return this.recoveryBatchesService.detectBatch(dto);
  }

  @Post(':batchId/run')
  runBatch(@Param('batchId', new ParseUUIDPipe()) batchId: string) {
    return this.recoveryBatchesService.runBatch(batchId);
  }

  @Get(':batchId')
  getBatchStatus(@Param('batchId', new ParseUUIDPipe()) batchId: string) {
    return this.recoveryBatchesService.getBatchStatus(batchId);
  }
}
