import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class EmployeeService {
  constructor(
    private prisma: PrismaService,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateEmployeeDto, userId?: string) {
    const employeeCode = await resolveAutoCode(
      this.prisma.employee,
      this.tenant.companyId!,
      'employeeCode',
      'EMP',
      dto.employeeCode,
    );
    const email = dto.email || `${employeeCode.toLowerCase()}@local.erp`;
    return this.prisma.employee.create({
      data: {
        ...(dto as any),
        employeeCode,
        email,
        companyId: this.tenant.companyId!,
        createdBy: userId,
      },
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
        'firstName',
        'lastName',
        'email',
        'phone',
        'employeeCode',
      ]),
    };
    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where: where as any }),
    ]);
    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null } as any,
    });
    if (!item) throw new NotFoundException('Employee not found');
    const [enriched] = await enrichWithCreator(this.prisma, [item]);
    return enriched;
  }

  async update(id: string, dto: UpdateEmployeeDto, userId?: string) {
    await this.findOne(id);
    return this.prisma.employee.update({
      where: { id },
      data: { ...(dto as any), updatedBy: userId },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' } as any,
    });
  }

  async restore(id: string) {
    return this.prisma.employee.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' } as any,
    });
  }
}
