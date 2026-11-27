import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateDemandNoteDto, UpdateDemandNoteDto } from './dto/DemandNote.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class DemandNoteService {
  constructor(
    private prisma: PrismaService,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateDemandNoteDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) {
      throw new BadRequestException('Company context required');
    }
    const items = dto.items;
    const demandNumber = await resolveAutoCode(
      this.prisma.demandNote,
      companyId,
      'demandNumber',
      'DEM',
      dto.demandNumber,
    );

    return this.prisma.demandNote.create({
      data: {
        companyId,
        demandNumber,
        departmentId: dto.departmentId || null,
        costCenter: dto.costCenter || null,
        requestedBy: dto.requestedBy || null,
        priority: dto.priority ?? 'MEDIUM',
        requiredDate: dto.requiredDate ? new Date(dto.requiredDate) : null,
        remarks: dto.remarks || null,
        status: dto.status ?? 'DRAFT',
        createdBy: userId,
        items:
          items && items.length > 0
            ? {
                create: items.map((i) => ({
                  itemId: i.itemId,
                  description: i.description,
                  quantity: i.quantity,
                  issuedQty: 0,
                  unit: i.unit,
                  remarks: i.remarks,
                })),
              }
            : undefined,
      },
      include: {
        items: { include: { item: true } },
        department: true,
      },
    });
  }

  async findAll(query: any) {
    const { page, limit, skip } = buildPagination(query);
    const companyId = this.tenant.companyId;
    const where = {
      ...(companyId ? { companyId } : {}),
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...buildSearchFilter(query.search, ['demandNumber', 'remarks']),
    };
    const [data, total] = await Promise.all([
      this.prisma.demandNote.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { item: true } },
          department: true,
        },
      }),
      this.prisma.demandNote.count({ where: where as any }),
    ]);
    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const companyId = this.tenant.companyId;
    const item = await this.prisma.demandNote.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
      } as any,
      include: {
        items: { include: { item: true } },
        department: true,
      },
    });
    if (!item) throw new NotFoundException('DemandNote not found');
    const [enriched] = await enrichWithCreator(this.prisma, [item]);
    return enriched;
  }

  async update(id: string, dto: UpdateDemandNoteDto, userId?: string) {
    await this.findOne(id);
    const { items, ...scalarData } = dto;

    return (this.prisma.$transaction as any)(async (tx: any) => {
      if (items) {
        await tx.demandNoteItem.deleteMany({ where: { demandId: id } });
        if (items.length > 0) {
          await tx.demandNoteItem.createMany({
            data: items.map((i) => ({
              demandId: id,
              itemId: i.itemId,
              description: i.description,
              quantity: i.quantity,
              issuedQty: 0,
              unit: i.unit,
              remarks: i.remarks,
            })),
          });
        }
      }

      return tx.demandNote.update({
        where: { id },
        data: {
          ...scalarData,
          updatedBy: userId,
        },
        include: {
          items: { include: { item: true } },
          department: true,
        },
      });
    });
  }

  async submit(id: string, userId?: string) {
    const note = await this.findOne(id);
    if (note.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot submit demand note in ${note.status} status`,
      );
    }
    return this.prisma.demandNote.update({
      where: { id },
      data: { status: 'SUBMITTED', updatedBy: userId },
      include: { items: { include: { item: true } }, department: true },
    });
  }

  async approve(id: string, userId?: string) {
    const note = await this.findOne(id);
    if (!['DRAFT', 'SUBMITTED', 'PENDING'].includes(note.status)) {
      throw new BadRequestException(
        `Cannot approve demand note in ${note.status} status`,
      );
    }
    return this.prisma.demandNote.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedBy: userId,
      },
      include: { items: { include: { item: true } }, department: true },
    });
  }

  async reject(id: string, remarks?: string, userId?: string) {
    const note = await this.findOne(id);
    return this.prisma.demandNote.update({
      where: { id },
      data: {
        status: 'REJECTED',
        remarks: remarks
          ? `${note.remarks ? note.remarks + ' | ' : ''}Rejected: ${remarks}`
          : note.remarks,
        updatedBy: userId,
      },
      include: { items: { include: { item: true } }, department: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.demandNote.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' } as any,
    });
  }

  async restore(id: string) {
    return this.prisma.demandNote.update({
      where: { id },
      data: { deletedAt: null, status: 'DRAFT' } as any,
    });
  }
}
