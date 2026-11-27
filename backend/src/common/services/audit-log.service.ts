import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

import { TenantContext } from '../../common/tenant/tenant-context';

export interface AuditLogInput {
  companyId?: string;
  entity: string;
  entityId?: string;
  action:
    | 'CREATED'
    | 'UPDATED'
    | 'APPROVED'
    | 'REJECTED'
    | 'DELETED'
    | 'COMPLETED'
    | 'POSTED'
    | 'LOGIN'
    | string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditLogService {
  constructor(
    private prisma: PrismaService,
    private tenant: TenantContext,
  ) {}

  /**
   * Record an auditable action. `userName` / `userEmail` are snapshotted at
   * write time so the activity feed can render "who did it" without a join.
   * If a transactional client `tx` is provided, executes directly on that connection
   * to avoid connection pool starvation.
   */
  async log(params: AuditLogInput, tx?: any) {
    const store = this.tenant.store;
    const userId = params.userId ?? store?.userId ?? null;
    const companyId = params.companyId ?? this.tenant.companyId;

    if (!companyId) return; // nothing to attribute to

    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        companyId,
        entity: params.entity,
        entityId: params.entityId ?? null,
        action: params.action,
        userId: userId ?? undefined,
        userName: params.userName ?? store?.userName ?? null,
        userEmail: params.userEmail ?? store?.userEmail ?? null,
        oldValue: params.oldValue ?? undefined,
        newValue: params.newValue ?? undefined,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  }

  async findAll(filters: {
    entity?: string;
    userId?: string;
    action?: string;
    from?: Date;
    to?: Date;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const where: any = {};
    if (this.tenant.companyId) {
      where.companyId = this.tenant.companyId;
    }

    if (filters.entity) where.entity = filters.entity;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }
    if (filters.search) {
      where.OR = [
        { userName: { contains: filters.search, mode: 'insensitive' } },
        { userEmail: { contains: filters.search, mode: 'insensitive' } },
        { entity: { contains: filters.search, mode: 'insensitive' } },
        { entityId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Recent activity for a specific record (its full history). */
  async findByEntity(entity: string, entityId: string) {
    const where: any = { entity, entityId };
    if (this.tenant.companyId) {
      where.companyId = this.tenant.companyId;
    }
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
