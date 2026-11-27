import { Module } from '@nestjs/common';
import { CustomerReceiptService } from './customer-receipt.service';
import { CustomerReceiptController } from './customer-receipt.controller';
import { FinanceModule } from '../../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [CustomerReceiptController],
  providers: [CustomerReceiptService],
  exports: [CustomerReceiptService],
})
export class CustomerReceiptModule {}
