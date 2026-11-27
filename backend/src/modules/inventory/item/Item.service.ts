import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateItemDto, UpdateItemDto } from './dto/Item.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class ItemService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateItemDto, userId?: string) {
    const cleanDto: any = { ...dto };
    if (!cleanDto.categoryId || cleanDto.categoryId === 'NONE') cleanDto.categoryId = null;
    if (!cleanDto.unitId || cleanDto.unitId === 'NONE') cleanDto.unitId = null;
    cleanDto.itemCode = await resolveAutoCode(
      this.prisma.item,
      undefined,
      'itemCode',
      'ITM',
      cleanDto.itemCode,
    );
    return this.prisma.item.create({
      data: { ...(cleanDto as any), createdBy: userId },
    });
  }

  async findAll(query: any) {
    const { page, limit, skip } = buildPagination(query);
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...buildSearchFilter(query.search, [
        'name',
        'itemCode',
        'brand',
        'hsnCode',
      ]),
    };
    const [data, total] = await Promise.all([
      this.prisma.item.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.item.count({ where: where as any }),
    ]);
    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, deletedAt: null } as any,
    });
    if (!item) throw new NotFoundException('Item not found');
    const [enriched] = await enrichWithCreator(this.prisma, [item]);
    return enriched;
  }

  async update(id: string, dto: UpdateItemDto, userId?: string) {
    await this.findOne(id);
    const cleanDto: any = { ...dto };
    if (cleanDto.categoryId !== undefined && (!cleanDto.categoryId || cleanDto.categoryId === 'NONE')) cleanDto.categoryId = null;
    if (cleanDto.unitId !== undefined && (!cleanDto.unitId || cleanDto.unitId === 'NONE')) cleanDto.unitId = null;
    return this.prisma.item.update({
      where: { id },
      data: { ...(cleanDto as any), updatedBy: userId },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.item.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' } as any,
    });
  }

  async restore(id: string) {
    return this.prisma.item.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' } as any,
    });
  }
}
