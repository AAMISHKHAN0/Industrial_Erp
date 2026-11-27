import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { FinanceIntegrationService } from '../../finance/services/finance-integration.service';
import {
  CreateSupplierBillDto,
  QuerySupplierBillDto,
} from './dto/supplier-bill.dto';
import { buildPagination } from '../../../common/utils/pagination';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class SupplierBillService {
  constructor(
    private prisma: PrismaService,
    private finance: FinanceIntegrationService,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateSupplierBillDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) {
      throw new BadRequestException('Company context required');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required for supplier bill');
    }

    const vendor = await this.prisma.vendor.findFirst({
      where: { id: dto.vendorId, deletedAt: null },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const billDate = dto.billDate ? new Date(dto.billDate) : new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Duplicate invoice prevention
      const existing = await tx.supplierBill.findFirst({
        where: {
          companyId,
          vendorId: dto.vendorId,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
        },
      });
      if (existing) {
        throw new ConflictException(
          'Supplier invoice number already exists for this vendor',
        );
      }

      // 2. Accounting period check
      const periodRows: Array<{ id: string; isClosed: boolean }> =
        await tx.$queryRaw`
        SELECT id, "isClosed"
        FROM "accounting_periods"
        WHERE "companyId" = ${companyId}
          AND "startDate" <= ${billDate}
          AND "endDate" >= ${billDate}
        FOR UPDATE
      `;
      if (periodRows.length > 0 && periodRows[0].isClosed) {
        throw new BadRequestException('Accounting period is closed');
      }

      let subtotal = 0;
      let totalTaxAmount = 0;
      let matchedGrniAmount = 0;

      const processedItems: Array<{
        grnId?: string;
        grnItemId?: string;
        poItemId?: string;
        itemId: string;
        billedQty: number;
        unitPrice: number;
        taxAmount: number;
        lineTotal: number;
      }> = [];

      // 3. 3-Way match validation per item
      for (const item of dto.items) {
        if (item.billedQty <= 0) {
          throw new BadRequestException('Billed quantity must be greater than zero');
        }

        let grnItem: any = null;
        let po: any = null;
        let poItem: any = null;

        if (item.grnItemId) {
          grnItem = await tx.goodsReceivingItem.findUnique({
            where: { id: item.grnItemId },
            include: { grn: { include: { po: true } } },
          });
        } else if (item.grnId) {
          grnItem = await tx.goodsReceivingItem.findFirst({
            where: { grnId: item.grnId, itemId: item.itemId },
            include: { grn: { include: { po: true } } },
          });
        }

        if (grnItem) {
          po = grnItem.grn?.po;
          if (grnItem.poItemId) {
            poItem = await tx.purchaseOrderItem.findUnique({
              where: { id: grnItem.poItemId },
            });
          }

          // Tolerance check on quantity
          const qtyTol = poItem?.tolerancePct ?? po?.qtyTolerancePct ?? 0;
          const maxAllowedQty = grnItem.acceptedQty * (1 + qtyTol / 100);

          // Get already billed quantity against this GRN item
          const alreadyBilledRows = await tx.supplierBillItem.aggregate({
            where: { grnItemId: grnItem.id },
            _sum: { billedQty: true },
          });
          const alreadyBilled = alreadyBilledRows._sum.billedQty ?? 0;
          const totalBilled = alreadyBilled + item.billedQty;

          if (totalBilled > maxAllowedQty) {
            throw new BadRequestException(
              `3-Way Match Failed: Billed quantity (${totalBilled}) exceeds GRN accepted quantity with tolerance (${maxAllowedQty})`,
            );
          }
        }

        // Tolerance check on price
        if (poItem) {
          const priceTol = po?.priceTolerancePct ?? 0;
          const maxAllowedPrice = poItem.unitPrice * (1 + priceTol / 100);
          if (item.unitPrice > maxAllowedPrice) {
            throw new BadRequestException(
              `3-Way Match Failed: Billed unit price (${item.unitPrice}) exceeds PO price with tolerance (${maxAllowedPrice})`,
            );
          }
        }

        const lineTotal = Math.round(item.billedQty * item.unitPrice * 100) / 100;
        const itemTax = item.taxAmount ?? (item.taxRate ? Math.round(lineTotal * (item.taxRate / 100) * 100) / 100 : 0);
        const grnCost = grnItem ? grnItem.unitCost : item.unitPrice;
        const grniPortion = Math.round(item.billedQty * grnCost * 100) / 100;

        subtotal += lineTotal;
        totalTaxAmount += itemTax;
        matchedGrniAmount += grniPortion;

        processedItems.push({
          grnId: item.grnId || grnItem?.grnId,
          grnItemId: item.grnItemId || grnItem?.id,
          poItemId: item.poItemId || grnItem?.poItemId,
          itemId: item.itemId,
          billedQty: item.billedQty,
          unitPrice: item.unitPrice,
          taxAmount: itemTax,
          lineTotal,
        });

        // Update PurchaseOrderItem.billedQty if poItemId exists
        const targetPoItemId = item.poItemId || grnItem?.poItemId;
        if (targetPoItemId) {
          await tx.purchaseOrderItem.update({
            where: { id: targetPoItemId },
            data: { billedQty: { increment: item.billedQty } },
          });
        }
      }

      subtotal = Math.round(subtotal * 100) / 100;
      totalTaxAmount = Math.round(totalTaxAmount * 100) / 100;
      matchedGrniAmount = Math.round(matchedGrniAmount * 100) / 100;
      const totalAmount = Math.round((subtotal + totalTaxAmount) * 100) / 100;

      const billNumber = await resolveAutoCode(
        tx.supplierBill,
        companyId,
        'billNumber',
        'BILL',
        dto.billNumber,
      );

      // 4. Create Voucher & Balanced Journal Entry
      const voucher = await tx.voucher.create({
        data: {
          companyId,
          voucherNumber: `VCH-BILL-${billNumber}`,
          voucherType: 'SUPPLIER_BILL',
          businessDate: billDate,
          status: 'POSTED',
          reference: billNumber,
          notes: dto.notes ?? `Supplier Bill ${billNumber} (Inv: ${dto.supplierInvoiceNumber})`,
          createdBy: userId,
        },
      });

      // Assemble balanced journal items
      const journalItems: Array<{
        accountCode: string;
        debit?: number;
        credit?: number;
        description: string;
      }> = [];

      // Dr GRNI (matched portion)
      if (matchedGrniAmount > 0) {
        journalItems.push({
          accountCode: 'GRNI',
          debit: matchedGrniAmount,
          description: `Clear GRNI for Bill ${billNumber}`,
        });
      }

      // Variance if subtotal != matchedGrniAmount
      const variance = Math.round((subtotal - matchedGrniAmount) * 100) / 100;
      if (variance > 0) {
        journalItems.push({
          accountCode: 'COGS',
          debit: variance,
          description: `Purchase price variance (unfavorable) for Bill ${dto.billNumber}`,
        });
      } else if (variance < 0) {
        journalItems.push({
          accountCode: 'COGS',
          credit: Math.abs(variance),
          description: `Purchase price variance (favorable) for Bill ${dto.billNumber}`,
        });
      }

      // Dr INPUT_TAX_RECEIVABLE if tax applies
      if (totalTaxAmount > 0) {
        journalItems.push({
          accountCode: 'INPUT_TAX_RECEIVABLE',
          debit: totalTaxAmount,
          description: `Input sales tax for Bill ${dto.billNumber}`,
        });
      }

      // Cr ACCOUNTS_PAYABLE
      journalItems.push({
        accountCode: 'ACCOUNTS_PAYABLE',
        credit: totalAmount,
        description: `Vendor AP for Bill ${dto.billNumber} (${vendor.name})`,
      });

      const journal = await this.finance.createJournalEntry(
        {
          companyId,
          reference: billNumber,
          description: `Supplier bill - ${billNumber} (Invoice ${dto.supplierInvoiceNumber})`,
          items: journalItems,
          createdBy: userId,
        },
        tx,
      );

      await tx.journalEntry.update({
        where: { id: journal.id },
        data: { voucherId: voucher.id },
      });

      // 5. Create SupplierBill and line items
      const bill = await tx.supplierBill.create({
        data: {
          companyId,
          billNumber,
          vendorId: dto.vendorId,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
          supplierInvoiceDate: dto.supplierInvoiceDate
            ? new Date(dto.supplierInvoiceDate)
            : null,
          billDate,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: 'POSTED',
          voucherId: voucher.id,
          subtotal,
          taxAmount: totalTaxAmount,
          totalAmount,
          paidAmount: 0,
          notes: dto.notes,
          createdBy: userId,
          items: {
            create: processedItems.map((i) => ({
              grnId: i.grnId || null,
              grnItemId: i.grnItemId || null,
              poItemId: i.poItemId || null,
              itemId: i.itemId,
              billedQty: i.billedQty,
              unitPrice: i.unitPrice,
              taxAmount: i.taxAmount,
              lineTotal: i.lineTotal,
            })),
          },
        },
        include: {
          items: { include: { item: true, grn: true } },
          vendor: true,
        },
      });

      return bill;
    });
  }

  async findAll(query: QuerySupplierBillDto) {
    const { page, limit, skip } = buildPagination(query);
    const companyId = this.tenant.companyId;

    const where: any = {
      ...(companyId ? { companyId } : {}),
      deletedAt: null,
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.supplierBill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { billDate: 'desc' },
        include: {
          items: { include: { item: true } },
          vendor: true,
        },
      }),
      this.prisma.supplierBill.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const companyId = this.tenant.companyId;
    const bill = await this.prisma.supplierBill.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
      },
      include: {
        items: { include: { item: true, grn: true } },
        vendor: true,
      },
    });
    if (!bill) throw new NotFoundException('Supplier bill not found');
    return bill;
  }
}
