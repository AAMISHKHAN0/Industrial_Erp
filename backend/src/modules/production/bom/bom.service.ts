import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateBomDto, UpdateBomDto } from './dto/bom.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class BomService {
  constructor(
    private prisma: PrismaService,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateBomDto, userId?: string) {
    const { materials, ...data } = dto;
    const bomNumber = await resolveAutoCode(
      this.prisma.billOfMaterial,
      this.tenant.companyId!,
      'bomNumber',
      'BOM',
      data.bomNumber,
    );
    return this.prisma.billOfMaterial.create({
      data: {
        companyId: this.tenant.companyId!,
        createdBy: userId,
        ...(data as any),
        bomNumber,
        ...(materials ? { materials: { create: materials as any } } : {}),
      },
      include: { item: true, materials: { include: { item: true } } },
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
      ...buildSearchFilter(query.search, ['bomNumber', 'description']),
    };

    const [data, total] = await Promise.all([
      this.prisma.billOfMaterial.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { item: true, materials: { include: { item: true } } },
      }),
      this.prisma.billOfMaterial.count({ where: where as any }),
    ]);

    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const record = await this.prisma.billOfMaterial.findFirst({
      where: { id, deletedAt: null } as any,
      include: { item: true, materials: { include: { item: true } } },
    });
    if (!record) throw new NotFoundException('Bill of material not found');
    const [enriched] = await enrichWithCreator(this.prisma, [record]);
    return enriched;
  }

  async update(id: string, dto: UpdateBomDto, userId?: string) {
    await this.findOne(id);
    const { materials, ...data } = dto;
    return this.prisma.billOfMaterial.update({
      where: { id },
      data: {
        ...(data as any),
        updatedBy: userId,
        ...(materials
          ? { materials: { deleteMany: {}, create: materials as any } }
          : {}),
      },
      include: { item: true, materials: { include: { item: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.billOfMaterial.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' } as any,
    });
  }

  async restore(id: string) {
    const item = await this.prisma.billOfMaterial.findFirst({
      where: { id } as any,
    });
    if (!item) throw new NotFoundException('Bill of material not found');
    return this.prisma.billOfMaterial.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' } as any,
    });
  }
}
