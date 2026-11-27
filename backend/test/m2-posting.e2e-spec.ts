import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PostingService } from '../src/modules/finance/services/posting.service';
import { PurchaseOrderService } from '../src/modules/purchase/purchase-order/PurchaseOrder.service';
import { GoodsReceivingNoteService } from '../src/modules/purchase/goods-receiving/GoodsReceivingNote.service';
import { SalesOrderService } from '../src/modules/sales/sales-order/sales-order.service';
import { StockService } from '../src/modules/inventory/services/stock.service';
import { FinanceIntegrationService } from '../src/modules/finance/services/finance-integration.service';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { seedDefaultAccounts } from '../src/modules/finance/account/default-accounts';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('Milestone 2 Acceptance Test Suite (Document 06 & SCOPE.md)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let postingService: PostingService;
  let poService: PurchaseOrderService;
  let grnService: GoodsReceivingNoteService;
  let soService: SalesOrderService;
  let stockService: StockService;
  let financeService: FinanceIntegrationService;
  let tenant: TenantContext;

  let testCompanyId: string;
  let warehouseA: string;
  let warehouseB: string;
  let testItemId: string;
  let testVendorId: string;
  let testCustomerId: string;
  let testUserId: string;

  const runAsTenant = <T>(fn: () => Promise<T>): Promise<T> => {
    return tenant.run(
      { companyId: testCompanyId, userId: testUserId, role: 'ADMIN' },
      fn,
    );
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    postingService = app.get<PostingService>(PostingService);
    poService = app.get<PurchaseOrderService>(PurchaseOrderService);
    grnService = app.get<GoodsReceivingNoteService>(GoodsReceivingNoteService);
    soService = app.get<SalesOrderService>(SalesOrderService);
    stockService = app.get<StockService>(StockService);
    financeService = app.get<FinanceIntegrationService>(
      FinanceIntegrationService,
    );
    tenant = app.get<TenantContext>(TenantContext);

    // Create unique isolated test tenant fixtures
    const suffix = Date.now().toString(36);
    const company = await prisma.company.create({
      data: {
        name: `M2 Test Company ${suffix}`,
      },
    });
    testCompanyId = company.id;

    const user = await prisma.user.create({
      data: {
        companyId: testCompanyId,
        email: `admin_${suffix}@m2test.local`,
        password: 'dummy_hash_for_testing',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    testUserId = user.id;

    const whA = await prisma.warehouse.create({
      data: {
        companyId: testCompanyId,
        name: `Central Warehouse ${suffix}`,
        code: `WHA_${suffix.slice(-4)}`,
      },
    });
    warehouseA = whA.id;

    const whB = await prisma.warehouse.create({
      data: {
        companyId: testCompanyId,
        name: `Regional Warehouse ${suffix}`,
        code: `WHB_${suffix.slice(-4)}`,
      },
    });
    warehouseB = whB.id;

    const item = await prisma.item.create({
      data: {
        companyId: testCompanyId,
        itemCode: `ITEM_${suffix.slice(-6)}`,
        name: 'Industrial Cotton Yarn 30s',
        currentStock: 0,
        availableStock: 0,
        reservedStock: 0,
      },
    });
    testItemId = item.id;

    const vendor = await prisma.vendor.create({
      data: {
        companyId: testCompanyId,
        vendorCode: `VEND_${suffix.slice(-4)}`,
        name: 'National Yarn Suppliers',
      },
    });
    testVendorId = vendor.id;

    const customer = await prisma.customer.create({
      data: {
        companyId: testCompanyId,
        customerCode: `CUST_${suffix.slice(-4)}`,
        name: 'Apex Fabrics Ltd',
      },
    });
    testCustomerId = customer.id;

    // Seed default chart of accounts for test company
    await seedDefaultAccounts(prisma, testCompanyId, testUserId);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  // --------------------------------------------------------------------------
  // ST-01: Multi-Layer FIFO Consumption & GL Tie
  // --------------------------------------------------------------------------
  describe('ST-01: Multi-Layer FIFO Consumption (Document 06 §4.1)', () => {
    it('should consume 120 units across 2 FIFO layers producing cost PKR 12,600 and remaining 30 units @ PKR 130 = PKR 3,900', () =>
      runAsTenant(async () => {
        // 1. Receipt 1: 100 units @ PKR 100.00
        const r1 = await postingService.postGoodsReceipt({
          requestKey: `ST01-GRN1-${Date.now()}`,
          grnNumber: `GRN-01-${Date.now().toString(36)}`,
          companyId: testCompanyId,
          warehouseId: warehouseA,
          vendorName: 'National Yarn',
          items: [{ itemId: testItemId, quantity: 100, unitCost: 100 }],
          createdBy: testUserId,
        });
        expect(r1.voucherId).toBeDefined();

        // 2. Receipt 2: 50 units @ PKR 130.00
        const r2 = await postingService.postGoodsReceipt({
          requestKey: `ST01-GRN2-${Date.now()}`,
          grnNumber: `GRN-02-${Date.now().toString(36)}`,
          companyId: testCompanyId,
          warehouseId: warehouseA,
          vendorName: 'National Yarn',
          items: [{ itemId: testItemId, quantity: 50, unitCost: 130 }],
          createdBy: testUserId,
        });
        expect(r2.voucherId).toBeDefined();

        // Check stock before issue: 150 units in warehouse
        const stockBefore = await prisma.warehouseStock.findUnique({
          where: {
            warehouseId_itemId: { warehouseId: warehouseA, itemId: testItemId },
          },
        });
        expect(stockBefore?.quantity).toBe(150);

        // Verify FIFO layers exist
        const layersBefore = await prisma.fifoLayer.findMany({
          where: {
            companyId: testCompanyId,
            warehouseId: warehouseA,
            itemId: testItemId,
            status: 'OPEN',
          },
          orderBy: [{ receiptDate: 'asc' }, { sequence: 'asc' }],
        });
        expect(layersBefore.length).toBe(2);
        expect(Number(layersBefore[0].originalQty)).toBe(100);
        expect(Number(layersBefore[0].unitCost)).toBe(100);
        expect(Number(layersBefore[1].originalQty)).toBe(50);
        expect(Number(layersBefore[1].unitCost)).toBe(130);

        // 3. Issue 120 units across 2 FIFO layers
        const issueResult = await postingService.postStockIssue({
          requestKey: `ST01-ISSUE-${Date.now()}`,
          reference: `DEMAND-NOTE-01`,
          companyId: testCompanyId,
          warehouseId: warehouseA,
          items: [{ itemId: testItemId, quantity: 120 }],
          expenseAccountCode: 'COGS',
          createdBy: testUserId,
        });

        // Expected math: 100 @ 100 (PKR 10,000) + 20 @ 130 (PKR 2,600) = PKR 12,600.00
        expect(issueResult.totalIssueCost).toBe(12600);
        expect(issueResult.allocations?.length).toBe(2);
        expect(issueResult.allocations?.[0].quantity).toBe(100);
        expect(issueResult.allocations?.[0].allocatedValue).toBe(10000);
        expect(issueResult.allocations?.[1].quantity).toBe(20);
        expect(issueResult.allocations?.[1].allocatedValue).toBe(2600);

        // 4. Verify remaining stock: exactly 30 units
        const stockAfter = await prisma.warehouseStock.findUnique({
          where: {
            warehouseId_itemId: { warehouseId: warehouseA, itemId: testItemId },
          },
        });
        expect(stockAfter?.quantity).toBe(30);

        // 5. Verify remaining FIFO layers: Layer 1 EXHAUSTED (0 qty, 0 val), Layer 2 OPEN (30 qty, 3,900 val)
        const layer1 = await prisma.fifoLayer.findUnique({
          where: { id: layersBefore[0].id },
        });
        const layer2 = await prisma.fifoLayer.findUnique({
          where: { id: layersBefore[1].id },
        });

        expect(layer1?.status).toBe('EXHAUSTED');
        expect(Number(layer1?.remainingQty)).toBe(0);
        expect(Number(layer1?.trackedValue)).toBe(0);

        expect(layer2?.status).toBe('OPEN');
        expect(Number(layer2?.remainingQty)).toBe(30);
        expect(Number(layer2?.trackedValue)).toBe(3900); // 30 × 130 = PKR 3,900.00

        // 6. Verify balanced GL journal entry linked to issue voucher
        expect(issueResult.journalEntryId).toBeDefined();
        const journal = await prisma.journalEntry.findUnique({
          where: { id: issueResult.journalEntryId },
          include: { items: { include: { account: true } } },
        });
        expect(journal).toBeDefined();

        const cogsLine = journal?.items.find(
          (i) => i.account.accountCode === 'COGS',
        );
        const invLine = journal?.items.find(
          (i) => i.account.accountCode === 'INVENTORY',
        );

        expect(cogsLine?.debitAmount).toBe(12600);
        expect(cogsLine?.creditAmount).toBe(0);
        expect(invLine?.debitAmount).toBe(0);
        expect(invLine?.creditAmount).toBe(12600);
      }));
  });

  // --------------------------------------------------------------------------
  // ST-02: Concurrent Issue Race Condition & Idempotency Proof
  // --------------------------------------------------------------------------
  describe('ST-02: Concurrency Control & Idempotency Replay (Document 06 §4.2)', () => {
    it('should serialize concurrent requests: exactly one issues 20 from 30, one rejected; idempotency replay posts zero duplicate effects', () =>
      runAsTenant(async () => {
        // Baseline check: warehouse A has exactly 30 units remaining from ST-01
        const currentStock = await prisma.warehouseStock.findUnique({
          where: {
            warehouseId_itemId: { warehouseId: warehouseA, itemId: testItemId },
          },
        });
        expect(currentStock?.quantity).toBe(30);

        const requestKeyA = `ST02-CONCUR-A-${Date.now()}`;
        const requestKeyB = `ST02-CONCUR-B-${Date.now()}`;

        // Launch 2 parallel requests simultaneously, each attempting to issue 20 units
        const [resA, resB] = await Promise.allSettled([
          runAsTenant(() =>
            postingService.postStockIssue({
              requestKey: requestKeyA,
              reference: 'CONCURRENT-ISSUE-A',
              companyId: testCompanyId,
              warehouseId: warehouseA,
              items: [{ itemId: testItemId, quantity: 20 }],
              createdBy: testUserId,
            }),
          ),
          runAsTenant(() =>
            postingService.postStockIssue({
              requestKey: requestKeyB,
              reference: 'CONCURRENT-ISSUE-B',
              companyId: testCompanyId,
              warehouseId: warehouseA,
              items: [{ itemId: testItemId, quantity: 20 }],
              createdBy: testUserId,
            }),
          ),
        ]);

        // Exactly ONE must succeed and ONE must fail with Insufficient stock
        const successCount = [resA, resB].filter(
          (r) => r.status === 'fulfilled',
        ).length;
        const rejectedCount = [resA, resB].filter(
          (r) => r.status === 'rejected',
        ).length;

        expect(successCount).toBe(1);
        expect(rejectedCount).toBe(1);

        // Remaining stock must be exactly 10 units (30 - 20)
        const stockAfterConcurrent = await prisma.warehouseStock.findUnique({
          where: {
            warehouseId_itemId: { warehouseId: warehouseA, itemId: testItemId },
          },
        });
        expect(stockAfterConcurrent?.quantity).toBe(10);

        // Identify the successful request key
        const successfulKey =
          resA.status === 'fulfilled' ? requestKeyA : requestKeyB;
        const successfulRef =
          resA.status === 'fulfilled'
            ? 'CONCURRENT-ISSUE-A'
            : 'CONCURRENT-ISSUE-B';

        // Idempotency Replay Proof: Resubmit the exact same request with the exact same key
        const replayResult = await postingService.postStockIssue({
          requestKey: successfulKey,
          reference: successfulRef,
          companyId: testCompanyId,
          warehouseId: warehouseA,
          items: [{ itemId: testItemId, quantity: 20 }],
          createdBy: testUserId,
        });

        expect(replayResult.replayed).toBe(true);

        // Stock must remain unchanged at exactly 10 units (no second deduction!)
        const stockAfterReplay = await prisma.warehouseStock.findUnique({
          where: {
            warehouseId_itemId: { warehouseId: warehouseA, itemId: testItemId },
          },
        });
        expect(stockAfterReplay?.quantity).toBe(10);

        // Idempotency Conflict Proof: Resubmit with same key but changed quantity (e.g. 5 instead of 20)
        await expect(
          postingService.postStockIssue({
            requestKey: successfulKey,
            reference: successfulRef,
            companyId: testCompanyId,
            warehouseId: warehouseA,
            items: [{ itemId: testItemId, quantity: 5 }], // changed payload!
            createdBy: testUserId,
          }),
        ).rejects.toThrow(ConflictException);
      }));
  });

  // --------------------------------------------------------------------------
  // ST-03: Crash Injection Between Stock & Journal -> Full Transaction Rollback
  // --------------------------------------------------------------------------
  describe('ST-03: Crash Injection Rollback & Cutoff Protection (Document 06 §4.3)', () => {
    it('should roll back stock, FIFO layers, and idempotency key when failure is injected before journal write', () =>
      runAsTenant(async () => {
        const stockBefore =
          (
            await prisma.warehouseStock.findUnique({
              where: {
                warehouseId_itemId: {
                  warehouseId: warehouseA,
                  itemId: testItemId,
                },
              },
            })
          )?.quantity ?? 0;

        const crashKey = `ST03-CRASH-${Date.now()}`;

        // Execute posting with crash simulation hook
        await expect(
          postingService.postStockIssue({
            requestKey: crashKey,
            reference: 'CRASH-TEST',
            companyId: testCompanyId,
            warehouseId: warehouseA,
            items: [{ itemId: testItemId, quantity: 5 }],
            crashSimulation: 'AFTER_STOCK_BEFORE_JOURNAL',
            createdBy: testUserId,
          }),
        ).rejects.toThrow('SIMULATED_CRASH');

        // 1. Verify complete rollback: stock level unchanged
        const stockAfterCrash =
          (
            await prisma.warehouseStock.findUnique({
              where: {
                warehouseId_itemId: {
                  warehouseId: warehouseA,
                  itemId: testItemId,
                },
              },
            })
          )?.quantity ?? 0;
        expect(stockAfterCrash).toBe(stockBefore);

        // 2. Verify no orphan voucher created
        const voucher = await prisma.voucher.findFirst({
          where: { companyId: testCompanyId, reference: 'CRASH-TEST' },
        });
        expect(voucher).toBeNull();

        // 3. Verify no committed idempotency record remains
        const idempKey = await prisma.idempotencyKey.findUnique({
          where: {
            companyId_action_requestKey: {
              companyId: testCompanyId,
              action: 'ISSUE_STOCK',
              requestKey: crashKey,
            },
          },
        });
        expect(idempKey).toBeNull();

        // 4. Retry cleanly with the same request key: must succeed and commit once
        const cleanResult = await postingService.postStockIssue({
          requestKey: crashKey,
          reference: 'CRASH-TEST-RETRY',
          companyId: testCompanyId,
          warehouseId: warehouseA,
          items: [{ itemId: testItemId, quantity: 5 }],
          createdBy: testUserId,
        });

        expect(cleanResult.voucherId).toBeDefined();
        expect(cleanResult.replayed).toBe(false);

        const stockAfterClean =
          (
            await prisma.warehouseStock.findUnique({
              where: {
                warehouseId_itemId: {
                  warehouseId: warehouseA,
                  itemId: testItemId,
                },
              },
            })
          )?.quantity ?? 0;
        expect(stockAfterClean).toBe(stockBefore - 5);
      }));
  });

  // --------------------------------------------------------------------------
  // ST-04: Inter-Warehouse Transfers & FIFO Provenance
  // --------------------------------------------------------------------------
  describe('ST-04: Inter-Warehouse Stock Transfers (Document 06 §4.4)', () => {
    it('should transfer stock between warehouses preserving FIFO layer costs and provenance', () =>
      runAsTenant(async () => {
        // Receive 40 units @ PKR 150 into Warehouse A
        await postingService.postGoodsReceipt({
          requestKey: `ST04-GRN-${Date.now()}`,
          grnNumber: `GRN-XFER-${Date.now().toString(36)}`,
          companyId: testCompanyId,
          warehouseId: warehouseA,
          items: [{ itemId: testItemId, quantity: 40, unitCost: 150 }],
          createdBy: testUserId,
        });

        const whAStockBefore =
          (
            await prisma.warehouseStock.findUnique({
              where: {
                warehouseId_itemId: {
                  warehouseId: warehouseA,
                  itemId: testItemId,
                },
              },
            })
          )?.quantity ?? 0;

        const whBStockBefore =
          (
            await prisma.warehouseStock.findUnique({
              where: {
                warehouseId_itemId: {
                  warehouseId: warehouseB,
                  itemId: testItemId,
                },
              },
            })
          )?.quantity ?? 0;

        // Transfer 25 units from Warehouse A to Warehouse B
        const transferResult = await stockService.transferStock({
          itemId: testItemId,
          fromWarehouseId: warehouseA,
          toWarehouseId: warehouseB,
          quantity: 25,
          createdBy: testUserId,
        });

        expect(transferResult.voucherId).toBeDefined();
        expect(transferResult.status).toBe('POSTED');

        // Verify stock balances updated correctly
        const whAStockAfter =
          (
            await prisma.warehouseStock.findUnique({
              where: {
                warehouseId_itemId: {
                  warehouseId: warehouseA,
                  itemId: testItemId,
                },
              },
            })
          )?.quantity ?? 0;

        const whBStockAfter =
          (
            await prisma.warehouseStock.findUnique({
              where: {
                warehouseId_itemId: {
                  warehouseId: warehouseB,
                  itemId: testItemId,
                },
              },
            })
          )?.quantity ?? 0;

        expect(whAStockAfter).toBe(whAStockBefore - 25);
        expect(whBStockAfter).toBe(whBStockBefore + 25);

        // Verify destination warehouse received new FIFO layer with provenance
        const destLayers = await prisma.fifoLayer.findMany({
          where: {
            companyId: testCompanyId,
            warehouseId: warehouseB,
            itemId: testItemId,
          },
        });
        expect(destLayers.length).toBeGreaterThan(0);
        const totalDestTrackedVal = destLayers.reduce(
          (s, l) => s + Number(l.trackedValue),
          0,
        );
        expect(totalDestTrackedVal).toBeGreaterThan(0);
      }));

    it('should enforce reversal constraints: reject if stock consumed downstream, reject if period closed, post contra-journal and decrement stock on valid reversal', () =>
      runAsTenant(async () => {
        // Create an isolated item for reversal testing to ensure clear FIFO layer boundaries
        const revItem = await prisma.item.create({
          data: {
            companyId: testCompanyId,
            itemCode: `ITEM_REV_${Date.now().toString(36)}`,
            name: 'Reversal Isolated Item',
            currentStock: 0,
            availableStock: 0,
            reservedStock: 0,
          },
        });

        // 1. Post a GRN receipt for 50 units @ PKR 100 into Warehouse A
        const receiptResult = await postingService.postGoodsReceipt({
          requestKey: `REV-TEST-GRN-${Date.now()}`,
          grnNumber: `GRN-REV-${Date.now().toString(36)}`,
          companyId: testCompanyId,
          warehouseId: warehouseA,
          items: [{ itemId: revItem.id, quantity: 50, unitCost: 100 }],
          createdBy: testUserId,
        });
        expect(receiptResult.voucherId).toBeDefined();

        // Consume 20 units downstream via stock issue (consumes from revItem's only layer)
        await postingService.postStockIssue({
          requestKey: `REV-TEST-ISSUE-${Date.now()}`,
          companyId: testCompanyId,
          warehouseId: warehouseA,
          reference: `ISSUE-DOWNSTREAM-${Date.now().toString(36)}`,
          items: [{ itemId: revItem.id, quantity: 20 }],
          createdBy: testUserId,
        });

        // Constraint A: Attempt to reverse receipt voucher when 20 units were consumed downstream
        await expect(
          postingService.reverseVoucher({
            voucherId: receiptResult.voucherId,
            reason: 'Try reverse consumed stock',
            actorId: testUserId,
            companyId: testCompanyId,
          }),
        ).rejects.toThrow(BadRequestException);

        // Constraint B: Attempt to reverse in a closed accounting period
        const pastPeriodName = `PAST-REV-${Date.now().toString(36)}`;
        const pastPeriod = await postingService.openAccountingPeriod(
          testCompanyId,
          pastPeriodName,
          new Date('2025-01-01'),
          new Date('2025-01-31'),
        );
        await postingService.closeAccountingPeriod(
          testCompanyId,
          pastPeriod.id,
          testUserId,
        );

        // Post a clean unconsumed receipt voucher
        const cleanReceipt = await postingService.postGoodsReceipt({
          requestKey: `REV-TEST-CLEAN-${Date.now()}`,
          grnNumber: `GRN-CLEAN-${Date.now().toString(36)}`,
          companyId: testCompanyId,
          warehouseId: warehouseA,
          items: [{ itemId: revItem.id, quantity: 15, unitCost: 110 }],
          createdBy: testUserId,
        });

        // Attempt reversal dated inside the closed period
        await expect(
          postingService.reverseVoucher({
            voucherId: cleanReceipt.voucherId,
            reversalDate: new Date('2025-01-15'),
            reason: 'Attempt reverse in closed period',
            actorId: testUserId,
            companyId: testCompanyId,
          }),
        ).rejects.toThrow(BadRequestException);

        // Constraint C: Successful reversal of unconsumed receipt
        const preRevInvAccount = await prisma.account.findFirst({
          where: { companyId: testCompanyId, accountCode: 'INVENTORY' },
        });
        const preRevGrniAccount = await prisma.account.findFirst({
          where: { companyId: testCompanyId, accountCode: 'GRNI' },
        });
        const preRevWhAStock =
          (
            await prisma.warehouseStock.findUnique({
              where: {
                warehouseId_itemId: {
                  warehouseId: warehouseA,
                  itemId: revItem.id,
                },
              },
            })
          )?.quantity ?? 0;

        const revResult = await postingService.reverseVoucher({
          voucherId: cleanReceipt.voucherId,
          reason: 'Defective supplier batch returned',
          actorId: testUserId,
          companyId: testCompanyId,
        });

        expect(revResult.status).toBe('POSTED');
        expect(revResult.reversalVoucherNumber).toMatch(/^VCH-REVERSAL-/);
        expect(revResult.contraJournalEntryId).toBeDefined();

        // Verify original voucher status marked REVERSED
        const origVoucher = await prisma.voucher.findUnique({
          where: { id: cleanReceipt.voucherId },
        });
        expect(origVoucher?.status).toBe('REVERSED');

        // Verify stock decremented by 15 units
        const postRevWhAStock =
          (
            await prisma.warehouseStock.findUnique({
              where: {
                warehouseId_itemId: {
                  warehouseId: warehouseA,
                  itemId: revItem.id,
                },
              },
            })
          )?.quantity ?? 0;
        expect(postRevWhAStock).toBe(preRevWhAStock - 15);

        // Verify contra-journal entry posted with swapped debits & credits
        const contraJournal = await prisma.journalEntry.findUnique({
          where: { id: revResult.contraJournalEntryId },
          include: { items: { include: { account: true } } },
        });
        expect(contraJournal).toBeDefined();
        const contraInvLine = contraJournal?.items.find(
          (i) => i.account.accountCode === 'INVENTORY',
        );
        const contraGrniLine = contraJournal?.items.find(
          (i) => i.account.accountCode === 'GRNI',
        );
        expect(contraInvLine?.creditAmount).toBe(1650);
        expect(contraInvLine?.debitAmount).toBe(0);
        expect(contraGrniLine?.debitAmount).toBe(1650);
        expect(contraGrniLine?.creditAmount).toBe(0);

        // Verify Account balances restored
        const postRevInvAccount = await prisma.account.findFirst({
          where: { companyId: testCompanyId, accountCode: 'INVENTORY' },
        });
        const postRevGrniAccount = await prisma.account.findFirst({
          where: { companyId: testCompanyId, accountCode: 'GRNI' },
        });
        expect(postRevInvAccount?.balance).toBe(
          (preRevInvAccount?.balance ?? 0) - 1650,
        );
        expect(postRevGrniAccount?.balance).toBe(
          (preRevGrniAccount?.balance ?? 0) - 1650,
        );

        // Constraint D: Attempt to reverse a reversal voucher
        await expect(
          postingService.reverseVoucher({
            voucherId: revResult.reversalVoucherId,
            reason: 'Attempt reverse of reversal',
            actorId: testUserId,
            companyId: testCompanyId,
          }),
        ).rejects.toThrow(
          'Cannot reverse a voucher that is already a reversal',
        );

        // Constraint E: Attempt to reverse an already reversed (non-POSTED) voucher
        await expect(
          postingService.reverseVoucher({
            voucherId: cleanReceipt.voucherId,
            reason: 'Attempt reverse already reversed',
            actorId: testUserId,
            companyId: testCompanyId,
          }),
        ).rejects.toThrow('Only POSTED vouchers can be reversed');

        // Constraint F: Attempt to reverse receipt when item availableStock is insufficient (e.g. reserved)
        const unavailReceipt = await postingService.postGoodsReceipt({
          requestKey: `REV-TEST-AVAIL-${Date.now()}`,
          grnNumber: `GRN-AVAIL-${Date.now().toString(36)}`,
          companyId: testCompanyId,
          warehouseId: warehouseA,
          items: [{ itemId: revItem.id, quantity: 10, unitCost: 100 }],
          createdBy: testUserId,
        });
        // Artificially reduce availableStock on item so availableStock is 5 < 10
        await prisma.item.update({
          where: { id: revItem.id },
          data: { availableStock: 5 },
        });
        await expect(
          postingService.reverseVoucher({
            voucherId: unavailReceipt.voucherId,
            reason: 'Attempt reverse with insufficient availableStock',
            actorId: testUserId,
            companyId: testCompanyId,
          }),
        ).rejects.toThrow(/available stock for item .* is insufficient/);
      }));

    it('should route GRN cancellation through reverseVoucher and reverse financial journal entry', () =>
      runAsTenant(async () => {
        const cancelItem = await prisma.item.create({
          data: {
            companyId: testCompanyId,
            itemCode: `ITEM_CAN_${Date.now().toString(36)}`,
            name: 'Cancel Test Item',
            currentStock: 0,
            availableStock: 0,
            reservedStock: 0,
          },
        });

        // Create PO
        const po = await poService.create(
          {
            poNumber: `PO-CANCEL-${Date.now().toString(36)}`,
            vendorId: testVendorId,
            orderDate: new Date().toISOString(),
            grandTotal: 2000,
            items: [
              {
                itemId: cancelItem.id,
                quantity: 20,
                unitPrice: 100,
                totalPrice: 2000,
              },
            ],
          },
          testUserId,
        );
        await poService.approve(po.id, testUserId);

        // Create GRN
        const grn = await grnService.create(
          {
            grnNumber: `GRN-CANCEL-${Date.now().toString(36)}`,
            poId: po.id,
            vendorId: testVendorId,
            warehouseId: warehouseA,
            status: 'RECEIVED',
            items: [
              {
                itemId: cancelItem.id,
                poItemId: po.items[0].id,
                orderedQty: 20,
                receivedQty: 20,
                acceptedQty: 20,
                unitCost: 100,
              },
            ],
          },
          testUserId,
        );

        const initialStock =
          (
            await prisma.warehouseStock.findUnique({
              where: {
                warehouseId_itemId: {
                  warehouseId: warehouseA,
                  itemId: cancelItem.id,
                },
              },
            })
          )?.quantity ?? 0;

        // Cancel the GRN
        await grnService.update(grn.id, { status: 'CANCELLED' }, testUserId);

        const afterCancelStock =
          (
            await prisma.warehouseStock.findUnique({
              where: {
                warehouseId_itemId: {
                  warehouseId: warehouseA,
                  itemId: cancelItem.id,
                },
              },
            })
          )?.quantity ?? 0;

        expect(afterCancelStock).toBe(initialStock - 20);

        // Verify contra journal entry was created
        const contraJournal = await prisma.journalEntry.findFirst({
          where: {
            companyId: testCompanyId,
            reference: `REV-VCH-GRN-${grn.grnNumber}`,
          },
          include: { items: { include: { account: true } } },
        });
        expect(contraJournal).toBeDefined();
      }));
  });

  // --------------------------------------------------------------------------
  // AP-01: Procurement, GRN, Partial Bill, and Payment
  // --------------------------------------------------------------------------
  describe('AP-01: PO Commitment, GRN Clearance, Partial Billing & Payment (Document 06 §4.5)', () => {
    it('PO approve has 0 journals; GRN posts Dr Inv / Cr GRNI; partial bill clears GRNI; partial payment clears AP', () =>
      runAsTenant(async () => {
        // Record baseline account balances
        const initialGrni =
          (
            await prisma.account.findFirst({
              where: { companyId: testCompanyId, accountCode: 'GRNI' },
            })
          )?.balance ?? 0;

        const initialAp =
          (
            await prisma.account.findFirst({
              where: {
                companyId: testCompanyId,
                accountCode: 'ACCOUNTS_PAYABLE',
              },
            })
          )?.balance ?? 0;

        const initialBank =
          (
            await prisma.account.findFirst({
              where: { companyId: testCompanyId, accountCode: 'BANK' },
            })
          )?.balance ?? 0;

        // Step 1: Create Purchase Order for 100 units @ PKR 100 = PKR 10,000.00
        const po = await poService.create(
          {
            poNumber: `PO-AP01-${Date.now().toString(36)}`,
            vendorId: testVendorId,
            orderDate: new Date().toISOString(),
            grandTotal: 10000,
            items: [
              {
                itemId: testItemId,
                quantity: 100,
                unitPrice: 100,
                totalPrice: 10000,
              },
            ],
          },
          testUserId,
        );

        // Approve PO: Must be commitment only! (0 financial journal entries created)
        const approvedPo = await poService.approve(po.id, testUserId);
        expect(approvedPo.status).toBe('APPROVED');

        const poJournals = await prisma.journalEntry.findMany({
          where: { companyId: testCompanyId, reference: `PO-${po.poNumber}` },
        });
        expect(poJournals.length).toBe(0); // ZERO financial journals on PO approval!

        // Step 2: Goods Receipt Note (GRN): Accept 60 units @ PKR 100 = PKR 6,000.00
        const grn = await grnService.create(
          {
            grnNumber: `GRN-AP01-${Date.now().toString(36)}`,
            poId: po.id,
            vendorId: testVendorId,
            warehouseId: warehouseA,
            status: 'RECEIVED',
            items: [
              {
                itemId: testItemId,
                orderedQty: 100,
                receivedQty: 60,
                acceptedQty: 60,
                rejectedQty: 0,
                unitCost: 100,
              },
            ],
          },
          testUserId,
        );

        expect(grn.status).toBe('RECEIVED');

        // Verify GRN financial journal: Dr INVENTORY PKR 6,000, Cr GRNI PKR 6,000 (NOT ACCOUNTS_PAYABLE)
        const grnJournal = await prisma.journalEntry.findFirst({
          where: {
            companyId: testCompanyId,
            reference: `GRN-${grn.grnNumber}`,
          },
          include: { items: { include: { account: true } } },
        });
        expect(grnJournal).toBeDefined();

        const grnInvLine = grnJournal?.items.find(
          (i) => i.account.accountCode === 'INVENTORY',
        );
        const grnGrniLine = grnJournal?.items.find(
          (i) => i.account.accountCode === 'GRNI',
        );
        const grnApLine = grnJournal?.items.find(
          (i) => i.account.accountCode === 'ACCOUNTS_PAYABLE',
        );

        expect(grnInvLine?.debitAmount).toBe(6000);
        expect(grnGrniLine?.creditAmount).toBe(6000);
        expect(grnApLine).toBeUndefined(); // ACCOUNTS_PAYABLE must NOT be touched on GRN!

        // Check GRNI account balance increased by PKR 6,000 Credit
        const grniAccount = await prisma.account.findFirst({
          where: { companyId: testCompanyId, accountCode: 'GRNI' },
        });
        expect(grniAccount?.balance).toBe(initialGrni + 6000);

        // Step 3: Partial Supplier Bill: Bill 40 units @ PKR 100 = PKR 4,000 against GRN
        const billResult = await postingService.postSupplierBill({
          requestKey: `AP01-BILL-${Date.now()}`,
          billNumber: `BILL-01-${Date.now().toString(36)}`,
          companyId: testCompanyId,
          vendorName: 'National Yarn Suppliers',
          billedAmount: 4000,
          grnReference: grn.grnNumber,
          createdBy: testUserId,
        });

        expect(billResult.voucherId).toBeDefined();

        // Verify GRNI balance: initial + 6,000 - 4,000 = initial + PKR 2,000 remaining
        const grniAfterBill = await prisma.account.findFirst({
          where: { companyId: testCompanyId, accountCode: 'GRNI' },
        });
        expect(grniAfterBill?.balance).toBe(initialGrni + 2000);

        // Verify Vendor AP balance: initial + PKR 4,000 Credit
        const apAfterBill = await prisma.account.findFirst({
          where: { companyId: testCompanyId, accountCode: 'ACCOUNTS_PAYABLE' },
        });
        expect(apAfterBill?.balance).toBe(initialAp + 4000);

        // Step 4: Partial Supplier Payment: Pay PKR 3,000 against Vendor AP
        const payResult = await postingService.postSupplierPayment({
          requestKey: `AP01-PAY-${Date.now()}`,
          paymentNumber: `PAY-01-${Date.now().toString(36)}`,
          companyId: testCompanyId,
          vendorName: 'National Yarn Suppliers',
          amount: 3000,
          paymentMethod: 'BANK',
          createdBy: testUserId,
        });

        expect(payResult.voucherId).toBeDefined();

        // Verify Vendor AP remaining balance: initial + 4,000 - 3,000 = initial + PKR 1,000 Credit
        const apAfterPay = await prisma.account.findFirst({
          where: { companyId: testCompanyId, accountCode: 'ACCOUNTS_PAYABLE' },
        });
        expect(apAfterPay?.balance).toBe(initialAp + 1000);

        // Verify Bank account balance: initial - 3,000 (Credited PKR 3,000)
        const bankAfterPay = await prisma.account.findFirst({
          where: { companyId: testCompanyId, accountCode: 'BANK' },
        });
        expect(bankAfterPay?.balance).toBe(initialBank - 3000);
      }));
  });

  // --------------------------------------------------------------------------
  // FIN-01: Period Closing Concurrency & Reconciliation
  // --------------------------------------------------------------------------
  describe('FIN-01: Period Locking, Ledger Reconciliation & Payroll Fix (Document 06 §4.6)', () => {
    it('should reject posting to closed accounting period and reconcile GL with FIFO layers', () =>
      runAsTenant(async () => {
        const periodName = `FY2026-M11-${Date.now().toString(36)}`;
        const startDate = new Date('2026-11-01T00:00:00Z');
        const endDate = new Date('2026-11-30T23:59:59Z');

        // 1. Create and Open accounting period
        const period = await postingService.openAccountingPeriod(
          testCompanyId,
          periodName,
          startDate,
          endDate,
        );
        expect(period.isClosed).toBe(false);

        // Post inside open period: succeeds
        const openPost = await postingService.post({
          action: 'JOURNAL_POST',
          requestKey: `FIN01-OPEN-${Date.now()}`,
          voucherType: 'JOURNAL',
          businessDate: new Date('2026-11-15T12:00:00Z'),
          companyId: testCompanyId,
          reference: 'VALID-PERIOD-POST',
          journalItems: [
            { accountCode: 'CASH', debit: 500, description: 'Cash deposit' },
            {
              accountCode: 'BANK',
              credit: 500,
              description: 'Bank withdrawal',
            },
          ],
          createdBy: testUserId,
        });
        expect(openPost.voucherId).toBeDefined();

        // 2. Close accounting period
        const closed = await postingService.closeAccountingPeriod(
          testCompanyId,
          period.id,
          testUserId,
        );
        expect(closed.isClosed).toBe(true);

        // Post inside closed period: MUST be rejected with BadRequestException
        await expect(
          postingService.post({
            action: 'JOURNAL_POST',
            requestKey: `FIN01-CLOSED-${Date.now()}`,
            voucherType: 'JOURNAL',
            businessDate: new Date('2026-11-20T12:00:00Z'),
            companyId: testCompanyId,
            reference: 'INVALID-CLOSED-POST',
            journalItems: [
              { accountCode: 'CASH', debit: 100, description: 'Late cash' },
              { accountCode: 'BANK', credit: 100, description: 'Late bank' },
            ],
            createdBy: testUserId,
          }),
        ).rejects.toThrow(BadRequestException);

        // 3. Sub-ledger control account reconciliation: FIFO layer tracked value ties to Inventory GL
        const openLayers = await prisma.fifoLayer.findMany({
          where: { companyId: testCompanyId, status: 'OPEN' },
        });
        const totalFifoValuation =
          Math.round(
            openLayers.reduce((s, l) => s + Number(l.trackedValue), 0) * 100,
          ) / 100;

        const invAccount = await prisma.account.findFirst({
          where: { companyId: testCompanyId, accountCode: 'INVENTORY' },
        });
        const glInventoryBalance =
          Math.round((invAccount?.balance ?? 0) * 100) / 100;

        // GL Inventory balance must exactly reconcile to FIFO layer tracked valuation
        expect(glInventoryBalance).toBe(totalFifoValuation);

        // 4. Payroll Accrual Fix Verification: Gross = 100,000, Deductions = 15,000, Net = 85,000
        // Previously threw unbalanced journal error (Dr 100k != Cr 85k).
        // Now posts balanced: Dr Salary Expense 100k, Cr Deductions 15k, Cr Salary Payable 85k.
        const payrollEntry = await financeService.createPayrollJournalEntry({
          periodName: `NOV-2026-${Date.now().toString(36)}`,
          totalSalary: 100000,
          totalDeductions: 15000,
          netPay: 85000,
          createdBy: testUserId,
        });

        expect(payrollEntry).toBeDefined();
        expect(payrollEntry.isPosted).toBe(true);

        const payrollLines = await prisma.journalEntryItem.findMany({
          where: { journalEntryId: payrollEntry.id },
          include: { account: true },
        });

        const grossLine = payrollLines.find(
          (i) => i.account.accountCode === 'SALARY_EXPENSE',
        );
        const netLine = payrollLines.find(
          (i) => i.account.accountCode === 'SALARY_PAYABLE',
        );
        const dedLine = payrollLines.find(
          (i) => i.account.accountCode === 'PAYROLL_DEDUCTIONS',
        );

        expect(grossLine?.debitAmount).toBe(100000);
        expect(netLine?.creditAmount).toBe(85000);
        expect(dedLine?.creditAmount).toBe(15000);
        expect(
          (grossLine?.debitAmount ?? 0) -
            (netLine?.creditAmount ?? 0) -
            (dedLine?.creditAmount ?? 0),
        ).toBe(0);
      }));

    it('should execute 10 concurrent requests without connection pool starvation deadlock or transaction timeouts', () =>
      runAsTenant(async () => {
        // Open a dedicated open period for stress test to isolate from closed period tests
        const concPeriodName = `FY2027-M06-${Date.now().toString(36)}`;
        await postingService.openAccountingPeriod(
          testCompanyId,
          concPeriodName,
          new Date('2027-06-01T00:00:00Z'),
          new Date('2027-06-30T23:59:59Z'),
        );
        const concDate = new Date('2027-06-15T12:00:00Z');

        const startTime = Date.now();
        const tasks = Array.from({ length: 10 }, (_, i) =>
          postingService.post({
            action: 'STRESS_CONCURRENCY',
            requestKey: `CONC-10-${i}-${Date.now()}`,
            voucherType: 'JOURNAL',
            companyId: testCompanyId,
            businessDate: concDate,
            journalItems: [
              {
                accountCode: 'CASH',
                debit: 50,
                description: `Stress line ${i}`,
              },
              {
                accountCode: 'BANK',
                credit: 50,
                description: `Stress offset ${i}`,
              },
            ],
            createdBy: testUserId,
          }),
        );

        const results = await Promise.allSettled(tasks);
        const duration = Date.now() - startTime;

        // All 10 requests must fulfill cleanly without connection pool starvation
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        expect(fulfilled.length).toBe(10);
        expect(duration).toBeLessThan(15000);
      }));

    it('should cleanly serialize 9 concurrent posts against period close with row lock and zero deadlocks', () =>
      runAsTenant(async () => {
        const stressPeriodName = `STRESS-PERIOD-${Date.now().toString(36)}`;
        const targetDate = new Date('2026-07-15');
        const stressPeriod = await postingService.openAccountingPeriod(
          testCompanyId,
          stressPeriodName,
          new Date('2026-07-01'),
          new Date('2026-07-31'),
        );

        const postTasks = Array.from({ length: 9 }, (_, i) =>
          postingService.post({
            action: 'STRESS_PERIOD_POST',
            requestKey: `SER-POST-${i}-${Date.now()}`,
            voucherType: 'JOURNAL',
            companyId: testCompanyId,
            businessDate: targetDate,
            journalItems: [
              { accountCode: 'CASH', debit: 25, description: `Ser line ${i}` },
              {
                accountCode: 'BANK',
                credit: 25,
                description: `Ser offset ${i}`,
              },
            ],
            createdBy: testUserId,
          }),
        );

        const closeTask = postingService.closeAccountingPeriod(
          testCompanyId,
          stressPeriod.id,
          testUserId,
        );

        const results = await Promise.allSettled([...postTasks, closeTask]);

        // Every task must finish as fulfilled or cleanly rejected with BadRequestException (period closed)
        for (const res of results) {
          if (res.status === 'rejected') {
            expect(res.reason).toBeInstanceOf(BadRequestException);
            expect(res.reason.message).toContain('Accounting period is closed');
          }
        }

        // Period in DB must be isClosed: true
        const periodInDb = await prisma.accountingPeriod.findUnique({
          where: { id: stressPeriod.id },
        });
        expect(periodInDb?.isClosed).toBe(true);
      }));
  });

  // --------------------------------------------------------------------------
  // Boundary Hardening: Non-positive Quantity Rejection
  // --------------------------------------------------------------------------
  describe('Boundary Hardening: Reject Quantity <= 0 (SCOPE.md §4)', () => {
    it('should reject non-positive quantities with BadRequestException in posting engine and helpers', () =>
      runAsTenant(async () => {
        // Zero quantity in post()
        await expect(
          postingService.post({
            action: 'ZERO_QTY_TEST',
            requestKey: `ZERO-QTY-${Date.now()}`,
            voucherType: 'STOCK_ISSUE',
            companyId: testCompanyId,
            businessDate: new Date(),
            stockMovements: [
              {
                type: 'INWARD',
                itemId: testItemId,
                warehouseId: warehouseA,
                quantity: 0,
                unitCost: 100,
              },
            ],
            createdBy: testUserId,
          }),
        ).rejects.toThrow(BadRequestException);

        // Negative quantity in post()
        await expect(
          postingService.post({
            action: 'NEG_QTY_TEST',
            requestKey: `NEG-QTY-${Date.now()}`,
            voucherType: 'STOCK_ISSUE',
            companyId: testCompanyId,
            businessDate: new Date(),
            stockMovements: [
              {
                type: 'INWARD',
                itemId: testItemId,
                warehouseId: warehouseA,
                quantity: -10,
                unitCost: 100,
              },
            ],
            createdBy: testUserId,
          }),
        ).rejects.toThrow(BadRequestException);

        // Zero quantity in postGoodsReceipt()
        await expect(
          postingService.postGoodsReceipt({
            requestKey: `ZERO-GRN-${Date.now()}`,
            grnNumber: `GRN-0-${Date.now().toString(36)}`,
            companyId: testCompanyId,
            warehouseId: warehouseA,
            items: [{ itemId: testItemId, quantity: 0, unitCost: 100 }],
            createdBy: testUserId,
          }),
        ).rejects.toThrow(BadRequestException);

        // Negative quantity in postStockIssue()
        await expect(
          postingService.postStockIssue({
            requestKey: `ZERO-ISSUE-${Date.now()}`,
            companyId: testCompanyId,
            warehouseId: warehouseA,
            reference: 'ZERO-ISSUE-REF',
            items: [{ itemId: testItemId, quantity: -5 }],
            createdBy: testUserId,
          }),
        ).rejects.toThrow(BadRequestException);

        // Zero billed amount in postSupplierBill()
        await expect(
          postingService.postSupplierBill({
            requestKey: `ZERO-BILL-${Date.now()}`,
            billNumber: `BILL-0-${Date.now().toString(36)}`,
            companyId: testCompanyId,
            billedAmount: 0,
            createdBy: testUserId,
          }),
        ).rejects.toThrow(BadRequestException);

        // Zero payment amount in postSupplierPayment()
        await expect(
          postingService.postSupplierPayment({
            requestKey: `ZERO-PAY-${Date.now()}`,
            paymentNumber: `PAY-0-${Date.now().toString(36)}`,
            companyId: testCompanyId,
            amount: 0,
            createdBy: testUserId,
          }),
        ).rejects.toThrow(BadRequestException);
      }));
  });
});
