import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { PostingService } from '../services/posting.service';
import { StatutoryService } from '../statutory/statutory.service';
import {
  CreateVendorPaymentDto,
  CreateUtilityPaymentDto,
  CreateFixedAssetPaymentDto,
  CreateOutgoingPaymentDto,
  QueryPaymentsDto,
} from './dto/payment.dto';
import { buildPagination } from '../../../common/utils/pagination';

const GROUP_TO_VOUCHER_TYPE: Record<string, string> = {
  VENDOR_PAYMENT: 'SUPPLIER_PAYMENT',
  VENDOR: 'SUPPLIER_PAYMENT',
  UTILITY: 'UTILITY_PAYMENT',
  FIXED_ASSET: 'FIXED_ASSET_PURCHASE',
  STATUTORY: 'STATUTORY_PAYMENT',
};

const VOUCHER_TYPE_TO_GROUP: Record<string, string> = {
  SUPPLIER_PAYMENT: 'VENDOR_PAYMENT',
  UTILITY_PAYMENT: 'UTILITY',
  FIXED_ASSET_PURCHASE: 'FIXED_ASSET',
  STATUTORY_PAYMENT: 'STATUTORY',
};

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private postingService: PostingService,
    private statutoryService: StatutoryService,
    private tenant: TenantContext,
  ) {}

  async recordVendorPayment(dto: CreateVendorPaymentDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const amount = Math.round(dto.amount * 100) / 100;
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const paymentMethod = dto.paymentMethod ?? 'BANK';
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const paymentNumber = `VEN-${Date.now().toString().slice(-6)}`;
    const reqKey =
      dto.requestKey ??
      `PAY-VEN-${companyId}-${dto.vendorId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    return this.prisma.$transaction(
      async (tx) => {
        const vendor = await tx.vendor.findFirst({
          where: { id: dto.vendorId, companyId, deletedAt: null },
        });
        if (!vendor) throw new NotFoundException('Vendor not found');

        const settledBills: Array<{
          supplierBillId: string;
          billNumber: string;
          settledAmount: number;
          status: string;
        }> = [];

        if (dto.billAllocations && dto.billAllocations.length > 0) {
          const totalAllocated =
            Math.round(
              dto.billAllocations.reduce((s, a) => s + Number(a.amount), 0) *
                100,
            ) / 100;
          if (totalAllocated > amount + 0.01) {
            throw new BadRequestException(
              `Total bill allocations (${totalAllocated}) exceed payment amount (${amount})`,
            );
          }
          for (const alloc of dto.billAllocations) {
            const allocAmt = Math.round(Number(alloc.amount) * 100) / 100;
            const rows: any[] = await tx.$queryRaw`
              SELECT id, "billNumber", "vendorId", "totalAmount", "paidAmount", status
              FROM "supplier_bills"
              WHERE id = ${alloc.supplierBillId} AND "companyId" = ${companyId} AND "deletedAt" IS NULL
              FOR UPDATE
            `;
            if (rows.length === 0) {
              throw new NotFoundException(
                `Supplier bill ${alloc.supplierBillId} not found`,
              );
            }
            const bill = rows[0];
            if (bill.vendorId !== vendor.id) {
              throw new BadRequestException(
                `Supplier bill ${bill.billNumber} does not belong to vendor ${vendor.name}`,
              );
            }
            const remaining = Math.max(
              0,
              Math.round((bill.totalAmount - bill.paidAmount) * 100) / 100,
            );
            if (allocAmt > remaining + 0.01) {
              throw new BadRequestException(
                `Allocation (${allocAmt}) exceeds remaining balance (${remaining}) on bill ${bill.billNumber}`,
              );
            }
            const newPaid = Math.round((bill.paidAmount + allocAmt) * 100) / 100;
            const newStatus =
              newPaid >= bill.totalAmount - 0.01 ? 'PAID' : 'PARTIALLY_PAID';
            await tx.supplierBill.update({
              where: { id: bill.id },
              data: { paidAmount: newPaid, status: newStatus, updatedBy: userId },
            });
            settledBills.push({
              supplierBillId: bill.id,
              billNumber: bill.billNumber,
              settledAmount: allocAmt,
              status: newStatus,
            });
          }
        } else if (dto.supplierBillId) {
          const rows: any[] = await tx.$queryRaw`
            SELECT id, "billNumber", "vendorId", "totalAmount", "paidAmount", status
            FROM "supplier_bills"
            WHERE id = ${dto.supplierBillId} AND "companyId" = ${companyId} AND "deletedAt" IS NULL
            FOR UPDATE
          `;
          if (rows.length === 0) {
            throw new NotFoundException('Supplier bill not found');
          }
          const bill = rows[0];
          if (bill.vendorId !== vendor.id) {
            throw new BadRequestException(
              'Supplier bill does not belong to the selected vendor',
            );
          }
          const remaining = Math.max(
            0,
            Math.round((bill.totalAmount - bill.paidAmount) * 100) / 100,
          );
          if (amount > remaining + 0.01) {
            throw new BadRequestException(
              `Payment amount (${amount}) exceeds remaining bill balance (${remaining})`,
            );
          }
          const newPaid = Math.round((bill.paidAmount + amount) * 100) / 100;
          const newStatus =
            newPaid >= bill.totalAmount - 0.01 ? 'PAID' : 'PARTIALLY_PAID';
          await tx.supplierBill.update({
            where: { id: bill.id },
            data: { paidAmount: newPaid, status: newStatus, updatedBy: userId },
          });
          settledBills.push({
            supplierBillId: bill.id,
            billNumber: bill.billNumber,
            settledAmount: amount,
            status: newStatus,
          });
        } else {
          // Auto-settle open bills FIFO (oldest first) up to payment amount
          const openBills: any[] = await tx.$queryRaw`
            SELECT id, "billNumber", "totalAmount", "paidAmount", status
            FROM "supplier_bills"
            WHERE "companyId" = ${companyId}
              AND "vendorId" = ${vendor.id}
              AND "deletedAt" IS NULL
              AND status IN ('POSTED', 'PARTIALLY_PAID')
            ORDER BY "billDate" ASC, "createdAt" ASC
            FOR UPDATE
          `;
          let remainingToApply = amount;
          for (const bill of openBills) {
            if (remainingToApply <= 0.009) break;
            const billRemaining = Math.max(
              0,
              Math.round((bill.totalAmount - bill.paidAmount) * 100) / 100,
            );
            if (billRemaining <= 0) continue;
            const applyAmt =
              Math.round(Math.min(remainingToApply, billRemaining) * 100) / 100;
            const newPaid = Math.round((bill.paidAmount + applyAmt) * 100) / 100;
            const newStatus =
              newPaid >= bill.totalAmount - 0.01 ? 'PAID' : 'PARTIALLY_PAID';
            await tx.supplierBill.update({
              where: { id: bill.id },
              data: { paidAmount: newPaid, status: newStatus, updatedBy: userId },
            });
            settledBills.push({
              supplierBillId: bill.id,
              billNumber: bill.billNumber,
              settledAmount: applyAmt,
              status: newStatus,
            });
            remainingToApply =
              Math.round((remainingToApply - applyAmt) * 100) / 100;
          }
        }

        const voucherResult = await this.postingService.postSupplierPayment(
          {
            requestKey: reqKey,
            paymentNumber,
            businessDate: paymentDate,
            companyId,
            vendorId: vendor.id,
            vendorName: vendor.name,
            amount,
            paymentMethod,
            notes:
              dto.notes ??
              `Vendor payment to ${vendor.name}${dto.reference ? ` (Ref: ${dto.reference})` : ''}`,
            metadata: {
              group: 'VENDOR_PAYMENT',
              vendorId: vendor.id,
              vendorName: vendor.name,
              paymentMethod,
              amount,
              reference: dto.reference ?? null,
              supplierBillId: dto.supplierBillId ?? null,
              settledBills,
            },
            createdBy: userId,
          },
          tx,
        );

        return {
          id: voucherResult.voucherId,
          voucherId: voucherResult.voucherId,
          voucherNumber: voucherResult.voucherNumber,
          referenceNumber: dto.reference || `PAY-${paymentNumber}`,
          date: voucherResult.businessDate,
          group: 'VENDOR_PAYMENT',
          headOrType: 'Vendor Payment',
          vendorId: vendor.id,
          beneficiary: vendor.name,
          amount,
          paymentMethod,
          status: 'POSTED',
          settledBills,
          journalEntryId: voucherResult.journalEntryId,
          replayed: voucherResult.replayed,
        };
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  async recordUtilityPayment(dto: CreateUtilityPaymentDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const amount = Math.round(dto.amount * 100) / 100;
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const paymentMethod = dto.paymentMethod ?? 'BANK';
    const creditAccount = paymentMethod === 'CASH' ? 'CASH' : 'BANK';
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const utilRef = `UTIL-${Date.now().toString().slice(-6)}`;
    const reqKey =
      dto.requestKey ??
      `PAY-UTIL-${companyId}-${dto.utilityType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const provider = dto.providerName?.trim() || dto.utilityType;
    const period = dto.billingMonth?.trim() || paymentDate.toISOString().slice(0, 7);
    const consumer = dto.consumerNumber?.trim() || utilRef;

    const voucherResult = await this.postingService.post({
      action: 'PAY_UTILITY',
      requestKey: reqKey,
      voucherType: 'UTILITY_PAYMENT',
      businessDate: paymentDate,
      companyId,
      reference: utilRef,
      notes:
        dto.notes ??
        `[UTILITY] ${dto.utilityType} - ${provider} (${period}) | Consumer: ${consumer}`,
      metadata: {
        group: 'UTILITY',
        utilityType: dto.utilityType,
        providerName: provider,
        consumerNumber: consumer,
        billingMonth: period,
        paymentMethod,
        amount,
      },
      createdBy: userId,
      journalItems: [
        {
          accountCode: 'UTILITY_EXPENSE',
          debit: amount,
          description: `Utility (${dto.utilityType}) - ${provider} (${period})`,
        },
        {
          accountCode: creditAccount,
          credit: amount,
          description: `Utility disbursement from ${creditAccount} (${utilRef})`,
        },
      ],
    });

    return {
      id: voucherResult.voucherId,
      voucherId: voucherResult.voucherId,
      voucherNumber: voucherResult.voucherNumber,
      referenceNumber: consumer,
      entryReference: utilRef,
      date: voucherResult.businessDate,
      group: 'UTILITY',
      headOrType: dto.utilityType,
      beneficiary: provider,
      amount,
      paymentMethod,
      status: 'POSTED',
      journalEntryId: voucherResult.journalEntryId,
      replayed: voucherResult.replayed,
    };
  }

  async recordFixedAssetPayment(
    dto: CreateFixedAssetPaymentDto,
    userId?: string,
  ) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const amount = Math.round(dto.amount * 100) / 100;
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const paymentMethod = dto.paymentMethod ?? 'BANK';
    const creditAccount = paymentMethod === 'CASH' ? 'CASH' : 'BANK';
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const assetRef = `ASSET-${Date.now().toString().slice(-6)}`;
    const reqKey =
      dto.requestKey ??
      `PAY-ASSET-${companyId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const vendorName = dto.vendorName?.trim() || 'Asset Vendor';
    const serialOrInvoice = dto.serialOrInvoice?.trim() || assetRef;

    const voucherResult = await this.postingService.post({
      action: 'PAY_FIXED_ASSET',
      requestKey: reqKey,
      voucherType: 'FIXED_ASSET_PURCHASE',
      businessDate: paymentDate,
      companyId,
      vendorId: dto.vendorId,
      reference: assetRef,
      notes:
        dto.notes ??
        `[FIXED_ASSET] ${dto.assetDescription} (${dto.assetCategory}) - Vendor: ${vendorName}`,
      metadata: {
        group: 'FIXED_ASSET',
        assetCategory: dto.assetCategory,
        assetDescription: dto.assetDescription,
        vendorName,
        vendorId: dto.vendorId ?? null,
        serialOrInvoice,
        paymentMethod,
        amount,
      },
      createdBy: userId,
      journalItems: [
        {
          accountCode: 'FIXED_ASSETS',
          debit: amount,
          description: `Fixed Asset (${dto.assetCategory}): ${dto.assetDescription}`,
        },
        {
          accountCode: creditAccount,
          credit: amount,
          description: `Asset disbursement from ${creditAccount} (${assetRef})`,
        },
      ],
    });

    return {
      id: voucherResult.voucherId,
      voucherId: voucherResult.voucherId,
      voucherNumber: voucherResult.voucherNumber,
      referenceNumber: serialOrInvoice,
      entryReference: assetRef,
      date: voucherResult.businessDate,
      group: 'FIXED_ASSET',
      headOrType: `Fixed Asset (${dto.assetCategory})`,
      beneficiary: vendorName,
      amount,
      paymentMethod,
      status: 'POSTED',
      journalEntryId: voucherResult.journalEntryId,
      replayed: voucherResult.replayed,
    };
  }

  async recordOutgoingPayment(dto: CreateOutgoingPaymentDto, userId?: string) {
    if (dto.group === 'VENDOR_PAYMENT') {
      if (!dto.vendorId) {
        throw new BadRequestException(
          'vendorId is required for VENDOR_PAYMENT',
        );
      }
      return this.recordVendorPayment(
        {
          vendorId: dto.vendorId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          paymentDate: dto.paymentDate,
          supplierBillId: dto.supplierBillId,
          billAllocations: dto.billAllocations,
          reference: dto.reference,
          notes: dto.notes,
          requestKey: dto.requestKey,
        },
        userId,
      );
    }

    if (dto.group === 'UTILITY') {
      return this.recordUtilityPayment(
        {
          utilityType: dto.utilityType || 'ELECTRICITY',
          providerName: dto.providerName,
          consumerNumber: dto.consumerNumber,
          billingMonth: dto.billingMonth,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          paymentDate: dto.paymentDate,
          notes: dto.notes,
          requestKey: dto.requestKey,
        },
        userId,
      );
    }

    if (dto.group === 'FIXED_ASSET') {
      if (!dto.assetDescription) {
        throw new BadRequestException(
          'assetDescription is required for FIXED_ASSET',
        );
      }
      return this.recordFixedAssetPayment(
        {
          assetDescription: dto.assetDescription,
          assetCategory: dto.assetCategory || 'MACHINERY',
          vendorName: dto.vendorName,
          vendorId: dto.vendorId,
          serialOrInvoice: dto.serialOrInvoice,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          paymentDate: dto.paymentDate,
          notes: dto.notes,
          requestKey: dto.requestKey,
        },
        userId,
      );
    }

    if (dto.group === 'STATUTORY') {
      let obligationId = dto.obligationId;
      if (!obligationId) {
        if (!dto.head || !dto.authority || !dto.taxPeriod) {
          throw new BadRequestException(
            'Either obligationId or (head, authority, taxPeriod) is required for STATUTORY payment',
          );
        }
        if (dto.head.toUpperCase() === 'LABOUR') {
          throw new BadRequestException(
            'Labour statutory payments are pending owner classification and account mapping approval',
          );
        }
        const obligation = await this.statutoryService.createObligation(
          {
            head: dto.head,
            authority: dto.authority,
            taxPeriod: dto.taxPeriod,
            dueAmount: dto.amount,
            challanNumber: dto.cprNumber,
            psid: dto.psid,
            notes: dto.notes,
          },
          userId,
        );
        obligationId = obligation.id;
      }

      return this.statutoryService.recordPayment(
        {
          obligationId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod ?? 'BANK',
          paymentDate: dto.paymentDate,
          cprNumber: dto.cprNumber,
          psid: dto.psid,
          requestKey: dto.requestKey,
          notes: dto.notes,
        },
        userId,
      );
    }

    throw new BadRequestException(`Unsupported payment group: ${dto.group}`);
  }

  async findAll(query: QueryPaymentsDto) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const { page, limit, skip } = buildPagination(query);
    const targetVoucherType = query.group
      ? GROUP_TO_VOUCHER_TYPE[query.group.toUpperCase()]
      : undefined;

    const where: any = {
      companyId,
      status: 'POSTED',
      voucherType: targetVoucherType
        ? targetVoucherType
        : {
            in: [
              'SUPPLIER_PAYMENT',
              'UTILITY_PAYMENT',
              'FIXED_ASSET_PURCHASE',
              'STATUTORY_PAYMENT',
            ],
          },
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
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
      const group = VOUCHER_TYPE_TO_GROUP[v.voucherType] ?? v.voucherType;
      const debitItem = v.journalEntry?.items.find((i) => i.debitAmount > 0);
      const creditItem = v.journalEntry?.items.find((i) => i.creditAmount > 0);
      const amount =
        Number(meta.amount) ||
        Number(debitItem?.debitAmount ?? 0) ||
        Number(creditItem?.creditAmount ?? 0);
      const paymentMethod =
        meta.paymentMethod ||
        (creditItem?.account?.accountCode === 'CASH' ? 'CASH' : 'BANK');

      let headOrType = group;
      let beneficiary = meta.vendorName || meta.providerName || 'Beneficiary';
      let referenceNumber = v.reference || v.voucherNumber;

      if (group === 'VENDOR_PAYMENT') {
        headOrType = 'Vendor Payment';
        beneficiary = meta.vendorName || v.notes || 'Vendor';
        referenceNumber = meta.reference || v.reference || v.voucherNumber;
      } else if (group === 'UTILITY') {
        headOrType = meta.utilityType || 'UTILITY';
        beneficiary = meta.providerName || headOrType;
        referenceNumber = meta.consumerNumber || v.reference || v.voucherNumber;
      } else if (group === 'FIXED_ASSET') {
        headOrType = meta.assetCategory
          ? `Fixed Asset (${meta.assetCategory})`
          : 'Fixed Asset';
        beneficiary = meta.vendorName || 'Asset Vendor';
        referenceNumber = meta.serialOrInvoice || v.reference || v.voucherNumber;
      } else if (group === 'STATUTORY') {
        headOrType = 'STATUTORY';
        beneficiary = 'Tax / Statutory Authority';
        referenceNumber = v.reference || v.voucherNumber;
      }

      return {
        id: v.id,
        voucherId: v.id,
        voucherNumber: v.voucherNumber,
        entryReference: v.reference,
        date: v.businessDate,
        group,
        headOrType,
        beneficiary,
        vendorId: v.vendorId,
        referenceNumber,
        amount: Math.round(amount * 100) / 100,
        paymentMethod,
        status: v.status,
        notes: v.notes,
        metadata: v.metadata,
        createdAt: v.createdAt,
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
