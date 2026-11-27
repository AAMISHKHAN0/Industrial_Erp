import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  buildPagination,
  buildSearchFilter,
  PaginationParams,
} from '../utils/pagination';

import { TenantContext } from '../../common/tenant/tenant-context';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private tenant: TenantContext,
  ) {}

  async notify(params: {
    userId: string;
    title: string;
    message?: string;
    type?: string;
    link?: string;
  }) {
    await this.prisma.notification.create({
      data: {
        companyId: this.tenant.companyId!,
        userId: params.userId,
        title: params.title,
        message: params.message ?? '',
        type: params.type ?? 'INFO',
        link: params.link,
      },
    });
  }

  async notifyMany(params: {
    userIds: string[];
    title: string;
    message?: string;
    type?: string;
    link?: string;
  }) {
    await this.prisma.notification.createMany({
      data: params.userIds.map((userId) => ({
        companyId: this.tenant.companyId!,
        userId,
        title: params.title,
        message: params.message ?? '',
        type: params.type ?? 'INFO',
        link: params.link,
      })),
    });
  }

  async findForUser(userId: string, params: PaginationParams = {}) {
    const { page, limit, skip } = buildPagination(params);
    const where = { userId };
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}
