import { Module } from '@nestjs/common';
import { CustomerModule } from './customer/customer.module';
import { SalesOrderModule } from './sales-order/sales-order.module';
import { SalesInvoiceModule } from './sales-invoice/sales-invoice.module';
import { SalesDispatchModule } from './sales-dispatch/sales-dispatch.module';
import { CustomerReceiptModule } from './customer-receipt/customer-receipt.module';
import { CustomerStatementModule } from './customer-statement/customer-statement.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductionModule } from '../production/production.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    CustomerModule,
    SalesOrderModule,
    SalesInvoiceModule,
    SalesDispatchModule,
    CustomerReceiptModule,
    CustomerStatementModule,
    InventoryModule,
    ProductionModule,
    FinanceModule,
  ],
  exports: [
    CustomerModule,
    SalesOrderModule,
    SalesInvoiceModule,
    SalesDispatchModule,
    CustomerReceiptModule,
    CustomerStatementModule,
  ],
})
export class SalesModule {}

