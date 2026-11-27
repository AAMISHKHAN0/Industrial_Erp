import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EventBus } from '../../../common/events/event-bus';
import { InventoryUpdatedEvent } from '../../../common/events/domain-event';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { Prisma } from '@prisma/client';
import { PostingService } from '../../finance/services/posting.service';

const Decimal = Prisma.Decimal;

@Injectable()
export class StockService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBus,
    private tenant: TenantContext,
    @Inject(forwardRef(() => PostingService))
    private postingService: PostingService,
  ) {}

  private get companyId(): string {
    const id = this.tenant.companyId;
    if (!id) throw new Error('No company context for stock operation');
    return id;
  }

  async getStock(itemId?: string, warehouseId?: string) {
    if (!itemId) throw new Error('itemId is required');
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new Error(`Item ${itemId} not found`);
    if (warehouseId) {
      const ws = await this.prisma.warehouseStock.findUnique({
        where: { warehouseId_itemId: { warehouseId, itemId } },
      });
      return {
        ...item,
        warehouseStock: ws?.quantity ?? 0,
        warehouseAvgCost: ws?.averageCost ?? 0,
      };
    }
    const total = await this.prisma.warehouseStock.aggregate({
      where: { itemId },
      _sum: { quantity: true },
    });
    return { ...item, totalStock: total._sum.quantity ?? 0 };
  }

  async receiveStock(
    params: {
      itemId: string;
      warehouseId: string;
      quantity: number;
      unitCost: number;
      referenceId: string;
      referenceType: string;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    const {
      itemId,
      warehouseId,
      quantity,
      unitCost,
      referenceId,
      referenceType,
      createdBy,
    } = params;
    const execute = async (tx: Prisma.TransactionClient) => {
      const item = await tx.item.update({
        where: { id: itemId },
        data: {
          currentStock: { increment: quantity },
          availableStock: { increment: quantity },
        },
      });
      const ws = await tx.warehouseStock.upsert({
        where: { warehouseId_itemId: { warehouseId, itemId } },
        create: {
          companyId: this.companyId,
          warehouseId,
          itemId,
          quantity,
          averageCost: unitCost,
        },
        update: { quantity: { increment: quantity }, averageCost: unitCost },
      });

      // Maintain FIFO layer
      const lastLayer = await tx.fifoLayer.findFirst({
        where: { companyId: this.companyId, warehouseId, itemId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });
      const sequence = (lastLayer?.sequence ?? 0) + 1;
      const trackedValue = Math.round(quantity * unitCost * 100) / 100;
      await tx.fifoLayer.create({
        data: {
          companyId: this.companyId,
          warehouseId,
          itemId,
          sourceMovementId: referenceId,
          receiptDate: new Date(),
          sequence,
          originalQty: new Decimal(quantity),
          remainingQty: new Decimal(quantity),
          unitCost: new Decimal(unitCost),
          trackedValue: new Decimal(trackedValue),
          status: 'OPEN',
        },
      });

      const beforeQty = ws.quantity - quantity;
      const beforeCost = ws.averageCost;
      await tx.stockLedger.create({
        data: {
          companyId: this.companyId,
          itemId,
          warehouseId,
          transactionType: 'GRN_RECEIPT',
          referenceId,
          referenceType,
          qtyBefore: beforeQty,
          qtyChange: quantity,
          qtyAfter: ws.quantity,
          costBefore: beforeCost,
          costChange: Math.round(quantity * unitCost * 100) / 100,
          costAfter: ws.averageCost,
          notes: `Received ${quantity} units at ${unitCost}`,
          createdBy,
        },
      });
      await this.eventBus.publish(
        new InventoryUpdatedEvent({
          itemId,
          warehouseId,
          transactionType: 'GRN_RECEIPT',
          qtyChange: quantity,
          referenceId,
          referenceType,
        }),
      );
      return { item, warehouseStock: ws };
    };

    return externalTx ? execute(externalTx) : this.prisma.$transaction(execute);
  }

  async issueStock(
    params: {
      itemId: string;
      warehouseId: string;
      quantity: number;
      referenceId: string;
      referenceType: string;
      unreserve?: boolean;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    const {
      itemId,
      warehouseId,
      quantity,
      referenceId,
      referenceType,
      unreserve,
      createdBy,
    } = params;
    const execute = async (tx: Prisma.TransactionClient) => {
      // Row lock on warehouse stock
      await tx.$queryRaw`
        SELECT id, quantity
        FROM "warehouse_stock"
        WHERE "companyId" = ${this.companyId}
          AND "warehouseId" = ${warehouseId}
          AND "itemId" = ${itemId}
        FOR UPDATE
      `;

      const ws = await tx.warehouseStock.findUnique({
        where: { warehouseId_itemId: { warehouseId, itemId } },
      });
      if (!ws || ws.quantity < quantity) {
        throw new BadRequestException(
          `Insufficient stock for item ${itemId} in warehouse ${warehouseId}. Available: ${ws?.quantity ?? 0}, Required: ${quantity}`,
        );
      }

      // Consume FIFO layers
      const openLayers = await tx.$queryRaw<
        Array<{
          id: string;
          sequence: number;
          remainingQty: any;
          unitCost: any;
          trackedValue: any;
          receiptDate: Date;
        }>
      >`
        SELECT id, sequence, "remainingQty", "unitCost", "trackedValue", "receiptDate"
        FROM "fifo_layers"
        WHERE "companyId" = ${this.companyId}
          AND "warehouseId" = ${warehouseId}
          AND "itemId" = ${itemId}
          AND "status" = 'OPEN'
          AND "remainingQty" > 0
        ORDER BY "receiptDate" ASC, "sequence" ASC
        FOR UPDATE
      `;

      let totalIssueCost = 0;
      let remainingToConsume = quantity;

      for (const layer of openLayers) {
        if (remainingToConsume <= 0) break;
        const layerRemaining = Number(layer.remainingQty);
        const layerUnitCost = Number(layer.unitCost);
        const layerTrackedVal = Number(layer.trackedValue);

        const takeQty = Math.min(remainingToConsume, layerRemaining);
        const isExhausting = takeQty === layerRemaining;

        let allocatedVal = 0;
        if (isExhausting) {
          allocatedVal = layerTrackedVal;
        } else {
          allocatedVal = Math.round(takeQty * layerUnitCost * 100) / 100;
        }

        const newRemaining = layerRemaining - takeQty;
        const newTrackedVal = isExhausting
          ? 0
          : Math.round((layerTrackedVal - allocatedVal) * 100) / 100;
        const newStatus = isExhausting ? 'EXHAUSTED' : 'OPEN';

        await tx.fifoLayer.update({
          where: { id: layer.id },
          data: {
            remainingQty: new Decimal(newRemaining),
            trackedValue: new Decimal(newTrackedVal),
            status: newStatus,
          },
        });

        await tx.fifoAllocation.create({
          data: {
            companyId: this.companyId,
            layerId: layer.id,
            stockMovementId: referenceId,
            quantity: new Decimal(takeQty),
            unitCost: new Decimal(layerUnitCost),
            allocatedValue: new Decimal(allocatedVal),
          },
        });

        totalIssueCost += allocatedVal;
        remainingToConsume -= takeQty;
      }

      totalIssueCost = Math.round(totalIssueCost * 100) / 100;
      const beforeQty = ws.quantity;
      const unreserveQty = unreserve ? quantity : 0;

      await tx.item.update({
        where: { id: itemId },
        data: {
          currentStock: { decrement: quantity },
          availableStock: { decrement: quantity - unreserveQty },
          reservedStock:
            unreserveQty > 0 ? { decrement: unreserveQty } : undefined,
        },
      });

      const updated = await tx.warehouseStock.update({
        where: { warehouseId_itemId: { warehouseId, itemId } },
        data: { quantity: { decrement: quantity } },
      });

      await tx.stockLedger.create({
        data: {
          companyId: this.companyId,
          itemId,
          warehouseId,
          transactionType: 'SALES_ISSUE',
          referenceId,
          referenceType,
          qtyBefore: beforeQty,
          qtyChange: -quantity,
          qtyAfter: updated.quantity,
          costBefore: ws.averageCost,
          costChange: totalIssueCost,
          costAfter: updated.averageCost,
          notes: `Issued ${quantity} units (FIFO cost: ${totalIssueCost})`,
          createdBy,
        },
      });

      await this.eventBus.publish(
        new InventoryUpdatedEvent({
          itemId,
          warehouseId,
          transactionType: 'SALES_ISSUE',
          qtyChange: -quantity,
          referenceId,
          referenceType,
        }),
      );
      return { ...updated, totalIssueCost };
    };

    return externalTx ? execute(externalTx) : this.prisma.$transaction(execute);
  }

  async reserveStock(
    itemId: string,
    warehouseId: string,
    quantity: number,
    externalTx?: Prisma.TransactionClient,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const ws = await tx.warehouseStock.findUnique({
        where: { warehouseId_itemId: { warehouseId, itemId } },
      });
      if (!ws || ws.quantity < quantity)
        throw new BadRequestException(
          `Insufficient stock to reserve for item ${itemId}`,
        );
      await tx.item.update({
        where: { id: itemId },
        data: {
          reservedStock: { increment: quantity },
          availableStock: { decrement: quantity },
        },
      });
    };
    return externalTx ? execute(externalTx) : this.prisma.$transaction(execute);
  }

  async unreserveStock(
    itemId: string,
    warehouseId: string,
    quantity: number,
    externalTx?: Prisma.TransactionClient,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      await tx.item.update({
        where: { id: itemId },
        data: {
          reservedStock: { decrement: quantity },
          availableStock: { increment: quantity },
        },
      });
    };
    return externalTx ? execute(externalTx) : this.prisma.$transaction(execute);
  }

  async transferStock(
    params: {
      itemId: string;
      fromWarehouseId: string;
      toWarehouseId: string;
      quantity: number;
      requestKey?: string;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    const requestKey =
      params.requestKey ??
      `XFER-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return this.postingService.post(
      {
        action: 'STOCK_TRANSFER',
        requestKey,
        voucherType: 'TRANSFER',
        reference: `XFER-${params.itemId}`,
        notes: `Transfer ${params.quantity} from ${params.fromWarehouseId} to ${params.toWarehouseId}`,
        createdBy: params.createdBy,
        stockMovements: [
          {
            type: 'TRANSFER',
            itemId: params.itemId,
            warehouseId: params.fromWarehouseId,
            toWarehouseId: params.toWarehouseId,
            quantity: params.quantity,
          },
        ],
      },
      externalTx,
    );
  }

  async adjustStock(params: {
    itemId: string;
    warehouseId: string;
    newQuantity: number;
    reason: string;
    createdBy?: string;
  }) {
    const { itemId, warehouseId, newQuantity, reason, createdBy } = params;
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ws = await tx.warehouseStock.findUnique({
        where: { warehouseId_itemId: { warehouseId, itemId } },
      });
      const currentQty = ws?.quantity ?? 0;
      const diff = newQuantity - currentQty;
      const type = diff >= 0 ? 'ADJUSTMENT_PLUS' : 'ADJUSTMENT_MINUS';
      await tx.warehouseStock.upsert({
        where: { warehouseId_itemId: { warehouseId, itemId } },
        create: {
          companyId: this.companyId,
          warehouseId,
          itemId,
          quantity: newQuantity,
          averageCost: 0,
        },
        update: { quantity: newQuantity },
      });
      const totalQty =
        (
          await tx.warehouseStock.aggregate({
            where: { itemId },
            _sum: { quantity: true },
          })
        )._sum.quantity ?? 0;
      await tx.item.update({
        where: { id: itemId },
        data: { currentStock: totalQty, availableStock: totalQty },
      });
      await tx.stockLedger.create({
        data: {
          companyId: this.companyId,
          itemId,
          warehouseId,
          transactionType: type,
          qtyBefore: currentQty,
          qtyChange: diff,
          qtyAfter: newQuantity,
          notes: reason,
          createdBy,
        },
      });
      return {
        itemId,
        warehouseId,
        previousQty: currentQty,
        newQuantity,
        difference: diff,
      };
    });
  }

  async getLedger(itemId: string, limit = 50) {
    return this.prisma.stockLedger.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getFifoLayers(itemId?: string, warehouseId?: string) {
    const where: any = {
      ...(this.companyId ? { companyId: this.companyId } : {}),
      status: 'OPEN',
      remainingQty: { gt: 0 },
    };
    if (itemId) where.itemId = itemId;
    if (warehouseId) where.warehouseId = warehouseId;

    const layers = await this.prisma.fifoLayer.findMany({
      where,
      orderBy: [{ receiptDate: 'asc' }, { sequence: 'asc' }],
      include: {
        item: {
          select: {
            id: true,
            itemCode: true,
            name: true,
            unit: { select: { name: true, code: true } },
          },
        },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    return layers.map((layer) => ({
      id: layer.id,
      itemId: layer.itemId,
      itemCode: layer.item?.itemCode,
      itemName: layer.item?.name,
      warehouseId: layer.warehouseId,
      warehouseName: layer.warehouse?.name,
      receiptDate: layer.receiptDate,
      sequence: layer.sequence,
      originalQty: Number(layer.originalQty),
      remainingQty: Number(layer.remainingQty),
      unitCost: Number(layer.unitCost),
      trackedValue: Number(layer.trackedValue),
      status: layer.status,
    }));
  }
}
