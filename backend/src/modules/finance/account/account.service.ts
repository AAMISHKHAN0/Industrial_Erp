import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAccountDto, userId?: string) {
    const cleanDto: any = { ...dto };
    delete cleanDto.status;
    if (!cleanDto.parentId || cleanDto.parentId === 'NONE') {
      cleanDto.parentId = null;
    }
    cleanDto.accountCode = await resolveAutoCode(
      this.prisma.account,
      undefined,
      'accountCode',
      'ACC',
      cleanDto.accountCode,
    );
    return this.prisma.account.create({
      data: { ...(cleanDto as any), createdBy: userId },
      include: { children: true },
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
      ...(query.status ? { isActive: query.status.toUpperCase() === 'ACTIVE' } : {}),
      ...buildSearchFilter(query.search, ['name', 'accountCode']),
    };

    const [data, total] = await Promise.all([
      this.prisma.account.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { children: true },
      }),
      this.prisma.account.count({ where: where as any }),
    ]);

    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const record = await this.prisma.account.findFirst({
      where: { id, deletedAt: null } as any,
      include: { children: true },
    });
    if (!record) throw new NotFoundException('Account not found');
    const [enriched] = await enrichWithCreator(this.prisma, [record]);
    return enriched;
  }

  async update(id: string, dto: UpdateAccountDto, userId?: string) {
    await this.findOne(id);
    const cleanDto: any = { ...dto };
    delete cleanDto.status;
    if (cleanDto.parentId !== undefined && (!cleanDto.parentId || cleanDto.parentId === 'NONE')) {
      cleanDto.parentId = null;
    }
    return this.prisma.account.update({
      where: { id },
      data: { ...(cleanDto as any), updatedBy: userId },
      include: { children: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.account.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false } as any,
    });
  }

  async restore(id: string) {
    return this.prisma.account.update({
      where: { id },
      data: { deletedAt: null, isActive: true } as any,
    });
  }
}
