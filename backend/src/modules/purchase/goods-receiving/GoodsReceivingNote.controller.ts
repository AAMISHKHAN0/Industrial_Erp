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
import { GoodsReceivingNoteService } from './GoodsReceivingNote.service';
import {
  CreateGoodsReceivingNoteDto,
  UpdateGoodsReceivingNoteDto,
  QueryGoodsReceivingNoteDto,
} from './dto/GoodsReceivingNote.dto';

@ApiTags('Purchase - Goods Receiving')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('purchase/goods-receiving')
export class GoodsReceivingNoteController {
  constructor(private readonly s: GoodsReceivingNoteService) {}

  @Post() create(@Body() dto: CreateGoodsReceivingNoteDto, @Req() req: any) {
    return this.s.create(dto, req.user?.id);
  }
  @Get('unbilled') findUnbilled() {
    return this.s.findUnbilled();
  }
  @Get() findAll(@Query() q: QueryGoodsReceivingNoteDto) {
    return this.s.findAll(q);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.s.findOne(id);
  }
  @Post(':id/cancel') cancel(@Param('id') id: string, @Req() req: any) {
    return this.s.cancel(id, req.user?.id);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateGoodsReceivingNoteDto,
    @Req() req: any,
  ) {
    return this.s.update(id, dto, req.user?.id);
  }
  @Delete(':id') remove(@Param('id') id: string) {
    return this.s.remove(id);
  }
  @Post(':id/restore') restore(@Param('id') id: string) {
    return this.s.restore(id);
  }
}
