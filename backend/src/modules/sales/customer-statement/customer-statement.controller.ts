import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/strategies/supabase.strategy';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerStatementService } from './customer-statement.service';

@ApiTags('Sales - Customer Statements & AR Aging')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('sales/customer-statements')
export class CustomerStatementController {
  constructor(private readonly service: CustomerStatementService) {}

  @Get('aging')
  getArAging(@Query('asOfDate') asOfDate?: string) {
    return this.service.getArAging(asOfDate);
  }

  @Get(':customerId')
  getCustomerStatement(
    @Param('customerId') customerId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getCustomerStatement(customerId, startDate, endDate);
  }
}
