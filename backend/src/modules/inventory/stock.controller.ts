import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/strategies/supabase.strategy';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StockService } from './services/stock.service';
import { TransferStockDto, GetStockDto } from './dto/stock.dto';

@ApiTags('Inventory - Stock')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('inventory/stock')
export class StockController {
  constructor(private readonly service: StockService) {}

  @Post('transfer')
  transfer(@Body() dto: TransferStockDto, @Req() req: any) {
    return this.service.transferStock({
      itemId: dto.itemId,
      fromWarehouseId: dto.fromWarehouseId,
      toWarehouseId: dto.toWarehouseId,
      quantity: dto.quantity,
      createdBy: req.user?.id,
    });
  }

  @Get('fifo-layers')
  getFifoLayers(
    @Query('itemId') itemId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.service.getFifoLayers(itemId, warehouseId);
  }

  @Get()
  getStock(@Query() q: GetStockDto) {
    return this.service.getStock(q.itemId, q.warehouseId);
  }
}
