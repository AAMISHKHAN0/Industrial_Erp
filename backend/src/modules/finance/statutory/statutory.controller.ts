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
import { StatutoryService } from './statutory.service';
import {
  CreateObligationDto,
  RecordStatutoryPaymentDto,
} from './dto/statutory.dto';

@ApiTags('Finance - Statutory Payments')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('finance/statutory')
export class StatutoryController {
  constructor(private readonly service: StatutoryService) {}

  @Post('obligations')
  createObligation(@Body() dto: CreateObligationDto, @Req() req: any) {
    return this.service.createObligation(dto, req.user?.id);
  }

  @Post('payments')
  recordPayment(@Body() dto: RecordStatutoryPaymentDto, @Req() req: any) {
    return this.service.recordPayment(dto, req.user?.id);
  }

  @Get('register')
  getRegister(
    @Query('head') head?: string,
    @Query('authority') authority?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getRegister({ head, authority, status });
  }

  @Get('obligations/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
