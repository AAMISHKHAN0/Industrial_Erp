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
import { SalesDispatchService } from './sales-dispatch.service';
import { CreateSalesDispatchDto } from './dto/sales-dispatch.dto';

@ApiTags('Sales - Sales Dispatches')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('sales/dispatches')
export class SalesDispatchController {
  constructor(private readonly service: SalesDispatchService) {}

  @Post()
  create(@Body() dto: CreateSalesDispatchDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get()
  findAll(
    @Query('customerId') customerId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.service.findAll({ customerId, warehouseId });
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
    return this.service.reverse(id, reason ?? 'Dispatch cancelled', req.user?.id);
  }
}
