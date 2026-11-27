import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateJournalEntryDto,
  UpdateJournalEntryDto,
} from './dto/journal-entry.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { enrichWithCreator } from '../../../common/utils/enrich';
import { resolveAutoCode } from '../../../common/utils/auto-code.util';

@Injectable()
export class JournalEntryService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateJournalEntryDto, userId?: string) {
    const totalDebits = dto.items.reduce((sum, i) => sum + Number(i.debitAmount || 0), 0);
    const totalCredits = dto.items.reduce((sum, i) => sum + Number(i.creditAmount || 0), 0);
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new BadRequestException('Total debits must equal total credits');
    }

    const entryNumber = await resolveAutoCode(
      this.prisma.journalEntry,
      undefined,
      'entryNumber',
      'JE',
      dto.entryNumber,
    );

    return this.prisma.journalEntry.create({
      data: {
        entryNumber,
        entryDate: dto.entryDate ? new Date(dto.entryDate) : new Date(),
        reference: dto.reference,
        description: dto.description,
        createdBy: userId,
        items: {
          create: dto.items.map((item) => ({
            accountId: item.accountId,
            debitAmount: item.debitAmount,
            creditAmount: item.creditAmount,
            description: item.description,
          })),
        },
      } as any,
      include: { items: { include: { account: true } } },
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
      ...(query.status ? { isPosted: query.status === 'POSTED' } : {}),
      ...buildSearchFilter(query.search, [
        'entryNumber',
        'description',
        'reference',
      ]),
    };

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { account: true } } },
      }),
      this.prisma.journalEntry.count({ where: where as any }),
    ]);

    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const record = await this.prisma.journalEntry.findFirst({
      where: { id } as any,
      include: { items: { include: { account: true } } },
    });
    if (!record) throw new NotFoundException('Journal entry not found');
    const [enriched] = await enrichWithCreator(this.prisma, [record]);
    return enriched;
  }

  async update(id: string, dto: UpdateJournalEntryDto, userId?: string) {
    const existing = await this.findOne(id);
    if (existing.isPosted) {
      throw new BadRequestException('Cannot modify a posted journal entry');
    }

    if (dto.items) {
      const totalDebits = dto.items.reduce((sum, i) => sum + Number(i.debitAmount || 0), 0);
      const totalCredits = dto.items.reduce(
        (sum, i) => sum + Number(i.creditAmount || 0),
        0,
      );
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new BadRequestException('Total debits must equal total credits');
      }

      await this.prisma.journalEntryItem.deleteMany({
        where: { journalEntryId: id },
      });

      return this.prisma.journalEntry.update({
        where: { id },
        data: {
          ...dto,
          updatedBy: userId,
          ...(dto.entryDate ? { entryDate: new Date(dto.entryDate) } : {}),
          items: {
            create: dto.items.map((item) => ({
              accountId: item.accountId,
              debitAmount: item.debitAmount,
              creditAmount: item.creditAmount,
              description: item.description,
            })),
          },
        } as any,
        include: { items: { include: { account: true } } },
      });
    }

    return this.prisma.journalEntry.update({
      where: { id },
      data: {
        ...(dto as any),
        ...(dto.entryDate ? { entryDate: new Date(dto.entryDate) } : {}),
        updatedBy: userId,
      },
      include: { items: { include: { account: true } } },
    });
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    if (existing.isPosted) {
      throw new BadRequestException('Cannot delete a posted journal entry');
    }
    await this.prisma.journalEntryItem.deleteMany({
      where: { journalEntryId: id },
    });
    return this.prisma.journalEntry.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.findOne(id);
  }

  async post(id: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({
        where: { id },
        include: { items: { include: { account: true } } },
      });
      if (!entry) {
        throw new NotFoundException('Journal entry not found');
      }
      if (entry.isPosted) {
        throw new BadRequestException('Journal entry is already posted');
      }
      if (!entry.items || entry.items.length < 2) {
        throw new BadRequestException(
          'Journal entry must have at least 2 line items to post',
        );
      }

      const totalDebits = entry.items.reduce(
        (sum, i) => sum + Number(i.debitAmount ?? 0),
        0,
      );
      const totalCredits = entry.items.reduce(
        (sum, i) => sum + Number(i.creditAmount ?? 0),
        0,
      );
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new BadRequestException(
          `Journal entry unbalanced: debits (${totalDebits}) != credits (${totalCredits})`,
        );
      }

      for (const item of entry.items) {
        const debitAmt = Number(item.debitAmount ?? 0);
        const creditAmt = Number(item.creditAmount ?? 0);
        const isDebitNormal = ['ASSET', 'EXPENSE'].includes(item.account.type);
        const balanceDelta = isDebitNormal
          ? debitAmt - creditAmt
          : creditAmt - debitAmt;

        if (Math.abs(balanceDelta) > 0.0001) {
          await tx.account.update({
            where: { id: item.accountId },
            data: { balance: { increment: balanceDelta } },
          });
        }
      }

      return tx.journalEntry.update({
        where: { id },
        data: {
          isPosted: true,
          postedAt: new Date(),
          postedBy: userId,
          updatedBy: userId,
        } as any,
        include: { items: { include: { account: true } } },
      });
    });
  }
}
