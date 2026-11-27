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
import { DesignationService } from './designation.service';
import {
  CreateDesignationDto,
  UpdateDesignationDto,
  QueryDesignationDto,
} from './dto/designation.dto';

@ApiTags('Master Data - Designation')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('master-data/designation')
export class DesignationController {
  constructor(private readonly service: DesignationService) {}

  @Post()
  create(@Body() dto: CreateDesignationDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query() query: QueryDesignationDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDesignationDto,
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
