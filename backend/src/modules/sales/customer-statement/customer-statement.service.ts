import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant-context';

export interface StatementEntry {
  date: Date;
  type: 'INVOICE' | 'RECEIPT' | 'REVERSAL';
  reference: string;
  documentNumber: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  withholdingAmount?: number;
  status: string;
}

export interface CustomerStatementResult {
  customer: {
    id: string;
    customerCode: string;
    name: string;
    taxNumber?: string;
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  entries: StatementEntry[];
  openInvoicesOutstanding: number;
  isReconciled: boolean;
}

export interface CustomerAgingBucket {
  customerId: string;
  customerCode: string;
  customerName: string;
  current: number; // 0-30 days
  days31To60: number; // 31-60 days
  days61To90: number; // 61-90 days
  over90Days: number; // > 90 days
  totalOutstanding: number;
}

export interface ArAgingResult {
  asOfDate: Date;
  customers: CustomerAgingBucket[];
  totalCurrent: number;
  totalDays31To60: number;
  totalDays61To90: number;
  totalOver90Days: number;
  grandTotalOutstanding: number;
  glArBalance: number;
  isGlReconciled: boolean;
  variance: number;
}

@Injectable()
export class CustomerStatementService {
  constructor(
    private prisma: PrismaService,
    private tenant: TenantContext,
  ) {}

  async getCustomerStatement(
    customerId: string,
    startDateStr?: string,
    endDateStr?: string,
  ): Promise<CustomerStatementResult> {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const startDate = startDateStr
      ? new Date(startDateStr)
      : new Date(new Date().getFullYear(), 0, 1);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    // 1. Calculate Opening Balance prior to startDate
    const priorInvoices = await this.prisma.salesInvoice.findMany({
      where: {
        companyId,
        customerId,
        invoiceDate: { lt: startDate },
        status: { notIn: ['CANCELLED', 'DRAFT'] },
      },
    });
    const priorDebits = priorInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    const priorReceipts = await this.prisma.customerReceipt.findMany({
      where: {
        companyId,
        customerId,
        receiptDate: { lt: startDate },
        status: 'POSTED',
      },
    });
    const priorCredits = priorReceipts.reduce((sum, rec) => sum + rec.totalSettled, 0);

    const openingBalance = Math.round((priorDebits - priorCredits) * 100) / 100;

    // 2. Fetch Period Invoices
    const periodInvoices = await this.prisma.salesInvoice.findMany({
      where: {
        companyId,
        customerId,
        invoiceDate: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED', 'DRAFT'] },
      },
    });

    // 3. Fetch Period Receipts
    const periodReceipts = await this.prisma.customerReceipt.findMany({
      where: {
        companyId,
        customerId,
        receiptDate: { gte: startDate, lte: endDate },
        status: 'POSTED',
      },
    });

    // 4. Merge and sort chronological entries
    const rawEntries: Array<{
      date: Date;
      type: 'INVOICE' | 'RECEIPT' | 'REVERSAL';
      reference: string;
      documentNumber: string;
      description: string;
      debit: number;
      credit: number;
      withholdingAmount?: number;
      status: string;
    }> = [];

    for (const inv of periodInvoices) {
      rawEntries.push({
        date: inv.invoiceDate,
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        documentNumber: inv.invoiceNumber,
        description: inv.notes ?? `Sales Invoice ${inv.invoiceNumber}`,
        debit: inv.totalAmount,
        credit: 0,
        status: inv.status,
      });
    }

    for (const rec of periodReceipts) {
      rawEntries.push({
        date: rec.receiptDate,
        type: 'RECEIPT',
        reference: rec.receiptNumber,
        documentNumber: rec.receiptNumber,
        description: `Payment received via ${rec.paymentMethod}${rec.chequeNumber ? ' (Chq #' + rec.chequeNumber + ')' : ''}`,
        debit: 0,
        credit: rec.totalSettled,
        withholdingAmount: rec.taxWithheld,
        status: rec.status,
      });
    }

    rawEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = openingBalance;
    let totalDebits = 0;
    let totalCredits = 0;

    const entries: StatementEntry[] = rawEntries.map((e) => {
      totalDebits += e.debit;
      totalCredits += e.credit;
      runningBalance = Math.round((runningBalance + e.debit - e.credit) * 100) / 100;
      return {
        ...e,
        balance: runningBalance,
      };
    });

    totalDebits = Math.round(totalDebits * 100) / 100;
    totalCredits = Math.round(totalCredits * 100) / 100;
    const closingBalance = runningBalance;

    // 5. Open Invoices Check
    const openInvoices = await this.prisma.salesInvoice.findMany({
      where: {
        companyId,
        customerId,
        status: { in: ['POSTED', 'PARTIALLY_PAID'] },
      },
    });
    const openInvoicesOutstanding =
      Math.round(openInvoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0) * 100) / 100;

