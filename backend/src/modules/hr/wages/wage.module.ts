import { Module } from '@nestjs/common';
import { WageService } from './wage.service';
import { WageController } from './wage.controller';

@Module({
  controllers: [WageController],
  providers: [WageService],
  exports: [WageService],
})
export class WageModule {}
