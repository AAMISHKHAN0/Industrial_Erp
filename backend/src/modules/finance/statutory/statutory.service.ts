import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { PostingService } from '../services/posting.service';
import {
  CreateObligationDto,
  RecordStatutoryPaymentDto,
} from './dto/statutory.dto';

@Injectable()
export class StatutoryService {
  constructor(
    private prisma: PrismaService,
    private postingService: PostingService,
    private tenant: TenantContext,
  ) {}

  async createObligation(dto: CreateObligationDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const dueAmount = Math.round(dto.dueAmount * 100) / 100;
    if (dueAmount <= 0) {
      throw new BadRequestException('Due amount must be greater than zero');
    }

    const obligationNumber = `STAT-${dto.head.toUpperCase()}-${Date.now().toString().slice(-6)}`;

    return this.prisma.statutoryObligation.create({
      data: {
        companyId,
        obligationNumber,
        head: dto.head.toUpperCase(),
        authority: dto.authority.toUpperCase(),
        registrationNumber: dto.registrationNumber,
        taxPeriod: dto.taxPeriod,
        dueAmount,
        paidAmount: 0,
        outstandingAmount: dueAmount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: 'APPROVED', // Ready for payment or reviewed
        assessmentReference: dto.assessmentReference,
        challanNumber: dto.challanNumber,
        psid: dto.psid,
        notes: dto.notes,
        createdBy: userId,
      },
    });
  }

  async recordPayment(dto: RecordStatutoryPaymentDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const amount = Math.round(dto.amount * 100) / 100;
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    // 0. Idempotency Gate check for repeat submissions
    if (dto.requestKey) {
      const existingKey = await this.prisma.idempotencyKey.findUnique({
        where: {
          companyId_action_requestKey: {
            companyId,
            action: 'PAY_STATUTORY',
            requestKey: dto.requestKey,
          },
        },
      });
      if (existingKey && existingKey.status === 'COMPLETED') {
        const existingPayment = await this.prisma.statutoryPayment.findFirst({
          where: {
            companyId,
            OR: [
              ...(existingKey.resultId ? [{ voucherId: existingKey.resultId }] : []),
              { obligationId: dto.obligationId },
            ],
          },
          include: { obligation: true },
        });
        if (existingPayment) {
          return {
            ...existingPayment,
            replayed: true,
            voucherNumber: (existingKey.responsePayload as any)?.voucherNumber,
          };
        }
      }
    }

    // 1. Fetch obligation
    const obligation = await this.prisma.statutoryObligation.findFirst({
      where: { id: dto.obligationId, companyId },
    });
    if (!obligation) throw new NotFoundException('Statutory obligation not found');

    // 2. Owner decision invariant: Pending Labour cannot post!
    if (obligation.head.toUpperCase() === 'LABOUR') {
      throw new BadRequestException(
        'Labour statutory payments are pending owner classification and account mapping approval',
      );
    }

    if (amount > obligation.outstandingAmount + 0.01) {
      throw new BadRequestException(
        `Payment amount (${amount}) exceeds outstanding obligation balance (${obligation.outstandingAmount})`,
      );
    }

    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    // Determine target payable account head
    let payableAccountCode = 'STATUTORY_PAYABLE';
    if (obligation.head === 'SALES_TAX') payableAccountCode = 'SALES_TAX_PAYABLE';
    else if (obligation.head === 'INCOME_TAX') payableAccountCode = 'INCOME_TAX_PAYABLE';
    else if (obligation.head === 'PESSI') payableAccountCode = 'PESSI_PAYABLE';
    else if (obligation.head === 'PROFESSIONAL_TAX') payableAccountCode = 'PROFESSIONAL_TAX_PAYABLE';

    const reqKey =
      dto.requestKey ?? `STAT-PAY-${companyId}-${obligation.id}-${dto.cprNumber ?? Date.now()}`;

    // 3. Atomically post GL voucher + update obligation + create payment
    return this.prisma.$transaction(
      async (tx) => {
        const voucherResult = await this.postingService.postStatutoryPayment(
          {
            requestKey: reqKey,
            paymentNumber: `PAY-${Date.now().toString().slice(-6)}`,
            businessDate: paymentDate,
            companyId,
            head: obligation.head,
            payableAccountCode,
            amount,
            paymentMethod: dto.paymentMethod,
            notes:
              dto.notes ??
              `Payment for ${obligation.head} (${obligation.taxPeriod}) - CPR: ${dto.cprNumber ?? 'N/A'}`,
            createdBy: userId,
          },
          tx,
        );

        // If replayed, find and return existing payment
        if (voucherResult.replayed) {
          const existingPayment = await tx.statutoryPayment.findFirst({
            where: { companyId, voucherId: voucherResult.voucherId },
            include: { obligation: true },
          });
          if (existingPayment) {
            return {
              ...existingPayment,
              replayed: true,
              voucherNumber: voucherResult.voucherNumber,
            };
          }
        }

        const newPaid = Math.round((obligation.paidAmount + amount) * 100) / 100;
        const newOutstanding = Math.max(
          0,
          Math.round((obligation.dueAmount - newPaid) * 100) / 100,
        );
        const newStatus = newOutstanding === 0 ? 'PAID' : 'PART_PAID';

        await tx.statutoryObligation.update({
          where: { id: obligation.id },
          data: {
            paidAmount: newPaid,
            outstandingAmount: newOutstanding,
            status: newStatus,
          },
        });

        const paymentNumber = `SPAY-${Date.now().toString().slice(-6)}`;
        const payment = await tx.statutoryPayment.create({
          data: {
            companyId,
            paymentNumber,
            obligationId: obligation.id,
            paymentDate,
            amount,
            paymentMethod: dto.paymentMethod,
            cprNumber: dto.cprNumber,
            psid: dto.psid ?? obligation.psid,
            bankReference: dto.bankReference,
            evidenceUrl: dto.evidenceUrl,
            evidenceStatus:
              dto.cprNumber || dto.evidenceUrl ? 'VERIFIED' : 'PENDING',
            voucherId: voucherResult.voucherId,
            status: 'POSTED',
            notes: dto.notes,
            createdBy: userId,
          },
          include: {
            obligation: true,
          },
        });

        return {
          ...payment,
          replayed: false,
          voucherNumber: voucherResult.voucherNumber,
          journalEntryId: voucherResult.journalEntryId,
        };
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  async getRegister(query?: { head?: string; authority?: string; status?: string }) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    return this.prisma.statutoryObligation.findMany({
      where: {
        companyId,
        head: query?.head?.toUpperCase(),
        authority: query?.authority?.toUpperCase(),
        status: query?.status?.toUpperCase(),
      },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const obligation = await this.prisma.statutoryObligation.findFirst({
      where: { id, companyId },
      include: {
        payments: true,
      },
    });
    if (!obligation) throw new NotFoundException('Statutory obligation not found');
    return obligation;
  }
}
