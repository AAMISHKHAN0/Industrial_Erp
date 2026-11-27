import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCustomerDto, userId?: string) {
    const customerCode = await resolveAutoCode(
      this.prisma.customer,
      undefined,
      'customerCode',
      'CUST',
      dto.customerCode,
    );
    return this.prisma.customer.create({
      data: { ...(dto as any), customerCode, createdBy: userId },
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
      ...buildSearchFilter(query.search, [
        'name',
        'customerCode',
        'email',
        'phone',
        'contactPerson',
      ]),
    };

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where: where as any }),
    ]);

    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const entity = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null } as any,
    });
    if (!entity) throw new NotFoundException('Customer not found');
    const [enriched] = await enrichWithCreator(this.prisma, [entity]);
    return enriched;
  }

  async update(id: string, dto: UpdateCustomerDto, userId?: string) {
    await this.findOne(id);
    return this.prisma.customer.update({
      where: { id },
      data: { ...(dto as any), updatedBy: userId },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' } as any,
    });
  }

  async restore(id: string) {
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' } as any,
    });
  }
}
