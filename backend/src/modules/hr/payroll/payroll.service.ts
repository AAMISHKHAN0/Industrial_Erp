import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import {
  CreatePayheadDto,
  UpdatePayheadDto,
  CreatePayrollPeriodDto,
  UpdatePayrollPeriodDto,
  CreatePaySlipDto,
  UpdatePaySlipDto,
} from './dto/payroll.dto';
import { FinanceIntegrationService } from '../../finance/services/finance-integration.service';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { NotificationService } from '../../../common/services/notification.service';
import { EventBus } from '../../../common/events/event-bus';
import { PayrollProcessedEvent } from '../../../common/events/domain-event';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private finance: FinanceIntegrationService,
    private auditLog: AuditLogService,
    private notification: NotificationService,
    private eventBus: EventBus,
    private tenant: TenantContext,
  ) {}

  async processPayroll(periodId: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const period = await tx.payrollPeriod.findUnique({
        where: { id: periodId },
        include: {
          paySlips: {
            include: { employee: true, items: { include: { payhead: true } } },
          },
        },
      });
      if (!period) throw new NotFoundException('Payroll period not found');
      if (period.isProcessed)
        throw new Error('Payroll period already processed');

      let totalSalary = 0;
      let totalDeductions = 0;
      let netPay = 0;

      for (const slip of period.paySlips) {
        totalSalary += slip.grossPay;
        totalDeductions += slip.totalDeductions;
        netPay += slip.netPay;
        await tx.paySlip.update({
          where: { id: slip.id },
          data: { status: 'PROCESSED' },
        });
      }

      await tx.payrollPeriod.update({
        where: { id: periodId },
        data: {
          isProcessed: true,
          processedAt: new Date(),
          processedBy: userId,
        },
      });

      await this.finance.createPayrollJournalEntry(
        {
          periodName: period.name,
          totalSalary,
          totalDeductions,
          netPay,
          createdBy: userId,
        },
        tx,
      );

      await this.eventBus.publish(
        new PayrollProcessedEvent({
          periodId,
          totalSalary,
          paySlipIds: period.paySlips.map((s) => s.id),
        }),
      );
      await this.auditLog.log(
        {
          entity: 'PayrollPeriod',
          entityId: periodId,
          action: 'PROCESSED',
          userId,
          newValue: { totalSalary, netPay },
        },
        tx,
      );
      if (userId)
        await this.notification.notify({
          userId,
          title: `Payroll ${period.name} processed`,
          message: `Net pay: ${netPay}`,
          link: `/hr/payroll`,
        });

      return { period, totalSalary, netPay };
    });
  }

  async createPayhead(dto: CreatePayheadDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');
    const code = await resolveAutoCode(this.prisma.payhead, companyId, 'code', 'PH', dto.code);
    return this.prisma.payhead.create({
      data: { ...(dto as any), companyId, code, createdBy: userId },
    });
  }
  async findAllPayheads(query: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    status?: string;
  }) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;
    const companyId = this.tenant.companyId;
    const where: any = {
      ...(companyId ? { companyId } : {}),
      ...(query.status
        ? { isActive: query.status.toUpperCase() === 'ACTIVE' }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.payhead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payhead.count({ where }),
    ]);
    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
  async findOnePayhead(id: string) {
    const r = await this.prisma.payhead.findFirst({ where: { id } });
    if (!r) throw new NotFoundException('Payhead not found');
    const [enriched] = await enrichWithCreator(this.prisma, [r]);
    return enriched;
  }
  async updatePayhead(id: string, dto: UpdatePayheadDto, userId?: string) {
    await this.findOnePayhead(id);
    return this.prisma.payhead.update({
      where: { id },
      data: { ...(dto as any), updatedBy: userId },
    });
  }
  async removePayhead(id: string) {
    return this.prisma.payhead.update({
      where: { id },
      data: { isActive: false } as any,
    });
  }
  async restorePayhead(id: string) {
    return this.prisma.payhead.update({
      where: { id },
      data: { isActive: true } as any,
    });
  }

  async createPeriod(dto: CreatePayrollPeriodDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');
    const data = {
      ...dto,
      companyId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      createdBy: userId,
    };
    return this.prisma.payrollPeriod.create({ data: data as any });
  }
  async findAllPeriods(query: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    status?: string;
  }) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;
    const companyId = this.tenant.companyId;
    const where: any = {
      ...(companyId ? { companyId } : {}),
      ...(query.status
        ? { isProcessed: query.status.toUpperCase() === 'PROCESSED' }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.payrollPeriod.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.payrollPeriod.count({ where }),
    ]);
    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
  async findOnePeriod(id: string) {
    const r = await this.prisma.payrollPeriod.findFirst({ where: { id } });
    if (!r) throw new NotFoundException('Payroll period not found');
    const [enriched] = await enrichWithCreator(this.prisma, [r]);
    return enriched;
  }
  async updatePeriod(id: string, dto: UpdatePayrollPeriodDto, userId?: string) {
    await this.findOnePeriod(id);
    const data: any = { ...dto, updatedBy: userId };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return this.prisma.payrollPeriod.update({
      where: { id },
      data,
    });
  }
  async removePeriod(id: string) {
    const period = await this.findOnePeriod(id);
    const slipCount = await this.prisma.paySlip.count({ where: { periodId: id } });
    if (period.isProcessed || slipCount > 0) {
      throw new BadRequestException(
        'Cannot delete a payroll period that has been processed or has pay slips',
      );
    }
    return this.prisma.payrollPeriod.delete({ where: { id } });
  }
  async restorePeriod(id: string) {
    return this.prisma.payrollPeriod.update({
      where: { id },
      data: { isProcessed: false } as any,
    });
  }

  async createSlip(dto: CreatePaySlipDto, userId?: string) {
    return this.prisma.paySlip.create({
      data: { ...(dto as any), createdBy: userId },
      include: { employee: true, period: true },
    });
  }
  async findAllSlips(query: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    status?: string;
  }) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;
    const where: any = { ...(query.status ? { status: query.status } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.paySlip.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { employee: true, period: true },
      }),
      this.prisma.paySlip.count({ where }),
    ]);
    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
  async findOneSlip(id: string) {
    const r = await this.prisma.paySlip.findFirst({
      where: { id },
      include: { employee: true, period: true },
    });
    if (!r) throw new NotFoundException('Pay slip not found');
    const [enriched] = await enrichWithCreator(this.prisma, [r]);
    return enriched;
  }
  async updateSlip(id: string, dto: UpdatePaySlipDto, userId?: string) {
    await this.findOneSlip(id);
    return this.prisma.paySlip.update({
      where: { id },
      data: { ...(dto as any), updatedBy: userId },
      include: { employee: true, period: true },
    });
  }
  async removeSlip(id: string) {
    return this.prisma.paySlip.update({
      where: { id },
      data: { status: 'CANCELLED' } as any,
    });
  }
  async restoreSlip(id: string) {
    return this.prisma.paySlip.update({
      where: { id },
      data: { status: 'DRAFT' } as any,
    });
  }
}
