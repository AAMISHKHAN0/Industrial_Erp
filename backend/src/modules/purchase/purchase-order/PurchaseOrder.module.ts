import { Module } from '@nestjs/common';
import { PurchaseOrderController } from './PurchaseOrder.controller';
import { PurchaseOrderService } from './PurchaseOrder.service';

@Module({
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService],
  exports: [PurchaseOrderService],
})
export class PurchaseOrderModule {}
