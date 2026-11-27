import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateDesignationDto,
  UpdateDesignationDto,
} from './dto/designation.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class DesignationService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDesignationDto, userId?: string) {
    const code = await resolveAutoCode(this.prisma.designation, undefined, 'code', 'DSG', dto.code);
    return this.prisma.designation.create({
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
      ...buildSearchFilter(query.search, ['name', 'code', 'description']),
    };
    const [data, total] = await Promise.all([
      this.prisma.designation.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.designation.count({ where: where as any }),
    ]);
    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.designation.findFirst({
      where: { id, deletedAt: null } as any,
    });
    if (!item) throw new NotFoundException('Designation not found');
    const [enriched] = await enrichWithCreator(this.prisma, [item]);
    return enriched;
  }

  async update(id: string, dto: UpdateDesignationDto, userId?: string) {
    await this.findOne(id);
    return this.prisma.designation.update({
      where: { id },
      data: { ...(dto as any), updatedBy: userId },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.designation.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' } as any,
    });
  }

  async restore(id: string) {
    return this.prisma.designation.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' } as any,
    });
  }
}
