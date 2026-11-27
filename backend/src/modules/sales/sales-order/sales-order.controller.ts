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
import { SalesOrderService } from './sales-order.service';
import {
  CreateSalesOrderDto,
  UpdateSalesOrderDto,
  QuerySalesOrderDto,
} from './dto/sales-order.dto';

@ApiTags('Sales - Orders')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('sales/orders')
export class SalesOrderController {
  constructor(private readonly service: SalesOrderService) {}

  @Post() create(@Body() dto: CreateSalesOrderDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }
  @Get() findAll(@Query() query: QuerySalesOrderDto) {
    return this.service.findAll(query);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderDto,
  ) {
    return this.service.update(id, dto);
  }
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
  @Post(':id/restore') restore(@Param('id') id: string) {
    return this.service.restore(id);
  }
  @Post(':id/confirm') confirm(@Param('id') id: string, @Req() req: any) {
    return this.service.confirm(id, req.user?.id);
  }
  @Post(':id/deliver') deliver(
    @Param('id') id: string,
    @Body('warehouseId') warehouseId: string,
    @Req() req: any,
  ) {
    return this.service.deliver(id, warehouseId, req.user?.id);
  }
}
