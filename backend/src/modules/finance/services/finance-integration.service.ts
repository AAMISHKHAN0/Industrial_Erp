import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { Prisma, AccountType } from '@prisma/client';
import {
  SYSTEM_ACCOUNTS,
  seedDefaultAccounts,
} from '../account/default-accounts';

@Injectable()
export class FinanceIntegrationService {
  private entrySeq = 0;
  private readonly logger = new Logger(FinanceIntegrationService.name);

  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private tenant: TenantContext,
  ) {}

  private async nextEntryNumber(): Promise<string> {
    this.entrySeq++;
    return `JE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(this.entrySeq).padStart(4, '0')}-${Date.now().toString(36).slice(-4)}`;
  }

  /** Find an account by code (company-scoped) or auto-create it from the
   *  standard mapping. This guarantees journal entries always post. */
  private async ensureAccount(
    tx: Prisma.TransactionClient,
    accountCode: string,
    providedCompanyId?: string,
  ) {
    const companyId = providedCompanyId ?? this.tenant.companyId!;
    const existing = await tx.account.findFirst({
      where: { companyId, accountCode },
    });
    if (existing) return existing;

    const def = SYSTEM_ACCOUNTS[accountCode] ?? {
      type: 'ASSET',
      name: accountCode,
    };
    this.logger.warn(
      `Account "${accountCode}" missing — auto-creating as ${def.type}`,
    );
    return tx.account.create({
      data: {
        companyId,
        accountCode,
        name: def.name,
        type: def.type,
        isActive: true,
        balance: 0,
      },
    });
  }

  /** Seed the standard accounts for a company (safe to call multiple times). */
  async seedDefaultAccounts(companyId: string, createdBy?: string) {
    await seedDefaultAccounts(this.prisma, companyId, createdBy);
  }

  async createJournalEntry(
    params: {
      companyId?: string;
      entryDate?: Date;
      reference: string;
      description: string;
      items: Array<{
        accountCode: string;
        debit?: number;
        credit?: number;
        description?: string;
      }>;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    const companyId = params.companyId ?? this.tenant.companyId!;
    const entryNumber = await this.nextEntryNumber();
    const totalDebit = params.items.reduce((s, i) => s + (i.debit ?? 0), 0);
    const totalCredit = params.items.reduce((s, i) => s + (i.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01)
      throw new Error(
        `Journal entry unbalanced: debit ${totalDebit} != credit ${totalCredit}`,
      );

    const execute = async (tx: Prisma.TransactionClient) => {
      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          entryDate: params.entryDate ?? new Date(),
          reference: params.reference,
          description: params.description,
          isPosted: true,
          postedAt: new Date(),
          postedBy: params.createdBy,
          createdBy: params.createdBy,
          items: {
            create: await Promise.all(
              params.items.map(async (item) => {
                const account = await this.ensureAccount(
                  tx,
                  item.accountCode,
                  companyId,
                );
                const debitAmt = item.debit ?? 0;
                const creditAmt = item.credit ?? 0;
                let balanceDelta = 0;
                if (['ASSET', 'EXPENSE'].includes(account.type)) {
                  balanceDelta = debitAmt - creditAmt;
                } else {
                  balanceDelta = creditAmt - debitAmt;
                }
                if (balanceDelta !== 0) {
                  await tx.account.update({
                    where: { id: account.id },
                    data: { balance: { increment: balanceDelta } },
                  });
                }
                return {
                  accountId: account.id,
                  debitAmount: debitAmt,
                  creditAmount: creditAmt,
                  description: item.description,
                };
              }),
            ),
          },
        },
        include: { items: true },
      });

      await this.auditLog.log(
        {
          companyId,
          entity: 'JournalEntry',
          entityId: entry.id,
          action: 'POSTED',
          userId: params.createdBy,
          newValue: entry,
        },
        tx,
      );
      return entry;
    };

    return externalTx ? execute(externalTx) : this.prisma.$transaction(execute);
  }

  async createPurchaseJournalEntry(
    params: {
      poNumber: string;
      vendorName: string;
      totalAmount: number;
      inventoryAccountCode?: string;
      payableAccountCode?: string;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    return this.createJournalEntry(
      {
        reference: `PO-${params.poNumber}`,
        description: `Purchase from ${params.vendorName}`,
        items: [
          {
            accountCode: params.inventoryAccountCode ?? 'INVENTORY',
            debit: params.totalAmount,
            description: `Inventory - ${params.poNumber}`,
          },
          {
            accountCode: params.payableAccountCode ?? 'ACCOUNTS_PAYABLE',
            credit: params.totalAmount,
            description: `AP - ${params.vendorName}`,
          },
        ],
        createdBy: params.createdBy,
      },
      externalTx,
    );
  }

  async createSalesJournalEntry(
    params: {
      soNumber: string;
      customerName: string;
      totalAmount: number;
      receivableAccountCode?: string;
      revenueAccountCode?: string;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    return this.createJournalEntry(
      {
        reference: `SO-${params.soNumber}`,
        description: `Sales to ${params.customerName}`,
        items: [
          {
            accountCode: params.receivableAccountCode ?? 'ACCOUNTS_RECEIVABLE',
            debit: params.totalAmount,
            description: `AR - ${params.customerName}`,
          },
          {
            accountCode: params.revenueAccountCode ?? 'SALES_REVENUE',
            credit: params.totalAmount,
            description: `Revenue - ${params.soNumber}`,
          },
        ],
        createdBy: params.createdBy,
      },
      externalTx,
    );
  }

  async createPayrollJournalEntry(
    params: {
      periodName: string;
      totalSalary: number;
      totalDeductions: number;
      netPay: number;
      salaryExpenseAccountCode?: string;
      salaryPayableAccountCode?: string;
      deductionsAccountCode?: string;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    const items: Array<{
      accountCode: string;
      debit?: number;
      credit?: number;
      description?: string;
    }> = [
      {
        accountCode: params.salaryExpenseAccountCode ?? 'SALARY_EXPENSE',
        debit: params.totalSalary,
        description: `Gross salary - ${params.periodName}`,
      },
      {
        accountCode: params.salaryPayableAccountCode ?? 'SALARY_PAYABLE',
        credit: params.netPay,
        description: `Net pay - ${params.periodName}`,
      },
    ];
    if (params.totalDeductions && params.totalDeductions > 0) {
      items.push({
        accountCode: params.deductionsAccountCode ?? 'PAYROLL_DEDUCTIONS',
        credit: params.totalDeductions,
        description: `Payroll deductions - ${params.periodName}`,
      });
    }
    return this.createJournalEntry(
      {
        reference: `PAYROLL-${params.periodName}`,
        description: `Salary for ${params.periodName}`,
        items,
        createdBy: params.createdBy,
      },
      externalTx,
    );
  }
}
