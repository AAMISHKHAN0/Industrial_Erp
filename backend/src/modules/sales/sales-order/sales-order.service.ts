import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateSalesOrderDto,
  UpdateSalesOrderDto,
} from './dto/sales-order.dto';
import { StockService } from '../../inventory/services/stock.service';
import { FinanceIntegrationService } from '../../finance/services/finance-integration.service';
import { PostingService } from '../../finance/services/posting.service';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { NotificationService } from '../../../common/services/notification.service';
import { EventBus } from '../../../common/events/event-bus';
import { SalesOrderConfirmedEvent } from '../../../common/events/domain-event';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class SalesOrderService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private finance: FinanceIntegrationService,
    @Inject(forwardRef(() => PostingService))
    private postingService: PostingService,
    private auditLog: AuditLogService,
    private notification: NotificationService,
    private eventBus: EventBus,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateSalesOrderDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const insufficientStock: string[] = [];

      if (dto.items) {
        for (const item of dto.items) {
          if (item.itemId) {
            const stock = await this.stockService.getStock(item.itemId);
            if (stock.availableStock < item.quantity) {
              insufficientStock.push(
                `${stock.name} (available: ${stock.availableStock}, required: ${item.quantity})`,
              );
            }
          }
        }
      }

      if (insufficientStock.length > 0 && dto.status !== 'CONFIRMED') {
        return {
          warning: `Insufficient stock: ${insufficientStock.join(', ')}. Confirm order to auto-create production orders.`,
        };
      }

      const soNumber = await resolveAutoCode(
        tx.salesOrder,
        this.tenant.companyId!,
        'soNumber',
        'SO',
        dto.soNumber,
      );

      const so = await tx.salesOrder.create({
        data: {
          companyId: this.tenant.companyId!,
          soNumber,
          customerId: dto.customerId,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
          expectedDelivery: dto.expectedDelivery
            ? new Date(dto.expectedDelivery)
            : undefined,
          paymentTerms: dto.paymentTerms,
          shippingCost: dto.shippingCost,
          discountAmount: dto.discountAmount,
          taxAmount: dto.taxAmount,
          grandTotal: dto.grandTotal,
          notes: dto.notes,
          status: dto.status ?? 'DRAFT',
          createdBy: userId,
          items: {
            create: (dto.items ?? []).map((i) => ({
              itemId: i.itemId,
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discountPct: i.discountPct,
              taxPct: i.taxPct,
              totalPrice: i.totalPrice,
            })),
          },
        },
        include: { customer: true, items: { include: { item: true } } },
      });

      if (dto.status === 'CONFIRMED') {
        for (const item of dto.items ?? []) {
          if (item.itemId) {
            const stock = await this.stockService.getStock(item.itemId);
            if (stock.availableStock >= item.quantity) {
              const warehouse = await tx.warehouseStock.findFirst({
                where: {
                  itemId: item.itemId,
                  quantity: { gte: item.quantity },
                },
              });
              if (warehouse)
                await this.stockService.reserveStock(
                  item.itemId,
                  warehouse.warehouseId,
                  item.quantity,
                  tx,
                );
            } else {
              const autoCreatePO =
                process.env.AUTO_CREATE_PRODUCTION_ORDER !== 'false';
              if (autoCreatePO) {
                const bom = await tx.billOfMaterial.findFirst({
                  where: { itemId: item.itemId, status: 'ACTIVE' },
                  include: { materials: true },
                });
                if (bom) {
                  await tx.productionOrder.create({
                    data: {
                      companyId: this.tenant.companyId!,
                      productionNumber: `PO-${soNumber}-${item.itemId?.slice(0, 8)}`,
                      itemId: item.itemId,
                      bomId: bom.id,
                      quantity: item.quantity,
                      status: 'PLANNED',
                      priority: 'MEDIUM',
                      createdBy: userId,
                    },
                  });
                }
              }
            }
          }
        }

        await this.finance.createSalesJournalEntry(
          {
            soNumber,
            customerName: so.customer?.name ?? 'Unknown',
            totalAmount: dto.grandTotal ?? 0,
            createdBy: userId,
          },
          tx,
        );

        await this.eventBus.publish(
          new SalesOrderConfirmedEvent({
            salesOrderId: so.id,
            soNumber,
            customerId: dto.customerId,
            totalAmount: dto.grandTotal ?? 0,
            items: (dto.items ?? []).map((i) => ({
              itemId: i.itemId ?? '',
              quantity: i.quantity,
            })),
          }),
        );
      }

      await this.auditLog.log(
        {
          entity: 'SalesOrder',
          entityId: so.id,
          action: 'CREATED',
          userId,
          newValue: { soNumber, status: dto.status },
        },
        tx,
      );
      if (userId)
        await this.notification.notify({
          userId,
          title: `SO ${soNumber} created`,
          message: `Status: ${dto.status}`,
          link: `/sales/orders/${so.id}`,
        });
      return so;
    });
  }

  async confirm(id: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.findFirst({
        where: { id, deletedAt: null },
        include: { items: true, customer: true },
      });
      if (!so) throw new NotFoundException('Sales order not found');

      for (const item of so.items) {
        if (item.itemId) {
          const stock = await this.stockService.getStock(item.itemId);
          if (stock.availableStock >= item.quantity) {
            const warehouse = await tx.warehouseStock.findFirst({
              where: { itemId: item.itemId, quantity: { gte: item.quantity } },
            });
            if (warehouse)
              await this.stockService.reserveStock(
                item.itemId,
                warehouse.warehouseId,
                item.quantity,
                tx,
              );
          } else {
            const bom = await tx.billOfMaterial.findFirst({
              where: { itemId: item.itemId, status: 'ACTIVE' },
              include: { materials: true },
            });
            if (bom) {
              await tx.productionOrder.create({
                data: {
                  companyId: this.tenant.companyId!,
                  productionNumber: `PROD-${so.soNumber}-${Date.now()}`,
                  itemId: item.itemId,
                  bomId: bom.id,
                  quantity: item.quantity,
                  status: 'PLANNED',
                  priority: 'MEDIUM',
                  createdBy: userId,
                },
              });
            }
          }
        }
      }

      const updated = await tx.salesOrder.update({
        where: { id },
        data: { status: 'CONFIRMED' },
        include: { customer: true, items: { include: { item: true } } },
      });
      // Sales order confirmation is stock reservation only — revenue recognized upon invoicing.
      await this.eventBus.publish(
        new SalesOrderConfirmedEvent({
          salesOrderId: id,
          soNumber: so.soNumber,
          customerId: so.customerId,
          totalAmount: so.grandTotal ?? 0,
          items: so.items.map((i) => ({
            itemId: i.itemId ?? '',
            quantity: i.quantity,
          })),
        }),
      );
      await this.auditLog.log(
        {
          entity: 'SalesOrder',
          entityId: id,
          action: 'CONFIRMED',
          userId,
        },
        tx,
      );
      if (userId)
        await this.notification.notify({
          userId,
          title: `SO ${so.soNumber} confirmed`,
          message: `Stock reserved`,
          link: `/sales/orders/${id}`,
        });
      return updated;
    });
  }

  async deliver(id: string, warehouseId: string, userId?: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const so = await tx.salesOrder.findFirst({
          where: { id, deletedAt: null },
          include: { items: true },
        });
        if (!so) throw new NotFoundException('Sales order not found');

        let targetWarehouseId = warehouseId?.trim();
        if (!targetWarehouseId) {
          const wh = await tx.warehouse.findFirst({
            where: { companyId: so.companyId, deletedAt: null },
            orderBy: { createdAt: 'asc' },
          });
          if (!wh) {
            throw new BadRequestException(
              'Warehouse is required for sales order delivery',
            );
          }
          targetWarehouseId = wh.id;
        }

        const validItems = so.items
          .filter((i) => i.itemId && i.quantity > 0)
          .map((i) => ({
            itemId: i.itemId!,
            quantity: i.quantity,
          }));

        if (validItems.length === 0) {
          throw new BadRequestException(
            'Sales order has no deliverable line items',
          );
        }

        // Route dispatch delivery through PostingService: consumes FIFO layers, unreserves stock, posts Dr COGS / Cr Inventory
        const postingResult = await this.postingService.postStockIssue(
          {
            action: 'SALES_DELIVERY',
            requestKey: `DELIVERY-${id}`,
            voucherType: 'DELIVERY',
            companyId: so.companyId,
            warehouseId: targetWarehouseId,
            reference: `SO-${so.soNumber}`,
            notes: `Delivery for Sales Order ${so.soNumber}`,
            items: validItems,
            expenseAccountCode: 'COGS',
            unreserve: true,
            createdBy: userId,
          },
          tx,
        );

        const updated = await tx.salesOrder.update({
          where: { id },
          data: { status: 'DELIVERED' },
        });

        await this.auditLog.log(
          {
            entity: 'SalesOrder',
            entityId: id,
            action: 'DELIVERED',
            userId,
            newValue: {
              status: 'DELIVERED',
              voucherNumber: postingResult.voucherNumber,
              totalIssueCost: postingResult.totalIssueCost,
            },
          },
          tx,
        );

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
      this.prisma.salesOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { customer: true, items: { include: { item: true } } },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);
    data = await enrichWithCreator(this.prisma, data);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const record = await this.prisma.salesOrder.findFirst({
      where: { id, deletedAt: null },
      include: { customer: true, items: { include: { item: true } } },
    });
    if (!record) throw new NotFoundException('Sales order not found');
    const enriched = await enrichWithCreator(this.prisma, [record]);
    return enriched[0];
  }

  async update(id: string, dto: UpdateSalesOrderDto) {
    await this.findOne(id);
    const { items, ...data } = dto;
    return this.prisma.salesOrder.update({
      where: { id },
      data: {
        ...(data as any),
        ...(items ? { items: { deleteMany: {}, create: items as any } } : {}),
      },
      include: { customer: true, items: { include: { item: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.salesOrder.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  async restore(id: string) {
    return this.prisma.salesOrder.update({
      where: { id },
      data: { deletedAt: null, status: 'DRAFT' },
    });
  }
}
