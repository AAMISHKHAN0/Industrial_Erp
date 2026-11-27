import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

const ALL_MODELS = [
  'company',
  'warehouse',
  'branch',
  'department',
  'designation',
  'employee',
  'user',
  'role',
  'permission',
  'rolePermission',
  'userRole',
  'auditLog',
  'notification',
  'category',
  'unit',
  'item',
  'vendor',
  'vendorItem',
  'demandNote',
  'demandNoteItem',
  'vendorQuotation',
  'vendorQuotationItem',
  'purchaseOrder',
  'purchaseOrderItem',
  'goodsReceivingNote',
  'goodsReceivingItem',
  'customer',
  'salesOrder',
  'salesOrderItem',
  'billOfMaterial',
  'bomMaterial',
  'productionOrder',
  'materialConsumption',
  'qualityCheck',
  'attendance',
  'leave',
  'payhead',
  'payrollPeriod',
  'paySlip',
  'paySlipItem',
  'account',
  'journalEntry',
  'journalEntryItem',
  'warehouseStock',
  'stockLedger',
  'idempotencyKey',
  'accountingPeriod',
  'voucher',
  'fifoLayer',
  'fifoAllocation',
  'materialIssue',
  'materialIssueItem',
  'purchaseReturn',
  'purchaseReturnItem',
  'supplierBill',
  'supplierBillItem',
  'salesInvoice',
  'salesInvoiceItem',
  'salesDispatch',
  'salesDispatchItem',
  'customerReceipt',
  'receiptAllocation',
  'statutoryObligation',
  'statutoryPayment',
  'wageRun',
  'wageLine',
  'session',
];

const DELETE_ORDER = [
  'session',
  'receiptAllocation',
  'customerReceipt',
  'salesInvoiceItem',
  'salesInvoice',
  'salesDispatchItem',
  'salesDispatch',
  'statutoryPayment',
  'statutoryObligation',
  'wageLine',
  'wageRun',
  'supplierBillItem',
  'supplierBill',
  'purchaseReturnItem',
  'purchaseReturn',
  'materialIssueItem',
  'materialIssue',
  'fifoAllocation',
  'fifoLayer',
  'stockLedger',
  'warehouseStock',
  'journalEntryItem',
  'journalEntry',
  'voucher',
  'accountingPeriod',
  'idempotencyKey',
  'paySlipItem',
  'paySlip',
  'payrollPeriod',
  'payhead',
  'auditLog',
  'notification',
  'qualityCheck',
  'materialConsumption',
  'productionOrder',
  'salesOrderItem',
  'salesOrder',
  'goodsReceivingItem',
  'goodsReceivingNote',
  'bomMaterial',
  'billOfMaterial',
  'purchaseOrderItem',
  'purchaseOrder',
  'vendorQuotationItem',
  'vendorQuotation',
  'demandNoteItem',
  'demandNote',
  'account',
  'vendorItem',
  'customer',
  'vendor',
  'item',
  'userRole',
  'rolePermission',
  'permission',
  'role',
  'user',
  'employee',
  'unit',
  'category',
  'designation',
  'department',
  'branch',
  'warehouse',
  'attendance',
  'leave',
  'company',
];

const CREATE_ORDER = [...DELETE_ORDER].reverse();

@Injectable()
export class BackupService {
  private isAutoBackupRunning = false;

  constructor(private prisma: PrismaService) {}

  @Cron('0 0 */6 * * *')
  async autoBackup() {
    if (
      process.env.LOCAL_DESKTOP_MODE === 'true' ||
      process.env.DISABLE_AUTO_DB_BACKUP === 'true'
    ) {
      return;
    }
    if (this.isAutoBackupRunning) return;
    this.isAutoBackupRunning = true;
    try {
      await this.createBackup(false);
      const all = await this.prisma.backup.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (all.length > 30) {
        const toRemove = all.slice(30);
        await this.prisma.backup.deleteMany({
          where: { id: { in: toRemove.map((b) => b.id) } },
        });
      }
    } catch (e: any) {
      console.error('Auto-backup failed:', e.message);
    } finally {
      this.isAutoBackupRunning = false;
    }
  }

  async createBackup(manual = true) {
    const models: Record<string, any[]> = {};
    const targetModels = manual
      ? ALL_MODELS
      : ALL_MODELS.filter((m) => m !== 'session');

    for (const model of targetModels) {
      try {
        models[model] = await (this.prisma as any)[model].findMany();
      } catch {
        models[model] = [];
      }
      // Yield between models so large snapshots never starve the event loop
      await new Promise((resolve) => setImmediate(resolve));
    }

    const payload = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      models,
    };
    const serialized = JSON.stringify(payload);
    const label = manual ? 'manual' : 'auto';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${label}-${ts}.json`;
    await (this.prisma.backup as any).create({
      data: {
        filename,
        label,
        size: Buffer.byteLength(serialized, 'utf8'),
        data: payload,
      },
    });
    return filename;
  }

  async listBackups() {
    return this.prisma.backup.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        label: true,
        size: true,
        createdAt: true,
      },
    });
  }

  async getBackupById(id: string) {
    const b = await this.prisma.backup.findFirst({ where: { id } });
    if (!b) throw new NotFoundException('Backup not found');
    return b;
  }

  async restoreBackup(id: string) {
    const b = await this.getBackupById(id);
    const raw = b.data as any;
    if (!raw.models) throw new BadRequestException('Invalid backup format');
    const modelList = [...DELETE_ORDER];

    for (const model of modelList) {
      try {
        await (this.prisma as any)[model].deleteMany();
      } catch {
        /* ignore */
      }
    }

    let total = 0;
    for (const model of CREATE_ORDER) {
      const records = raw.models[model];
      if (!records?.length) continue;
      try {
        await (this.prisma as any)[model].createMany({ data: records });
        total += records.length;
      } catch (e: any) {
        console.warn(`Skipping ${model}: ${e.message}`);
      }
    }
    // Invalidate all restored sessions per Document 05
    try {
      await this.prisma.session.deleteMany();
    } catch {
      /* ignore */
    }
    return total;
  }

  async restoreFromJson(data: any) {
    if (!data.models)
      throw new BadRequestException(
        'Invalid backup JSON — missing "models" key',
      );
    for (const model of DELETE_ORDER) {
      try {
        await (this.prisma as any)[model].deleteMany();
      } catch {
        /* ignore */
      }
    }
    let total = 0;
    for (const model of CREATE_ORDER) {
      const records = data.models[model];
      if (!records?.length) continue;
      try {
        await (this.prisma as any)[model].createMany({ data: records });
        total += records.length;
      } catch (e: any) {
        console.warn(`Skipping ${model}: ${e.message}`);
      }
    }
    // Invalidate all restored sessions per Document 05
    try {
      await this.prisma.session.deleteMany();
    } catch {
      /* ignore */
    }
    return total;
  }

  async clearAllData() {
    for (const model of DELETE_ORDER) {
      try {
        await (this.prisma as any)[model].deleteMany();
      } catch {
        /* ignore */
      }
    }
  }

  async deleteBackup(id: string) {
    const b = await this.getBackupById(id);
    await this.prisma.backup.delete({ where: { id: b.id } });
  }
}
