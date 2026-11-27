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
import { MaterialIssueService } from './material-issue.service';
import {
  CreateMaterialIssueDto,
  QueryMaterialIssueDto,
} from './dto/material-issue.dto';

@ApiTags('Inventory - Material Issue')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('inventory/material-issue')
export class MaterialIssueController {
  constructor(private readonly service: MaterialIssueService) {}

  @Post()
  create(@Body() dto: CreateMaterialIssueDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query() query: QueryMaterialIssueDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
