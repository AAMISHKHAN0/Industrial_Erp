import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/strategies/supabase.strategy';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExpenseService } from './expense.service';
import {
  CreateSundryExpenseDto,
  QuerySundryExpenseDto,
} from './dto/expense.dto';

@ApiTags('Finance - Sundry Expenses')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('finance/expenses')
export class ExpenseController {
  constructor(private readonly service: ExpenseService) {}

  @Get()
  findAll(@Query() query: QuerySundryExpenseDto) {
    return this.service.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateSundryExpenseDto, @Req() req: any) {
    return this.service.createSundry(dto, req.user?.id);
  }

  @Post('sundry')
  createSundry(@Body() dto: CreateSundryExpenseDto, @Req() req: any) {
    return this.service.createSundry(dto, req.user?.id);
  }
}
