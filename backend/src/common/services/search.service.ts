import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  buildPagination,
  buildSearchFilter,
  PaginationParams,
  PaginatedResult,
} from '../utils/pagination';

export interface SearchResult {
  entity: string;
  id: string;
  label: string;
  subLabel?: string;
  url: string;
}

export interface UnifiedSearchResponse {
  results: SearchResult[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async globalSearch(
    query: string,
    params: PaginationParams = {},
  ): Promise<UnifiedSearchResponse> {
    const { page, limit, skip } = buildPagination(params);
    const searchFilter = buildSearchFilter(query, [
      'name',
      'code',
      'email',
      'phone',
      'description',
      'itemCode',
      'firstName',
      'lastName',
    ]);

    if (!query || query.trim().length < 2) {
      return { results: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }

    const searchTerm = query.trim();

    const [
      items,
      customers,
      vendors,
      employees,
      purchaseOrders,
      salesOrders,
      productionOrders,
    ] = await Promise.all([
      this.prisma.item.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { itemCode: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, itemCode: true, categoryId: true },
        take: Math.ceil(limit / 7),
      }),
      this.prisma.customer.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm, mode: 'insensitive' } },
            { customerCode: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          customerCode: true,
          email: true,
          phone: true,
        },
        take: Math.ceil(limit / 7),
      }),
      this.prisma.vendor.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm, mode: 'insensitive' } },
            { vendorCode: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          vendorCode: true,
          email: true,
          phone: true,
        },
        take: Math.ceil(limit / 7),
      }),
      this.prisma.employee.findMany({
        where: {
          deletedAt: null,
          OR: [
            { firstName: { contains: searchTerm, mode: 'insensitive' } },
            { lastName: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm, mode: 'insensitive' } },
            { employeeCode: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          email: true,
          departmentId: true,
        },
        take: Math.ceil(limit / 7),
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          deletedAt: null,
          OR: [
            { poNumber: { contains: searchTerm, mode: 'insensitive' } },
            { vendor: { name: { contains: searchTerm, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          poNumber: true,
          status: true,
          vendorId: true,
          grandTotal: true,
          vendor: { select: { name: true } },
        },
        take: Math.ceil(limit / 7),
      }),
      this.prisma.salesOrder.findMany({
        where: {
          deletedAt: null,
          OR: [
            { soNumber: { contains: searchTerm, mode: 'insensitive' } },
            {
              customer: { name: { contains: searchTerm, mode: 'insensitive' } },
            },
          ],
        },
        select: {
          id: true,
          soNumber: true,
          status: true,
          customerId: true,
          grandTotal: true,
          customer: { select: { name: true } },
        },
        take: Math.ceil(limit / 7),
      }),
      this.prisma.productionOrder.findMany({
        where: {
          deletedAt: null,
          OR: [
            { productionNumber: { contains: searchTerm, mode: 'insensitive' } },
            { item: { name: { contains: searchTerm, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          productionNumber: true,
          status: true,
          itemId: true,
          quantity: true,
          item: { select: { name: true } },
        },
        take: Math.ceil(limit / 7),
      }),
    ]);

    const results: SearchResult[] = [];

    items.forEach((item) => {
      results.push({
        entity: 'Item',
        id: item.id,
        label: item.name,
        subLabel: `Item Code: ${item.itemCode}`,
        url: `/inventory/items/${item.id}`,
      });
    });

    customers.forEach((cust) => {
      results.push({
        entity: 'Customer',
        id: cust.id,
        label: cust.name,
        subLabel: `Code: ${cust.customerCode} | ${cust.email || cust.phone || ''}`,
        url: `/sales/customers/${cust.id}`,
      });
    });

    vendors.forEach((vend) => {
      results.push({
        entity: 'Vendor',
        id: vend.id,
        label: vend.name,
        subLabel: `Code: ${vend.vendorCode} | ${vend.email || vend.phone || ''}`,
        url: `/purchase/vendors/${vend.id}`,
      });
    });

    employees.forEach((emp) => {
      results.push({
        entity: 'Employee',
        id: emp.id,
        label: `${emp.firstName} ${emp.lastName}`,
        subLabel: `Code: ${emp.employeeCode} | ${emp.email || ''}`,
        url: `/master-data/employees/${emp.id}`,
      });
    });

    purchaseOrders.forEach((po) => {
      results.push({
        entity: 'Purchase Order',
        id: po.id,
        label: po.poNumber,
        subLabel: `${po.vendor?.name || 'Unknown'} | Status: ${po.status}`,
        url: `/purchase/orders/${po.id}`,
      });
    });

    salesOrders.forEach((so) => {
      results.push({
        entity: 'Sales Order',
        id: so.id,
        label: so.soNumber,
        subLabel: `${so.customer?.name || 'Unknown'} | Status: ${so.status}`,
        url: `/sales/orders/${so.id}`,
      });
    });

    productionOrders.forEach((mo) => {
      results.push({
        entity: 'Production Order',
        id: mo.id,
        label: mo.productionNumber,
        subLabel: `${mo.item?.name || 'Unknown'} | Qty: ${mo.quantity} | Status: ${mo.status}`,
        url: `/production/orders/${mo.id}`,
      });
    });

    const total = results.length;
    const paginatedResults = results.slice(skip, skip + limit);

    return {
      results: paginatedResults,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
