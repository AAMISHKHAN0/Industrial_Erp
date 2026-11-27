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
import { PurchaseReturnService } from './purchase-return.service';
import {
  CreatePurchaseReturnDto,
  QueryPurchaseReturnDto,
} from './dto/purchase-return.dto';

@ApiTags('Purchase - Returns & Debit Notes')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('purchase/returns')
export class PurchaseReturnController {
  constructor(private readonly service: PurchaseReturnService) {}

  @Post()
  create(@Body() dto: CreatePurchaseReturnDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query() query: QueryPurchaseReturnDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
