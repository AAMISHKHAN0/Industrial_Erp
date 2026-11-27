import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { Prisma, AccountType } from '@prisma/client';
import { SYSTEM_ACCOUNTS } from '../account/default-accounts';
import * as crypto from 'crypto';

const Decimal = Prisma.Decimal;

export interface StockMovementInput {
  type: 'INWARD' | 'OUTWARD' | 'TRANSFER';
  itemId: string;
  warehouseId: string;
  toWarehouseId?: string; // for TRANSFER
  quantity: number;
  unitCost?: number;
  lotNumber?: string;
  notes?: string;
  unreserve?: boolean; // unreserve stock for sales delivery
}

export interface JournalItemInput {
  accountCode: string;
  debit?: number;
  credit?: number;
  description?: string;
}

export interface PostVoucherParams {
  action: string;
  requestKey: string;
  voucherType: string;
  businessDate?: Date | string;
  companyId?: string;
  branchId?: string;
  vendorId?: string;
  reference?: string;
  notes?: string;
  metadata?: any;
  createdBy?: string;
  stockMovements?: StockMovementInput[];
  journalItems?: JournalItemInput[];
  crashSimulation?: 'AFTER_STOCK_BEFORE_JOURNAL' | 'BEFORE_COMMIT';
}

export interface PostVoucherResult {
  voucherId: string;
  voucherNumber: string;
  voucherType: string;
  businessDate: Date;
  status: string;
  totalIssueCost?: number;
  journalEntryId?: string;
  replayed: boolean;
  allocations?: Array<{
    itemId?: string;
    layerId: string;
    quantity: number;
    unitCost: number;
    allocatedValue: number;
  }>;
  itemBreakdowns?: Array<{
    itemId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
}

export interface ReverseVoucherParams {
  voucherId: string;
  reversalDate?: Date | string;
  reason: string;
  idempotencyKey?: string;
  actorId?: string;
  companyId?: string;
}

export interface ReverseVoucherResult {
  reversalVoucherId: string;
  reversalVoucherNumber: string;
  originalVoucherId: string;
  originalVoucherNumber: string;
  contraJournalEntryId?: string;
  status: string;
  replayed: boolean;
}

@Injectable()
export class PostingService {
  private readonly logger = new Logger(PostingService.name);
  private voucherSeq = 0;
  private journalSeq = 0;

  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private tenant: TenantContext,
  ) {}

  private getEffectiveCompanyId(providedCompanyId?: string): string {
    const id = providedCompanyId ?? this.tenant.companyId;
    if (!id)
      throw new BadRequestException('No company context for posting operation');
    return id;
  }

  /** Deterministic canonical JSON stringification for SHA-256 payload hashing */
  computePayloadHash(payload: any): string {
    const canonicalString = this.canonicalize(payload);
    return crypto.createHash('sha256').update(canonicalString).digest('hex');
  }

