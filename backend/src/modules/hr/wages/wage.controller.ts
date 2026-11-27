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
import { WageService } from './wage.service';
import { CreateWageRunDto, DisburseWageRunDto } from './dto/wage.dto';

@ApiTags('HR - Wages & Salaries')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('hr/wages')
export class WageController {
  constructor(private readonly service: WageService) {}

  @Post()
  createWageRun(@Body() dto: CreateWageRunDto, @Req() req: any) {
    return this.service.createWageRun(dto, req.user?.id);
  }

  @Post(':id/disburse')
  disburseWageRun(
    @Param('id') id: string,
    @Body() dto: DisburseWageRunDto,
    @Req() req: any,
  ) {
    return this.service.disburseWageRun(id, dto, req.user?.id);
  }

  @Get()
  findAll(
    @Query('periodYear') periodYear?: number,
    @Query('periodMonth') periodMonth?: number,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({ periodYear, periodMonth, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
