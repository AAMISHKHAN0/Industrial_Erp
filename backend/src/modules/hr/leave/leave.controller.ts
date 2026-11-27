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
import { LeaveService } from './leave.service';
import { CreateLeaveDto, UpdateLeaveDto, QueryLeaveDto } from './dto/leave.dto';

@ApiTags('HR - Leave')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('hr/leaves')
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  @Post()
  create(@Body() dto: CreateLeaveDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query() query: QueryLeaveDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveDto,
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

  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.service.approve(id, req.user?.id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Req() req: any) {
    return this.service.reject(id, req.user?.id);
  }
}
