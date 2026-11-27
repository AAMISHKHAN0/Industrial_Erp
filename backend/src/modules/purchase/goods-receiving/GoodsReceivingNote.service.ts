import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateGoodsReceivingNoteDto,
  UpdateGoodsReceivingNoteDto,
} from './dto/GoodsReceivingNote.dto';

const Decimal = Prisma.Decimal;
import { StockService } from '../../inventory/services/stock.service';
import { FinanceIntegrationService } from '../../finance/services/finance-integration.service';
import { PostingService } from '../../finance/services/posting.service';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { NotificationService } from '../../../common/services/notification.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

const RECEIVED_STATUSES = new Set([
  'RECEIVED',
  'COMPLETED',
  'PARTIALLY_RECEIVED',
]);

@Injectable()
export class GoodsReceivingNoteService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private finance: FinanceIntegrationService,
    private postingService: PostingService,
    private auditLog: AuditLogService,
    private notification: NotificationService,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateGoodsReceivingNoteDto, userId?: string) {
    return (this.prisma.$transaction as any)(
      async (tx: any) => {
        const companyId = this.tenant.companyId!;

        const poId = dto.poId?.trim() || null;
        let po: any = null;
        let poItemMap = new Map<string, any>();
        if (poId) {
          po = await tx.purchaseOrder.findFirst({
            where: { id: poId, deletedAt: null },
            include: { items: { include: { item: true } }, vendor: true },
          });
          if (!po) {
            throw new NotFoundException(
              'Purchase order not found in your company',
            );
          }
          poItemMap = new Map(po.items.map((i: any) => [i.id, i]));
        }

        const vendorId = dto.vendorId || po?.vendorId;
        if (!vendorId) {
          throw new BadRequestException('Vendor is required');
        }
        const vendor = await tx.vendor.findFirst({
          where: { id: vendorId, deletedAt: null },
        });
        if (!vendor) {
          throw new NotFoundException('Vendor not found in your company');
        }

        const items = dto.items ?? [];
        if (items.length === 0) {
          throw new BadRequestException('At least one item is required');
        }

        const poTolerancePct = po?.qtyTolerancePct ?? 0;

        for (const item of items) {
          if (item.receivedQty <= 0) {
            throw new BadRequestException(
              `Received quantity must be greater than zero for item ${item.itemId}`,
            );
          }
          if (item.acceptedQty < 0 || (item.rejectedQty ?? 0) < 0) {
            throw new BadRequestException('Quantities cannot be negative');
          }
          if (item.acceptedQty > item.receivedQty) {
            throw new BadRequestException(
              `Accepted quantity (${item.acceptedQty}) exceeds received quantity (${item.receivedQty}) for item ${item.itemId}`,
            );
          }
          if (item.acceptedQty + (item.rejectedQty ?? 0) > item.receivedQty) {
            throw new BadRequestException(
              `Accepted + rejected quantity (${item.acceptedQty + (item.rejectedQty ?? 0)}) cannot exceed received quantity (${item.receivedQty})`,
            );
          }

          if (item.poItemId && po) {
            const poItem: any = poItemMap.get(item.poItemId);
            if (!poItem) {
              throw new BadRequestException(
                `PO item ${item.poItemId} not found in this purchase order`,
              );
            }
            const itemTol = poItem.tolerancePct ?? poTolerancePct;
            const maxAllowed = poItem.quantity * (1 + itemTol / 100);
            const alreadyReceived = poItem.receivedQty ?? 0;
            const newTotal = alreadyReceived + item.receivedQty;
            if (newTotal > maxAllowed) {
              throw new BadRequestException(
                `Total received (${alreadyReceived} + ${item.receivedQty} = ${newTotal}) would exceed ordered quantity (${poItem.quantity}) for item ${poItem.item?.name || item.itemId}`,
              );
            }
          } else if (po && item.orderedQty && item.receivedQty > item.orderedQty) {
            throw new BadRequestException(
              `Received quantity (${item.receivedQty}) exceeds ordered quantity (${item.orderedQty}) for item ${item.itemId}`,
            );
          }
        }

        const status = dto.status ?? 'RECEIVED';
        const shouldUpdateStock = RECEIVED_STATUSES.has(status);

        let warehouseId = dto.warehouseId;
        if (!warehouseId) {
          let wh = await tx.warehouse.findFirst({
            where: { companyId, deletedAt: null },
          });
          if (!wh) {
            wh = await tx.warehouse.create({
              data: {
                companyId,
                code: 'WH-MAIN',
                name: 'Main Central Warehouse',
                status: 'ACTIVE',
              },
            });
          }
          warehouseId = wh.id;
        }

        const grnNumber = await resolveAutoCode(
          tx.goodsReceivingNote,
          companyId,
          'grnNumber',
          'GRN',
          dto.grnNumber,
        );

        const grn = await tx.goodsReceivingNote.create({
          data: {
            companyId,
            grnNumber,
            poId,
            vendorId,
            warehouseId,
            receivedDate: dto.receivedDate
              ? new Date(dto.receivedDate)
              : new Date(),
            receivedBy: dto.receivedBy,
            status,
            notes: dto.notes,
            deliveryChallanNumber: dto.deliveryChallanNumber,
            deliveryChallanDate: dto.deliveryChallanDate
              ? new Date(dto.deliveryChallanDate)
              : null,
            supplierInvoiceNumber: dto.supplierInvoiceNumber,
            supplierInvoiceDate: dto.supplierInvoiceDate
              ? new Date(dto.supplierInvoiceDate)
              : null,
            supplierInvoiceAmount: dto.supplierInvoiceAmount,
            gatePassNumber: dto.gatePassNumber,
            vehicleNumber: dto.vehicleNumber,
            driverName: dto.driverName,
            driverPhone: dto.driverPhone,
            transporterName: dto.transporterName,
            biltyNumber: dto.biltyNumber,
            departmentId: dto.departmentId,
            costCenter: dto.costCenter,
            inspectionStatus: dto.inspectionStatus ?? 'PENDING',
            inspectionNotes: dto.inspectionNotes,
            inspectedBy: dto.inspectedBy,
            inspectedAt: dto.inspectedAt ? new Date(dto.inspectedAt) : null,
            createdBy: userId,
            items: {
              create: items.map((i) => ({
                poItemId: i.poItemId?.trim() || null,
                itemId: i.itemId,
                orderedQty: i.orderedQty ?? 0,
                receivedQty: i.receivedQty,
                acceptedQty: i.acceptedQty,
                rejectedQty: i.rejectedQty ?? 0,
                rejectionReason: i.rejectionReason,
                unitCost: i.unitCost ?? 0,
                lotNumber: i.lotNumber,
                remarks: i.remarks,
              })),
            },
          },
          include: { items: true, po: true, vendor: true },
        });

        // Update stock only if GRN is in a received status
        if (shouldUpdateStock) {
          for (const item of grn.items) {
            if (item.acceptedQty > 0 && item.itemId) {
              await this.stockService.receiveStock(
                {
                  itemId: item.itemId,
                  warehouseId: warehouseId!,
                  quantity: item.acceptedQty,
                  unitCost: item.unitCost ?? 0,
                  referenceId: grn.id,
                  referenceType: 'GRN',
                  createdBy: userId,
                },
                tx,
              );
            }
          }
        }

        // Update PurchaseOrderItem.receivedQty if linked to PO
        if (poId) {
          for (const item of items) {
            if (item.poItemId) {
              await tx.purchaseOrderItem.update({
                where: { id: item.poItemId },
                data: { receivedQty: { increment: item.receivedQty } },
              });
            }
          }
          await this.updatePoStatus(tx, poId);
        }

        await this.auditLog.log(
          {
            entity: 'GoodsReceivingNote',
            entityId: grn.id,
            action: 'CREATED',
            userId,
            newValue: { grnNumber, items: items.length, status },
          },
          tx,
        );

        if (userId) {
          await this.notification.notify({
            userId,
            title: `GRN ${grnNumber} ${status}`,
            message: `${items.length} items received`,
            link: `/purchase/goods-receiving/${grn.id}`,
          });
        }

        // Finance entry: Dr INVENTORY, Cr GRNI at accepted quantity × unit cost
        let totalAcceptedValue = 0;
        for (const item of grn.items) {
          if (item.acceptedQty > 0 && item.itemId) {
            totalAcceptedValue += item.acceptedQty * (item.unitCost ?? 0);
          }
        }
        totalAcceptedValue = Math.round(totalAcceptedValue * 100) / 100;

        if (totalAcceptedValue > 0) {
          const voucher = await tx.voucher.create({
            data: {
              companyId,
              voucherNumber: `VCH-GRN-${grnNumber}`,
              voucherType: 'GRN',
              businessDate: dto.receivedDate
                ? new Date(dto.receivedDate)
                : new Date(),
              status: 'POSTED',
              reference: `GRN-${grnNumber}`,
              notes:
                dto.notes ??
                `Goods receipt from ${vendor?.name ?? po?.vendor?.name ?? 'Vendor'} (${grnNumber})`,
              createdBy: userId,
            },
          });

          const entry = await this.finance.createJournalEntry(
            {
              companyId,
              reference: `GRN-${grnNumber}`,
              description: `Goods receipt from ${vendor?.name ?? po?.vendor?.name ?? 'Vendor'} (${grnNumber})`,
              items: [
                {
                  accountCode: 'INVENTORY',
                  debit: totalAcceptedValue,
                  description: `Inventory receipt - ${grnNumber}`,
                },
                {
                  accountCode: 'GRNI',
                  credit: totalAcceptedValue,
                  description: `GRNI clearing - ${grnNumber}`,
                },
              ],
              createdBy: userId,
            },
            tx,
          );

          await tx.journalEntry.update({
            where: { id: entry.id },
            data: { voucherId: voucher.id },
          });

          await tx.goodsReceivingNote.update({
            where: { id: grn.id },
            data: { voucherId: voucher.id },
          });
          (grn as any).voucherId = voucher.id;
        }

        return grn;
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  async update(id: string, dto: UpdateGoodsReceivingNoteDto, userId?: string) {
    const existing = await this.findOne(id);
    const oldStatus = existing.status;
    const newStatus = dto.status ?? oldStatus;

    if (newStatus !== oldStatus) {
      return this.handleStatusTransition(id, oldStatus, newStatus, userId);
    }

    // Strip array relation fields — Prisma update can't accept raw arrays.
    const { items, ...scalarData } = dto as any;
    const cleanData = Object.fromEntries(
      Object.entries(scalarData).filter(([_, v]) => v !== undefined),
    );

    return (this.prisma.$transaction as any)(
      async (tx: any) => {
        if (items) {
          await tx.goodsReceivingItem.deleteMany({ where: { grnId: id } });
          if (items.length > 0) {
            await tx.goodsReceivingItem.createMany({
              data: items.map((i: any) => ({
                grnId: id,
                poItemId: i.poItemId || null,
                itemId: i.itemId || null,
                orderedQty: i.orderedQty ?? 0,
                receivedQty: i.receivedQty,
                acceptedQty: i.acceptedQty,
                rejectedQty: i.rejectedQty ?? 0,
                rejectionReason: i.rejectionReason || null,
                unitCost: i.unitCost ?? 0,
                lotNumber: i.lotNumber || null,
                remarks: i.remarks || null,
              })),
            });
          }
        }

        const updated = await tx.goodsReceivingNote.update({
          where: { id },
          data: cleanData,
          include: { items: true, vendor: true, po: true },
        });

        await this.auditLog.log(
          {
            entity: 'GoodsReceivingNote',
            entityId: id,
            action: 'UPDATED',
            userId,
          },
          tx,
        );

        return updated;
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  private async handleStatusTransition(
    id: string,
    oldStatus: string,
    newStatus: string,
    userId?: string,
  ) {
    return (this.prisma.$transaction as any)(
      async (tx: any) => {
        const grn = await tx.goodsReceivingNote.findFirst({
          where: { id },
          include: { items: true },
        });
        if (!grn) throw new NotFoundException('GRN not found');

        // CANCELLED → reverse stock and GL if it was previously received
        if (newStatus === 'CANCELLED' && RECEIVED_STATUSES.has(oldStatus)) {
          // Route cancellation through PostingService.reverseVoucher
          const voucher = await tx.voucher.findFirst({
            where: {
              companyId: grn.companyId,
              OR: [
                { reference: `GRN-${grn.grnNumber}` },
                { reference: grn.grnNumber },
                { reference: grn.id },
              ],
            },
          });

          if (voucher) {
            await this.postingService.reverseVoucher(
              {
                voucherId: voucher.id,
                reversalDate: new Date(),
                reason: `GRN cancelled: ${grn.grnNumber}`,
                actorId: userId,
                companyId: grn.companyId,
              },
              tx,
            );
          } else {
            // If no voucher exists, verify open period and downstream consumption constraints
            const now = new Date();
            const periodRows: Array<{ id: string; isClosed: boolean }> =
              await tx.$queryRaw`
            SELECT id, "isClosed"
            FROM "accounting_periods"
            WHERE "companyId" = ${grn.companyId}
              AND "startDate" <= ${now}
              AND "endDate" >= ${now}
            FOR UPDATE
          `;
            if (periodRows.length > 0 && periodRows[0].isClosed) {
              throw new BadRequestException(
                `Accounting period is closed for date ${now.toISOString().slice(0, 10)}`,
              );
            }

            for (const item of grn.items) {
              if (item.acceptedQty > 0 && item.itemId) {
                const warehouseId =
                  grn.warehouseId ??
                  (
                    await tx.warehouse.findFirst({
                      where: { deletedAt: null } as any,
                    })
                  )?.id ??
                  '';
                const layer = await tx.fifoLayer.findFirst({
                  where: {
                    companyId: grn.companyId,
                    sourceMovementId: id,
                    itemId: item.itemId,
                    warehouseId,
                  },
                });
                if (
                  layer &&
                  Number(layer.remainingQty) < Number(layer.originalQty)
                ) {
                  throw new BadRequestException(
                    `Cannot reverse GRN ${grn.grnNumber}: stock for item ${item.itemId} has already been consumed downstream (original: ${layer.originalQty}, remaining: ${layer.remainingQty})`,
                  );
                }

                await this.stockService.issueStock(
                  {
                    itemId: item.itemId,
                    warehouseId,
                    quantity: item.acceptedQty,
                    referenceId: id,
                    referenceType: 'GRN_CANCELLATION',
                    createdBy: userId,
                  },
                  tx,
                );

                if (layer) {
                  await tx.fifoLayer.update({
                    where: { id: layer.id },
                    data: {
                      remainingQty: new Decimal(0),
                      trackedValue: new Decimal(0),
                      status: 'CANCELLED',
                    },
                  });
                }
              }
            }

            // Check if there was an unlinked journal entry for this GRN and reverse it
            const grnJournal = await tx.journalEntry.findFirst({
              where: {
                companyId: grn.companyId,
                reference: `GRN-${grn.grnNumber}`,
              },
              include: { items: { include: { account: true } } },
            });
            if (grnJournal && grnJournal.items.length > 0) {
              const contraEntryNumber = `JE-REV-${Date.now().toString(36).toUpperCase()}`;
              await tx.journalEntry.create({
                data: {
                  companyId: grn.companyId,
                  entryNumber: contraEntryNumber,
                  entryDate: now,
                  reference: `REV-GRN-${grn.grnNumber}`,
                  description: `Reversal of GRN ${grn.grnNumber}`,
                  isPosted: true,
                  postedAt: now,
                  postedBy: userId,
                  createdBy: userId,
                  items: {
                    create: await Promise.all(
                      grnJournal.items.map(async (jItem: any) => {
                        const newDebit = jItem.creditAmount;
                        const newCredit = jItem.debitAmount;
                        let balanceDelta = 0;
                        if (['ASSET', 'EXPENSE'].includes(jItem.account.type)) {
                          balanceDelta = newDebit - newCredit;
                        } else {
                          balanceDelta = newCredit - newDebit;
                        }
                        if (balanceDelta !== 0) {
                          await tx.account.update({
                            where: { id: jItem.accountId },
                            data: { balance: { increment: balanceDelta } },
                          });
                        }
                        return {
                          accountId: jItem.accountId,
                          debitAmount: newDebit,
                          creditAmount: newCredit,
                          description: `Reversal contra for GRN-${grn.grnNumber}`,
                        };
                      }),
                    ),
                  },
                },
              });
            }
          }

          for (const item of grn.items) {
            if (item.poItemId) {
              await tx.purchaseOrderItem.update({
                where: { id: item.poItemId },
                data: { receivedQty: { decrement: item.receivedQty } },
              });
            }
          }
          if (grn.poId) {
            await this.updatePoStatus(tx, grn.poId);
          }
        }

        // COMPLETED → update stock if transitioning from non-received status
        if (newStatus === 'COMPLETED' && !RECEIVED_STATUSES.has(oldStatus)) {
          for (const item of grn.items) {
            if (item.acceptedQty > 0 && item.itemId) {
              const warehouseId =
                grn.warehouseId ??
                (
                  await tx.warehouse.findFirst({
                    where: { deletedAt: null } as any,
                  })
                )?.id ??
                '';
              await this.stockService.receiveStock(
                {
                  itemId: item.itemId,
                  warehouseId,
                  quantity: item.acceptedQty,
                  unitCost: item.unitCost,
                  referenceId: id,
                  referenceType: 'GRN',
                  createdBy: userId,
                },
                tx,
              );
            }
          }
          for (const item of grn.items) {
            if (item.poItemId) {
              await tx.purchaseOrderItem.update({
                where: { id: item.poItemId },
                data: { receivedQty: { increment: item.receivedQty } },
              });
            }
          }
          if (grn.poId) {
            await this.updatePoStatus(tx, grn.poId);
          }
        }

        const updated = await tx.goodsReceivingNote.update({
          where: { id },
          data: { status: newStatus },
          include: { items: true, vendor: true, po: true },
        });

        await this.auditLog.log(
          {
            entity: 'GoodsReceivingNote',
            entityId: id,
            action: 'STATUS_CHANGED',
            userId,
            newValue: { from: oldStatus, to: newStatus },
          },
          tx,
        );

        return updated;
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  private async updatePoStatus(tx: any, poId?: string | null) {
    if (!poId) return;
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId },
      include: { items: true },
    });
    if (!po) return;

    const allItems = po.items;
    if (allItems.length === 0) return;

    const allFullyReceived = (allItems as any[]).every(
      (i) => (i.receivedQty ?? 0) >= i.quantity,
    );
    const anyReceived = (allItems as any[]).some(
      (i) => (i.receivedQty ?? 0) > 0,
    );

    let newStatus: string;
    if (allFullyReceived) {
      newStatus = 'COMPLETED';
    } else if (anyReceived) {
      newStatus = 'PARTIALLY_RECEIVED';
    } else {
      return; // no change
    }

    if (po.status !== newStatus) {
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: newStatus },
      });
    }
  }

  async findAll(query: any) {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 10;
    const skip = (page - 1) * limit;
    const where: any = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };
    let [data, total] = await Promise.all([
      this.prisma.goodsReceivingNote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true, vendor: true, po: true },
      }),
      this.prisma.goodsReceivingNote.count({ where }),
    ]);
    data = await enrichWithCreator(this.prisma, data);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.goodsReceivingNote.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: { include: { item: true } },
        vendor: true,
        po: { include: { items: { include: { item: true } } } },
      },
    });
    if (!item) throw new NotFoundException('GoodsReceivingNote not found');
    const enriched = await enrichWithCreator(this.prisma, [item]);
    return enriched[0];
  }

  async remove(id: string) {
    const grn = await this.findOne(id);
    if (RECEIVED_STATUSES.has(grn.status)) {
      throw new BadRequestException(
        'Cannot delete a GRN that has been received. Cancel it first to reverse stock.',
      );
    }
    return this.prisma.goodsReceivingNote.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  async restore(id: string) {
    const item = await this.prisma.goodsReceivingNote.findFirst({
      where: { id },
    });
    if (!item) throw new NotFoundException('GoodsReceivingNote not found');
    return this.prisma.goodsReceivingNote.update({
      where: { id },
      data: { deletedAt: null, status: 'DRAFT' },
    });
  }

  async cancel(id: string, userId?: string) {
    return this.update(id, { status: 'CANCELLED' }, userId);
  }

  async findUnbilled() {
    const companyId = this.tenant.companyId;
    const grns = await this.prisma.goodsReceivingNote.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
        status: { in: Array.from(RECEIVED_STATUSES) },
      },
      include: {
        vendor: true,
        items: { include: { item: true } },
        supplierBillItems: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return grns.map((grn) => {
      const billedByItem: Record<string, number> = {};
      for (const billItem of grn.supplierBillItems) {
        if (billItem.grnItemId) {
          billedByItem[billItem.grnItemId] =
            (billedByItem[billItem.grnItemId] ?? 0) + billItem.billedQty;
        }
      }
      const itemsWithBilling = grn.items.map((item) => {
        const billedQty = billedByItem[item.id] ?? 0;
        const unbilledQty = Math.max(0, item.acceptedQty - billedQty);
        return {
          ...item,
          billedQty,
          unbilledQty,
        };
      });
      const totalUnbilledQty = itemsWithBilling.reduce(
        (sum, i) => sum + i.unbilledQty,
        0,
      );
      return {
        ...grn,
        items: itemsWithBilling,
        isFullyBilled: totalUnbilledQty === 0,
      };
    });
  }
}
