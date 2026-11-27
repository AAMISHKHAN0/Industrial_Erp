import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/PurchaseOrder.dto';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { NotificationService } from '../../../common/services/notification.service';
import { FinanceIntegrationService } from '../../finance/services/finance-integration.service';
import { EventBus } from '../../../common/events/event-bus';
import { PurchaseOrderApprovedEvent } from '../../../common/events/domain-event';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class PurchaseOrderService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private notification: NotificationService,
    private finance: FinanceIntegrationService,
    private eventBus: EventBus,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreatePurchaseOrderDto, userId?: string) {
    return (this.prisma.$transaction as any)(
      async (tx: any) => {
        // FK ownership: the referenced vendor must belong to the caller's company.
        const vendor = await tx.vendor.findFirst({
          where: { id: dto.vendorId, deletedAt: null },
        });
        if (!vendor)
          throw new NotFoundException('Vendor not found in your company');

        const poNumber = await resolveAutoCode(
          tx.purchaseOrder,
          this.tenant.companyId!,
          'poNumber',
          'PO',
          dto.poNumber,
        );

        const po = await tx.purchaseOrder.create({
          data: {
            companyId: this.tenant.companyId!,
            poNumber,
            vendorId: dto.vendorId,
            demandNoteId: dto.demandNoteId,
            quotationId: dto.quotationId,
            orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
            expectedDelivery: dto.expectedDelivery
              ? new Date(dto.expectedDelivery)
              : undefined,
            paymentTerms: dto.paymentTerms,
            shippingCost: dto.shippingCost ?? 0,
            discountAmount: dto.discountAmount ?? 0,
            taxAmount: dto.taxAmount ?? 0,
            grandTotal:
              dto.grandTotal ??
              (dto.items
                ? dto.items.reduce(
                    (s, i) =>
                      s + (i.totalPrice ?? i.quantity * i.unitPrice),
                    0,
                  )
                : 0),
            qtyTolerancePct: dto.qtyTolerancePct ?? 0,
            priceTolerancePct: dto.priceTolerancePct ?? 0,
            notes: dto.notes,
            status: 'DRAFT',
            createdBy: userId,
            ...(dto.items && dto.items.length > 0
              ? {
                  items: {
                    create: dto.items.map((i) => ({
                      itemId: i.itemId,
                      quantity: i.quantity,
                      unitPrice: i.unitPrice,
                      discountPct: i.discountPct ?? 0,
                      taxPct: i.taxPct ?? 0,
                      totalPrice: i.totalPrice ?? i.quantity * i.unitPrice,
                      tolerancePct: i.tolerancePct,
                    })),
                  },
                }
              : {}),
          },
          include: { items: true, vendor: true },
        });

        await this.auditLog.log({
          entity: 'PurchaseOrder',
          entityId: po.id,
          action: 'CREATED',
          userId,
          newValue: { poNumber, total: dto.grandTotal },
        });
        if (userId)
          await this.notification.notify({
            userId,
            title: `PO ${poNumber} created`,
            message: `Amount: ${dto.grandTotal}`,
            link: `/purchase/orders/${po.id}`,
          });
        return po;
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  async approve(id: string, userId?: string) {
    return (this.prisma.$transaction as any)(
      async (tx: any) => {
        // Ownership: findFirst is tenant-scoped by the extension; blocks cross-company approve.
        const owned = await tx.purchaseOrder.findFirst({
          where: { id, deletedAt: null },
        });
        if (!owned) throw new NotFoundException('PurchaseOrder not found');
        const po = await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedBy: userId,
            approvedAt: new Date(),
          },
          include: { vendor: true, items: true },
        });
        await this.auditLog.log({
          entity: 'PurchaseOrder',
          entityId: id,
          action: 'APPROVED',
          userId,
          newValue: { status: 'APPROVED' },
        });
        await this.eventBus.publish(
          new PurchaseOrderApprovedEvent({
            purchaseOrderId: id,
            poNumber: po.poNumber,
            vendorId: po.vendorId,
            totalAmount: po.grandTotal ?? 0,
          }),
        );

        // PO approval is commercial authorization only — zero financial GL posting.

        const admins = await tx.user.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true },
        });
        for (const admin of admins) {
          await this.notification.notify({
            userId: admin.id,
            title: `PO ${po.poNumber} approved`,
            message: `Vendor: ${po.vendor?.name}`,
            link: `/purchase/orders/${id}`,
          });
        }
        return po;
      },
      { maxWait: 30000, timeout: 30000 },
    );
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
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { vendor: true, items: { include: { item: true } } },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    data = await enrichWithCreator(this.prisma, data);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: { vendor: true, items: { include: { item: true } } },
    });
    if (!item) throw new NotFoundException('PurchaseOrder not found');
    const enriched = await enrichWithCreator(this.prisma, [item]);
    return enriched[0];
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    await this.findOne(id);

    const { items, ...scalarData } = dto as any;
    const cleanData = Object.fromEntries(
      Object.entries(scalarData).filter(
        ([_, v]) => v !== undefined && v !== '',
      ),
    );

    return (this.prisma.$transaction as any)(
      async (tx: any) => {
        if (items) {
          await tx.purchaseOrderItem.deleteMany({
            where: { purchaseOrderId: id },
          });
          if (items.length > 0) {
            await tx.purchaseOrderItem.createMany({
              data: items.map((i: any) => ({
                purchaseOrderId: id,
                itemId: i.itemId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                discountPct: i.discountPct,
                taxPct: i.taxPct,
                totalPrice: i.totalPrice,
              })),
            });
          }
        }

        return tx.purchaseOrder.update({
          where: { id },
          data: cleanData,
          include: { vendor: true, items: true },
        });
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  async restore(id: string) {
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { deletedAt: null, status: 'DRAFT' },
    });
  }
}
