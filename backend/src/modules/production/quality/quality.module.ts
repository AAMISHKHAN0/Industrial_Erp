import { Module } from '@nestjs/common';
import { QualityCheckController } from './quality.controller';
import { QualityCheckService } from './quality.service';

@Module({
  controllers: [QualityCheckController],
  providers: [QualityCheckService],
  exports: [QualityCheckService],
})
export class QualityCheckModule {}
