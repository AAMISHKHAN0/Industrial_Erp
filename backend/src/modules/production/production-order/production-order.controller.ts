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
import { ProductionOrderService } from './production-order.service';
import {
  CreateProductionOrderDto,
  UpdateProductionOrderDto,
  QueryProductionOrderDto,
  CompleteProductionOrderDto,
} from './dto/production-order.dto';

@ApiTags('Production - Orders')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('production/orders')
export class ProductionOrderController {
  constructor(private readonly service: ProductionOrderService) {}

  @Post() create(@Body() dto: CreateProductionOrderDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }
  @Get() findAll(@Query() query: QueryProductionOrderDto) {
    return this.service.findAll(query);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateProductionOrderDto,
  ) {
    return this.service.update(id, dto);
  }
  @Delete(':id') remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
  @Post(':id/restore') restore(@Param('id') id: string) {
    return this.service.restore(id);
  }

  @Post(':id/start')
  start(@Param('id') id: string, @Req() req: any) {
    return this.service.start(id, req.user?.id);
  }

  @Post(':id/hold')
  hold(@Param('id') id: string, @Req() req: any) {
    return this.service.hold(id, req.user?.id);
  }

  @Post(':id/resume')
  resume(@Param('id') id: string, @Req() req: any) {
    return this.service.resume(id, req.user?.id);
  }

  @Post(':id/complete')
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteProductionOrderDto,
    @Req() req: any,
  ) {
    return this.service.complete(
      id,
      dto?.producedQty,
      dto?.rejectedQty,
      dto?.warehouseId,
      req.user?.id,
    );
  }
}
