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
import { SalesInvoiceService } from './sales-invoice.service';
import { CreateSalesInvoiceDto } from './dto/sales-invoice.dto';

@ApiTags('Sales - Sales Invoices')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('sales/invoices')
export class SalesInvoiceController {
  constructor(private readonly service: SalesInvoiceService) {}

  @Post()
  create(@Body() dto: CreateSalesInvoiceDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query('customerId') customerId?: string, @Query('status') status?: string) {
    return this.service.findAll({ customerId, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/reverse')
  reverse(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    return this.service.reverse(id, reason ?? 'Invoice cancelled', req.user?.id);
  }
}
