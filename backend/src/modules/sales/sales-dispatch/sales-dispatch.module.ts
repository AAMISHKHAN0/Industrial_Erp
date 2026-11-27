import { Module } from '@nestjs/common';
import { SalesDispatchService } from './sales-dispatch.service';
import { SalesDispatchController } from './sales-dispatch.controller';
import { FinanceModule } from '../../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [SalesDispatchController],
  providers: [SalesDispatchService],
  exports: [SalesDispatchService],
})
export class SalesDispatchModule {}
