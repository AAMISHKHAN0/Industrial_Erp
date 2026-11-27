import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateVendorDto,
  UpdateVendorDto,
  VendorItemDto,
  AddVendorItemsDto,
} from './dto/vendor.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class VendorService {
  constructor(
    private prisma: PrismaService,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateVendorDto, userId?: string) {
    const { materialsSupplied, creditLimit, ...vendorData } = dto;
    const companyId = this.tenant.companyId!;
    const vendorCode = await resolveAutoCode(
      this.prisma.vendor,
      companyId,
      'vendorCode',
      'VND',
      vendorData.vendorCode,
    );
    return this.prisma.vendor.create({
      data: {
        companyId,
        createdBy: userId,
        ...(vendorData as any),
        vendorCode,
        ...(materialsSupplied?.length
          ? {
              suppliedItems: {
                create: materialsSupplied.map((itemId) => ({
                  itemId,
                  companyId,
                })),
              },
            }
          : {}),
      },
      include: {
        suppliedItems: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                category: { select: { name: true } },
                unit: { select: { name: true } },
              },
            },
          },
        },
      },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    status?: string;
    itemId?: string;
  }) {
    const { page, limit, skip } = buildPagination(query);
    const where: any = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...buildSearchFilter(query.search, [
        'name',
        'vendorCode',
        'email',
        'phone',
        'contactPerson',
      ]),
      ...(query.itemId
        ? { suppliedItems: { some: { itemId: query.itemId } } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          suppliedItems: {
            include: {
              item: {
                select: {
                  id: true,
                  itemCode: true,
                  name: true,
                  category: { select: { name: true } },
                  unit: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const entity = await this.prisma.vendor.findFirst({
      where: { id, deletedAt: null } as any,
      include: {
        suppliedItems: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                category: { select: { name: true } },
                unit: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!entity) throw new NotFoundException('Vendor not found');
    const [enriched] = await enrichWithCreator(this.prisma, [entity]);
    return enriched;
  }

  async update(id: string, dto: UpdateVendorDto, userId?: string) {
    await this.findOne(id);
    const { materialsSupplied, creditLimit, ...vendorData } = dto;

    if (materialsSupplied) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.vendor.update({
          where: { id },
          data: {
            ...(vendorData as any),
            updatedBy: userId,
            suppliedItems: {
              deleteMany: {},
              create: materialsSupplied.map((itemId) => ({ itemId })),
            },
          },
          include: {
            suppliedItems: {
              include: {
                item: {
                  select: {
                    id: true,
                    itemCode: true,
                    name: true,
                    category: { select: { name: true } },
                    unit: { select: { name: true } },
                  },
                },
              },
            },
          },
        });
        return updated;
      });
    }

    return this.prisma.vendor.update({
      where: { id },
      data: { ...(vendorData as any), updatedBy: userId },
      include: {
        suppliedItems: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                category: { select: { name: true } },
                unit: { select: { name: true } },
              },
            },
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.vendor.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' } as any,
    });
  }

  async restore(id: string) {
    return this.prisma.vendor.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' } as any,
    });
  }

  async findItems(vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, deletedAt: null } as any,
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return this.prisma.vendorItem.findMany({
      where: { vendorId },
      include: {
        item: {
          select: {
            id: true,
            itemCode: true,
            name: true,
            category: { select: { name: true } },
            unit: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findVendorsByItem(itemId: string) {
    const items = await this.prisma.vendorItem.findMany({
      where: { itemId },
      include: {
        vendor: {
          select: {
            id: true,
            vendorCode: true,
            name: true,
            email: true,
            phone: true,
            city: true,
          },
        },
      },
    });
    return items.map((vi) => ({
      ...vi.vendor,
      preferredSupplier: vi.preferredSupplier,
      leadTimeDays: vi.leadTimeDays,
      minimumOrderQuantity: vi.minimumOrderQuantity,
      unitPrice: vi.unitPrice,
    }));
  }

  async findItemsByVendor(vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, deletedAt: null } as any,
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return this.prisma.vendorItem.findMany({
      where: { vendorId },
      include: {
        item: {
          select: {
            id: true,
            itemCode: true,
            name: true,
            category: { select: { name: true } },
            unit: { select: { name: true } },
          },
        },
      },
    });
  }

  async addItems(vendorId: string, dto: AddVendorItemsDto) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, deletedAt: null } as any,
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const existing = await this.prisma.vendorItem.findMany({
      where: { vendorId, itemId: { in: dto.itemIds } },
      select: { itemId: true },
    });
    const existingIds = new Set(existing.map((e) => e.itemId));
    const newItems = dto.itemIds.filter((id) => !existingIds.has(id));

    if (newItems.length === 0) {
      throw new ConflictException(
        'All items are already associated with this vendor',
      );
    }

    await this.prisma.vendorItem.createMany({
      data: newItems.map((itemId) => ({ vendorId, itemId })),
    } as any);

    return this.findItems(vendorId);
  }

  async updateItem(vendorId: string, itemId: string, dto: VendorItemDto) {
    const vi = await this.prisma.vendorItem.findUnique({
      where: { vendorId_itemId: { vendorId, itemId } },
    });
    if (!vi) throw new NotFoundException('Vendor-Item relationship not found');

    return this.prisma.vendorItem.update({
      where: { vendorId_itemId: { vendorId, itemId } },
      data: dto as any,
      include: {
        item: {
          select: {
            id: true,
            itemCode: true,
            name: true,
            category: { select: { name: true } },
            unit: { select: { name: true } },
          },
        },
      },
    });
  }

  async removeItem(vendorId: string, itemId: string) {
    const vi = await this.prisma.vendorItem.findUnique({
      where: { vendorId_itemId: { vendorId, itemId } },
    });
    if (!vi) throw new NotFoundException('Vendor-Item relationship not found');

    await this.prisma.vendorItem.delete({
      where: { vendorId_itemId: { vendorId, itemId } },
    });

    return { message: 'Item removed from vendor' };
  }

  async getVendorTrail(vendorId: string, startDate?: string, endDate?: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, deletedAt: null },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const start = startDate ? new Date(startDate) : new Date('2000-01-01');
    const end = endDate ? new Date(endDate) : new Date('2099-12-31');
    if (
      endDate &&
      end.getHours() === 0 &&
      end.getMinutes() === 0 &&
      end.getSeconds() === 0
    ) {
      end.setHours(23, 59, 59, 999);
    }

    const [pos, grns, bills, returns] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where: { vendorId, deletedAt: null, createdAt: { gte: start, lte: end } },
        include: { items: { include: { item: true } } },
        orderBy: { orderDate: 'desc' },
      }),
      this.prisma.goodsReceivingNote.findMany({
        where: { vendorId, deletedAt: null, createdAt: { gte: start, lte: end } },
        include: { items: { include: { item: true } }, po: true },
        orderBy: { receivedDate: 'desc' },
      }),
      this.prisma.supplierBill.findMany({
        where: { vendorId, deletedAt: null, createdAt: { gte: start, lte: end } },
        include: { items: { include: { item: true, grn: true } } },
        orderBy: { billDate: 'desc' },
      }),
      this.prisma.purchaseReturn.findMany({
        where: { vendorId, deletedAt: null, createdAt: { gte: start, lte: end } },
        include: { items: { include: { item: true } } },
        orderBy: { returnDate: 'desc' },
      }),
    ]);

    const vendorBillIds = new Set(bills.map((b) => b.id));
    const vendorBillRefs = new Set(
      bills.flatMap((b) => [
        b.id,
        b.billNumber,
        `BILL-${b.billNumber}`,
        `PAY-${b.billNumber}`,
        b.supplierInvoiceNumber,
      ]),
    );

    const candidatePayments = await this.prisma.voucher.findMany({
      where: {
        companyId: vendor.companyId,
        voucherType: 'SUPPLIER_PAYMENT',
        status: 'POSTED',
        businessDate: { gte: start, lte: end },
        OR: [{ vendorId }, { vendorId: null }],
      },
      include: {
        journalEntry: {
          include: { items: { include: { account: true } } },
        },
      },
      orderBy: { businessDate: 'desc' },
    });

    // Strictly isolate payments belonging to this vendor (never return other vendors' payments)
    const payments = candidatePayments.filter((p) => {
      if (p.vendorId === vendorId) return true;
      if (p.vendorId && p.vendorId !== vendorId) return false;
      const meta = (p.metadata ?? {}) as Record<string, any>;
      if (meta.vendorId === vendorId) return true;
      if (meta.supplierBillId && vendorBillIds.has(meta.supplierBillId)) {
        return true;
      }
      if (
        Array.isArray(meta.billAllocations) &&
        meta.billAllocations.some((a: any) => vendorBillIds.has(a?.supplierBillId))
      ) {
        return true;
      }
      if (p.reference && vendorBillRefs.has(p.reference)) return true;
      return false;
    });

    const getPaymentAmount = (p: any): number => {
      const apItems =
        p.journalEntry?.items?.filter(
          (i: any) => i.account?.accountCode === 'ACCOUNTS_PAYABLE',
        ) ?? [];
      const apDebitSum = apItems.reduce(
        (s: number, i: any) => s + Number(i.debitAmount ?? 0),
        0,
      );
      if (apDebitSum > 0) return Math.round(apDebitSum * 100) / 100;
      const metaAmt = Number((p.metadata as any)?.amount ?? 0);
      return metaAmt > 0 ? Math.round(metaAmt * 100) / 100 : 0;
    };

    const totalPoValue = pos.reduce((sum, p) => sum + (p.grandTotal ?? 0), 0);
    const totalGrnValue = grns.reduce((sum, g) => {
      const acceptedVal = g.items.reduce(
        (s, i) => s + i.acceptedQty * (i.unitCost ?? 0),
        0,
      );
      return sum + acceptedVal;
    }, 0);
    const totalBilledValue = bills.reduce(
      (sum, b) => sum + (b.totalAmount ?? 0),
      0,
    );
    const totalReturnValue = returns.reduce(
      (sum, r) => sum + (r.totalAmount ?? 0),
      0,
    );
    const totalPaidValue = payments.reduce(
      (sum, p) => sum + getPaymentAmount(p),
      0,
    );

    const openGrniBalance = Math.max(
      0,
      Math.round((totalGrnValue - totalBilledValue) * 100) / 100,
    );
    const outstandingAp = Math.max(
      0,
      Math.round(
        (totalBilledValue - totalPaidValue - totalReturnValue) * 100,
      ) / 100,
    );

    const timeline: any[] = [];
    for (const po of pos) {
      timeline.push({
        id: po.id,
        date: po.orderDate ?? po.createdAt,
        type: 'PO',
        docNumber: po.poNumber,
        number: po.poNumber,
        reference: po.notes ?? '',
        amount: po.grandTotal,
        status: po.status,
        matchStatus: 'COMMITTED',
        paperwork: {},
        items: po.items.map((i) => ({
          itemCode: i.item?.itemCode,
          name: i.item?.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          receivedQty: i.receivedQty,
          billedQty: i.billedQty,
        })),
      });
    }

    for (const grn of grns) {
      const grnVal = grn.items.reduce(
        (s, i) => s + i.acceptedQty * (i.unitCost ?? 0),
        0,
      );
      timeline.push({
        id: grn.id,
        date: grn.receivedDate ?? grn.createdAt,
        type: 'GRN',
        docNumber: grn.grnNumber,
        number: grn.grnNumber,
        reference: grn.po?.poNumber ?? 'DIRECT',
        amount: grnVal,
        status: grn.status,
        matchStatus: grn.po ? 'PO_MATCHED' : 'DIRECT_RECEIPT',
        paperwork: {
          deliveryChallanNumber: grn.deliveryChallanNumber,
          gatePassNumber: grn.gatePassNumber,
          vehicleNumber: grn.vehicleNumber,
          biltyNumber: grn.biltyNumber,
          supplierInvoiceNumber: grn.supplierInvoiceNumber,
        },
        items: grn.items.map((i) => ({
          itemCode: i.item?.itemCode,
          name: i.item?.name,
          orderedQty: i.orderedQty,
          receivedQty: i.receivedQty,
          acceptedQty: i.acceptedQty,
          rejectedQty: i.rejectedQty,
          unitCost: i.unitCost,
        })),
      });
    }

    for (const bill of bills) {
      timeline.push({
        id: bill.id,
        date: bill.billDate,
        type: 'BILL',
        docNumber: bill.billNumber,
        number: bill.billNumber,
        reference: bill.supplierInvoiceNumber,
        amount: bill.totalAmount,
        status: bill.status,
        matchStatus: 'MATCHED',
        paperwork: {
          supplierInvoiceNumber: bill.supplierInvoiceNumber,
          supplierInvoiceDate: bill.supplierInvoiceDate,
        },
        items: bill.items.map((i) => ({
          itemCode: i.item?.itemCode,
          name: i.item?.name,
          billedQty: i.billedQty,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        })),
      });
    }

    for (const ret of returns) {
      timeline.push({
        id: ret.id,
        date: ret.returnDate,
        type: 'RETURN',
        docNumber: ret.returnNumber,
        number: ret.returnNumber,
        reference: ret.debitNoteNumber ?? ret.reason ?? '',
        amount: ret.totalAmount,
        status: ret.status,
        matchStatus: ret.debitNoteNumber ? 'DEBIT_NOTE' : 'GRNI_REVERSAL',
        paperwork: {
          gatePassNumber: ret.gatePassNumber,
          debitNoteNumber: ret.debitNoteNumber,
        },
        items: ret.items.map((i) => ({
          itemCode: i.item?.itemCode,
          name: i.item?.name,
          quantity: i.quantity,
          unitCost: i.unitCost,
          totalCost: i.totalCost,
        })),
      });
    }

    for (const pay of payments) {
      const amt = getPaymentAmount(pay);
      const docNum = pay.reference?.startsWith('PAY-')
        ? pay.reference
        : pay.voucherNumber;
      timeline.push({
        id: pay.id,
        date: pay.businessDate,
        type: 'PAYMENT',
        docNumber: docNum,
        number: docNum,
        voucherNumber: pay.voucherNumber,
        reference: pay.notes ?? pay.reference ?? '',
        amount: amt,
        status: pay.status,
        matchStatus: 'PAID',
        paperwork: {},
        items: [],
      });
    }

    timeline.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return {
      vendor: {
        id: vendor.id,
        code: vendor.vendorCode,
        vendorCode: vendor.vendorCode,
        name: vendor.name,
        contactPerson: vendor.contactPerson,
        phone: vendor.phone,
        email: vendor.email,
        paymentTerms: vendor.paymentTerms,
      },
      summary: {
        totalPoValue: Math.round(totalPoValue * 100) / 100,
        totalGrnValue: Math.round(totalGrnValue * 100) / 100,
        totalBilledValue: Math.round(totalBilledValue * 100) / 100,
        totalPaidValue: Math.round(totalPaidValue * 100) / 100,
        totalReturnValue: Math.round(totalReturnValue * 100) / 100,
        openGrniBalance,
        unbilledGrnValue: openGrniBalance,
        outstandingAp,
        outstandingPayable: outstandingAp,
      },
      timeline,
    };
  }
}
