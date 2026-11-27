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
import { CreateSalesInvoiceDto } from './dto/sales-invoice.dto';

@Injectable()
export class SalesInvoiceService {
  constructor(
    private prisma: PrismaService,
    private postingService: PostingService,
    private tenant: TenantContext,
  ) {}

  async create(dto: CreateSalesInvoiceDto, userId?: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) {
      throw new BadRequestException('Company context required');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required for sales invoice');
    }

    let customer: any = null;
    if (dto.customerId && dto.customerId !== 'custom' && dto.customerId !== 'new') {
      customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, companyId, deletedAt: null },
      });
    }

    const effectiveCustomerName = (dto.customerName || (customer ? customer.name : '')).trim();
    if (!customer) {
      const nameToUse = effectiveCustomerName || 'Walk-in / Cash Customer';
      // Find existing customer by name in this company or create one
      customer = await this.prisma.customer.findFirst({
        where: {
          companyId,
          name: { equals: nameToUse, mode: 'insensitive' },
          deletedAt: null,
        },
      });

      if (!customer) {
        const autoCustCode = await resolveAutoCode(
          this.prisma.customer,
          companyId,
          'customerCode',
          'CUST',
        );
        customer = await this.prisma.customer.create({
          data: {
            companyId,
            name: nameToUse,
            taxNumber: dto.customerTaxId || null,
            address: dto.billingAddress || null,
            customerCode: autoCustCode,
          },
        });
      }
    } else if (dto.customerTaxId && !customer.taxNumber) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { taxNumber: dto.customerTaxId },
      }).catch(() => {});
    }

    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();

    // Check accounting period
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        companyId,
        startDate: { lte: invoiceDate },
        endDate: { gte: invoiceDate },
      },
    });
    if (period && period.isClosed) {
      throw new BadRequestException('Accounting period is closed');
    }

    // Check dispatch link if supplied
    if (dto.dispatchId) {
      const dispatch = await this.prisma.salesDispatch.findFirst({
        where: { id: dto.dispatchId, companyId, deletedAt: null },
      });
      if (!dispatch) throw new NotFoundException('Linked sales dispatch not found');
      if (dispatch.customerId !== customer.id) {
        throw new BadRequestException('Dispatch customer does not match invoice customer');
      }
    }

    // Generate invoiceNumber if not provided
    const invoiceNumber = await resolveAutoCode(
      this.prisma.salesInvoice,
      companyId,
      'invoiceNumber',
      'INV',
      dto.invoiceNumber,
    );

    const existing = await this.prisma.salesInvoice.findUnique({
      where: { companyId_invoiceNumber: { companyId, invoiceNumber } },
    });
    if (existing) {
      throw new ConflictException(`Invoice number ${invoiceNumber} already exists`);
    }

    let subtotal = 0;
    let totalTax = 0;

    const itemsToCreate = dto.items.map((item) => {
      if (item.quantity <= 0) {
        throw new BadRequestException('Item quantity must be greater than zero');
      }
      const lineSubtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
      let lineTax = 0;
      let taxPct = item.taxPct ?? 0;

      if (item.taxAmount !== undefined && item.taxAmount !== null && item.taxAmount >= 0) {
        lineTax = Math.round(item.taxAmount * 100) / 100;
        taxPct = lineSubtotal > 0 ? Math.round((lineTax / lineSubtotal) * 10000) / 100 : 0;
      } else {
        lineTax = Math.round(((lineSubtotal * taxPct) / 100) * 100) / 100;
      }
      const lineTotal = Math.round((lineSubtotal + lineTax) * 100) / 100;

      subtotal += lineSubtotal;
      totalTax += lineTax;

      return {
        itemId: item.itemId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxPct,
        taxAmount: lineTax,
        lineTotal,
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    totalTax = Math.round(totalTax * 100) / 100;
    const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;

    const combinedNotes =
      dto.customerPoRef && (!dto.notes || !dto.notes.includes(dto.customerPoRef))
        ? [`Customer PO: ${dto.customerPoRef}`, dto.notes].filter(Boolean).join(' | ')
        : dto.notes;

    // Atomically Post GL Voucher + Create Invoice record
    return this.prisma.$transaction(
      async (tx) => {
        const voucherResult = await this.postingService.postSalesInvoice(
          {
            requestKey: `INV-POST-${companyId}-${invoiceNumber}`,
            invoiceNumber,
            businessDate: invoiceDate,
            companyId,
            customerName: effectiveCustomerName || customer.name,
            grossAmount: grandTotal,
            netAmount: subtotal,
            taxAmount: totalTax,
            notes: combinedNotes,
            createdBy: userId,
          },
          tx,
        );

        const invoice = await tx.salesInvoice.create({
          data: {
            companyId,
            invoiceNumber,
            customerId: customer.id,
            soId: dto.soId,
            dispatchId: dto.dispatchId,
            invoiceDate,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            status: 'POSTED',
            voucherId: voucherResult.voucherId,
            subtotal,
            taxAmount: totalTax,
            totalAmount: grandTotal,
            paidAmount: 0,
            withheldAmount: 0,
            outstandingAmount: grandTotal,
            customerTaxId: dto.customerTaxId ?? customer.taxNumber,
            billingAddress: dto.billingAddress ?? customer.address,
            notes: combinedNotes,
            createdBy: userId,
            items: {
              create: itemsToCreate,
            },
          },
          include: {
            items: true,
            customer: true,
          },
        });

        return {
          ...invoice,
          voucherNumber: voucherResult.voucherNumber,
          journalEntryId: voucherResult.journalEntryId,
        };
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  async findOne(id: string) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    const invoice = await this.prisma.salesInvoice.findFirst({
      where: {
        companyId,
        OR: [{ id }, { invoiceNumber: id }],
        deletedAt: null,
      },
      include: {
        items: { include: { item: true } },
        customer: true,
        allocations: { include: { receipt: true } },
        dispatch: true,
      },
    });
    if (!invoice) throw new NotFoundException('Sales invoice not found');
    return invoice;
  }

  async findAll(query?: { customerId?: string; status?: string }) {
    const companyId = this.tenant.companyId;
    if (!companyId) throw new BadRequestException('Company context required');

    return this.prisma.salesInvoice.findMany({
      where: {
        companyId,
        customerId: query?.customerId,
        status: query?.status,
        deletedAt: null,
      },
      include: {
        customer: true,
        items: true,
      },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  async reverse(id: string, reason: string, userId?: string) {
    const invoice = await this.findOne(id);
    if (invoice.status === 'CANCELLED' || invoice.status === 'REVERSED') {
      throw new BadRequestException('Invoice is already cancelled or reversed');
    }
    if (invoice.paidAmount > 0 || invoice.withheldAmount > 0) {
      throw new BadRequestException('Cannot reverse invoice with settled receipts. Reverse receipts first.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        if (invoice.voucherId) {
          await this.postingService.reverseVoucher(
            {
              voucherId: invoice.voucherId,
              reason,
              actorId: userId,
            },
            tx,
          );
        }

        return tx.salesInvoice.update({
          where: { id: invoice.id },
          data: {
            status: 'CANCELLED',
            outstandingAmount: 0,
            updatedBy: userId,
          },
        });
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }
}