  private canonicalize(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (obj instanceof Date) {
      return JSON.stringify(obj.toISOString());
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map((item) => this.canonicalize(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    return (
      '{' +
      keys
        .map((k) => JSON.stringify(k) + ':' + this.canonicalize(obj[k]))
        .join(',') +
      '}'
    );
  }

  private async nextVoucherNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
    voucherType: string,
    businessDate: Date,
  ): Promise<string> {
    const dateStr = businessDate.toISOString().slice(0, 10).replace(/-/g, '');
    this.voucherSeq++;
    const count = await tx.voucher.count({
      where: { companyId, voucherType },
    });
    const seqStr = String(count + this.voucherSeq).padStart(4, '0');
    return `VCH-${voucherType}-${dateStr}-${seqStr}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  }

  private async nextJournalEntryNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.journalSeq++;
    const count = await tx.journalEntry.count({
      where: { companyId },
    });
    const seqStr = String(count + this.journalSeq).padStart(4, '0');
    return `JE-${dateStr}-${seqStr}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  }

  private async ensureAccount(
    tx: Prisma.TransactionClient,
    companyId: string,
    accountCode: string,
    createdBy?: string,
  ) {
    const existing = await tx.account.findFirst({
      where: { companyId, accountCode },
    });
    if (existing) return existing;

    const def = SYSTEM_ACCOUNTS[accountCode] ?? {
      type: 'ASSET',
      name: accountCode,
    };
    this.logger.warn(
      `Account "${accountCode}" missing for company ${companyId} — auto-creating as ${def.type}`,
    );
    return tx.account.create({
      data: {
        companyId,
        accountCode,
        name: def.name,
        type: def.type,
        isActive: true,
        balance: 0,
        createdBy,
      },
    });
  }

  /**
   * Core atomic posting engine: commits Voucher, StockLedger, FifoLayer/Allocation,
   * balanced JournalEntry, and IdempotencyKey in ONE PostgreSQL transaction ($transaction).
   */
  async post(
    params: PostVoucherParams,
    externalTx?: Prisma.TransactionClient,
  ): Promise<PostVoucherResult> {
    const companyId = this.getEffectiveCompanyId(params.companyId);
    const businessDate = params.businessDate
      ? new Date(params.businessDate)
      : new Date();

    // Defensive validation: reject quantity <= 0
    if (params.stockMovements && params.stockMovements.length > 0) {
      for (const mov of params.stockMovements) {
        if (mov.quantity <= 0) {
          throw new BadRequestException('Quantity must be greater than zero');
        }
      }
    }

    // 1. Calculate incoming payload hash (excluding the requestKey itself)
    const hashPayload = {
      action: params.action,
      voucherType: params.voucherType,
      businessDate: businessDate.toISOString().slice(0, 10),
      reference: params.reference ?? '',
      notes: params.notes ?? '',
      stockMovements: params.stockMovements ?? [],
      journalItems: params.journalItems ?? [],
    };
    const incomingHash = this.computePayloadHash(hashPayload);

    const execute = async (
      tx: Prisma.TransactionClient,
    ): Promise<PostVoucherResult> => {
        // 2. Idempotency Gate
        const existingKey = await tx.idempotencyKey.findUnique({
          where: {
            companyId_action_requestKey: {
              companyId,
              action: params.action,
              requestKey: params.requestKey,
            },
          },
        });

        if (existingKey) {
          if (existingKey.payloadHash !== incomingHash) {
            throw new ConflictException(
              'Idempotency conflict: payload does not match original request',
            );
          }
          if (
            existingKey.status === 'COMPLETED' &&
            existingKey.responsePayload
          ) {
            const cached =
              existingKey.responsePayload as unknown as PostVoucherResult;
            return {
              ...cached,
              replayed: true,
            };
          }
          if (existingKey.status === 'PROCESSING') {
            throw new ConflictException(
              'A request with this idempotency key is currently processing',
            );
          }
        } else {
          // Record processing idempotency key
          await tx.idempotencyKey.create({
            data: {
              companyId,
              action: params.action,
              requestKey: params.requestKey,
              payloadHash: incomingHash,
              status: 'PROCESSING',
            },
          });
        }

        // 3. Accounting Period Verification & Row-Lock
        const periodRows: Array<{ id: string; isClosed: boolean }> =
          await tx.$queryRaw`
        SELECT id, "isClosed"
        FROM "accounting_periods"
        WHERE "companyId" = ${companyId}
          AND "startDate" <= ${businessDate}
          AND "endDate" >= ${businessDate}
        FOR UPDATE
      `;

        if (periodRows.length > 0 && periodRows[0].isClosed) {
          throw new BadRequestException(
            `Accounting period is closed for date ${businessDate.toISOString().slice(0, 10)}`,
          );
        }
        const periodId = periodRows.length > 0 ? periodRows[0].id : null;

        // 4. Concurrency Protection: Deterministic Row Locks on Stock & FIFO
        const pairsToLock: Array<{ warehouseId: string; itemId: string }> = [];
        if (params.stockMovements && params.stockMovements.length > 0) {
          for (const mov of params.stockMovements) {
            pairsToLock.push({
              warehouseId: mov.warehouseId,
              itemId: mov.itemId,
            });
            if (mov.type === 'TRANSFER' && mov.toWarehouseId) {
              pairsToLock.push({
                warehouseId: mov.toWarehouseId,
                itemId: mov.itemId,
              });
            }
          }
        }

        // Sort deterministically: warehouseId ASC, itemId ASC to prevent deadlock
        const uniquePairs = Array.from(
          new Map(
            pairsToLock.map((p) => [`${p.warehouseId}:${p.itemId}`, p]),
          ).values(),
        ).sort((a, b) => {
          if (a.warehouseId < b.warehouseId) return -1;
          if (a.warehouseId > b.warehouseId) return 1;
          if (a.itemId < b.itemId) return -1;
          if (a.itemId > b.itemId) return 1;
          return 0;
        });

        for (const pair of uniquePairs) {
          // Ensure warehouseStock record exists
          await tx.warehouseStock.upsert({
            where: {
              warehouseId_itemId: {
                warehouseId: pair.warehouseId,
                itemId: pair.itemId,
              },
            },
            create: {
              companyId,
              warehouseId: pair.warehouseId,
              itemId: pair.itemId,
              quantity: 0,
              averageCost: 0,
            },
            update: {},
          });

          // Acquire pessimistic row lock
          await tx.$queryRaw`
          SELECT id, quantity, "averageCost"
          FROM "warehouse_stock"
          WHERE "companyId" = ${companyId}
            AND "warehouseId" = ${pair.warehouseId}
            AND "itemId" = ${pair.itemId}
          FOR UPDATE
        `;
        }

        // 5. Allocate Sequential Voucher Identity
        const voucherNumber = await this.nextVoucherNumber(
          tx,
          companyId,
          params.voucherType,
          businessDate,
        );
        const voucher = await tx.voucher.create({
          data: {
            companyId,
            branchId: params.branchId,
            vendorId: params.vendorId,
            voucherNumber,
            voucherType: params.voucherType,
            businessDate,
            status: 'POSTED',
            periodId,
            reference: params.reference,
            notes: params.notes,
            metadata: params.metadata,
            createdBy: params.createdBy,
          },
        });

        // 6. Stock Movements & FIFO Engine
        let totalIssueCost = 0;
        const allAllocations: Array<{
          layerId: string;
          quantity: number;
          unitCost: number;
          allocatedValue: number;
        }> = [];

        if (params.stockMovements && params.stockMovements.length > 0) {
          for (const movement of params.stockMovements) {
            if (movement.type === 'INWARD') {
              // Receipt / Cutover Inward: Create FIFO Layer
              const lastLayer = await tx.fifoLayer.findFirst({
                where: {
                  companyId,
                  warehouseId: movement.warehouseId,
                  itemId: movement.itemId,
                },
                orderBy: { sequence: 'desc' },
                select: { sequence: true },
              });
              const sequence = (lastLayer?.sequence ?? 0) + 1;
              const originalQty = new Decimal(movement.quantity);
              const unitCost = new Decimal(movement.unitCost ?? 0);
              const trackedValue = new Decimal(
                Math.round(movement.quantity * (movement.unitCost ?? 0) * 100) /
                  100,
              );

              await tx.fifoLayer.create({
                data: {
                  companyId,
                  warehouseId: movement.warehouseId,
                  itemId: movement.itemId,
                  sourceMovementId: voucher.id,
                  receiptDate: businessDate,
                  sequence,
                  originalQty,
                  remainingQty: originalQty,
                  unitCost,
                  trackedValue,
                  sourceLot: movement.lotNumber,
                  status: 'OPEN',
                },
              });

              // Update warehouseStock
              const ws = await tx.warehouseStock.update({
                where: {
                  warehouseId_itemId: {
                    warehouseId: movement.warehouseId,
                    itemId: movement.itemId,
                  },
                },
                data: {
                  quantity: { increment: movement.quantity },
                  averageCost: movement.unitCost ?? undefined,
                },
              });

              // Update item currentStock & availableStock
              await tx.item.update({
                where: { id: movement.itemId },
                data: {
                  currentStock: { increment: movement.quantity },
                  availableStock: { increment: movement.quantity },
                },
              });

              // Append StockLedger
              await tx.stockLedger.create({
                data: {
                  companyId,
                  itemId: movement.itemId,
                  warehouseId: movement.warehouseId,
                  transactionType: 'GRN_RECEIPT',
                  referenceId: voucher.id,
                  referenceType: params.voucherType,
                  qtyBefore: ws.quantity - movement.quantity,
                  qtyChange: movement.quantity,
                  qtyAfter: ws.quantity,
                  costBefore: ws.averageCost,
                  costChange: movement.unitCost ?? 0,
                  costAfter: ws.averageCost,
                  notes:
                    movement.notes ??
                    `Received ${movement.quantity} @ ${movement.unitCost}`,
                  createdBy: params.createdBy,
                },
              });
            } else if (movement.type === 'OUTWARD') {
              // Outward Issue: Chronological FIFO Sequential Consumption
              const openLayers = await tx.$queryRaw<
                Array<{
                  id: string;
                  sequence: number;
                  remainingQty: any;
                  unitCost: any;
                  trackedValue: any;
                  receiptDate: Date;
                }>
              >`
              SELECT id, sequence, "remainingQty", "unitCost", "trackedValue", "receiptDate"
              FROM "fifo_layers"
              WHERE "companyId" = ${companyId}
                AND "warehouseId" = ${movement.warehouseId}
                AND "itemId" = ${movement.itemId}
                AND "status" = 'OPEN'
                AND "remainingQty" > 0
              ORDER BY "receiptDate" ASC, "sequence" ASC
              FOR UPDATE
            `;

              const totalAvailable = openLayers.reduce(
                (sum, l) => sum + Number(l.remainingQty),
                0,
              );
              if (totalAvailable < movement.quantity) {
                throw new BadRequestException(
                  `Insufficient stock for item ${movement.itemId} in warehouse ${movement.warehouseId}. Required: ${movement.quantity}, Available: ${totalAvailable}`,
                );
              }

              let remainingToConsume = movement.quantity;

              for (const layer of openLayers) {
                if (remainingToConsume <= 0) break;

                const layerRemaining = Number(layer.remainingQty);
                const layerUnitCost = Number(layer.unitCost);
                const layerTrackedVal = Number(layer.trackedValue);

                const takeQty = Math.min(remainingToConsume, layerRemaining);
                const isExhausting = takeQty === layerRemaining;

                // Zero-residual clearance: exhausting layer absorbs full remaining trackedValue
                let allocatedVal = 0;
                if (isExhausting) {
                  allocatedVal = layerTrackedVal;
                } else {
                  allocatedVal =
                    Math.round(takeQty * layerUnitCost * 100) / 100;
                }

                const newRemainingQty = layerRemaining - takeQty;
                const newTrackedVal = isExhausting
                  ? 0
                  : Math.round((layerTrackedVal - allocatedVal) * 100) / 100;
                const newStatus = isExhausting ? 'EXHAUSTED' : 'OPEN';

                await tx.fifoLayer.update({
                  where: { id: layer.id },
                  data: {
                    remainingQty: new Decimal(newRemainingQty),
                    trackedValue: new Decimal(newTrackedVal),
                    status: newStatus,
                  },
                });

                await tx.fifoAllocation.create({
                  data: {
                    companyId,
                    layerId: layer.id,
                    stockMovementId: voucher.id,
                    quantity: new Decimal(takeQty),
                    unitCost: new Decimal(layerUnitCost),
                    allocatedValue: new Decimal(allocatedVal),
                  },
                });

                allAllocations.push({
                  layerId: layer.id,
                  quantity: takeQty,
                  unitCost: layerUnitCost,
                  allocatedValue: allocatedVal,
                });

                totalIssueCost += allocatedVal;
                remainingToConsume -= takeQty;
              }

              totalIssueCost = Math.round(totalIssueCost * 100) / 100;

              // Deduct warehouseStock
              const ws = await tx.warehouseStock.update({
                where: {
                  warehouseId_itemId: {
                    warehouseId: movement.warehouseId,
                    itemId: movement.itemId,
                  },
                },
                data: {
                  quantity: { decrement: movement.quantity },
                },
              });

              // Deduct Item stock
              const unreserveQty = movement.unreserve ? movement.quantity : 0;
              await tx.item.update({
                where: { id: movement.itemId },
                data: {
                  currentStock: { decrement: movement.quantity },
                  availableStock: {
                    decrement: movement.quantity - unreserveQty,
                  },
                  reservedStock:
                    unreserveQty > 0 ? { decrement: unreserveQty } : undefined,
                },
              });

              // Append StockLedger
              await tx.stockLedger.create({
                data: {
                  companyId,
                  itemId: movement.itemId,
                  warehouseId: movement.warehouseId,
                  transactionType: 'SALES_ISSUE',
                  referenceId: voucher.id,
                  referenceType: params.voucherType,
                  qtyBefore: ws.quantity + movement.quantity,
                  qtyChange: -movement.quantity,
                  qtyAfter: ws.quantity,
                  costBefore: ws.averageCost,
                  costChange: totalIssueCost,
                  costAfter: ws.averageCost,
                  notes:
                    movement.notes ??
                    `Issued ${movement.quantity} units (FIFO cost: ${totalIssueCost})`,
                  createdBy: params.createdBy,
                },
              });
            } else if (movement.type === 'TRANSFER') {
              if (!movement.toWarehouseId) {
                throw new BadRequestException(
                  'Transfer movement requires toWarehouseId',
                );
              }

              // Consume source FIFO layers
              const sourceLayers = await tx.$queryRaw<
                Array<{
                  id: string;
                  sequence: number;
                  remainingQty: any;
                  unitCost: any;
                  trackedValue: any;
                  receiptDate: Date;
                }>
              >`
              SELECT id, sequence, "remainingQty", "unitCost", "trackedValue", "receiptDate"
              FROM "fifo_layers"
              WHERE "companyId" = ${companyId}
                AND "warehouseId" = ${movement.warehouseId}
                AND "itemId" = ${movement.itemId}
                AND "status" = 'OPEN'
                AND "remainingQty" > 0
              ORDER BY "receiptDate" ASC, "sequence" ASC
              FOR UPDATE
            `;

              const totalAvailable = sourceLayers.reduce(
                (sum, l) => sum + Number(l.remainingQty),
                0,
              );
              if (totalAvailable < movement.quantity) {
                throw new BadRequestException(
                  `Insufficient stock for transfer of item ${movement.itemId} from warehouse ${movement.warehouseId}. Required: ${movement.quantity}, Available: ${totalAvailable}`,
                );
              }

              let remainingToTransfer = movement.quantity;
              const transferSlices: Array<{
                quantity: number;
                unitCost: number;
                value: number;
              }> = [];

              for (const layer of sourceLayers) {
                if (remainingToTransfer <= 0) break;
                const layerRemaining = Number(layer.remainingQty);
                const layerUnitCost = Number(layer.unitCost);
                const layerTrackedVal = Number(layer.trackedValue);

                const takeQty = Math.min(remainingToTransfer, layerRemaining);
                const isExhausting = takeQty === layerRemaining;

                let allocatedVal = 0;
                if (isExhausting) {
                  allocatedVal = layerTrackedVal;
                } else {
                  allocatedVal =
                    Math.round(takeQty * layerUnitCost * 100) / 100;
                }

                const newRemainingQty = layerRemaining - takeQty;
                const newTrackedVal = isExhausting
                  ? 0
                  : Math.round((layerTrackedVal - allocatedVal) * 100) / 100;
                const newStatus = isExhausting ? 'EXHAUSTED' : 'OPEN';

                await tx.fifoLayer.update({
                  where: { id: layer.id },
                  data: {
                    remainingQty: new Decimal(newRemainingQty),
                    trackedValue: new Decimal(newTrackedVal),
                    status: newStatus,
                  },
                });

                await tx.fifoAllocation.create({
                  data: {
                    companyId,
                    layerId: layer.id,
                    stockMovementId: voucher.id,
                    quantity: new Decimal(takeQty),
                    unitCost: new Decimal(layerUnitCost),
                    allocatedValue: new Decimal(allocatedVal),
                  },
                });

                transferSlices.push({
                  quantity: takeQty,
                  unitCost: layerUnitCost,
                  value: allocatedVal,
                });
                remainingToTransfer -= takeQty;
              }

              // Create new FIFO layers in destination warehouse preserving unitCost and provenance
              for (const slice of transferSlices) {
                const lastDestLayer = await tx.fifoLayer.findFirst({
                  where: {
                    companyId,
                    warehouseId: movement.toWarehouseId,
                    itemId: movement.itemId,
                  },
                  orderBy: { sequence: 'desc' },
                  select: { sequence: true },
                });
                const nextSeq = (lastDestLayer?.sequence ?? 0) + 1;

                await tx.fifoLayer.create({
                  data: {
                    companyId,
                    warehouseId: movement.toWarehouseId,
                    itemId: movement.itemId,
                    sourceMovementId: voucher.id,
                    receiptDate: businessDate,
                    sequence: nextSeq,
                    originalQty: new Decimal(slice.quantity),
                    remainingQty: new Decimal(slice.quantity),
                    unitCost: new Decimal(slice.unitCost),
                    trackedValue: new Decimal(slice.value),
                    status: 'OPEN',
                  },
                });
              }

              // Update source and destination warehouse stocks
              const fromWs = await tx.warehouseStock.update({
                where: {
                  warehouseId_itemId: {
                    warehouseId: movement.warehouseId,
                    itemId: movement.itemId,
                  },
                },
                data: { quantity: { decrement: movement.quantity } },
              });
              const toWs = await tx.warehouseStock.update({
                where: {
                  warehouseId_itemId: {
                    warehouseId: movement.toWarehouseId,
                    itemId: movement.itemId,
                  },
                },
                data: { quantity: { increment: movement.quantity } },
              });

              // Stock ledgers for transfer
              await tx.stockLedger.create({
                data: {
                  companyId,
                  itemId: movement.itemId,
                  warehouseId: movement.warehouseId,
                  transactionType: 'TRANSFER_OUT',
                  referenceId: voucher.id,
                  referenceType: 'TRANSFER',
                  qtyBefore: fromWs.quantity + movement.quantity,
                  qtyChange: -movement.quantity,
                  qtyAfter: fromWs.quantity,
                  costBefore: fromWs.averageCost,
                  costChange: 0,
                  costAfter: fromWs.averageCost,
                  notes: `Transfer out to warehouse ${movement.toWarehouseId}`,
                  createdBy: params.createdBy,
                },
              });

              await tx.stockLedger.create({
                data: {
                  companyId,
                  itemId: movement.itemId,
                  warehouseId: movement.toWarehouseId,
                  transactionType: 'TRANSFER_IN',
                  referenceId: voucher.id,
                  referenceType: 'TRANSFER',
                  qtyBefore: toWs.quantity - movement.quantity,
                  qtyChange: movement.quantity,
                  qtyAfter: toWs.quantity,
                  costBefore: toWs.averageCost,
                  costChange: 0,
                  costAfter: toWs.averageCost,
                  notes: `Transfer in from warehouse ${movement.warehouseId}`,
                  createdBy: params.createdBy,
                },
              });
            }
          }
        }

        // 7. Crash Injection Hook (for ST-03 test)
        if (
          process.env.NODE_ENV === 'test' &&
          params.crashSimulation === 'AFTER_STOCK_BEFORE_JOURNAL'
        ) {
          throw new Error(
            'SIMULATED_CRASH: Failure injected after stock/FIFO before journal write',
          );
        }

        // 8. General Ledger Double-Entry Posting
        let journalEntryId: string | undefined;

        if (params.journalItems && params.journalItems.length > 0) {
          if (params.journalItems.length < 2) {
            throw new BadRequestException(
              'Journal entry must have at least 2 items',
            );
          }

          // Validate line invariant (debit XOR credit per line)
          for (const item of params.journalItems) {
            const d = item.debit ?? 0;
            const c = item.credit ?? 0;
            if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
              throw new BadRequestException(
                `Each journal line must specify either debit or credit, not both or neither: ${item.accountCode}`,
              );
            }
          }

          // Validate double-entry equality
          const totalDebit =
            Math.round(
              params.journalItems.reduce((s, i) => s + (i.debit ?? 0), 0) * 100,
            ) / 100;
          const totalCredit =
            Math.round(
              params.journalItems.reduce((s, i) => s + (i.credit ?? 0), 0) *
                100,
            ) / 100;

          if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new BadRequestException(
              `Journal entry unbalanced: total debit ${totalDebit} != total credit ${totalCredit}`,
            );
          }

          const entryNumber = await this.nextJournalEntryNumber(tx, companyId);
          const journal = await tx.journalEntry.create({
            data: {
              companyId,
              entryNumber,
              entryDate: businessDate,
              reference: params.reference ?? voucherNumber,
              description: params.notes ?? `${params.voucherType} posting`,
              isPosted: true,
              postedAt: new Date(),
              postedBy: params.createdBy,
              createdBy: params.createdBy,
              voucherId: voucher.id,
              periodId,
              items: {
                create: await Promise.all(
                  params.journalItems.map(async (item) => {
                    const account = await this.ensureAccount(
                      tx,
                      companyId,
                      item.accountCode,
                      params.createdBy,
                    );
                    const debitAmt = item.debit ?? 0;
                    const creditAmt = item.credit ?? 0;

                    // Correct account balance polarity update
                    let balanceDelta = 0;
                    if (['ASSET', 'EXPENSE'].includes(account.type)) {
                      balanceDelta = debitAmt - creditAmt;
                    } else {
                      balanceDelta = creditAmt - debitAmt;
                    }

                    if (balanceDelta !== 0) {
                      await tx.account.update({
                        where: { id: account.id },
                        data: { balance: { increment: balanceDelta } },
                      });
                    }

                    return {
                      accountId: account.id,
                      debitAmount: debitAmt,
                      creditAmount: creditAmt,
                      description: item.description,
                    };
                  }),
                ),
              },
            },
          });

          journalEntryId = journal.id;
        }

        if (
          process.env.NODE_ENV === 'test' &&
          params.crashSimulation === 'BEFORE_COMMIT'
        ) {
          throw new Error('SIMULATED_CRASH: Failure injected before commit');
        }

        // 9. Prepare Result Envelope & Cache in IdempotencyKey
        const result: PostVoucherResult = {
          voucherId: voucher.id,
          voucherNumber: voucher.voucherNumber,
          voucherType: voucher.voucherType,
          businessDate: voucher.businessDate,
          status: voucher.status,
          totalIssueCost: totalIssueCost > 0 ? totalIssueCost : undefined,
          journalEntryId,
          replayed: false,
          allocations: allAllocations.length > 0 ? allAllocations : undefined,
        };

        await tx.idempotencyKey.update({
          where: {
            companyId_action_requestKey: {
              companyId,
              action: params.action,
              requestKey: params.requestKey,
            },
          },
          data: {
            status: 'COMPLETED',
            resultId: voucher.id,
            responsePayload: result as any,
          },
        });

        await this.auditLog.log(
          {
            companyId,
            entity: 'Voucher',
            entityId: voucher.id,
            action: 'POSTED',
            userId: params.createdBy,
            newValue: {
              voucherNumber: voucher.voucherNumber,
              voucherType: voucher.voucherType,
            },
          },
          tx,
        );

        return result;
      };

    return externalTx
      ? execute(externalTx)
      : this.prisma.$transaction(execute, { maxWait: 30000, timeout: 30000 });
  }

