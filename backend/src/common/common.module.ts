import { Global, Module } from '@nestjs/common';
import { EventBus } from './events/event-bus';
import { AuditLogService } from './services/audit-log.service';
import { NotificationService } from './services/notification.service';
import { SearchService } from './services/search.service';
import { DashboardService } from './services/dashboard.service';
import { SearchController } from './services/search.controller';
import { NotificationController } from './services/notification.controller';
import { DashboardController } from './services/dashboard.controller';
import { TenantContext } from './tenant/tenant-context';

@Global()
@Module({
  providers: [
    TenantContext,
    EventBus,
    AuditLogService,
    NotificationService,
    SearchService,
    DashboardService,
  ],
  exports: [
    TenantContext,
    EventBus,
    AuditLogService,
    NotificationService,
    SearchService,
    DashboardService,
  ],
  controllers: [SearchController, NotificationController, DashboardController],
})
export class CommonModule {}
