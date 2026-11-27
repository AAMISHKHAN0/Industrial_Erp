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
import { PayrollService } from './payroll.service';
import {
  CreatePayheadDto,
  UpdatePayheadDto,
  CreatePayrollPeriodDto,
  UpdatePayrollPeriodDto,
  CreatePaySlipDto,
  UpdatePaySlipDto,
  QueryPayrollDto,
} from './dto/payroll.dto';

@ApiTags('HR - Payroll')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('hr/payroll')
export class PayrollController {
  constructor(private readonly service: PayrollService) {}

  @Post('payhead') createPayhead(
    @Body() dto: CreatePayheadDto,
    @Req() req: any,
  ) {
    return this.service.createPayhead(dto, req.user?.id);
  }
  @Get('payhead') findAllPayheads(@Query() query: QueryPayrollDto) {
    return this.service.findAllPayheads(query);
  }
  @Get('payhead/:id') findOnePayhead(@Param('id') id: string) {
    return this.service.findOnePayhead(id);
  }
  @Patch('payhead/:id') updatePayhead(
    @Param('id') id: string,
    @Body() dto: UpdatePayheadDto,
    @Req() req: any,
  ) {
    return this.service.updatePayhead(id, dto, req.user?.id);
  }
  @Delete('payhead/:id') removePayhead(@Param('id') id: string) {
    return this.service.removePayhead(id);
  }
  @Post('payhead/:id/restore') restorePayhead(@Param('id') id: string) {
    return this.service.restorePayhead(id);
  }

  @Post('period') createPeriod(
    @Body() dto: CreatePayrollPeriodDto,
    @Req() req: any,
  ) {
    return this.service.createPeriod(dto, req.user?.id);
  }
  @Get('period') findAllPeriods(@Query() query: QueryPayrollDto) {
    return this.service.findAllPeriods(query);
  }
  @Get('period/:id') findOnePeriod(@Param('id') id: string) {
    return this.service.findOnePeriod(id);
  }
  @Patch('period/:id') updatePeriod(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollPeriodDto,
    @Req() req: any,
  ) {
    return this.service.updatePeriod(id, dto, req.user?.id);
  }
  @Delete('period/:id') removePeriod(@Param('id') id: string) {
    return this.service.removePeriod(id);
  }
  @Post('period/:id/restore') restorePeriod(@Param('id') id: string) {
    return this.service.restorePeriod(id);
  }
  @Post('period/:id/process') processPeriod(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.service.processPayroll(id, req.user?.id);
  }

  @Post('slip') createSlip(@Body() dto: CreatePaySlipDto, @Req() req: any) {
    return this.service.createSlip(dto, req.user?.id);
  }
  @Get('slip') findAllSlips(@Query() query: QueryPayrollDto) {
    return this.service.findAllSlips(query);
  }
  @Get('slip/:id') findOneSlip(@Param('id') id: string) {
    return this.service.findOneSlip(id);
  }
  @Patch('slip/:id') updateSlip(
    @Param('id') id: string,
    @Body() dto: UpdatePaySlipDto,
    @Req() req: any,
  ) {
    return this.service.updateSlip(id, dto, req.user?.id);
  }
  @Delete('slip/:id') removeSlip(@Param('id') id: string) {
    return this.service.removeSlip(id);
  }
  @Post('slip/:id/restore') restoreSlip(@Param('id') id: string) {
    return this.service.restoreSlip(id);
  }
}
