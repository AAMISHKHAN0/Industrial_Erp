import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateLeaveDto, UpdateLeaveDto } from './dto/leave.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { enrichWithCreator } from '../../../common/utils/enrich';

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLeaveDto, userId?: string) {
    const data = {
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      createdBy: userId,
    };
    return this.prisma.leave.create({
      data: data as any,
      include: { employee: true },
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
      ...(query.status ? { status: query.status } : {}),
      ...buildSearchFilter(query.search, ['reason', 'remarks']),
    };

    const [data, total] = await Promise.all([
      this.prisma.leave.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { employee: true },
      }),
      this.prisma.leave.count({ where: where as any }),
    ]);

    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const record = await this.prisma.leave.findFirst({
      where: { id } as any,
      include: { employee: true },
    });
    if (!record) throw new NotFoundException('Leave record not found');
    const [enriched] = await enrichWithCreator(this.prisma, [record]);
    return enriched;
  }

  async update(id: string, dto: UpdateLeaveDto, userId?: string) {
    await this.findOne(id);
    const data: Record<string, any> = {
      ...(dto as any),
      updatedBy: userId,
    };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return this.prisma.leave.update({
      where: { id },
      data,
      include: { employee: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.leave.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.findOne(id);
  }

  async approve(id: string, userId?: string) {
    await this.findOne(id);
    return this.prisma.leave.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        updatedBy: userId,
      } as any,
    });
  }

  async reject(id: string, userId?: string) {
    await this.findOne(id);
    return this.prisma.leave.update({
      where: { id },
      data: { status: 'REJECTED', updatedBy: userId } as any,
    });
  }
}
