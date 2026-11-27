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
import { QualityCheckService } from './quality.service';
import {
  CreateQualityCheckDto,
  UpdateQualityCheckDto,
  QueryQualityCheckDto,
} from './dto/quality.dto';

@ApiTags('Production - Quality')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('production/quality')
export class QualityCheckController {
  constructor(private readonly service: QualityCheckService) {}

  @Post()
  create(@Body() dto: CreateQualityCheckDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query() query: QueryQualityCheckDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQualityCheckDto,
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
}
