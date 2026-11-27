import { Global, Module } from '@nestjs/common';
import { AccountModule } from './account/account.module';
import { JournalEntryModule } from './journal-entry/journal-entry.module';
import { StatutoryModule } from './statutory/statutory.module';
import { PaymentModule } from './payment/payment.module';
import { ExpenseModule } from './expense/expense.module';
import { FinanceIntegrationService } from './services/finance-integration.service';
import { PostingService } from './services/posting.service';

@Global()
@Module({
  imports: [
    AccountModule,
    JournalEntryModule,
    StatutoryModule,
    PaymentModule,
    ExpenseModule,
  ],
  providers: [FinanceIntegrationService, PostingService],
  exports: [
    AccountModule,
    JournalEntryModule,
    StatutoryModule,
    PaymentModule,
    ExpenseModule,
    FinanceIntegrationService,
    PostingService,
  ],
})
export class FinanceModule {}
