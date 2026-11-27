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
import { JournalEntryService } from './journal-entry.service';
import {
  CreateJournalEntryDto,
  UpdateJournalEntryDto,
  QueryJournalEntryDto,
} from './dto/journal-entry.dto';

@ApiTags('Finance - Journal Entries')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('finance/journal-entries')
export class JournalEntryController {
  constructor(private readonly service: JournalEntryService) {}

  @Post()
  create(@Body() dto: CreateJournalEntryDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query() query: QueryJournalEntryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateJournalEntryDto,
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

  @Post(':id/post')
  post(@Param('id') id: string, @Req() req: any) {
    return this.service.post(id, req.user?.id);
  }
}
