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
import { DemandNoteService } from './DemandNote.service';
import {
  CreateDemandNoteDto,
  UpdateDemandNoteDto,
  QueryDemandNoteDto,
} from './dto/DemandNote.dto';

@ApiTags('DemandNote')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('purchase/demand-notes')
export class DemandNoteController {
  constructor(private readonly s: DemandNoteService) {}

  @Post() create(@Body() dto: CreateDemandNoteDto, @Req() req: any) {
    return this.s.create(dto, req.user?.id);
  }
  @Get() findAll(@Query() q: QueryDemandNoteDto) {
    return this.s.findAll(q);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.s.findOne(id);
  }
  @Post(':id/submit') submit(@Param('id') id: string, @Req() req: any) {
    return this.s.submit(id, req.user?.id);
  }
  @Post(':id/approve') approve(@Param('id') id: string, @Req() req: any) {
    return this.s.approve(id, req.user?.id);
  }
  @Post(':id/reject') reject(
    @Param('id') id: string,
    @Body() body: { remarks?: string },
    @Req() req: any,
  ) {
    return this.s.reject(id, body?.remarks, req.user?.id);
  }
  @Patch(':id/status') updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; remarks?: string },
    @Req() req: any,
  ) {
    if (body.status === 'APPROVED') return this.s.approve(id, req.user?.id);
    if (body.status === 'REJECTED') return this.s.reject(id, body.remarks, req.user?.id);
    if (body.status === 'SUBMITTED' || body.status === 'PENDING') return this.s.submit(id, req.user?.id);
    return this.s.update(id, { status: body.status } as any, req.user?.id);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateDemandNoteDto,
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
