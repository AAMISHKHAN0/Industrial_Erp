import {
  Controller,
  Get,
  Query,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../modules/auth/strategies/supabase.strategy';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from '@nestjs/common';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async findForUser(
    @Request() req: Request,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    return this.notificationService.findForUser(userId, { page, limit });
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: Request) {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    return { count: await this.notificationService.getUnreadCount(userId) };
  }

  @Patch(':id/read')
  async markAsRead(@Request() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    return this.notificationService.markAsRead(userId, id);
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req: Request) {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    return this.notificationService.markAllAsRead(userId);
  }
}
