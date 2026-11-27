import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class WarehouseService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWarehouseDto, userId?: string) {
    const code = await resolveAutoCode(this.prisma.warehouse, undefined, 'code', 'WH', dto.code);
    return this.prisma.warehouse.create({
      data: { ...(dto as any), code, createdBy: userId },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    status?: string;
    isActive?: boolean;
  }) {
    const { page, limit, skip } = buildPagination(query);
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...buildSearchFilter(query.search, ['name', 'code', 'city']),
    };

    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.warehouse.count({ where: where as any }),
    ]);

    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const entity = await this.prisma.warehouse.findFirst({
      where: { id, deletedAt: null } as any,
    });
    if (!entity) throw new NotFoundException('Warehouse not found');
    const [enriched] = await enrichWithCreator(this.prisma, [entity]);
    return enriched;
  }

  async update(id: string, dto: UpdateWarehouseDto, userId?: string) {
    await this.findOne(id);
    return this.prisma.warehouse.update({
      where: { id },
      data: { ...(dto as any), updatedBy: userId },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.warehouse.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' } as any,
    });
  }

  async restore(id: string) {
    return this.prisma.warehouse.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' } as any,
    });
  }
}
