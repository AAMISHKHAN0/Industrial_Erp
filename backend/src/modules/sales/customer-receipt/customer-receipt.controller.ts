import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/strategies/supabase.strategy';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerReceiptService } from './customer-receipt.service';
import { CreateCustomerReceiptDto } from './dto/customer-receipt.dto';

@ApiTags('Sales - Customer Receipts')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller(['sales/receipts', 'sales/customer-receipts'])
export class CustomerReceiptController {
  constructor(private readonly service: CustomerReceiptService) {}

  @Post()
  create(@Body() dto: CreateCustomerReceiptDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get()
  findAll(
    @Query('customerId') customerId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('chequeStatus') chequeStatus?: string,
  ) {
    return this.service.findAll({ customerId, paymentMethod, chequeStatus });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/clear-cheque')
  clearCheque(
    @Param('id') id: string,
    @Body('clearanceDate') clearanceDate?: string,
    @Req() req?: any,
  ) {
    return this.service.clearCheque(id, clearanceDate, req?.user?.id);
  }

  @Post(':id/return-cheque')
  returnCheque(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Body('returnDate') returnDate?: string,
    @Req() req?: any,
  ) {
    return this.service.returnCheque(
      id,
      reason ?? 'Cheque bounced/returned',
      returnDate,
      req?.user?.id,
    );
  }

  @Post(':id/reverse')
  reverse(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Body('reversalDate') reversalDate?: string,
    @Req() req?: any,
  ) {
    return this.service.reverse(
      id,
      reason ?? 'Customer receipt reversed',
      reversalDate,
      req?.user?.id,
    );
  }
}
