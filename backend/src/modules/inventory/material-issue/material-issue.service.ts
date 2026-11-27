import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PostingService } from '../../finance/services/posting.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import {
  CreateMaterialIssueDto,
  QueryMaterialIssueDto,
} from './dto/material-issue.dto';
import { buildPagination } from '../../../common/utils/pagination';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class MaterialIssueService {
  constructor(
    private prisma: PrismaService,
    private postingService: PostingService,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateMaterialIssueDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) {
      throw new BadRequestException('Company context required');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required for material issue');
    }

    const issueNumber = await resolveAutoCode(
      this.prisma.materialIssue,
      companyId,
      'issueNumber',
      'ISS',
      dto.issueNumber,
    );

    // 1. If linked to DemandNote, validate demand status and remaining quantity
    let demandNote: any = null;
    if (dto.demandNoteId) {
      demandNote = await this.prisma.demandNote.findFirst({
        where: { id: dto.demandNoteId, deletedAt: null },
        include: { items: true },
      });
      if (!demandNote) {
        throw new NotFoundException('Demand note not found');
      }
      if (!['APPROVED', 'PARTIALLY_ISSUED'].includes(demandNote.status)) {
        throw new BadRequestException(
          `Demand note must be APPROVED or PARTIALLY_ISSUED to issue stock (current: ${demandNote.status})`,
        );
      }

      const demandItemMap = new Map<string, any>(
        demandNote.items.map((i: any) => [i.id, i]),
      );

      for (const item of dto.items) {
        if (item.demandNoteItemId) {
          const dItem = demandItemMap.get(item.demandNoteItemId);
          if (!dItem) {
            throw new BadRequestException(
              `Demand note item ${item.demandNoteItemId} not found in demand note`,
            );
          }
          const remainingAuthorized = dItem.quantity - (dItem.issuedQty ?? 0);
          if (item.quantity > remainingAuthorized) {
            throw new BadRequestException(
              `Issue quantity (${item.quantity}) exceeds remaining authorized demand quantity (${remainingAuthorized}) for item ${item.itemId}`,
            );
          }
        }
      }
    }

    // 2. Resolve warehouse (or fallback to company default warehouse)
    let warehouseId = dto.warehouseId;
    if (!warehouseId) {
      let wh = await this.prisma.warehouse.findFirst({
        where: { companyId, deletedAt: null },
      });
      if (!wh) {
        wh = await this.prisma.warehouse.create({
          data: {
            companyId,
            code: 'WH-MAIN',
            name: 'Main Central Warehouse',
            status: 'ACTIVE',
          },
        });
      }
      warehouseId = wh.id;
    }

    // 3. Atomically execute stock/FIFO/GL + record MaterialIssue + update DemandNoteItem.issuedQty
    return this.prisma.$transaction(
      async (tx) => {
        const postResult = await this.postingService.postStockIssue(
          {
            companyId,
            warehouseId,
            reference: issueNumber,
            notes:
              dto.notes ??
              `Material issue against demand ${demandNote?.demandNumber ?? 'DIRECT'}`,
            voucherType: 'MATERIAL_ISSUE',
            action: 'MATERIAL_ISSUE',
            expenseAccountCode: 'DEPARTMENT_EXPENSE',
            businessDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
            requestKey: issueNumber,
            createdBy: userId,
            items: dto.items.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
            })),
          },
          tx,
        );

        const issue = await tx.materialIssue.create({
          data: {
            companyId,
            issueNumber,
            demandNoteId: dto.demandNoteId || null,
            warehouseId: warehouseId!,
            issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
            issuedBy: userId,
            departmentId: dto.departmentId || demandNote?.departmentId || null,
            costCenter: dto.costCenter || demandNote?.costCenter || null,
            notes: dto.notes,
            status: 'POSTED',
            voucherId: postResult.voucherId,
            totalCost: postResult.totalIssueCost ?? 0,
            createdBy: userId,
            items: {
              create: dto.items.map((i, idx) => {
                const breakdown = postResult.itemBreakdowns?.[idx];
                return {
                  demandNoteItemId: i.demandNoteItemId || null,
                  itemId: i.itemId,
                  quantity: i.quantity,
                  unitCost: breakdown?.unitCost ?? 0,
                  totalCost: breakdown?.totalCost ?? 0,
                  remarks: i.remarks,
                };
              }),
            },
          },
          include: {
            items: { include: { item: true } },
            demandNote: true,
            warehouse: true,
          },
        });

        // Update DemandNote items issuedQty
        if (dto.demandNoteId && demandNote) {
          for (const item of dto.items) {
            if (item.demandNoteItemId) {
              await tx.demandNoteItem.update({
                where: { id: item.demandNoteItemId },
                data: { issuedQty: { increment: item.quantity } },
              });
            }
          }

          // Re-check all items on DemandNote to update status
          const updatedDemandItems = await tx.demandNoteItem.findMany({
            where: { demandId: dto.demandNoteId },
          });

          const allFullyIssued = updatedDemandItems.every(
            (i) => (i.issuedQty ?? 0) >= i.quantity,
          );
          const anyIssued = updatedDemandItems.some(
            (i) => (i.issuedQty ?? 0) > 0,
          );

          let newDemandStatus = demandNote.status;
          if (allFullyIssued) {
            newDemandStatus = 'FULFILLED';
          } else if (anyIssued) {
            newDemandStatus = 'PARTIALLY_ISSUED';
          }

          if (newDemandStatus !== demandNote.status) {
            await tx.demandNote.update({
              where: { id: dto.demandNoteId },
              data: { status: newDemandStatus, updatedBy: userId },
            });
          }
        }

        return issue;
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  async findAll(query: QueryMaterialIssueDto) {
    const { page, limit, skip } = buildPagination(query);
    const companyId = this.tenant.companyId;

    const where: any = {
      ...(companyId ? { companyId } : {}),
      deletedAt: null,
      ...(query.demandNoteId ? { demandNoteId: query.demandNoteId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.materialIssue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issueDate: 'desc' },
        include: {
          items: { include: { item: true } },
          demandNote: true,
          warehouse: true,
        },
      }),
      this.prisma.materialIssue.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const companyId = this.tenant.companyId;
    const issue = await this.prisma.materialIssue.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
      },
      include: {
        items: { include: { item: true } },
        demandNote: true,
        warehouse: true,
      },
    });
    if (!issue) throw new NotFoundException('Material issue not found');
    return issue;
  }
}
