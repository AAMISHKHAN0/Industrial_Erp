import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/strategies/supabase.strategy';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StockRegisterService } from './stock-register.service';
import { QueryStockRegisterDto } from './dto/stock-register.dto';

@ApiTags('Inventory - Stock Register')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('inventory/stock/register')
export class StockRegisterController {
  constructor(private readonly service: StockRegisterService) {}

  @Get()
  getRegister(@Query() query: QueryStockRegisterDto) {
    return this.service.getRegister(query);
  }
}

@ApiTags('Inventory - Stock Register Alias')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('inventory/stock-register')
export class StockRegisterAliasController {
  constructor(private readonly service: StockRegisterService) {}

  @Get()
  getRegister(@Query() query: QueryStockRegisterDto) {
    return this.service.getRegister(query);
  }
}
