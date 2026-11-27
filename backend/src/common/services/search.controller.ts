import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../modules/auth/strategies/supabase.strategy';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { SearchService, UnifiedSearchResponse } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search query (minimum 2 characters)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page (default: 20, max: 100)',
  })
  async globalSearch(
    @Query('q') query: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<UnifiedSearchResponse> {
    return this.searchService.globalSearch(query, { page, limit });
  }
}
