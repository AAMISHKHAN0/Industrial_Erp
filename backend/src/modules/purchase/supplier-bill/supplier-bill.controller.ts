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
import { SupplierBillService } from './supplier-bill.service';
import {
  CreateSupplierBillDto,
  QuerySupplierBillDto,
} from './dto/supplier-bill.dto';

@ApiTags('Purchase - Supplier Bills & 3-Way Matching')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('purchase/bills')
export class SupplierBillController {
  constructor(private readonly service: SupplierBillService) {}

  @Post()
  create(@Body() dto: CreateSupplierBillDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query() query: QuerySupplierBillDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
