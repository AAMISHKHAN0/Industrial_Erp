import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateVendorQuotationDto,
  UpdateVendorQuotationDto,
} from './dto/vendor-quotation.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class VendorQuotationService {
  constructor(
    private prisma: PrismaService,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateVendorQuotationDto, userId?: string) {
    const { items, ...data } = dto;
    const quotationNumber = await resolveAutoCode(
      this.prisma.vendorQuotation,
      this.tenant.companyId!,
      'quotationNumber',
      'QTN',
      data.quotationNumber,
    );
    const cleanData: any = {
      ...data,
      demandNoteId: data.demandNoteId ? data.demandNoteId : null,
      quotationDate: data.quotationDate ? new Date(data.quotationDate) : null,
      warranty: data.warranty || null,
      notes: data.notes || null,
    };
    return this.prisma.vendorQuotation.create({
      data: {
        companyId: this.tenant.companyId!,
        createdBy: userId,
        ...cleanData,
        quotationNumber,
        ...(items ? { items: { create: items as any } } : {}),
      },
      include: { vendor: true, items: true },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    status?: string;
  }) {
    const { page, limit, skip } = buildPagination(query);
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...buildSearchFilter(query.search, ['quotationNumber', 'notes']),
    };

    const [data, total] = await Promise.all([
      this.prisma.vendorQuotation.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { vendor: true, items: true },
      }),
      this.prisma.vendorQuotation.count({ where: where as any }),
    ]);

    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const record = await this.prisma.vendorQuotation.findFirst({
      where: { id, deletedAt: null } as any,
      include: { vendor: true, items: true },
    });
    if (!record) throw new NotFoundException('Vendor quotation not found');
    const [enriched] = await enrichWithCreator(this.prisma, [record]);
    return enriched;
  }

  async update(id: string, dto: UpdateVendorQuotationDto, userId?: string) {
    await this.findOne(id);
    const { items, ...data } = dto;
    const cleanData: any = { ...data };
    if ('demandNoteId' in cleanData) {
      cleanData.demandNoteId = cleanData.demandNoteId || null;
    }
    if ('quotationDate' in cleanData) {
      cleanData.quotationDate = cleanData.quotationDate ? new Date(cleanData.quotationDate) : null;
    }
    if ('warranty' in cleanData) {
      cleanData.warranty = cleanData.warranty || null;
    }
    if ('notes' in cleanData) {
      cleanData.notes = cleanData.notes || null;
    }
    return this.prisma.vendorQuotation.update({
      where: { id },
      data: {
        ...cleanData,
        updatedBy: userId,
        ...(items ? { items: { deleteMany: {}, create: items as any } } : {}),
      },
      include: { vendor: true, items: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.vendorQuotation.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' } as any,
    });
  }

  async restore(id: string) {
    const item = await this.prisma.vendorQuotation.findFirst({
      where: { id } as any,
    });
    if (!item) throw new NotFoundException('Vendor quotation not found');
    return this.prisma.vendorQuotation.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' } as any,
    });
  }
}
