import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/strategies/supabase.strategy';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VendorQuotationService } from './vendor-quotation.service';
import {
  CreateVendorQuotationDto,
  UpdateVendorQuotationDto,
  QueryVendorQuotationDto,
} from './dto/vendor-quotation.dto';

@ApiTags('Purchase - Quotations')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('purchase/quotations')
export class VendorQuotationController {
  constructor(private readonly service: VendorQuotationService) {}

  @Post()
  create(@Body() dto: CreateVendorQuotationDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query() query: QueryVendorQuotationDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorQuotationDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req.user?.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }
}
