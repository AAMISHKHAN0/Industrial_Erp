import { Module } from '@nestjs/common';
import { CustomerStatementService } from './customer-statement.service';
import { CustomerStatementController } from './customer-statement.controller';

@Module({
  controllers: [CustomerStatementController],
  providers: [CustomerStatementService],
  exports: [CustomerStatementService],
})
export class CustomerStatementModule {}
