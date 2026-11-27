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
import { ItemService } from './Item.service';
import { CreateItemDto, UpdateItemDto, QueryItemDto } from './dto/Item.dto';

@ApiTags('Item')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('inventory/items')
export class ItemController {
  constructor(private readonly s: ItemService) {}

  @Post() create(@Body() dto: CreateItemDto, @Req() req: any) {
    return this.s.create(dto, req.user?.id);
  }
  @Get() findAll(@Query() q: QueryItemDto) {
    return this.s.findAll(q);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.s.findOne(id);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
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
