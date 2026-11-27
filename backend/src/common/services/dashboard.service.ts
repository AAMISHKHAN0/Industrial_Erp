import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getMonthlyRevenue(year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const [invoices, purchaseOrders, salesOrders] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        where: {
          deletedAt: null,
          status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] },
          invoiceDate: { gte: startDate, lte: endDate },
        },
        select: {
          totalAmount: true,
          invoiceDate: true,
        },
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          deletedAt: null,
          status: { not: 'CANCELLED' },
          orderDate: { gte: startDate, lte: endDate },
        },
        select: {
          grandTotal: true,
          orderDate: true,
        },
      }),
      this.prisma.salesOrder.findMany({
        where: {
          deletedAt: null,
          status: { not: 'CANCELLED' },
          orderDate: { gte: startDate, lte: endDate },
        },
        select: {
          grandTotal: true,
          orderDate: true,
        },
      }),
    ]);

    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      revenue: 0,
      purchases: 0,
      orders: 0,
      purchaseOrders: 0,
    }));

    invoices.forEach((inv) => {
      if (inv.invoiceDate) {
        const month = new Date(inv.invoiceDate).getMonth();
        if (month >= 0 && month < 12) {
          monthlyData[month].revenue += Number(inv.totalAmount || 0);
          monthlyData[month].orders += 1;
        }
      }
    });

    // Include uninvoiced sales orders only in order count if invoices are 0 so early activity still shows
    if (invoices.length === 0 && salesOrders.length > 0) {
      salesOrders.forEach((so) => {
        if (so.orderDate) {
          const month = new Date(so.orderDate).getMonth();
          if (month >= 0 && month < 12) {
            monthlyData[month].revenue += Number(so.grandTotal || 0);
            monthlyData[month].orders += 1;
          }
        }
      });
    }

    purchaseOrders.forEach((po) => {
      if (po.orderDate) {
        const month = new Date(po.orderDate).getMonth();
        if (month >= 0 && month < 12) {
          monthlyData[month].purchases += Number(po.grandTotal || 0);
          monthlyData[month].purchaseOrders += 1;
        }
      }
    });

    return monthlyData.map((d) => ({
      month: d.month,
      revenue: Math.round(d.revenue),
      purchases: Math.round(d.purchases),
      orders: d.orders,
      purchaseOrders: d.purchaseOrders,
    }));
  }

  async getSummaryStats() {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
      999,
    );
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Fetch all stats in parallel
    const [
      todayPurchases,
      pendingApprovals,
      monthlySalesAgg,
      productionOutput,
      activeEmployees,
      openFifoLayers,
    ] = await Promise.all([
      // Today's purchase orders count
      this.prisma.purchaseOrder.count({
        where: {
          deletedAt: null,
          createdAt: { gte: startOfToday, lte: endOfToday },
        },
      }),
      // Pending approvals (DRAFT + PENDING POs)
      this.prisma.purchaseOrder.count({
        where: {
          deletedAt: null,
          status: { in: ['DRAFT', 'PENDING'] },
        },
      }),
      // Monthly sales from posted SalesInvoices
      this.prisma.salesInvoice.aggregate({
        where: {
          deletedAt: null,
          status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] },
          invoiceDate: { gte: startOfMonth },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      // Production output this month (completed production orders)
      this.prisma.productionOrder.count({
        where: {
          deletedAt: null,
          status: 'COMPLETED',
          updatedAt: { gte: startOfMonth },
        },
      }),
      // Active employees
      this.prisma.employee.count({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
        },
      }),
      // Active FIFO stock batches for live inventory valuation
      this.prisma.fifoLayer.findMany({
        where: {
          status: 'OPEN',
          remainingQty: { gt: 0 },
        },
        select: {
          remainingQty: true,
          unitCost: true,
        },
      }),
    ]);

    const inventoryValue = openFifoLayers.reduce(
      (sum, layer) =>
        sum + Number(layer.remainingQty) * Number(layer.unitCost),
      0,
    );

    return {
      todayPurchases,
      pendingApprovals,
      inventoryValue: Math.round(inventoryValue),
      monthlySales: Math.round(Number(monthlySalesAgg._sum?.totalAmount || 0)),
      productionOutput,
      activeEmployees,
    };
  }
}
