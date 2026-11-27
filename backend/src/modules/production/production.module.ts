import { Module } from '@nestjs/common';
import { BomModule } from './bom/bom.module';
import { ProductionOrderModule } from './production-order/production-order.module';
import { QualityCheckModule } from './quality/quality.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    BomModule,
    ProductionOrderModule,
    QualityCheckModule,
    InventoryModule,
    FinanceModule,
  ],
  exports: [BomModule, ProductionOrderModule, QualityCheckModule],
})
export class ProductionModule {}
