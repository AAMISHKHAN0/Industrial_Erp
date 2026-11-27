import { Module } from '@nestjs/common';
import { SupplierBillService } from './supplier-bill.service';
import { SupplierBillController } from './supplier-bill.controller';
import { FinanceModule } from '../../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [SupplierBillController],
  providers: [SupplierBillService],
  exports: [SupplierBillService],
})
export class SupplierBillModule {}