  // --- Specialized Business Path Helpers ---

  /** GRN Receipt posting: Inward stock + FIFO layer + Dr Inventory / Cr GRNI */
  async postGoodsReceipt(
    params: {
      requestKey: string;
      grnId?: string;
      grnNumber: string;
      businessDate?: Date | string;
      companyId?: string;
      warehouseId: string;
      vendorName?: string;
      items: Array<{
        itemId: string;
        quantity: number;
        unitCost: number;
        lotNumber?: string;
      }>;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<PostVoucherResult> {
    for (const item of params.items) {
      if (item.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than zero');
      }
    }

    const totalAcceptedValue =
      Math.round(
        params.items.reduce(
          (sum, item) => sum + item.quantity * item.unitCost,
          0,
        ) * 100,
      ) / 100;

    return this.post(
      {
        action: 'POST_GRN',
        requestKey: params.requestKey,
        voucherType: 'GRN',
        businessDate: params.businessDate,
        companyId: params.companyId,
        reference: `GRN-${params.grnNumber}`,
        notes: `Goods received from ${params.vendorName ?? 'Vendor'}`,
        createdBy: params.createdBy,
        stockMovements: params.items.map((i) => ({
          type: 'INWARD',
          itemId: i.itemId,
          warehouseId: params.warehouseId,
          quantity: i.quantity,
          unitCost: i.unitCost,
          lotNumber: i.lotNumber,
        })),
        journalItems: [
          {
            accountCode: 'INVENTORY',
            debit: totalAcceptedValue,
            description: `Inventory receipt - ${params.grnNumber}`,
          },
          {
            accountCode: 'GRNI',
            credit: totalAcceptedValue,
            description: `GRNI clearing - ${params.grnNumber}`,
          },
        ],
      },
      externalTx,
    );
  }

  /** Sales Order delivery / Material issue posting: Outward stock + FIFO consumption + Dr COGS / Cr Inventory */
  async postStockIssue(
    params: {
      action?: string;
      requestKey: string;
      voucherType?: string;
      businessDate?: Date | string;
      companyId?: string;
      warehouseId: string;
      reference: string;
      notes?: string;
      items: Array<{ itemId: string; quantity: number }>;
      expenseAccountCode?: string; // defaults to COGS
      unreserve?: boolean;
      createdBy?: string;
      crashSimulation?: 'AFTER_STOCK_BEFORE_JOURNAL' | 'BEFORE_COMMIT';
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<PostVoucherResult> {
    for (const item of params.items) {
      if (item.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than zero');
      }
    }

    const voucherType = params.voucherType ?? 'STOCK_ISSUE';
    const action = params.action ?? 'ISSUE_STOCK';
    const expenseAccount = params.expenseAccountCode ?? 'COGS';

    // First do outward stock movements with FIFO consumption in atomic transaction
    // When journal items are not predetermined, we compute FIFO cost dynamically inside post()
    // To wire dynamic COGS amount directly, we can structure the post call:
    const companyId = this.getEffectiveCompanyId(params.companyId);
    const businessDate = params.businessDate
      ? new Date(params.businessDate)
      : new Date();

    const hashPayload = {
      action,
      voucherType,
      businessDate: businessDate.toISOString().slice(0, 10),
      reference: params.reference,
      notes: params.notes ?? '',
      items: params.items,
      expenseAccount,
    };
    const incomingHash = this.computePayloadHash(hashPayload);

    const execute = async (
      tx: Prisma.TransactionClient,
    ): Promise<PostVoucherResult> => {
        // 1. Idempotency Gate
        const existingKey = await tx.idempotencyKey.findUnique({
          where: {
            companyId_action_requestKey: {
              companyId,
              action,
              requestKey: params.requestKey,
            },
          },
        });

        if (existingKey) {
          if (existingKey.payloadHash !== incomingHash) {
            throw new ConflictException(
              'Idempotency conflict: payload does not match original request',
            );
          }
          if (
            existingKey.status === 'COMPLETED' &&
            existingKey.responsePayload
          ) {
            return {
              ...(existingKey.responsePayload as unknown as PostVoucherResult),
              replayed: true,
            };
          }
          if (existingKey.status === 'PROCESSING') {
            throw new ConflictException(
              'A request with this idempotency key is currently processing',
            );
          }
        } else {
          await tx.idempotencyKey.create({
            data: {
              companyId,
              action,
              requestKey: params.requestKey,
              payloadHash: incomingHash,
              status: 'PROCESSING',
            },
          });
        }

        // 2. Accounting Period Check
        const periodRows: Array<{ id: string; isClosed: boolean }> =
          await tx.$queryRaw`
        SELECT id, "isClosed"
        FROM "accounting_periods"
        WHERE "companyId" = ${companyId}
          AND "startDate" <= ${businessDate}
          AND "endDate" >= ${businessDate}
        FOR UPDATE
      `;
        if (periodRows.length > 0 && periodRows[0].isClosed) {
          throw new BadRequestException('Accounting period is closed');
        }
        const periodId = periodRows.length > 0 ? periodRows[0].id : null;

        // 3. Deterministic Row Locks on WarehouseStock & FifoLayer
        const uniqueItems = Array.from(
          new Set(params.items.map((i) => i.itemId)),
        ).sort();
        for (const itemId of uniqueItems) {
          await tx.warehouseStock.upsert({
            where: {
              warehouseId_itemId: { warehouseId: params.warehouseId, itemId },
            },
            create: {
              companyId,
              warehouseId: params.warehouseId,
              itemId,
              quantity: 0,
              averageCost: 0,
            },
            update: {},
          });
          await tx.$queryRaw`
          SELECT id, quantity
          FROM "warehouse_stock"
          WHERE "companyId" = ${companyId}
            AND "warehouseId" = ${params.warehouseId}
            AND "itemId" = ${itemId}
          FOR UPDATE
        `;
        }

        // 4. Create Voucher
        const voucherNumber = await this.nextVoucherNumber(
          tx,
          companyId,
          voucherType,
          businessDate,
        );
        const voucher = await tx.voucher.create({
          data: {
            companyId,
            voucherNumber,
            voucherType,
            businessDate,
            status: 'POSTED',
            periodId,
            reference: params.reference,
            notes: params.notes,
            createdBy: params.createdBy,
          },
        });

        // 5. FIFO Sequential Layer Consumption
        let totalIssueCost = 0;
        const allAllocations: Array<{
          itemId?: string;
          layerId: string;
          quantity: number;
          unitCost: number;
          allocatedValue: number;
        }> = [];
        const itemBreakdowns: Array<{
          itemId: string;
          quantity: number;
          unitCost: number;
          totalCost: number;
        }> = [];

        for (const item of params.items) {
          let itemCost = 0;
          const openLayers = await tx.$queryRaw<
            Array<{
              id: string;
              sequence: number;
              remainingQty: any;
              unitCost: any;
              trackedValue: any;
              receiptDate: Date;
            }>
          >`
          SELECT id, sequence, "remainingQty", "unitCost", "trackedValue", "receiptDate"
          FROM "fifo_layers"
          WHERE "companyId" = ${companyId}
            AND "warehouseId" = ${params.warehouseId}
            AND "itemId" = ${item.itemId}
            AND "status" = 'OPEN'
            AND "remainingQty" > 0
          ORDER BY "receiptDate" ASC, "sequence" ASC
          FOR UPDATE
        `;

          const totalAvailable = openLayers.reduce(
            (sum, l) => sum + Number(l.remainingQty),
            0,
          );
          if (totalAvailable < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for item ${item.itemId} in warehouse ${params.warehouseId}. Required: ${item.quantity}, Available: ${totalAvailable}`,
            );
          }

          let remainingToConsume = item.quantity;
          for (const layer of openLayers) {
            if (remainingToConsume <= 0) break;
            const layerRemaining = Number(layer.remainingQty);
            const layerUnitCost = Number(layer.unitCost);
            const layerTrackedVal = Number(layer.trackedValue);

            const takeQty = Math.min(remainingToConsume, layerRemaining);
            const isExhausting = takeQty === layerRemaining;

            let allocatedVal = 0;
            if (isExhausting) {
              allocatedVal = layerTrackedVal;
            } else {
              allocatedVal = Math.round(takeQty * layerUnitCost * 100) / 100;
            }

            const newRemaining = layerRemaining - takeQty;
            const newTrackedVal = isExhausting
              ? 0
              : Math.round((layerTrackedVal - allocatedVal) * 100) / 100;
            const newStatus = isExhausting ? 'EXHAUSTED' : 'OPEN';

            await tx.fifoLayer.update({
              where: { id: layer.id },
              data: {
                remainingQty: new Decimal(newRemaining),
                trackedValue: new Decimal(newTrackedVal),
                status: newStatus,
              },
            });

            await tx.fifoAllocation.create({
              data: {
                companyId,
                layerId: layer.id,
                stockMovementId: voucher.id,
                quantity: new Decimal(takeQty),
                unitCost: new Decimal(layerUnitCost),
                allocatedValue: new Decimal(allocatedVal),
              },
            });

            allAllocations.push({
              itemId: item.itemId,
              layerId: layer.id,
              quantity: takeQty,
              unitCost: layerUnitCost,
              allocatedValue: allocatedVal,
            });

            itemCost += allocatedVal;
            totalIssueCost += allocatedVal;
            remainingToConsume -= takeQty;
          }

          itemCost = Math.round(itemCost * 100) / 100;
          const itemUnitCost =
            item.quantity > 0
              ? Math.round((itemCost / item.quantity) * 10000) / 10000
              : 0;
          itemBreakdowns.push({
            itemId: item.itemId,
            quantity: item.quantity,
            unitCost: itemUnitCost,
            totalCost: itemCost,
          });

          // Deduct warehouseStock
          const ws = await tx.warehouseStock.update({
            where: {
              warehouseId_itemId: {
                warehouseId: params.warehouseId,
                itemId: item.itemId,
              },
            },
            data: { quantity: { decrement: item.quantity } },
          });

          // Deduct Item currentStock / availableStock / reservedStock
          const unreserveQty = params.unreserve ? item.quantity : 0;
          await tx.item.update({
            where: { id: item.itemId },
            data: {
              currentStock: { decrement: item.quantity },
              availableStock: { decrement: item.quantity - unreserveQty },
              reservedStock:
                unreserveQty > 0 ? { decrement: unreserveQty } : undefined,
            },
          });

          // Append StockLedger
          await tx.stockLedger.create({
            data: {
              companyId,
              itemId: item.itemId,
              warehouseId: params.warehouseId,
              transactionType: 'SALES_ISSUE',
              referenceId: voucher.id,
              referenceType: voucherType,
              qtyBefore: ws.quantity + item.quantity,
              qtyChange: -item.quantity,
              qtyAfter: ws.quantity,
              costBefore: ws.averageCost,
              costChange: itemCost,
              costAfter: ws.averageCost,
              notes:
                params.notes ??
                `Issued ${item.quantity} units (FIFO cost: ${itemCost})`,
              createdBy: params.createdBy,
            },
          });
        }

        totalIssueCost = Math.round(totalIssueCost * 100) / 100;

        // Crash Simulation Hook
        if (
          process.env.NODE_ENV === 'test' &&
          params.crashSimulation === 'AFTER_STOCK_BEFORE_JOURNAL'
        ) {
          throw new Error(
            'SIMULATED_CRASH: Failure injected after stock/FIFO before journal write',
          );
        }
        if (
          process.env.NODE_ENV === 'test' &&
          params.crashSimulation === 'BEFORE_COMMIT'
        ) {
          throw new Error('SIMULATED_CRASH: Failure injected before commit');
        }

        // 6. Post Balanced COGS Journal Entry: Dr Expense / Cr Inventory
        let journalEntryId: string | undefined;
        if (totalIssueCost > 0) {
          const entryNumber = await this.nextJournalEntryNumber(tx, companyId);
          const journal = await tx.journalEntry.create({
            data: {
              companyId,
              entryNumber,
              entryDate: businessDate,
              reference: params.reference,
              description:
                params.notes ?? `Cost of goods sold for ${params.reference}`,
              isPosted: true,
              postedAt: new Date(),
              postedBy: params.createdBy,
              createdBy: params.createdBy,
              voucherId: voucher.id,
              periodId,
              items: {
                create: [
                  {
                    accountId: (
                      await this.ensureAccount(
                        tx,
                        companyId,
                        expenseAccount,
                        params.createdBy,
                      )
                    ).id,
                    debitAmount: totalIssueCost,
                    creditAmount: 0,
                    description: `COGS for ${params.reference}`,
                  },
                  {
                    accountId: (
                      await this.ensureAccount(
                        tx,
                        companyId,
                        'INVENTORY',
                        params.createdBy,
                      )
                    ).id,
                    debitAmount: 0,
                    creditAmount: totalIssueCost,
                    description: `Inventory reduction for ${params.reference}`,
                  },
                ],
              },
            },
          });

          // Update account balances with correct polarity
          const expAcc = await this.ensureAccount(
            tx,
            companyId,
            expenseAccount,
            params.createdBy,
          );
          const expDelta = ['ASSET', 'EXPENSE'].includes(expAcc.type)
            ? totalIssueCost
            : -totalIssueCost;
          await tx.account.update({
            where: { id: expAcc.id },
            data: { balance: { increment: expDelta } },
          });

          const invAcc = await this.ensureAccount(
            tx,
            companyId,
            'INVENTORY',
            params.createdBy,
          );
          await tx.account.update({
            where: { id: invAcc.id },
            data: { balance: { decrement: totalIssueCost } },
          });

          journalEntryId = journal.id;
        }

        const result: PostVoucherResult = {
          voucherId: voucher.id,
          voucherNumber: voucher.voucherNumber,
          voucherType: voucher.voucherType,
          businessDate: voucher.businessDate,
          status: voucher.status,
          totalIssueCost,
          journalEntryId,
          replayed: false,
          allocations: allAllocations,
          itemBreakdowns,
        };

        await tx.idempotencyKey.update({
          where: {
            companyId_action_requestKey: {
              companyId,
              action,
              requestKey: params.requestKey,
            },
          },
          data: {
            status: 'COMPLETED',
            resultId: voucher.id,
            responsePayload: result as any,
          },
        });

        return result;
      };

    return externalTx
      ? execute(externalTx)
      : this.prisma.$transaction(execute, { maxWait: 30000, timeout: 30000 });
  }

  /** Supplier Bill posting: Dr GRNI / Cr Accounts Payable (AP-01) */
  async postSupplierBill(
    params: {
      requestKey: string;
      billNumber: string;
      businessDate?: Date | string;
      companyId?: string;
      vendorName?: string;
      billedAmount: number;
      grnReference?: string;
      taxAmount?: number;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<PostVoucherResult> {
    if (params.billedAmount <= 0) {
      throw new BadRequestException('Billed amount must be greater than zero');
    }

    const journalItems: JournalItemInput[] = [
      {
        accountCode: 'GRNI',
        debit: params.billedAmount,
        description: `Clear GRNI against bill ${params.billNumber} (ref ${params.grnReference ?? 'GRN'})`,
      },
    ];

    if (params.taxAmount && params.taxAmount > 0) {
      journalItems.push({
        accountCode: 'INPUT_TAX_RECEIVABLE',
        debit: params.taxAmount,
        description: `Input Tax for bill ${params.billNumber}`,
      });
    }

    const totalPayable =
      Math.round((params.billedAmount + (params.taxAmount ?? 0)) * 100) / 100;
    journalItems.push({
      accountCode: 'ACCOUNTS_PAYABLE',
      credit: totalPayable,
      description: `AP to ${params.vendorName ?? 'Vendor'} for bill ${params.billNumber}`,
    });

    return this.post(
      {
        action: 'POST_BILL',
        requestKey: params.requestKey,
        voucherType: 'SUPPLIER_BILL',
        businessDate: params.businessDate,
        companyId: params.companyId,
        reference: `BILL-${params.billNumber}`,
        notes: `Supplier bill from ${params.vendorName ?? 'Vendor'}`,
        createdBy: params.createdBy,
        journalItems,
      },
      externalTx,
    );
  }

  /** Supplier Payment posting: Dr Accounts Payable / Cr Bank or Cash (AP-01) */
  async postSupplierPayment(
    params: {
      requestKey: string;
      paymentNumber: string;
      businessDate?: Date | string;
      companyId?: string;
      vendorId?: string;
      vendorName?: string;
      amount: number;
      paymentMethod?: 'BANK' | 'CASH';
      notes?: string;
      metadata?: any;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<PostVoucherResult> {
    if (params.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const creditAccount = params.paymentMethod === 'CASH' ? 'CASH' : 'BANK';
    const amount = Math.round(params.amount * 100) / 100;

    return this.post(
      {
        action: 'PAY_SUPPLIER',
        requestKey: params.requestKey,
        voucherType: 'SUPPLIER_PAYMENT',
        businessDate: params.businessDate,
        companyId: params.companyId,
        vendorId: params.vendorId,
        reference: `PAY-${params.paymentNumber}`,
        notes: params.notes ?? `Payment to ${params.vendorName ?? 'Vendor'}`,
        metadata: params.metadata,
        createdBy: params.createdBy,
        journalItems: [
          {
            accountCode: 'ACCOUNTS_PAYABLE',
            debit: amount,
            description: `Payment to ${params.vendorName ?? 'Vendor'}`,
          },
          {
            accountCode: creditAccount,
            credit: amount,
            description: `Disbursement from ${creditAccount}`,
          },
        ],
      },
      externalTx,
    );
  }

  /** Sales Invoice posting: Dr Accounts Receivable (gross) / Cr Sales Revenue (net) / Cr Sales Tax Payable (output tax) */
  async postSalesInvoice(
    params: {
      requestKey: string;
      invoiceNumber: string;
      businessDate?: Date | string;
      companyId?: string;
      customerName?: string;
      grossAmount: number;
      netAmount: number;
      taxAmount?: number;
      notes?: string;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<PostVoucherResult> {
    if (params.grossAmount <= 0) {
      throw new BadRequestException('Gross invoice amount must be greater than zero');
    }
    const net = Math.round(params.netAmount * 100) / 100;
    const tax = Math.round((params.taxAmount ?? 0) * 100) / 100;
    const gross = Math.round(params.grossAmount * 100) / 100;

    if (Math.abs(gross - (net + tax)) > 0.01) {
      throw new BadRequestException(
        `Gross amount (${gross}) must equal net amount (${net}) plus tax amount (${tax})`,
      );
    }

    const journalItems: JournalItemInput[] = [
      {
        accountCode: 'ACCOUNTS_RECEIVABLE',
        debit: gross,
        description: `AR for Sales Invoice ${params.invoiceNumber} - ${params.customerName ?? 'Customer'}`,
      },
      {
        accountCode: 'SALES_REVENUE',
        credit: net,
        description: `Revenue for Sales Invoice ${params.invoiceNumber}`,
      },
    ];

    if (tax > 0) {
      journalItems.push({
        accountCode: 'SALES_TAX_PAYABLE',
        credit: tax,
        description: `Sales Tax Output for Invoice ${params.invoiceNumber}`,
      });
    }

    return this.post(
      {
        action: 'POST_SALES_INVOICE',
        requestKey: params.requestKey,
        voucherType: 'SALES_INVOICE',
        businessDate: params.businessDate,
        companyId: params.companyId,
        reference: `INV-${params.invoiceNumber}`,
        notes: params.notes ?? `Sales Invoice ${params.invoiceNumber} to ${params.customerName ?? 'Customer'}`,
        createdBy: params.createdBy,
        journalItems,
      },
      externalTx,
    );
  }

  /** Customer Receipt posting: Dr Cash/Bank + Dr Withholding Tax Receivable / Cr Accounts Receivable (AR-01) */
  async postCustomerReceipt(
    params: {
      requestKey: string;
      receiptNumber: string;
      businessDate?: Date | string;
      companyId?: string;
      customerName?: string;
      amountReceived: number;
      taxWithheld?: number;
      paymentMethod?: 'CASH' | 'BANK' | 'CHEQUE';
      chequeStatus?: 'NONE' | 'PENDING_CLEARANCE' | 'CLEARED' | 'RETURNED';
      notes?: string;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<PostVoucherResult> {
    const received = Math.round((params.amountReceived ?? 0) * 100) / 100;
    const withheld = Math.round((params.taxWithheld ?? 0) * 100) / 100;
    const totalSettled = Math.round((received + withheld) * 100) / 100;

    if (totalSettled <= 0) {
      throw new BadRequestException('Total receipt amount must be greater than zero');
    }

    let debitAccount = 'CASH';
    if (params.paymentMethod === 'BANK') {
      debitAccount = 'BANK';
    } else if (params.paymentMethod === 'CHEQUE') {
      debitAccount = params.chequeStatus === 'CLEARED' ? 'BANK' : 'UNCLEARED_CHEQUES';
    }

    const journalItems: JournalItemInput[] = [];

    if (received > 0) {
      journalItems.push({
        accountCode: debitAccount,
        debit: received,
        description: `Receipt from ${params.customerName ?? 'Customer'} via ${params.paymentMethod ?? 'CASH'}`,
      });
    }

    if (withheld > 0) {
      journalItems.push({
        accountCode: 'WITHHOLDING_TAX_RECEIVABLE',
        debit: withheld,
        description: `Withholding tax on receipt ${params.receiptNumber} - ${params.customerName ?? 'Customer'}`,
      });
    }

    journalItems.push({
      accountCode: 'ACCOUNTS_RECEIVABLE',
      credit: totalSettled,
      description: `Settle AR for ${params.customerName ?? 'Customer'} on receipt ${params.receiptNumber}`,
    });

    return this.post(
      {
        action: 'POST_CUSTOMER_RECEIPT',
        requestKey: params.requestKey,
        voucherType: 'CUSTOMER_RECEIPT',
        businessDate: params.businessDate,
        companyId: params.companyId,
        reference: `REC-${params.receiptNumber}`,
        notes: params.notes ?? `Customer receipt ${params.receiptNumber}`,
        createdBy: params.createdBy,
        journalItems,
      },
      externalTx,
    );
  }

  /** Clear a previously pending cheque: Dr Bank / Cr Uncleared Cheques (AR-02) */
  async clearCheque(
    params: {
      requestKey: string;
      receiptNumber: string;
      clearanceDate?: Date | string;
      companyId?: string;
      amount: number;
      notes?: string;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<PostVoucherResult> {
    const amount = Math.round(params.amount * 100) / 100;
    if (amount <= 0) {
      throw new BadRequestException('Clearance amount must be greater than zero');
    }

    return this.post(
      {
        action: 'CLEAR_CHEQUE',
        requestKey: params.requestKey,
        voucherType: 'CHEQUE_CLEARANCE',
        businessDate: params.clearanceDate,
        companyId: params.companyId,
        reference: `CLR-CHEQUE-${params.receiptNumber}`,
        notes: params.notes ?? `Clearance of cheque for receipt ${params.receiptNumber}`,
        createdBy: params.createdBy,
        journalItems: [
          {
            accountCode: 'BANK',
            debit: amount,
            description: `Cheque cleared into Bank account`,
          },
          {
            accountCode: 'UNCLEARED_CHEQUES',
            credit: amount,
            description: `Clear uncleared cheque balance for receipt ${params.receiptNumber}`,
          },
        ],
      },
      externalTx,
    );
  }

  /** Statutory Payment posting: Dr Statutory Payable / Cr Bank or Cash (TAX-01) */
  async postStatutoryPayment(
    params: {
      requestKey: string;
      paymentNumber: string;
      businessDate?: Date | string;
      companyId?: string;
      head: string;
      payableAccountCode?: string;
      amount: number;
      paymentMethod?: 'BANK' | 'CASH';
      notes?: string;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<PostVoucherResult> {
    const amount = Math.round(params.amount * 100) / 100;
    if (amount <= 0) {
      throw new BadRequestException('Statutory payment amount must be greater than zero');
    }

    // Owner decision check: Labour payments cannot post without approved mapping!
    if (params.head.toUpperCase() === 'LABOUR') {
      throw new BadRequestException(
        'Labour statutory payments are pending owner classification and account mapping approval',
      );
    }

    const payableAccount = params.payableAccountCode ?? 'STATUTORY_PAYABLE';
    const creditAccount = params.paymentMethod === 'CASH' ? 'CASH' : 'BANK';

    return this.post(
      {
        action: 'PAY_STATUTORY',
        requestKey: params.requestKey,
        voucherType: 'STATUTORY_PAYMENT',
        businessDate: params.businessDate,
        companyId: params.companyId,
        reference: `STAT-PAY-${params.paymentNumber}`,
        notes: params.notes ?? `Statutory payment for ${params.head}`,
        createdBy: params.createdBy,
        journalItems: [
          {
            accountCode: payableAccount,
            debit: amount,
            description: `Discharge statutory obligation (${params.head})`,
          },
          {
            accountCode: creditAccount,
            credit: amount,
            description: `Payment from ${creditAccount}`,
          },
        ],
      },
      externalTx,
    );
  }

  /** Wage / Salary Accrual posting: Dr Wage Expense / Cr Payroll Deductions / Cr Wage Payable (HR-01) */
  async postWageAccrual(
    params: {
      requestKey: string;
      runNumber: string;
      businessDate?: Date | string;
      companyId?: string;
      grossWages: number;
      deductions?: number;
      notes?: string;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<PostVoucherResult> {
    const gross = Math.round(params.grossWages * 100) / 100;
    const deductions = Math.round((params.deductions ?? 0) * 100) / 100;
    const net = Math.round((gross - deductions) * 100) / 100;

    if (gross <= 0) {
      throw new BadRequestException('Gross wages must be greater than zero');
    }

    const journalItems: JournalItemInput[] = [
      {
        accountCode: 'WAGE_EXPENSE',
        debit: gross,
        description: `Wages accrual for run ${params.runNumber}`,
      },
    ];

    if (deductions > 0) {
      journalItems.push({
        accountCode: 'PAYROLL_DEDUCTIONS',
        credit: deductions,
        description: `Statutory/loan deductions for run ${params.runNumber}`,
      });
    }

    journalItems.push({
      accountCode: 'WAGE_PAYABLE',
      credit: net,
      description: `Net wages payable for run ${params.runNumber}`,
    });

    return this.post(
      {
        action: 'ACCRUE_WAGES',
        requestKey: params.requestKey,
        voucherType: 'WAGE_ACCRUAL',
        businessDate: params.businessDate,
        companyId: params.companyId,
        reference: `WAGE-${params.runNumber}`,
        notes: params.notes ?? `Wages accrual for run ${params.runNumber}`,
        createdBy: params.createdBy,
        journalItems,
      },
      externalTx,
    );
  }

  /** Wage / Salary Disbursement posting: Dr Wage Payable / Cr Bank or Cash (HR-01) */
  async postWageDisbursement(
    params: {
      requestKey: string;
      disbursementNumber: string;
      businessDate?: Date | string;
      companyId?: string;
      amount: number;
      paymentMethod?: 'BANK' | 'CASH';
      notes?: string;
      createdBy?: string;
    },
    externalTx?: Prisma.TransactionClient,
  ): Promise<PostVoucherResult> {
    const amount = Math.round(params.amount * 100) / 100;
    if (amount <= 0) {
      throw new BadRequestException('Disbursement amount must be greater than zero');
    }

    const creditAccount = params.paymentMethod === 'CASH' ? 'CASH' : 'BANK';

    return this.post(
      {
        action: 'DISBURSE_WAGES',
        requestKey: params.requestKey,
        voucherType: 'WAGE_DISBURSEMENT',
        businessDate: params.businessDate,
        companyId: params.companyId,
        reference: `WAGE-DISB-${params.disbursementNumber}`,
        notes: params.notes ?? `Wage disbursement ${params.disbursementNumber}`,
        createdBy: params.createdBy,
        journalItems: [
          {
            accountCode: 'WAGE_PAYABLE',
            debit: amount,
            description: `Clear wage payable`,
          },
          {
            accountCode: creditAccount,
            credit: amount,
            description: `Disbursement from ${creditAccount}`,
          },
        ],
      },
      externalTx,
    );
  }

  /** Open an accounting period */
  async openAccountingPeriod(
    companyId: string,
    name: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.prisma.accountingPeriod.upsert({
      where: { companyId_name: { companyId, name } },
      create: { companyId, name, startDate, endDate, isClosed: false },
      update: { startDate, endDate, isClosed: false },
    });
  }

  /** Close an accounting period serialized with row lock (FIN-01) */
  async closeAccountingPeriod(
    companyId: string,
    periodId: string,
    closedBy?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const rows: Array<{ id: string; isClosed: boolean }> =
          await tx.$queryRaw`
        SELECT id, "isClosed"
        FROM "accounting_periods"
        WHERE id = ${periodId} AND "companyId" = ${companyId}
        FOR UPDATE
      `;
        if (rows.length === 0)
          throw new NotFoundException('Accounting period not found');
        if (rows[0].isClosed) return { id: periodId, isClosed: true };

        const updated = await tx.accountingPeriod.update({
          where: { id: periodId },
          data: {
            isClosed: true,
            closedAt: new Date(),
            closedBy,
          },
        });
        return updated;
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }

  /**
   * Formal Voucher Reversal Engine (ST-04):
   * 1. Checks that the accounting period covering reversalDate is OPEN (SELECT ... FOR UPDATE).
   * 2. Loads the original Voucher, JournalEntry, and FIFO layers/allocations.
   * 3. Enforces reversal constraints:
   *    - If reversing a receipt: checks remainingQty == originalQty and decrements stock.
   *      Rejects with clear informative error if downstream consumption occurred.
   *    - If reversing an issue: restores remainingQty in original FIFO layers and increments stock.
   * 4. Creates reversal Voucher (voucherType: 'REVERSAL', reference: originalVoucher.voucherNumber, notes: reason).
   * 5. Posts balanced contra-journal entry (swapping original debits and credits).
   * 6. Marks original Voucher as 'REVERSED'.
   */
  async reverseVoucher(
    params: ReverseVoucherParams,
    existingTx?: Prisma.TransactionClient,
  ): Promise<ReverseVoucherResult> {
    const companyId = this.getEffectiveCompanyId(params.companyId);
    const reversalDate = params.reversalDate
      ? new Date(params.reversalDate)
      : new Date();

    if (!params.reason || params.reason.trim().length === 0) {
      throw new BadRequestException(
        'A reason must be provided for voucher reversal',
      );
    }

    if (params.idempotencyKey) {
      const existingKey = await this.prisma.idempotencyKey.findUnique({
        where: {
          companyId_action_requestKey: {
            companyId,
            action: 'REVERSE_VOUCHER',
            requestKey: params.idempotencyKey,
          },
        },
      });
      if (
        existingKey &&
        existingKey.status === 'COMPLETED' &&
        existingKey.responsePayload
      ) {
        return {
          ...(existingKey.responsePayload as unknown as ReverseVoucherResult),
          replayed: true,
        };
      }
    }

    const execute = async (
      tx: Prisma.TransactionClient,
    ): Promise<ReverseVoucherResult> => {
      // 1. Accounting Period Check covering reversalDate (with row-level lock)
      const periodRows: Array<{ id: string; isClosed: boolean }> =
        await tx.$queryRaw`
        SELECT id, "isClosed"
        FROM "accounting_periods"
        WHERE "companyId" = ${companyId}
          AND "startDate" <= ${reversalDate}
          AND "endDate" >= ${reversalDate}
        FOR UPDATE
      `;

      if (periodRows.length > 0 && periodRows[0].isClosed) {
        throw new BadRequestException(
          `Accounting period is closed for date ${reversalDate.toISOString().slice(0, 10)}`,
        );
      }
      const periodId = periodRows.length > 0 ? periodRows[0].id : null;

      // 2. Load original Voucher
      const voucher = await tx.voucher.findFirst({
        where: {
          companyId,
          OR: [
            { id: params.voucherId },
            { voucherNumber: params.voucherId },
            { reference: params.voucherId },
            { reference: `GRN-${params.voucherId}` },
          ],
        },
        include: {
          journalEntry: {
            include: {
              items: {
                include: { account: true },
              },
            },
          },
        },
      });

      if (!voucher) {
        throw new NotFoundException(
          `Voucher not found for reversal: ${params.voucherId}`,
        );
      }
      if (voucher.voucherType === 'REVERSAL') {
        throw new BadRequestException(
          'Cannot reverse a voucher that is already a reversal',
        );
      }
      if (voucher.status !== 'POSTED') {
        throw new BadRequestException(
          `Only POSTED vouchers can be reversed (current status: ${voucher.status})`,
        );
      }

      // 3. Enforce reversal constraints for stock & FIFO layers
      // Case A: Reversing an Inward Receipt (e.g. GRN)
      // Resolve any linked GRN to match its stock movement layer id
      const linkedGrn = await tx.goodsReceivingNote.findFirst({
        where: {
          companyId,
          OR: [
            ...(voucher.reference ? [{ id: voucher.reference }] : []),
            { id: voucher.id },
            ...(voucher.reference
              ? [{ grnNumber: voucher.reference.replace(/^GRN-/, '') }]
              : []),
            { grnNumber: voucher.voucherNumber.replace(/^VCH-GRN-/, '') },
          ],
        },
      });

      const sourceMovementIds = [
        voucher.id,
        voucher.voucherNumber,
        ...(voucher.reference ? [voucher.reference] : []),
        ...(voucher.reference?.startsWith('GRN-')
          ? [voucher.reference.replace('GRN-', '')]
          : []),
        ...(linkedGrn ? [linkedGrn.id, linkedGrn.grnNumber] : []),
      ];

      const createdLayers = await tx.fifoLayer.findMany({
        where: {
          companyId,
          sourceMovementId: { in: sourceMovementIds },
          status: { not: 'CANCELLED' },
        },
      });

      for (const layer of createdLayers) {
        const origQty = Number(layer.originalQty);
        const remQty = Number(layer.remainingQty);

        // Constraint: Stock must not have been consumed downstream
        if (remQty < origQty) {
          throw new BadRequestException(
            `Cannot reverse voucher ${voucher.voucherNumber}: stock for item ${layer.itemId} has already been consumed downstream (original: ${origQty}, remaining: ${remQty})`,
          );
        }

        // Verify warehouse stock is sufficient to deduct
        const ws = await tx.warehouseStock.findUnique({
          where: {
            warehouseId_itemId: {
              warehouseId: layer.warehouseId,
              itemId: layer.itemId,
            },
          },
        });
        if (!ws || ws.quantity < origQty) {
          throw new BadRequestException(
            `Cannot reverse voucher ${voucher.voucherNumber}: insufficient stock for item ${layer.itemId} in warehouse ${layer.warehouseId}. Available: ${ws?.quantity ?? 0}, Required: ${origQty}`,
          );
        }

        // Verify available stock is sufficient before deducting
        const item = await tx.item.findUnique({
          where: { id: layer.itemId },
        });
        const sku = item?.itemCode ?? layer.itemId;
        if (!item || item.availableStock < origQty) {
          throw new BadRequestException(
            `Cannot reverse voucher: available stock for item ${sku} is insufficient (available: ${item?.availableStock ?? 0}, required: ${origQty})`,
          );
        }

        // Decrement warehouseStock
        await tx.warehouseStock.update({
          where: {
            warehouseId_itemId: {
              warehouseId: layer.warehouseId,
              itemId: layer.itemId,
            },
          },
          data: { quantity: { decrement: origQty } },
        });

        // Decrement Item stock
        await tx.item.update({
          where: { id: layer.itemId },
          data: {
            currentStock: { decrement: origQty },
            availableStock: { decrement: origQty },
          },
        });

        // Mark FIFO layer as CANCELLED
        await tx.fifoLayer.update({
          where: { id: layer.id },
          data: {
            remainingQty: new Decimal(0),
            trackedValue: new Decimal(0),
            status: 'CANCELLED',
          },
        });

        // Stock Ledger audit
        const layerTotalCost = Math.round(origQty * Number(layer.unitCost) * 100) / 100;
        await tx.stockLedger.create({
          data: {
            companyId,
            itemId: layer.itemId,
            warehouseId: layer.warehouseId,
            transactionType: 'PURCHASE_RETURN',
            referenceId: voucher.id,
            referenceType: 'REVERSAL',
            qtyBefore: ws.quantity,
            qtyChange: -origQty,
            qtyAfter: ws.quantity - origQty,
            costBefore: ws.averageCost,
            costChange: -layerTotalCost,
            costAfter: ws.averageCost,
            notes: `Receipt reversed: ${voucher.voucherNumber} (${params.reason})`,
            createdBy: params.actorId,
          },
        });
      }

      // Case B: Reversing an Outward Issue / Dispatch
      const allocations = await tx.fifoAllocation.findMany({
        where: {
          companyId,
          stockMovementId: voucher.id,
        },
      });

      for (const alloc of allocations) {
        const layer = await tx.fifoLayer.findUnique({
          where: { id: alloc.layerId },
        });
        if (layer) {
          const restoreQty = Number(alloc.quantity);
          const restoreVal = Number(alloc.allocatedValue);
          const newRem = Number(layer.remainingQty) + restoreQty;
          const newTrackedVal =
            Math.round((Number(layer.trackedValue) + restoreVal) * 100) / 100;

          await tx.fifoLayer.update({
            where: { id: layer.id },
            data: {
              remainingQty: new Decimal(newRem),
              trackedValue: new Decimal(newTrackedVal),
              status: 'OPEN',
            },
          });

          const ws = await tx.warehouseStock.update({
            where: {
              warehouseId_itemId: {
                warehouseId: layer.warehouseId,
                itemId: layer.itemId,
              },
            },
            data: { quantity: { increment: restoreQty } },
          });

          await tx.item.update({
            where: { id: layer.itemId },
            data: {
              currentStock: { increment: restoreQty },
              availableStock: { increment: restoreQty },
            },
          });

          await tx.stockLedger.create({
            data: {
              companyId,
              itemId: layer.itemId,
              warehouseId: layer.warehouseId,
              transactionType: 'SALES_RETURN',
              referenceId: voucher.id,
              referenceType: 'REVERSAL',
              qtyBefore: ws.quantity - restoreQty,
              qtyChange: restoreQty,
              qtyAfter: ws.quantity,
              costBefore: ws.averageCost,
              costChange: Math.round(restoreVal * 100) / 100,
              costAfter: ws.averageCost,
              notes: `Issue reversed: ${voucher.voucherNumber} (${params.reason})`,
              createdBy: params.actorId,
            },
          });
        }
      }

      // 4. Create Reversal Voucher
      const reversalVoucherNumber = await this.nextVoucherNumber(
        tx,
        companyId,
        'REVERSAL',
        reversalDate,
      );
      const reversalVoucher = await tx.voucher.create({
        data: {
          companyId,
          voucherNumber: reversalVoucherNumber,
          voucherType: 'REVERSAL',
          businessDate: reversalDate,
          status: 'POSTED',
          periodId,
          reference: voucher.voucherNumber,
          notes: params.reason,
          reversalOfVoucherId: voucher.id,
          createdBy: params.actorId,
        },
      });

      // 5. Post Balanced Contra-Journal Entry
      let contraJournalId: string | undefined;
      const originalJournal =
        voucher.journalEntry ??
        (await tx.journalEntry.findFirst({
          where: {
            companyId,
            OR: [
              { voucherId: voucher.id },
              ...(voucher.reference ? [{ reference: voucher.reference }] : []),
              { reference: voucher.voucherNumber },
            ],
          },
          include: {
            items: {
              include: { account: true },
            },
          },
        }));

      if (originalJournal && originalJournal.items.length > 0) {
        const contraEntryNumber = await this.nextJournalEntryNumber(
          tx,
          companyId,
        );
        const contraJournal = await tx.journalEntry.create({
          data: {
            companyId,
            entryNumber: contraEntryNumber,
            entryDate: reversalDate,
            reference: `REV-${voucher.voucherNumber}`,
            description: `Reversal contra for ${voucher.voucherNumber}: ${params.reason}`,
            isPosted: true,
            postedAt: new Date(),
            postedBy: params.actorId,
            createdBy: params.actorId,
            voucherId: reversalVoucher.id,
            periodId,
            items: {
              create: await Promise.all(
                originalJournal.items.map(async (item) => {
                  const newDebit = item.creditAmount;
                  const newCredit = item.debitAmount;

                  // Update account balance with reversed polarity
                  let balanceDelta = 0;
                  if (['ASSET', 'EXPENSE'].includes(item.account.type)) {
                    balanceDelta = newDebit - newCredit;
                  } else {
                    balanceDelta = newCredit - newDebit;
                  }

                  if (balanceDelta !== 0) {
                    await tx.account.update({
                      where: { id: item.accountId },
                      data: { balance: { increment: balanceDelta } },
                    });
                  }

                  return {
                    accountId: item.accountId,
                    debitAmount: newDebit,
                    creditAmount: newCredit,
                    description: `Contra to ${item.account.accountCode}: ${item.description ?? ''}`,
                  };
                }),
              ),
            },
          },
        });
        contraJournalId = contraJournal.id;
      }

      // 6. Update original Voucher status to REVERSED
      await tx.voucher.update({
        where: { id: voucher.id },
        data: { status: 'REVERSED' },
      });

      // 7. Audit log (executed on tx to prevent pool starvation)
      await this.auditLog.log(
        {
          companyId,
          entity: 'Voucher',
          entityId: reversalVoucher.id,
          action: 'POSTED',
          userId: params.actorId,
          newValue: {
            voucherNumber: reversalVoucher.voucherNumber,
            voucherType: 'REVERSAL',
            reversalOf: voucher.voucherNumber,
            reason: params.reason,
          },
        },
        tx,
      );

      const result: ReverseVoucherResult = {
        reversalVoucherId: reversalVoucher.id,
        reversalVoucherNumber: reversalVoucher.voucherNumber,
        originalVoucherId: voucher.id,
        originalVoucherNumber: voucher.voucherNumber,
        contraJournalEntryId: contraJournalId,
        status: reversalVoucher.status,
        replayed: false,
      };

      // 8. Record Idempotency Key if provided
      if (params.idempotencyKey) {
        await tx.idempotencyKey.upsert({
          where: {
            companyId_action_requestKey: {
              companyId,
              action: 'REVERSE_VOUCHER',
              requestKey: params.idempotencyKey,
            },
          },
          create: {
            companyId,
            action: 'REVERSE_VOUCHER',
            requestKey: params.idempotencyKey,
            payloadHash: this.computePayloadHash({
              voucherId: voucher.id,
              reason: params.reason,
            }),
            status: 'COMPLETED',
            resultId: reversalVoucher.id,
            responsePayload: result as any,
          },
          update: {
            status: 'COMPLETED',
            resultId: reversalVoucher.id,
            responsePayload: result as any,
          },
        });
      }

      return result;
    };

    if (existingTx) {
      return execute(existingTx);
    }
    return this.prisma.$transaction(async (tx) => execute(tx), {
      maxWait: 30000,
      timeout: 30000,
    });
  }
}
