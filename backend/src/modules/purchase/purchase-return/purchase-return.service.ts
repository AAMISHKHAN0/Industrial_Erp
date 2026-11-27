import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { FinanceIntegrationService } from '../../finance/services/finance-integration.service';
import {
  CreatePurchaseReturnDto,
  QueryPurchaseReturnDto,
} from './dto/purchase-return.dto';
import { buildPagination } from '../../../common/utils/pagination';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

@Injectable()
export class PurchaseReturnService {
  constructor(
    private prisma: PrismaService,
    private finance: FinanceIntegrationService,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreatePurchaseReturnDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) {
      throw new BadRequestException('Company context required');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required for purchase return');
    }

    const vendor = await this.prisma.vendor.findFirst({
      where: { id: dto.vendorId, deletedAt: null },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, deletedAt: null },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const returnNumber = await resolveAutoCode(
      this.prisma.purchaseReturn,
      companyId,
      'returnNumber',
      'RET',
      dto.returnNumber,
    );
    const returnDate = dto.returnDate ? new Date(dto.returnDate) : new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Period check
      const periodRows: Array<{ id: string; isClosed: boolean }> =
        await tx.$queryRaw`
        SELECT id, "isClosed"
        FROM "accounting_periods"
        WHERE "companyId" = ${companyId}
          AND "startDate" <= ${returnDate}
          AND "endDate" >= ${returnDate}
        FOR UPDATE
      `;
      if (periodRows.length > 0 && periodRows[0].isClosed) {
        throw new BadRequestException('Accounting period is closed');
      }

      let totalReturnAmount = 0;
      const processedItems: Array<{
        itemId: string;
        quantity: number;
        unitCost: number;
        totalCost: number;
        reason?: string;
      }> = [];

      // 2. Process each item: stock check, FIFO layer consumption, ledger write
      for (const item of dto.items) {
        if (item.quantity <= 0) {
          throw new BadRequestException('Return quantity must be greater than zero');
        }

        // Lock & check warehouseStock
        const wsRows: Array<{ id: string; quantity: number }> =
          await tx.$queryRaw`
          SELECT id, quantity
          FROM "warehouse_stock"
          WHERE "companyId" = ${companyId}
            AND "warehouseId" = ${dto.warehouseId}
            AND "itemId" = ${item.itemId}
          FOR UPDATE
        `;

        const availableQty = wsRows.length > 0 ? wsRows[0].quantity : 0;
        if (availableQty < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for item ${item.itemId} in warehouse ${dto.warehouseId}. Available: ${availableQty}, Requested: ${item.quantity}`,
          );
        }

        // Downstream FIFO check
        let openLayers: any[] = [];
        if (dto.grnId) {
          openLayers = await tx.fifoLayer.findMany({
            where: {
              companyId,
              warehouseId: dto.warehouseId,
              itemId: item.itemId,
              sourceMovementId: dto.grnId,
              status: 'OPEN',
            },
            orderBy: [{ receiptDate: 'desc' }, { sequence: 'desc' }],
          });
        } else {
          openLayers = await tx.fifoLayer.findMany({
            where: {
              companyId,
              warehouseId: dto.warehouseId,
              itemId: item.itemId,
              status: 'OPEN',
              remainingQty: { gt: 0 },
            },
            orderBy: [{ receiptDate: 'desc' }, { sequence: 'desc' }],
          });
        }

        const totalLayerRemaining = openLayers.reduce(
          (sum, l) => sum + Number(l.remainingQty),
          0,
        );
        if (totalLayerRemaining < item.quantity) {
          throw new BadRequestException(
            'Cannot return stock: FIFO layer has been consumed downstream. Perform stock adjustment instead.',
          );
        }

        let remainingToReturn = item.quantity;
        let itemTotalCost = 0;

        for (const layer of openLayers) {
          if (remainingToReturn <= 0) break;
          const rem = Number(layer.remainingQty);
          const uCost = Number(layer.unitCost);
          const take = Math.min(remainingToReturn, rem);
          const isExhausting = take === rem;

          const allocVal = isExhausting
            ? Number(layer.trackedValue)
            : Math.round(take * uCost * 100) / 100;

          await tx.fifoLayer.update({
            where: { id: layer.id },
            data: {
              remainingQty: new Decimal(rem - take),
              trackedValue: new Decimal(
                isExhausting ? 0 : Math.round((Number(layer.trackedValue) - allocVal) * 100) / 100,
              ),
              status: isExhausting ? 'EXHAUSTED' : 'OPEN',
            },
          });

          itemTotalCost += allocVal;
          remainingToReturn -= take;
        }

        const unitCost = item.unitCost ?? (item.quantity > 0 ? itemTotalCost / item.quantity : 0);
        totalReturnAmount += itemTotalCost;

        // Decrement warehouse stock
        await tx.warehouseStock.update({
          where: {
            warehouseId_itemId: {
              warehouseId: dto.warehouseId,
              itemId: item.itemId,
            },
          },
          data: { quantity: { decrement: item.quantity } },
        });

        // Decrement Item stock
        await tx.item.update({
          where: { id: item.itemId },
          data: {
            currentStock: { decrement: item.quantity },
            availableStock: { decrement: item.quantity },
          },
        });

        // Record StockLedger
        await tx.stockLedger.create({
          data: {
            companyId,
            itemId: item.itemId,
            warehouseId: dto.warehouseId,
            transactionType: 'PURCHASE_RETURN',
            referenceType: 'PURCHASE_RETURN',
            referenceId: returnNumber,
            qtyBefore: availableQty,
            qtyChange: -item.quantity,
            qtyAfter: availableQty - item.quantity,
            costBefore: 0,
            costChange: -itemTotalCost,
            costAfter: 0,
            notes: dto.reason ?? `Purchase return to vendor: ${returnNumber}`,
            createdBy: userId,
          },
        });

        processedItems.push({
          itemId: item.itemId,
          quantity: item.quantity,
          unitCost,
          totalCost: itemTotalCost,
          reason: item.reason,
        });
      }

      totalReturnAmount = Math.round(totalReturnAmount * 100) / 100;

      // 3. Create Voucher & Balanced Journal Entry
      const isDebitNote = Boolean(dto.supplierBillId || dto.debitNoteNumber);
      const voucherType = isDebitNote ? 'DEBIT_NOTE' : 'PURCHASE_RETURN';
      const debitAccountCode = isDebitNote ? 'ACCOUNTS_PAYABLE' : 'GRNI';

      const voucher = await tx.voucher.create({
        data: {
          companyId,
          voucherNumber: `VCH-${voucherType}-${returnNumber}`,
          voucherType,
          businessDate: returnDate,
          status: 'POSTED',
          reference: returnNumber,
          notes: dto.reason ?? `Vendor return: ${returnNumber}`,
          createdBy: userId,
        },
      });

      if (totalReturnAmount > 0) {
        const journal = await this.finance.createJournalEntry(
          {
            companyId,
            reference: returnNumber,
            description: `Vendor return - ${returnNumber} (${vendor.name})`,
            items: [
              {
                accountCode: debitAccountCode,
                debit: totalReturnAmount,
                description: `Debit ${debitAccountCode} for vendor return ${returnNumber}`,
              },
              {
                accountCode: 'INVENTORY',
                credit: totalReturnAmount,
                description: `Credit INVENTORY for vendor return ${returnNumber}`,
              },
            ],
            createdBy: userId,
          },
          tx,
        );

        await tx.journalEntry.update({
          where: { id: journal.id },
          data: { voucherId: voucher.id },
        });
      }

      // 4. Create PurchaseReturn record and lines
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          companyId,
          returnNumber,
          vendorId: dto.vendorId,
          warehouseId: dto.warehouseId,
          grnId: dto.grnId || null,
          supplierBillId: dto.supplierBillId || null,
          debitNoteNumber: dto.debitNoteNumber || (isDebitNote ? `DN-${returnNumber}` : null),
          returnDate,
          gatePassNumber: dto.gatePassNumber,
          reason: dto.reason,
          status: 'POSTED',
          voucherId: voucher.id,
          totalAmount: totalReturnAmount,
          createdBy: userId,
          items: {
            create: processedItems.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
              unitCost: i.unitCost,
              totalCost: i.totalCost,
              reason: i.reason,
            })),
          },
        },
        include: {
          items: { include: { item: true } },
          vendor: true,
          warehouse: true,
        },
      });

      return purchaseReturn;
    });
  }

  async findAll(query: QueryPurchaseReturnDto) {
    const { page, limit, skip } = buildPagination(query);
    const companyId = this.tenant.companyId;

    const where: any = {
      ...(companyId ? { companyId } : {}),
      deletedAt: null,
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.purchaseReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { returnDate: 'desc' },
        include: {
          items: { include: { item: true } },
          vendor: true,
          warehouse: true,
        },
      }),
      this.prisma.purchaseReturn.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const companyId = this.tenant.companyId;
    const item = await this.prisma.purchaseReturn.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
      },
      include: {
        items: { include: { item: true } },
        vendor: true,
        warehouse: true,
      },
    });
    if (!item) throw new NotFoundException('Purchase return not found');
    return item;
  }
}
