import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { PostingService } from '../../finance/services/posting.service';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';
import { CreateCustomerReceiptDto } from './dto/customer-receipt.dto';

@Injectable()
export class CustomerReceiptService {
  constructor(
    private prisma: PrismaService,
    private postingService: PostingService,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateCustomerReceiptDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) {
      throw new BadRequestException('Company context required');
    }

    const received = Math.round((dto.amountReceived ?? 0) * 100) / 100;
    const withheld = Math.round((dto.taxWithheld ?? 0) * 100) / 100;
    const totalSettled = Math.round((received + withheld) * 100) / 100;

    if (totalSettled <= 0) {
      throw new BadRequestException('Receipt amount or withholding must be greater than zero');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const receiptDate = dto.receiptDate ? new Date(dto.receiptDate) : new Date();

    // Check accounting period
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        companyId,
        startDate: { lte: receiptDate },
        endDate: { gte: receiptDate },
      },
    });
    if (period && period.isClosed) {
      throw new BadRequestException('Accounting period is closed');
    }

    const receiptNumber = await resolveAutoCode(
      this.prisma.customerReceipt,
      companyId,
      'receiptNumber',
      'REC',
      dto.receiptNumber,
    );

    const existing = await this.prisma.customerReceipt.findUnique({
      where: { companyId_receiptNumber: { companyId, receiptNumber } },
    });
    if (existing) {
      throw new ConflictException(`Receipt number ${receiptNumber} already exists`);
    }

    const chequeStatus =
      dto.paymentMethod === 'CHEQUE' ? 'PENDING_CLEARANCE' : 'NONE';

    const combinedNotes =
      dto.bankReference && (!dto.notes || !dto.notes.includes(dto.bankReference))
        ? [`Bank Ref: ${dto.bankReference}`, dto.notes].filter(Boolean).join(' | ')
        : dto.notes;

    return this.prisma.$transaction(
      async (tx) => {
        // Validate invoice allocations if provided
        const allocationRecords: Array<{
          invoiceId: string;
          allocatedAmount: number;
          allocatedWithholding: number;
          totalAllocated: number;
        }> = [];

        if (dto.allocations && dto.allocations.length > 0) {
          let sumAllocated = 0;
          for (const alloc of dto.allocations) {
            const allocAmt = Math.round((alloc.amount ?? 0) * 100) / 100;
            const allocWht = Math.round((alloc.withholding ?? 0) * 100) / 100;
            const allocTotal = Math.round((allocAmt + allocWht) * 100) / 100;

            if (allocTotal <= 0) continue;

            // Row-lock the invoice
            const invoiceRows: any[] = await tx.$queryRaw`
              SELECT id, "outstandingAmount", "paidAmount", "withheldAmount", status
              FROM "sales_invoices"
              WHERE id = ${alloc.invoiceId} AND "companyId" = ${companyId}
              FOR UPDATE
            `;

            if (invoiceRows.length === 0) {
              throw new NotFoundException(`Sales invoice ${alloc.invoiceId} not found`);
            }
            const invoice = invoiceRows[0];

            if (allocTotal > invoice.outstandingAmount + 0.01) {
              throw new BadRequestException(
                `Allocation amount (${allocTotal}) exceeds outstanding invoice balance (${invoice.outstandingAmount})`,
              );
            }

            const newPaid = Math.round((invoice.paidAmount + allocAmt) * 100) / 100;
            const newWithheld = Math.round((invoice.withheldAmount + allocWht) * 100) / 100;
            const newOutstanding = Math.max(
              0,
              Math.round((invoice.outstandingAmount - allocTotal) * 100) / 100,
            );
            const newStatus = newOutstanding === 0 ? 'PAID' : 'PARTIALLY_PAID';

            await tx.salesInvoice.update({
              where: { id: alloc.invoiceId },
              data: {
                paidAmount: newPaid,
                withheldAmount: newWithheld,
                outstandingAmount: newOutstanding,
                status: newStatus,
                updatedBy: userId,
              },
            });

            allocationRecords.push({
              invoiceId: alloc.invoiceId,
              allocatedAmount: allocAmt,
              allocatedWithholding: allocWht,
              totalAllocated: allocTotal,
            });

            sumAllocated += allocTotal;
          }

          if (Math.round(sumAllocated * 100) / 100 > totalSettled + 0.01) {
            throw new BadRequestException(
              `Total allocations (${sumAllocated}) cannot exceed total settled receipt amount (${totalSettled})`,
            );
          }
        }

        // Post GL Voucher:
        // Dr Cash / Bank / Uncleared Cheques
        // Dr Withholding Tax Receivable
        // Cr Accounts Receivable
        const voucherResult = await this.postingService.postCustomerReceipt(
          {
            requestKey: `REC-POST-${companyId}-${receiptNumber}`,
            receiptNumber,
            businessDate: receiptDate,
            companyId,
            customerName: customer.name,
            amountReceived: received,
            taxWithheld: withheld,
            paymentMethod: dto.paymentMethod,
            chequeStatus,
            notes: combinedNotes,
            createdBy: userId,
          },
          tx,
        );

        // Create CustomerReceipt record
        const receipt = await tx.customerReceipt.create({
          data: {
            companyId,
            receiptNumber,
            customerId: dto.customerId,
            receiptDate,
            paymentMethod: dto.paymentMethod,
            amountReceived: received,
            taxWithheld: withheld,
            totalSettled,
            withholdingCertificate: dto.withholdingCertificate,
            withholdingSection: dto.withholdingSection,
            status: 'POSTED',
            chequeNumber: dto.chequeNumber,
            chequeDate: dto.chequeDate ? new Date(dto.chequeDate) : null,
            chequeBank: dto.chequeBank,
            chequeStatus,
            voucherId: voucherResult.voucherId,
            notes: combinedNotes,
            createdBy: userId,
            allocations: {
              create: allocationRecords.map((a) => ({
                companyId,
                invoiceId: a.invoiceId,
                allocatedAmount: a.allocatedAmount,
                allocatedWithholding: a.allocatedWithholding,
                totalAllocated: a.totalAllocated,
              })),
            },
          },
          include: {
            allocations: { include: { invoice: true } },
            customer: true,
          },
        });

        return {
          ...receipt,
          voucherNumber: voucherResult.voucherNumber,
          journalEntryId: voucherResult.journalEntryId,
        };
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  async findOne(id: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const receipt = await this.prisma.customerReceipt.findFirst({
      where: {
        companyId,
        OR: [{ id }, { receiptNumber: id }],
        deletedAt: null,
      },
      include: {
        allocations: { include: { invoice: true } },
        customer: true,
      },
    });
    if (!receipt) throw new NotFoundException('Customer receipt not found');
    return receipt;
  }

  async findAll(query?: { customerId?: string; paymentMethod?: string; chequeStatus?: string }) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    return this.prisma.customerReceipt.findMany({
      where: {
        companyId,
        customerId: query?.customerId,
        paymentMethod: query?.paymentMethod,
        chequeStatus: query?.chequeStatus,
        deletedAt: null,
      },
      include: {
        customer: true,
        allocations: { include: { invoice: true } },
      },
      orderBy: { receiptDate: 'desc' },
    });
  }

  /**
   * Cheque Clearance (AR-02):
   * Moves funds Dr Bank / Cr Uncleared Cheques.
   * Updates chequeStatus to CLEARED.
   */
  async clearCheque(id: string, clearanceDate?: Date | string, userId?: string) {
    const receipt = await this.findOne(id);
    if (receipt.paymentMethod !== 'CHEQUE') {
      throw new BadRequestException('Only cheque receipts can be cleared');
    }
    if (receipt.chequeStatus !== 'PENDING_CLEARANCE') {
      throw new BadRequestException(`Cheque is already ${receipt.chequeStatus}`);
    }

    const cDate = clearanceDate ? new Date(clearanceDate) : new Date();

    return this.prisma.$transaction(
      async (tx) => {
        const voucherResult = await this.postingService.clearCheque(
          {
            requestKey: `CLR-${receipt.companyId}-${receipt.receiptNumber}`,
            receiptNumber: receipt.receiptNumber,
            clearanceDate: cDate,
            companyId: receipt.companyId,
            amount: receipt.amountReceived,
            notes: `Clearance of cheque ${receipt.chequeNumber ?? ''}`,
            createdBy: userId,
          },
          tx,
        );

        const updated = await tx.customerReceipt.update({
          where: { id: receipt.id },
          data: {
            chequeStatus: 'CLEARED',
            clearedDate: cDate,
            updatedBy: userId,
          },
          include: { allocations: true, customer: true },
        });

        return {
          ...updated,
          clearanceVoucherNumber: voucherResult.voucherNumber,
        };
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  /**
   * Cheque Return (bounced cheque) (AR-02):
   * 1. Marks chequeStatus as RETURNED with reason.
   * 2. Re-opens invoice balances (restores outstandingAmount, resets status).
   * 3. Reverses the voucher trail (posting contra-journal Dr AR / Cr Uncleared Cheques or Bank).
   */
  async returnCheque(id: string, reason: string, returnDate?: Date | string, userId?: string) {
    const receipt = await this.findOne(id);
    if (receipt.paymentMethod !== 'CHEQUE') {
      throw new BadRequestException('Only cheque receipts can be returned');
    }
    if (receipt.chequeStatus === 'RETURNED') {
      throw new BadRequestException('Cheque has already been marked RETURNED');
    }

    const rDate = returnDate ? new Date(returnDate) : new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Re-open allocated invoices
      for (const alloc of receipt.allocations) {
        const inv = await tx.salesInvoice.findUnique({
          where: { id: alloc.invoiceId },
        });
        if (inv) {
          const restoredOutstanding =
            Math.round((inv.outstandingAmount + alloc.totalAllocated) * 100) / 100;
          const restoredPaid =
            Math.max(0, Math.round((inv.paidAmount - alloc.allocatedAmount) * 100) / 100);
          const restoredWithheld =
            Math.max(0, Math.round((inv.withheldAmount - alloc.allocatedWithholding) * 100) / 100);

          await tx.salesInvoice.update({
            where: { id: inv.id },
            data: {
              outstandingAmount: restoredOutstanding,
              paidAmount: restoredPaid,
              withheldAmount: restoredWithheld,
              status: restoredOutstanding === inv.totalAmount ? 'POSTED' : 'PARTIALLY_PAID',
              updatedBy: userId,
            },
          });
        }
      }

      // 2. Reverse receipt voucher
      let reversalResult: any = null;
      if (receipt.voucherId) {
        reversalResult = await this.postingService.reverseVoucher(
          {
            voucherId: receipt.voucherId,
            reason: `Cheque return: ${reason}`,
            reversalDate: rDate,
            actorId: userId,
          },
          tx,
        );
      }

      // 3. Update customer receipt status
      const updated = await tx.customerReceipt.update({
        where: { id: receipt.id },
        data: {
          chequeStatus: 'RETURNED',
          returnReason: reason,
          status: 'REVERSED',
          reversalVoucherId: reversalResult?.reversalVoucherId,
          updatedBy: userId,
        },
        include: { allocations: { include: { invoice: true } }, customer: true },
      });

      return {
        ...updated,
        reversalVoucherNumber: reversalResult?.reversalVoucherNumber,
      };
    });
  }

  /**
   * General Customer Receipt Reversal (AR-01):
   * Reverses GL voucher (swapping debits and credits: Cr Cash, Cr Withholding, Dr AR).
   * Re-opens outstanding invoice balance back to full.
   */
  async reverse(id: string, reason: string, reversalDate?: Date | string, userId?: string) {
    const receipt = await this.findOne(id);
    if (receipt.status === 'REVERSED') {
      throw new BadRequestException('Receipt has already been reversed');
    }

    const rDate = reversalDate ? new Date(reversalDate) : new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Re-open allocated invoices
      for (const alloc of receipt.allocations) {
        const inv = await tx.salesInvoice.findUnique({
          where: { id: alloc.invoiceId },
        });
        if (inv) {
          const restoredOutstanding =
            Math.round((inv.outstandingAmount + alloc.totalAllocated) * 100) / 100;
          const restoredPaid =
            Math.max(0, Math.round((inv.paidAmount - alloc.allocatedAmount) * 100) / 100);
          const restoredWithheld =
            Math.max(0, Math.round((inv.withheldAmount - alloc.allocatedWithholding) * 100) / 100);

          await tx.salesInvoice.update({
            where: { id: inv.id },
            data: {
              outstandingAmount: restoredOutstanding,
              paidAmount: restoredPaid,
              withheldAmount: restoredWithheld,
              status: restoredOutstanding === inv.totalAmount ? 'POSTED' : 'PARTIALLY_PAID',
              updatedBy: userId,
            },
          });
        }
      }

      // 2. Reverse voucher in GL
      let reversalResult: any = null;
      if (receipt.voucherId) {
        reversalResult = await this.postingService.reverseVoucher(
          {
            voucherId: receipt.voucherId,
            reason,
            reversalDate: rDate,
            actorId: userId,
          },
          tx,
        );
      }

      // 3. Update customer receipt status
      const updated = await tx.customerReceipt.update({
        where: { id: receipt.id },
        data: {
          status: 'REVERSED',
          reversalVoucherId: reversalResult?.reversalVoucherId,
          updatedBy: userId,
        },
        include: { allocations: { include: { invoice: true } }, customer: true },
      });

      return {
        ...updated,
        reversalVoucherNumber: reversalResult?.reversalVoucherNumber,
      };
    });
  }
}
