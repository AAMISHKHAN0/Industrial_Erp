import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class UnitService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUnitDto, userId?: string) {
    const code = await resolveAutoCode(this.prisma.unit, undefined, 'code', 'UOM', dto.code);
    return this.prisma.unit.create({
      data: { ...(dto as any), code, createdBy: userId },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    status?: string;
  }) {
    const { page, limit, skip } = buildPagination(query);
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...buildSearchFilter(query.search, ['name', 'code']),
    };

    const [data, total] = await Promise.all([
      this.prisma.unit.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.unit.count({ where: where as any }),
    ]);

    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const entity = await this.prisma.unit.findFirst({
      where: { id, deletedAt: null } as any,
    });
    if (!entity) throw new NotFoundException('Unit not found');
    const [enriched] = await enrichWithCreator(this.prisma, [entity]);
    return enriched;
  }

  async update(id: string, dto: UpdateUnitDto, userId?: string) {
    await this.findOne(id);
    return this.prisma.unit.update({
      where: { id },
      data: { ...(dto as any), updatedBy: userId },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.unit.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' } as any,
    });
  }

  async restore(id: string) {
    return this.prisma.unit.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' } as any,
    });
  }
}
