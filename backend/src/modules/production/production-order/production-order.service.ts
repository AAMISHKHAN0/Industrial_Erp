import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateProductionOrderDto,
  UpdateProductionOrderDto,
} from './dto/production-order.dto';
import { StockService } from '../../inventory/services/stock.service';
import { FinanceIntegrationService } from '../../finance/services/finance-integration.service';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { NotificationService } from '../../../common/services/notification.service';
import { EventBus } from '../../../common/events/event-bus';
import { ProductionCompletedEvent } from '../../../common/events/domain-event';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class ProductionOrderService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private finance: FinanceIntegrationService,
    private auditLog: AuditLogService,
    private notification: NotificationService,
    private eventBus: EventBus,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateProductionOrderDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const productionNumber = await resolveAutoCode(
        tx.productionOrder,
        this.tenant.companyId!,
        'productionNumber',
        'PROD',
        dto.productionNumber,
      );
      const order = await tx.productionOrder.create({
        data: {
          companyId: this.tenant.companyId!,
          productionNumber,
          itemId: dto.itemId,
          bomId: dto.bomId || null,
          quantity: dto.quantity,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          assignedTo: dto.assignedTo,
          priority: dto.priority ?? 'MEDIUM',
          notes: dto.notes,
          status: 'PLANNED',
          createdBy: userId,
        },
        include: { item: true, bom: { include: { materials: true } } },
      });

      if (order.bom?.materials) {
        for (const mat of order.bom.materials) {
          await tx.materialConsumption.create({
            data: {
              productionOrderId: order.id,
              itemId: mat.itemId,
              plannedQty: mat.quantity * order.quantity,
              unit: mat.unit,
              notes: `Auto-generated from BOM: ${(order.bom as any)?.name}`,
            },
          });
        }
      }

      await this.auditLog.log(
        {
          entity: 'ProductionOrder',
          entityId: order.id,
          action: 'CREATED',
          userId,
          newValue: {
            productionNumber,
            quantity: dto.quantity,
          },
        },
        tx,
      );
      if (userId) {
        await this.notification.notify({
          userId,
          title: `Production Order ${productionNumber} created`,
          message: `Qty: ${dto.quantity}`,
          link: `/production/orders/${order.id}`,
        });
      }
      return order;
    });
  }

  async start(id: string, userId?: string) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id, deletedAt: null },
    });
    if (!order) throw new NotFoundException('Production order not found');
    if (order.status !== 'PLANNED') {
      throw new BadRequestException('Only planned orders can be started');
    }
    return this.prisma.productionOrder.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startDate: new Date(), updatedBy: userId },
    });
  }

  async hold(id: string, userId?: string) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id, deletedAt: null },
    });
    if (!order) throw new NotFoundException('Production order not found');
    if (order.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Only in-progress orders can be put on hold',
      );
    }
    return this.prisma.productionOrder.update({
      where: { id },
      data: { status: 'ON_HOLD', updatedBy: userId },
    });
  }

  async resume(id: string, userId?: string) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id, deletedAt: null },
    });
    if (!order) throw new NotFoundException('Production order not found');
    if (order.status !== 'ON_HOLD') {
      throw new BadRequestException('Only on-hold orders can be resumed');
    }
    return this.prisma.productionOrder.update({
      where: { id },
      data: { status: 'IN_PROGRESS', updatedBy: userId },
    });
  }

  async complete(
    id: string,
    producedQty?: number,
    rejectedQty?: number,
    warehouseId?: string,
    userId?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.productionOrder.findFirst({
          where: { id, deletedAt: null },
          include: {
            item: true,
            bom: { include: { materials: true } },
            materialConsumptions: { include: { item: true } },
          },
        });
        if (!order) throw new NotFoundException('Production order not found');
        if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
          throw new BadRequestException(
            `Production order is already ${order.status}`,
          );
        }

        const effectiveProduced =
          producedQty !== undefined && producedQty !== null
            ? Number(producedQty)
            : order.quantity;
        const effectiveRejected =
          rejectedQty !== undefined && rejectedQty !== null
            ? Number(rejectedQty)
            : 0;

        if (effectiveProduced < 0 || effectiveRejected < 0) {
          throw new BadRequestException('Quantities cannot be negative');
        }
        const acceptedQty = effectiveProduced - effectiveRejected;
        if (acceptedQty < 0) {
          throw new BadRequestException(
            'Rejected quantity cannot exceed produced quantity',
          );
        }

        // Resolve company warehouse (never hardcode 'default')
        let targetWarehouseId = warehouseId?.trim();
        if (targetWarehouseId) {
          const wh = await tx.warehouse.findFirst({
            where: {
              id: targetWarehouseId,
              companyId: order.companyId,
              deletedAt: null,
            },
          });
          if (!wh) {
            throw new NotFoundException(
              'Selected warehouse not found in your company',
            );
          }
          targetWarehouseId = wh.id;
        } else {
          const defaultWh = await tx.warehouse.findFirst({
            where: { companyId: order.companyId, deletedAt: null },
            orderBy: { createdAt: 'asc' },
          });
          if (!defaultWh) {
            throw new BadRequestException(
              'No active warehouse found for this company. Please create or select a warehouse.',
            );
          }
          targetWarehouseId = defaultWh.id;
        }

        // Issue consumed raw materials atomically inside tx
        let totalMaterialCost = 0;
        for (const mc of order.materialConsumptions) {
          const actualQty = mc.plannedQty;
          if (actualQty > 0) {
            const issueRes = await this.stockService.issueStock(
              {
                itemId: mc.itemId,
                warehouseId: targetWarehouseId,
                quantity: actualQty,
                referenceId: id,
                referenceType: 'PRODUCTION_ISSUE',
                createdBy: userId,
              },
              tx,
            );
            totalMaterialCost += issueRes.totalIssueCost ?? 0;
          }
          await tx.materialConsumption.update({
            where: { id: mc.id },
            data: { actualQty },
          });
        }
        totalMaterialCost = Math.round(totalMaterialCost * 100) / 100;

        // Receive finished goods atomically inside tx
        let finishedTotalCost = 0;
        if (acceptedQty > 0) {
          const finishedUnitCost =
            totalMaterialCost > 0
              ? Math.round((totalMaterialCost / acceptedQty) * 10000) / 10000
              : (order.item?.purchasePrice ?? 0);
          finishedTotalCost =
            totalMaterialCost > 0
              ? totalMaterialCost
              : Math.round(acceptedQty * finishedUnitCost * 100) / 100;

          await this.stockService.receiveStock(
            {
              itemId: order.itemId,
              warehouseId: targetWarehouseId,
              quantity: acceptedQty,
              unitCost: finishedUnitCost,
              referenceId: id,
              referenceType: 'PRODUCTION_RECEIPT',
              createdBy: userId,
            },
            tx,
          );
        }

        // GL Posting on completion (Raw Materials -> WIP -> Finished Goods)
        const journalItems: Array<{
          accountCode: string;
          debit?: number;
          credit?: number;
          description?: string;
        }> = [];

        if (totalMaterialCost > 0) {
          journalItems.push(
            {
              accountCode: 'WIP',
              debit: totalMaterialCost,
              description: `WIP material consumption - ${order.productionNumber}`,
            },
            {
              accountCode: 'INVENTORY',
              credit: totalMaterialCost,
              description: `Raw materials issued - ${order.productionNumber}`,
            },
          );
        }
        if (finishedTotalCost > 0) {
          journalItems.push(
            {
              accountCode: 'INVENTORY',
              debit: finishedTotalCost,
              description: `Finished goods received - ${order.productionNumber}`,
            },
            {
              accountCode: 'WIP',
              credit: finishedTotalCost,
              description: `WIP absorption on completion - ${order.productionNumber}`,
            },
          );
        }

        if (journalItems.length >= 2) {
          const now = new Date();
          const voucher = await tx.voucher.create({
            data: {
              companyId: order.companyId,
              voucherNumber: `VCH-PROD-${order.productionNumber}`,
              voucherType: 'PRODUCTION_COMPLETION',
              businessDate: now,
              status: 'POSTED',
              reference: `PROD-${order.productionNumber}`,
              notes: `Production completion for ${order.productionNumber} (${acceptedQty} accepted)`,
              createdBy: userId,
            },
          });

          const entry = await this.finance.createJournalEntry(
            {
              companyId: order.companyId,
              entryDate: now,
              reference: `PROD-${order.productionNumber}`,
              description: `Production order ${order.productionNumber} completion`,
              items: journalItems,
              createdBy: userId,
            },
            tx,
          );

          await tx.journalEntry.update({
            where: { id: entry.id },
            data: { voucherId: voucher.id },
          });
        }

        const updated = await tx.productionOrder.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            producedQty: effectiveProduced,
            rejectedQty: effectiveRejected,
            endDate: new Date(),
            updatedBy: userId,
          },
          include: { item: true, bom: true },
        });

        await this.eventBus.publish(
          new ProductionCompletedEvent({
            productionOrderId: id,
            itemId: order.itemId,
            producedQty: effectiveProduced,
            rejectedQty: effectiveRejected,
          }),
        );
        await this.auditLog.log(
          {
            entity: 'ProductionOrder',
            entityId: id,
            action: 'COMPLETED',
            userId,
            newValue: {
              producedQty: effectiveProduced,
              rejectedQty: effectiveRejected,
              warehouseId: targetWarehouseId,
              totalMaterialCost,
              finishedTotalCost,
            },
          },
          tx,
        );
        if (userId) {
          await this.notification.notify({
            userId,
            title: `Production ${order.productionNumber} completed`,
            message: `Produced: ${effectiveProduced}, Rejected: ${effectiveRejected}`,
            link: `/production/orders/${id}`,
          });
        }
        return updated;
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    status?: string;
  }) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;
    const where: any = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };
    let [data, total] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          item: true,
          bom: true,
          qualityChecks: true,
          materialConsumptions: { include: { item: true } },
        },
      }),
      this.prisma.productionOrder.count({ where }),
    ]);
    data = await enrichWithCreator(this.prisma, data);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const record = await this.prisma.productionOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        item: true,
        bom: { include: { materials: { include: { item: true } } } },
        qualityChecks: true,
        materialConsumptions: { include: { item: true } },
      },
    });
    if (!record) throw new NotFoundException('Production order not found');
    const enriched = await enrichWithCreator(this.prisma, [record]);
    return enriched[0];
  }

  async update(id: string, dto: UpdateProductionOrderDto) {
    await this.findOne(id);
    const cleanData: any = { ...dto };
    if ('bomId' in cleanData) cleanData.bomId = cleanData.bomId || null;
    if ('startDate' in cleanData) {
      cleanData.startDate = cleanData.startDate ? new Date(cleanData.startDate) : null;
    }
    if ('endDate' in cleanData) {
      cleanData.endDate = cleanData.endDate ? new Date(cleanData.endDate) : null;
    }
    if ('assignedTo' in cleanData) cleanData.assignedTo = cleanData.assignedTo || null;
    if ('notes' in cleanData) cleanData.notes = cleanData.notes || null;
    return this.prisma.productionOrder.update({
      where: { id },
      data: cleanData,
      include: { item: true, bom: true, qualityChecks: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.productionOrder.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });
  }

  async restore(id: string) {
    const item = await this.prisma.productionOrder.findFirst({ where: { id } });
    if (!item) throw new NotFoundException('Production order not found');
    return this.prisma.productionOrder.update({
      where: { id },
      data: { deletedAt: null, status: 'PLANNED' },
    });
  }
}
