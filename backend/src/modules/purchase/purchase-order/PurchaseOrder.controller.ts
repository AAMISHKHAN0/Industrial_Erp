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
import { PurchaseOrderService } from './PurchaseOrder.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  QueryPurchaseOrderDto,
} from './dto/PurchaseOrder.dto';

@ApiTags('Purchase - Orders')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('purchase/orders')
export class PurchaseOrderController {
  constructor(private readonly s: PurchaseOrderService) {}

  @Post() create(@Body() dto: CreatePurchaseOrderDto, @Req() req: any) {
    return this.s.create(dto, req.user?.id);
  }
  @Get() findAll(@Query() q: QueryPurchaseOrderDto) {
    return this.s.findAll(q);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.s.findOne(id);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.s.update(id, dto);
  }
  @Delete(':id') remove(@Param('id') id: string) {
    return this.s.remove(id);
  }
  @Post(':id/restore') restore(@Param('id') id: string) {
    return this.s.restore(id);
  }
  @Post(':id/approve') approve(@Param('id') id: string, @Req() req: any) {
    return this.s.approve(id, req.user?.id);
  }
}
