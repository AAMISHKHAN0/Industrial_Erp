import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../modules/auth/strategies/supabase.strategy';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummaryStats() {
    return this.dashboardService.getSummaryStats();
  }

  @Get('revenue')
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year for revenue data (default: current year)',
  })
  async getMonthlyRevenue(@Query('year') year?: number) {
    const currentYear = year ? Number(year) : new Date().getFullYear();
    return this.dashboardService.getMonthlyRevenue(currentYear);
  }
}
