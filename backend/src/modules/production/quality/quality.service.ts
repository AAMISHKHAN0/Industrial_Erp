import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateQualityCheckDto,
  UpdateQualityCheckDto,
} from './dto/quality.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';

@Injectable()
export class QualityCheckService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateQualityCheckDto, _userId?: string) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id: dto.productionOrderId, deletedAt: null },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundException('Production order not found');
    }

    return this.prisma.qualityCheck.create({
      data: {
        productionOrderId: dto.productionOrderId,
        checkedBy: dto.checkedBy?.trim() || null,
        checkDate: dto.checkDate ? new Date(dto.checkDate) : new Date(),
        parameter: dto.parameter.trim(),
        specification: dto.specification?.trim() || null,
        result: dto.result?.trim() || null,
        status: ((dto.status?.trim() || 'PENDING').toUpperCase()) as any,
        notes: dto.notes?.trim() || null,
      },
      include: { productionOrder: true },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    status?: string;
    productionOrderId?: string;
  }) {
    const { page, limit, skip } = buildPagination(query);
    const where: any = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.productionOrderId
        ? { productionOrderId: query.productionOrderId }
        : {}),
      ...buildSearchFilter(query.search, [
        'parameter',
        'result',
        'notes',
        'specification',
      ]),
    };

    const [data, total] = await Promise.all([
      this.prisma.qualityCheck.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { productionOrder: true },
      }),
      this.prisma.qualityCheck.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const record = await this.prisma.qualityCheck.findFirst({
      where: { id },
      include: { productionOrder: true },
    });
    if (!record) throw new NotFoundException('Quality check not found');
    return record;
  }

  async update(id: string, dto: UpdateQualityCheckDto, _userId?: string) {
    await this.findOne(id);
    const data: any = {};
    if (dto.productionOrderId !== undefined)
      data.productionOrderId = dto.productionOrderId;
    if (dto.checkedBy !== undefined) data.checkedBy = dto.checkedBy || null;
    if (dto.checkDate !== undefined)
      data.checkDate = dto.checkDate ? new Date(dto.checkDate) : null;
    if (dto.parameter !== undefined) data.parameter = dto.parameter;
    if (dto.specification !== undefined)
      data.specification = dto.specification || null;
    if (dto.result !== undefined) data.result = dto.result || null;
    if (dto.status !== undefined) data.status = dto.status.toUpperCase();
    if (dto.notes !== undefined) data.notes = dto.notes || null;

    return this.prisma.qualityCheck.update({
      where: { id },
      data,
      include: { productionOrder: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.qualityCheck.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.findOne(id);
  }
}