    const isReconciled = Math.abs(closingBalance - openInvoicesOutstanding) < 0.01;

    return {
      customer: {
        id: customer.id,
        customerCode: customer.customerCode,
        name: customer.name,
        taxNumber: customer.taxNumber ?? undefined,
      },
      period: {
        startDate,
        endDate,
      },
      openingBalance,
      totalDebits,
      totalCredits,
      closingBalance,
      entries,
      openInvoicesOutstanding,
      isReconciled,
    };
  }

  async getArAging(asOfDateStr?: string): Promise<ArAgingResult> {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

    const openInvoices = await this.prisma.salesInvoice.findMany({
      where: {
        companyId,
        status: { in: ['POSTED', 'PARTIALLY_PAID'] },
        outstandingAmount: { gt: 0 },
        invoiceDate: { lte: asOfDate },
      },
      include: { customer: true },
    });

    const customerMap = new Map<string, CustomerAgingBucket>();

    for (const inv of openInvoices) {
      if (!customerMap.has(inv.customerId)) {
        customerMap.set(inv.customerId, {
          customerId: inv.customerId,
          customerCode: inv.customer.customerCode,
          customerName: inv.customer.name,
          current: 0,
          days31To60: 0,
          days61To90: 0,
          over90Days: 0,
          totalOutstanding: 0,
        });
      }

      const bucket = customerMap.get(inv.customerId)!;
      const daysOld = Math.floor(
        (asOfDate.getTime() - inv.invoiceDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const outstanding = inv.outstandingAmount;

      bucket.totalOutstanding =
        Math.round((bucket.totalOutstanding + outstanding) * 100) / 100;

      if (daysOld <= 30) {
        bucket.current = Math.round((bucket.current + outstanding) * 100) / 100;
      } else if (daysOld <= 60) {
        bucket.days31To60 = Math.round((bucket.days31To60 + outstanding) * 100) / 100;
      } else if (daysOld <= 90) {
        bucket.days61To90 = Math.round((bucket.days61To90 + outstanding) * 100) / 100;
      } else {
        bucket.over90Days = Math.round((bucket.over90Days + outstanding) * 100) / 100;
      }
    }

    const customers = Array.from(customerMap.values());
    let totalCurrent = 0;
    let totalDays31To60 = 0;
    let totalDays61To90 = 0;
    let totalOver90Days = 0;
    let grandTotalOutstanding = 0;

    for (const c of customers) {
      totalCurrent += c.current;
      totalDays31To60 += c.days31To60;
      totalDays61To90 += c.days61To90;
      totalOver90Days += c.over90Days;
      grandTotalOutstanding += c.totalOutstanding;
    }

    totalCurrent = Math.round(totalCurrent * 100) / 100;
    totalDays31To60 = Math.round(totalDays31To60 * 100) / 100;
    totalDays61To90 = Math.round(totalDays61To90 * 100) / 100;
    totalOver90Days = Math.round(totalOver90Days * 100) / 100;
    grandTotalOutstanding = Math.round(grandTotalOutstanding * 100) / 100;

    // Check GL Accounts Receivable Control Account Balance
    const arAccount = await this.prisma.account.findFirst({
      where: {
        companyId,
        accountCode: 'ACCOUNTS_RECEIVABLE',
      },
    });
    const glArBalance = arAccount ? Number(arAccount.balance) : 0;
    const variance = Math.round(Math.abs(grandTotalOutstanding - glArBalance) * 100) / 100;

    return {
      asOfDate,
      customers,
      totalCurrent,
      totalDays31To60,
      totalDays61To90,
      totalOver90Days,
      grandTotalOutstanding,
      glArBalance,
      isGlReconciled: variance < 0.01,
      variance,
    };
  }
}
