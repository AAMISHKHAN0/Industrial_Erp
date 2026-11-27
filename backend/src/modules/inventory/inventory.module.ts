import { Global, Module } from '@nestjs/common';
import { ItemModule } from './item/Item.module';
import { CategoryModule } from './category/category.module';
import { UnitModule } from './unit/unit.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { MaterialIssueModule } from './material-issue/material-issue.module';
import { StockRegisterModule } from './stock-register/stock-register.module';
import { StockService } from './services/stock.service';
import { StockController } from './stock.controller';

@Global()
@Module({
  imports: [
    ItemModule,
    CategoryModule,
    UnitModule,
    WarehouseModule,
    MaterialIssueModule,
    StockRegisterModule,
  ],
  controllers: [StockController],
  providers: [StockService],
  exports: [
    ItemModule,
    CategoryModule,
    UnitModule,
    WarehouseModule,
    MaterialIssueModule,
    StockRegisterModule,
    StockService,
  ],
})
export class InventoryModule {}
