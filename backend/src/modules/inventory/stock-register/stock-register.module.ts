import { Module } from '@nestjs/common';
import { StockRegisterService } from './stock-register.service';
import {
  StockRegisterController,
  StockRegisterAliasController,
} from './stock-register.controller';

@Module({
  controllers: [StockRegisterController, StockRegisterAliasController],
  providers: [StockRegisterService],
  exports: [StockRegisterService],
})
export class StockRegisterModule {}
