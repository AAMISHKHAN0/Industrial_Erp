import { Module } from '@nestjs/common';
import { DemandNoteModule } from './demand-note/DemandNote.module';
import { PurchaseOrderModule } from './purchase-order/PurchaseOrder.module';
import { GoodsReceivingNoteModule } from './goods-receiving/GoodsReceivingNote.module';
import { VendorQuotationModule } from './vendor-quotation/vendor-quotation.module';
import { VendorModule } from './vendor/vendor.module';
import { PurchaseReturnModule } from './purchase-return/purchase-return.module';
import { SupplierBillModule } from './supplier-bill/supplier-bill.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    DemandNoteModule,
    PurchaseOrderModule,
    GoodsReceivingNoteModule,
    VendorQuotationModule,
    VendorModule,
    PurchaseReturnModule,
    SupplierBillModule,
    InventoryModule,
    FinanceModule,
  ],
  exports: [
    DemandNoteModule,
    PurchaseOrderModule,
    GoodsReceivingNoteModule,
    VendorQuotationModule,
    VendorModule,
    PurchaseReturnModule,
    SupplierBillModule,
  ],
})
export class PurchaseModule {}
