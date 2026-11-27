import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { PostingService } from '../../finance/services/posting.service';
import { CreateWageRunDto, DisburseWageRunDto } from './dto/wage.dto';

@Injectable()
export class WageService {
  constructor(
    private prisma: PrismaService,
    private postingService: PostingService,
    private tenant: TenantContext,
  ) {}

  async createWageRun(dto: CreateWageRunDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('At least one employee wage line is required');
    }

    const runType = dto.runType ?? 'DAILY_WAGE';

    // 1. Prevent duplicate wage run for the same period and run type (HR-01)
    const existingRun = await this.prisma.wageRun.findUnique({
      where: {
        companyId_periodYear_periodMonth_runType: {
          companyId,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
          runType,
        },
      },
    });
    if (existingRun) {
      throw new ConflictException(
        `A wage run for period ${dto.periodYear}-${dto.periodMonth} (${runType}) already exists`,
      );
    }

    let totalGross = 0;
    let totalDeductions = 0;

    const linesToCreate = dto.lines.map((line) => {
      const gross = Math.round(line.daysWorked * line.dailyRate * 100) / 100;
      const deductions = Math.round((line.deductions ?? 0) * 100) / 100;
      const net = Math.round((gross - deductions) * 100) / 100;

      totalGross += gross;
      totalDeductions += deductions;

      return {
        employeeId: line.employeeId,
        daysWorked: line.daysWorked,
        dailyRate: line.dailyRate,
        grossAmount: gross,
        deductions,
        netAmount: net,
      };
    });

    totalGross = Math.round(totalGross * 100) / 100;
    totalDeductions = Math.round(totalDeductions * 100) / 100;
    const totalNet = Math.round((totalGross - totalDeductions) * 100) / 100;

    const runNumber = `WRUN-${dto.periodYear}-${String(dto.periodMonth).padStart(2, '0')}-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    // 2. Atomically post GL Wage Accrual + create WageRun record
    return this.prisma.$transaction(
      async (tx) => {
        const voucherResult = await this.postingService.postWageAccrual(
          {
            requestKey: `WAGE-ACCR-${companyId}-${runNumber}`,
            runNumber,
            companyId,
            grossWages: totalGross,
            deductions: totalDeductions,
            notes:
              dto.notes ?? `Wage accrual for ${dto.periodYear}-${dto.periodMonth}`,
            createdBy: userId,
          },
          tx,
        );

        const wageRun = await tx.wageRun.create({
          data: {
            companyId,
            runNumber,
            periodMonth: dto.periodMonth,
            periodYear: dto.periodYear,
            runType,
            status: 'ACCRUED',
            totalAmount: totalNet,
            voucherId: voucherResult.voucherId,
            notes: dto.notes,
            createdBy: userId,
            lines: {
              create: linesToCreate,
            },
          },
          include: {
            lines: { include: { employee: true } },
          },
        });

        return {
          ...wageRun,
          voucherNumber: voucherResult.voucherNumber,
          journalEntryId: voucherResult.journalEntryId,
        };
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  async disburseWageRun(id: string, dto?: DisburseWageRunDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const wageRun = await this.prisma.wageRun.findFirst({
      where: { id, companyId },
      include: { lines: true },
    });
    if (!wageRun) throw new NotFoundException('Wage run not found');

    if (wageRun.status === 'DISBURSED') {
      throw new BadRequestException('Wage run has already been disbursed');
    }

    const paymentMethod = dto?.paymentMethod ?? 'BANK';
    const disbursementNumber = `DISB-${wageRun.runNumber}`;

    // 1. Atomically post GL Disbursement voucher + update status to DISBURSED (HR-01)
    return this.prisma.$transaction(
      async (tx) => {
        const voucherResult = await this.postingService.postWageDisbursement(
          {
            requestKey: `WAGE-DISB-${companyId}-${disbursementNumber}`,
            disbursementNumber,
            companyId,
            amount: wageRun.totalAmount,
            paymentMethod,
            notes: dto?.notes ?? `Wage disbursement for run ${wageRun.runNumber}`,
            createdBy: userId,
          },
          tx,
        );

        const updated = await tx.wageRun.update({
          where: { id: wageRun.id },
          data: {
            status: 'DISBURSED',
            disbursementVoucherId: voucherResult.voucherId,
            disbursedAt: new Date(),
          },
          include: {
            lines: { include: { employee: true } },
          },
        });

        return {
          ...updated,
          disbursementVoucherNumber: voucherResult.voucherNumber,
          journalEntryId: voucherResult.journalEntryId,
        };
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  async findOne(id: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const run = await this.prisma.wageRun.findFirst({
      where: { id, companyId },
      include: {
        lines: { include: { employee: true } },
      },
    });
    if (!run) throw new NotFoundException('Wage run not found');
    return run;
  }

  async findAll(query?: { periodYear?: number; periodMonth?: number; status?: string }) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    return this.prisma.wageRun.findMany({
      where: {
        companyId,
        periodYear: query?.periodYear ? Number(query.periodYear) : undefined,
        periodMonth: query?.periodMonth ? Number(query.periodMonth) : undefined,
        status: query?.status,
      },
      include: {
        lines: { include: { employee: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
