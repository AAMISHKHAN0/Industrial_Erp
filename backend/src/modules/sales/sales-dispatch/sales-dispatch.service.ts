import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { PostingService } from '../../finance/services/posting.service';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';
import { CreateSalesDispatchDto } from './dto/sales-dispatch.dto';

@Injectable()
export class SalesDispatchService {
  constructor(
    private prisma: PrismaService,
    private postingService: PostingService,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateSalesDispatchDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) {
      throw new BadRequestException('Company context required');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required for sales dispatch');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, deletedAt: null },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const dispatchDate = dto.dispatchDate ? new Date(dto.dispatchDate) : new Date();

    const dispatchNumber = await resolveAutoCode(
      this.prisma.salesDispatch,
      companyId,
      'dispatchNumber',
      'DSP',
      dto.dispatchNumber,
    );

    const existing = await this.prisma.salesDispatch.findUnique({
      where: { companyId_dispatchNumber: { companyId, dispatchNumber } },
    });
    if (existing) {
      throw new ConflictException(`Dispatch number ${dispatchNumber} already exists`);
    }

    // Atomically execute FIFO consumption, COGS journal, and SalesDispatch creation
    return this.prisma.$transaction(
      async (tx) => {
        const issueResult = await this.postingService.postStockIssue(
          {
            requestKey: `DSP-${companyId}-${dispatchNumber}`,
            voucherType: 'SALES_DISPATCH',
            action: 'POST_SALES_DISPATCH',
            businessDate: dispatchDate,
            companyId,
            warehouseId: dto.warehouseId,
            reference: `DISPATCH-${dispatchNumber}`,
            notes: dto.notes ?? `Dispatch to ${customer.name}`,
            expenseAccountCode: 'COGS',
            items: dto.items.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
            })),
            createdBy: userId,
          },
          tx,
        );

        const dispatch = await tx.salesDispatch.create({
          data: {
            companyId,
            dispatchNumber,
            customerId: dto.customerId,
            warehouseId: dto.warehouseId,
            soId: dto.soId,
            dispatchDate,
            status: 'DISPATCHED',
            voucherId: issueResult.voucherId,
            totalCost: issueResult.totalIssueCost ?? 0,
            notes: dto.notes,
            createdBy: userId,
            items: {
              create: dto.items.map((i, idx) => {
                const breakdown = issueResult.itemBreakdowns?.[idx];
                return {
                  itemId: i.itemId,
                  quantity: i.quantity,
                  unitCost: breakdown?.unitCost ?? 0,
                  totalCost: breakdown?.totalCost ?? 0,
                  soItemId: i.soItemId,
                };
              }),
            },
          },
          include: {
            items: true,
            customer: true,
            warehouse: true,
          },
        });

        return {
          ...dispatch,
          voucherNumber: issueResult.voucherNumber,
          allocations: issueResult.allocations,
          journalEntryId: issueResult.journalEntryId,
        };
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  async findOne(id: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const dispatch = await this.prisma.salesDispatch.findFirst({
      where: {
        companyId,
        OR: [{ id }, { dispatchNumber: id }],
        deletedAt: null,
      },
      include: {
        items: { include: { item: true } },
        customer: true,
        warehouse: true,
        invoices: true,
      },
    });
    if (!dispatch) throw new NotFoundException('Sales dispatch not found');
    return dispatch;
  }

  async findAll(query?: { customerId?: string; warehouseId?: string }) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    return this.prisma.salesDispatch.findMany({
      where: {
        companyId,
        customerId: query?.customerId,
        warehouseId: query?.warehouseId,
        deletedAt: null,
      },
      include: {
        customer: true,
        warehouse: true,
        items: true,
      },
      orderBy: { dispatchDate: 'desc' },
    });
  }

  async reverse(id: string, reason: string, userId?: string) {
    const dispatch = await this.findOne(id);
    if (dispatch.status === 'CANCELLED') {
      throw new BadRequestException('Dispatch is already cancelled');
    }

    return this.prisma.$transaction(
      async (tx) => {
        if (dispatch.voucherId) {
          await this.postingService.reverseVoucher(
            {
              voucherId: dispatch.voucherId,
              reason,
              actorId: userId,
            },
            tx,
          );
        }

        return tx.salesDispatch.update({
          where: { id: dispatch.id },
          data: {
            status: 'CANCELLED',
            updatedBy: userId,
          },
        });
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }
}
