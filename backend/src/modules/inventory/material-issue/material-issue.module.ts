import { Module } from '@nestjs/common';
import { MaterialIssueService } from './material-issue.service';
import { MaterialIssueController } from './material-issue.controller';
import { FinanceModule } from '../../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [MaterialIssueController],
  providers: [MaterialIssueService],
  exports: [MaterialIssueService],
})
export class MaterialIssueModule {}
