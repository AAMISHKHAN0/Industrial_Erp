import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { QueryStockRegisterDto } from './dto/stock-register.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class StockRegisterService {
  constructor(
    private prisma: PrismaService,
    private tenant: TenantContext,
  ) {}

  async getRegister(query: QueryStockRegisterDto) {
    const companyId = this.tenant.companyId;

    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = query.endDate ? new Date(query.endDate) : new Date();

    if (start > end) {
      throw new BadRequestException('Start date cannot be after end date');
    }

    // Include the entire end day if time was set to 00:00:00
    const effectiveEnd = new Date(end);
    if (
      effectiveEnd.getHours() === 0 &&
      effectiveEnd.getMinutes() === 0 &&
      effectiveEnd.getSeconds() === 0
    ) {
      effectiveEnd.setHours(23, 59, 59, 999);
    }

    const itemWhere: any = {
      ...(companyId ? { companyId } : {}),
      deletedAt: null,
      ...(query.itemId ? { id: query.itemId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };

    const items = await this.prisma.item.findMany({
      where: itemWhere,
      include: {
        category: true,
        unit: true,
      },
      orderBy: { itemCode: 'asc' },
    });

    const lines: any[] = [];
    let totalOpeningQty = 0;
    let totalOpeningValue = 0;
    let totalInwardQty = 0;
    let totalInwardValue = 0;
    let totalOutwardQty = 0;
    let totalOutwardValue = 0;
    let totalClosingQty = 0;
    let totalClosingValue = 0;

    const isBatch = items.length > 5;
    const priorMap = new Map<string, { openingQty: number; openingValue: number }>();
    const periodMap = new Map<string, { inwardQty: number; inwardValue: number; outwardQty: number; outwardValue: number }>();
    const fifoMap = new Map<string, number>();

    if (isBatch && companyId) {
      try {
        const priorRows: any[] = await this.prisma.$queryRawUnsafe(`
          SELECT "itemId", 
                 COALESCE(SUM("qtyChange"), 0)::float as "openingQty",
                 ROUND(COALESCE(SUM("costChange"), 0)::numeric, 2)::float as "openingValue"
          FROM "stock_ledger"
          WHERE "companyId" = $1 ${query.warehouseId ? `AND "warehouseId" = '${query.warehouseId.replace(/'/g, "''")}'` : ''}
            AND "createdAt" < $2
          GROUP BY "itemId"
        `, companyId, start);
        for (const r of priorRows) {
          priorMap.set(r.itemId, { openingQty: r.openingQty, openingValue: r.openingValue });
        }

        const periodRows: any[] = await this.prisma.$queryRawUnsafe(`
          SELECT "itemId",
                 COALESCE(SUM(CASE WHEN "qtyChange" > 0 THEN "qtyChange" ELSE 0 END), 0)::float as "inwardQty",
                 ROUND(COALESCE(SUM(CASE WHEN "qtyChange" > 0 THEN "costChange" ELSE 0 END), 0)::numeric, 2)::float as "inwardValue",
                 COALESCE(SUM(CASE WHEN "qtyChange" < 0 THEN ABS("qtyChange") ELSE 0 END), 0)::float as "outwardQty",
                 ROUND(COALESCE(SUM(CASE WHEN "qtyChange" < 0 THEN ABS("costChange") ELSE 0 END), 0)::numeric, 2)::float as "outwardValue"
          FROM "stock_ledger"
          WHERE "companyId" = $1 ${query.warehouseId ? `AND "warehouseId" = '${query.warehouseId.replace(/'/g, "''")}'` : ''}
            AND "createdAt" >= $2 AND "createdAt" <= $3
          GROUP BY "itemId"
        `, companyId, start, effectiveEnd);
        for (const r of periodRows) {
          periodMap.set(r.itemId, {
            inwardQty: r.inwardQty,
            inwardValue: r.inwardValue,
            outwardQty: r.outwardQty,
            outwardValue: r.outwardValue
          });
        }

        const fifoRows: any[] = await this.prisma.$queryRawUnsafe(`
          SELECT "itemId",
                 ROUND(COALESCE(SUM("remainingQty" * "unitCost"), 0)::numeric, 2)::float as "layerValuation"
          FROM "fifo_layers"
          WHERE "companyId" = $1 ${query.warehouseId ? `AND "warehouseId" = '${query.warehouseId.replace(/'/g, "''")}'` : ''}
            AND status = 'OPEN' AND "remainingQty" > 0
          GROUP BY "itemId"
        `, companyId);
        for (const r of fifoRows) {
          fifoMap.set(r.itemId, r.layerValuation);
        }
      } catch (err) {
        // Fallback to item-by-item processing if batch query fails
      }
    }

    for (const item of items) {
      const baseFilter: any = {
        itemId: item.id,
        ...(companyId ? { companyId } : {}),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      };

      let openingQty = 0;
      let openingValue = 0;
      let inwardQty = 0;
      let inwardValue = 0;
      let outwardQty = 0;
      let outwardValue = 0;
      let closingQty = 0;
      let closingValue = 0;
      let effectiveClosingValue = 0;
      let fifoLayers: any[] = [];
      let periodMovements: any[] = [];

      if (isBatch && (priorMap.size > 0 || periodMap.size > 0 || fifoMap.size > 0)) {
        const prior = priorMap.get(item.id) || { openingQty: 0, openingValue: 0 };
        openingQty = prior.openingQty;
        openingValue = prior.openingValue;

        const period = periodMap.get(item.id) || { inwardQty: 0, inwardValue: 0, outwardQty: 0, outwardValue: 0 };
        inwardQty = period.inwardQty;
        inwardValue = period.inwardValue;
        outwardQty = period.outwardQty;
        outwardValue = period.outwardValue;

        closingQty = openingQty + inwardQty - outwardQty;
        closingValue = Math.round((openingValue + inwardValue - outwardValue) * 100) / 100;

        const layerVal = fifoMap.get(item.id);
        effectiveClosingValue =
          effectiveEnd >= new Date() && layerVal !== undefined
            ? layerVal
            : closingValue;
      } else {
        // 1. Opening movements prior to start date
        const priorMovements = await this.prisma.stockLedger.findMany({
          where: {
            ...baseFilter,
            createdAt: { lt: start },
          },
        });

        openingQty = priorMovements.reduce((sum, m) => sum + m.qtyChange, 0);
        openingValue = Math.round(
          priorMovements.reduce((sum, m) => sum + (m.costChange ?? 0), 0) * 100,
        ) / 100;

        // 2. Period movements between start and end
        periodMovements = await this.prisma.stockLedger.findMany({
          where: {
            ...baseFilter,
            createdAt: { gte: start, lte: effectiveEnd },
          },
          orderBy: { createdAt: 'asc' },
        });

        for (const m of periodMovements) {
          if (m.qtyChange > 0) {
            inwardQty += m.qtyChange;
            inwardValue += (m.costChange ?? 0);
          } else {
            outwardQty += Math.abs(m.qtyChange);
            outwardValue += Math.abs(m.costChange ?? 0);
          }
        }

        inwardValue = Math.round(inwardValue * 100) / 100;
        outwardValue = Math.round(outwardValue * 100) / 100;

        closingQty = openingQty + inwardQty - outwardQty;
        closingValue = Math.round((openingValue + inwardValue - outwardValue) * 100) / 100;

        // Fetch active FIFO layers for live valuation check
        fifoLayers = await this.prisma.fifoLayer.findMany({
          where: {
            itemId: item.id,
            ...(companyId ? { companyId } : {}),
            ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
            status: 'OPEN',
            remainingQty: { gt: 0 },
          },
          orderBy: [{ receiptDate: 'asc' }, { sequence: 'asc' }],
        });

        const layerValuation = Math.round(
          fifoLayers.reduce(
            (sum, l) => sum + Number(l.remainingQty) * Number(l.unitCost),
            0,
          ) * 100,
        ) / 100;

        effectiveClosingValue =
          effectiveEnd >= new Date() && fifoLayers.length > 0
            ? layerValuation
            : closingValue;
      }

      totalOpeningQty += openingQty;
      totalOpeningValue += openingValue;
      totalInwardQty += inwardQty;
      totalInwardValue += inwardValue;
      totalOutwardQty += outwardQty;
      totalOutwardValue += outwardValue;
      totalClosingQty += closingQty;
      totalClosingValue += effectiveClosingValue;

      lines.push({
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.name,
        category: item.category?.name,
        unit: item.unit?.code ?? item.unit?.name ?? 'Unit',
        openingQty,
        openingValue,
        inwardQty,
        inwardValue,
        outwardQty,
        outwardValue,
        closingQty,
        closingValue: effectiveClosingValue,
        fifoLayers: fifoLayers.map((l) => ({
          id: l.id,
          receiptDate: l.receiptDate,
          sequence: l.sequence,
          remainingQty: Number(l.remainingQty),
          unitCost: Number(l.unitCost),
          trackedValue: Number(l.trackedValue),
        })),
        movements: periodMovements.map((m) => ({
          id: m.id,
          date: m.createdAt,
          transactionType: m.transactionType,
          referenceType: m.referenceType,
          referenceId: m.referenceId,
          quantity: m.qtyChange,
          unitCost: m.qtyChange !== 0 ? Math.abs((m.costChange ?? 0) / m.qtyChange) : 0,
          totalCost: m.costChange,
          notes: m.notes,
        })),
      });
    }

    totalOpeningValue = Math.round(totalOpeningValue * 100) / 100;
    totalInwardValue = Math.round(totalInwardValue * 100) / 100;
    totalOutwardValue = Math.round(totalOutwardValue * 100) / 100;
    totalClosingValue = Math.round(totalClosingValue * 100) / 100;

    // 3. Reconcile with GL Account 'INVENTORY'
    const inventoryAccount = await this.prisma.account.findFirst({
      where: {
        ...(companyId ? { companyId } : {}),
        accountCode: 'INVENTORY',
      },
    });

    const glInventoryBalance = inventoryAccount
      ? Math.round(Number(inventoryAccount.balance) * 100) / 100
      : 0;

    const variance = Math.round((totalClosingValue - glInventoryBalance) * 100) / 100;
    const isReconciled = Math.abs(variance) < 0.01;

    return {
      dateRange: {
        startDate: start.toISOString(),
        endDate: effectiveEnd.toISOString(),
      },
      filters: {
        warehouseId: query.warehouseId ?? null,
        itemId: query.itemId ?? null,
        categoryId: query.categoryId ?? null,
      },
      summary: {
        totalOpeningQty,
        totalOpeningValue,
        totalInwardQty,
        totalInwardValue,
        totalOutwardQty,
        totalOutwardValue,
        totalClosingQty,
        totalClosingValue,
      },
      glReconciliation: {
        inventoryValuation: totalClosingValue,
        glInventoryBalance,
        variance,
        isReconciled,
        accountName: inventoryAccount?.name ?? 'Inventory',
      },
      items: lines,
    };
  }
}
