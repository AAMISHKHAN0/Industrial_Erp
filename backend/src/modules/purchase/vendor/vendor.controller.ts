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
import { VendorService } from './vendor.service';
import {
  CreateVendorDto,
  UpdateVendorDto,
  QueryVendorDto,
  VendorItemDto,
  AddVendorItemsDto,
} from './dto/vendor.dto';

@ApiTags('Purchase - Vendor')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('purchase/vendors')
export class VendorController {
  constructor(private readonly service: VendorService) {}

  @Post()
  create(@Body() dto: CreateVendorDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query() query: QueryVendorDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
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

  // ─── Vendor Items ───────────────────────────────────────────

  @Get(':id/items')
  findItems(@Param('id') id: string) {
    return this.service.findItems(id);
  }

  @Post(':id/items')
  addItems(@Param('id') id: string, @Body() dto: AddVendorItemsDto) {
    return this.service.addItems(id, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: VendorItemDto,
  ) {
    return this.service.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.removeItem(id, itemId);
  }

  // ─── Lookup endpoints for purchase integration ──────────────

  @Get('by-item/:itemId')
  findByItem(@Param('itemId') itemId: string) {
    return this.service.findVendorsByItem(itemId);
  }

  @Get(':id/supplied-items')
  findSuppliedItems(@Param('id') id: string) {
    return this.service.findItemsByVendor(id);
  }

  @Get(':id/trail')
  getVendorTrail(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getVendorTrail(id, startDate, endDate);
  }
}
