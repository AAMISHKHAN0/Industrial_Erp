import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { PostingService } from '../services/posting.service';
import {
  CreateSundryExpenseDto,
  QuerySundryExpenseDto,
} from './dto/expense.dto';
import { buildPagination } from '../../../common/utils/pagination';

@Injectable()
export class ExpenseService {
  constructor(
    private prisma: PrismaService,
    private postingService: PostingService,
    private tenant: TenantContext,
  ) {}

  async createSundry(dto: CreateSundryExpenseDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const amount = Math.round(dto.amount * 100) / 100;
    if (amount <= 0) {
      throw new BadRequestException('Expense amount must be greater than zero');
    }

    const paymentMethod = dto.paymentMethod ?? 'CASH';
    const creditAccount = paymentMethod === 'BANK' ? 'BANK' : 'CASH';
    const expenseDate = dto.expenseDate ? new Date(dto.expenseDate) : new Date();
    const category = dto.category.trim().toUpperCase();
    const dateStr = expenseDate.toISOString().slice(0, 10).replace(/-/g, '');
    const expRef = `EXP-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
    const reqKey =
      dto.requestKey ??
      `EXP-${companyId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const voucherResult = await this.postingService.post({
      action: 'RECORD_SUNDRY_EXPENSE',
      requestKey: reqKey,
      voucherType: 'SUNDRY_EXPENSE',
      businessDate: expenseDate,
      companyId,
      reference: expRef,
      notes: `[${category}] ${dto.payee.trim()}${dto.notes?.trim() ? ` - ${dto.notes.trim()}` : ''}`,
      metadata: {
        group: 'SUNDRY_EXPENSE',
        category,
        payee: dto.payee.trim(),
        ntn: dto.ntn?.trim() || null,
        paymentMethod,
        amount,
        notes: dto.notes?.trim() || null,
      },
      createdBy: userId,
      journalItems: [
        {
          accountCode: 'SUNDRY_EXPENSE',
          debit: amount,
          description: `Sundry Expense (${category}) - ${dto.payee.trim()}`,
        },
        {
          accountCode: creditAccount,
          credit: amount,
          description: `Paid via ${paymentMethod} (${expRef})`,
        },
      ],
    });

    return {
      id: voucherResult.voucherId,
      voucherId: voucherResult.voucherId,
      voucherNumber: voucherResult.voucherNumber,
      entryNumber: expRef,
      date: voucherResult.businessDate,
      category,
      payee: dto.payee.trim(),
      ntn: dto.ntn?.trim() || '',
      amount,
      paymentMode: paymentMethod,
      notes: dto.notes?.trim() || '',
      isPosted: true,
      journalEntryId: voucherResult.journalEntryId,
      replayed: voucherResult.replayed,
    };
  }

  async findAll(query: QuerySundryExpenseDto) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const { page, limit, skip } = buildPagination(query);
    const cat =
      query.category && query.category !== 'ALL'
        ? query.category.trim().toUpperCase()
        : undefined;
    const where: any = {
      companyId,
      voucherType: 'SUNDRY_EXPENSE',
      status: 'POSTED',
      ...(cat ? { notes: { startsWith: `[${cat}]` } } : {}),
    };

    const [vouchers, total] = await Promise.all([
      this.prisma.voucher.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          journalEntry: {
            include: { items: { include: { account: true } } },
          },
        },
      }),
      this.prisma.voucher.count({ where }),
    ]);

    const data = vouchers.map((v) => {
      const meta = (v.metadata ?? {}) as Record<string, any>;
      const debitItem = v.journalEntry?.items.find((i) => i.debitAmount > 0);
      const creditItem = v.journalEntry?.items.find((i) => i.creditAmount > 0);
      const amount =
        Number(meta.amount) || Number(debitItem?.debitAmount ?? 0);
      const paymentMode =
        meta.paymentMethod ||
        (creditItem?.account?.accountCode === 'BANK' ? 'BANK' : 'CASH');

      return {
        id: v.id,
        voucherId: v.id,
        voucherNumber: v.voucherNumber,
        entryNumber: v.reference || v.voucherNumber,
        date: v.businessDate,
        category: meta.category || 'DAILY_MISC',
        payee: meta.payee || 'Unknown Payee',
        ntn: meta.ntn || '',
        amount: Math.round(amount * 100) / 100,
        paymentMode,
        notes: meta.notes || v.notes || '',
        isPosted: true,
        createdAt: v.createdAt,
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
