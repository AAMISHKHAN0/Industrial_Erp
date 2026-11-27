import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PostingService } from '../src/modules/finance/services/posting.service';
import { PurchaseOrderService } from '../src/modules/purchase/purchase-order/PurchaseOrder.service';
import { GoodsReceivingNoteService } from '../src/modules/purchase/goods-receiving/GoodsReceivingNote.service';
import { DemandNoteService } from '../src/modules/purchase/demand-note/DemandNote.service';
import { MaterialIssueService } from '../src/modules/inventory/material-issue/material-issue.service';
import { PurchaseReturnService } from '../src/modules/purchase/purchase-return/purchase-return.service';
import { SupplierBillService } from '../src/modules/purchase/supplier-bill/supplier-bill.service';
import { StockRegisterService } from '../src/modules/inventory/stock-register/stock-register.service';
import { VendorService } from '../src/modules/purchase/vendor/vendor.service';
import { StockService } from '../src/modules/inventory/services/stock.service';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { seedDefaultAccounts } from '../src/modules/finance/account/default-accounts';

describe('Milestone 3 Acceptance Test Suite: Stores, Material Demands & Paperwork Tracking', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let postingService: PostingService;
  let poService: PurchaseOrderService;
  let grnService: GoodsReceivingNoteService;
  let demandService: DemandNoteService;
  let issueService: MaterialIssueService;
  let returnService: PurchaseReturnService;
  let billService: SupplierBillService;
  let registerService: StockRegisterService;
  let vendorService: VendorService;
  let stockService: StockService;
  let tenant: TenantContext;

  let testCompanyId: string;
  let warehouseA: string;
  let warehouseB: string;
  let testItemId: string;
  let testItem2Id: string;
  let testVendorId: string;
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
    demandService = app.get<DemandNoteService>(DemandNoteService);
    issueService = app.get<MaterialIssueService>(MaterialIssueService);
    returnService = app.get<PurchaseReturnService>(PurchaseReturnService);
    billService = app.get<SupplierBillService>(SupplierBillService);
    registerService = app.get<StockRegisterService>(StockRegisterService);
    vendorService = app.get<VendorService>(VendorService);
    stockService = app.get<StockService>(StockService);
    tenant = app.get<TenantContext>(TenantContext);

    // Create unique isolated test tenant fixtures
    const suffix = Date.now().toString(36);
    const company = await prisma.company.create({
      data: {
        name: `M3 Stores Test Company ${suffix}`,
      },
    });
    testCompanyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: `m3_storekeeper_${suffix}@example.com`,
        password: 'dummy-password',
        companyId: testCompanyId,
      },
    });
    testUserId = user.id;

    const wh1 = await prisma.warehouse.create({
      data: {
        name: `Stores Main Warehouse ${suffix}`,
        code: `WH-STR-${suffix.slice(-4)}`,
        companyId: testCompanyId,
      },
    });
    warehouseA = wh1.id;

    const wh2 = await prisma.warehouse.create({
      data: {
        name: `Production Floor Warehouse ${suffix}`,
        code: `WH-PRD-${suffix.slice(-4)}`,
        companyId: testCompanyId,
      },
    });
    warehouseB = wh2.id;

    const item1 = await prisma.item.create({
      data: {
        itemCode: `YARN-M3-${suffix.slice(-4)}`,
        name: 'Cotton Yarn 30/1 Combed',
        companyId: testCompanyId,
      },
    });
    testItemId = item1.id;

    const item2 = await prisma.item.create({
      data: {
        itemCode: `DYES-M3-${suffix.slice(-4)}`,
        name: 'Reactive Blue Dye Powder',
        companyId: testCompanyId,
      },
    });
    testItem2Id = item2.id;

    const vendor = await prisma.vendor.create({
      data: {
        vendorCode: `VND-M3-${suffix.slice(-4)}`,
        name: 'Al-Karam Spinners & Dyes Ltd',
        companyId: testCompanyId,
      },
    });
    testVendorId = vendor.id;

    // Seed default chart of accounts
    await seedDefaultAccounts(prisma as any, testCompanyId, testUserId);

    // Open an accounting period covering current year
    const now = new Date();
    await prisma.accountingPeriod.create({
      data: {
        companyId: testCompanyId,
        name: `FY-${now.getFullYear()}-${suffix.slice(-3)}`,
        startDate: new Date(now.getFullYear(), 0, 1),
        endDate: new Date(now.getFullYear(), 11, 31, 23, 59, 59),
        isClosed: false,
      },
    });
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // M3-GRN-01: Direct GRN Receiving with Paperwork Tracking & Cancellation
  // ───────────────────────────────────────────────────────────────────────────
  describe('M3-GRN-01: Direct GRN Receiving with Paperwork Tracking & Reversal', () => {
    let directGrnId: string;
    const directGrnNumber = `GRN-DIR-${Date.now().toString(36).toUpperCase()}`;

    it('should create direct GRN (without PO) with complete paperwork and atomic GL posting', async () => {
      await runAsTenant(async () => {
        const grn = await grnService.create({
          grnNumber: directGrnNumber,
          poId: undefined, // Direct receipt without PO
          vendorId: testVendorId,
          warehouseId: warehouseA,
          receivedDate: new Date().toISOString(),
          status: 'RECEIVED',
          notes: 'Emergency sundry procurement for weaving line',
          // Paperwork tracking fields
          deliveryChallanNumber: 'DC-98721',
          deliveryChallanDate: new Date().toISOString(),
          supplierInvoiceNumber: 'INV-ALKARAM-441',
          supplierInvoiceDate: new Date().toISOString(),
          supplierInvoiceAmount: 25000,
          gatePassNumber: 'GP-IN-1092',
          vehicleNumber: 'LES-19-4821',
          driverName: 'Muhammad Aslam',
          driverPhone: '+92-300-1234567',
          transporterName: 'Faisal Movers Logistics',
          biltyNumber: 'BLT-88712',
          inspectionStatus: 'PASSED',
          inspectionNotes: 'Inspected 100% cones, moisture content within 7.5% spec',
          inspectedBy: 'Q.A. Inspector Tariq',
          items: [
            {
              itemId: testItemId,
              orderedQty: 100,
              receivedQty: 100,
              acceptedQty: 80,
              rejectedQty: 20,
              rejectionReason: '20 cones damaged with oil stains during transit',
              unitCost: 200,
              lotNumber: 'LOT-2026-Y30',
              remarks: 'Accepted 80 cones into Warehouse A',
            },
          ],
        }, testUserId);

        directGrnId = grn.id;
        expect(grn.id).toBeDefined();
        expect(grn.poId).toBeNull();
        expect(grn.deliveryChallanNumber).toBe('DC-98721');
        expect(grn.gatePassNumber).toBe('GP-IN-1092');
        expect(grn.vehicleNumber).toBe('LES-19-4821');
        expect(grn.inspectionStatus).toBe('PASSED');
        expect(grn.voucherId).toBeDefined();

        // Verify stock only reflects accepted quantity (80 units)
        const ws = await prisma.warehouseStock.findUnique({
          where: {
            warehouseId_itemId: { warehouseId: warehouseA, itemId: testItemId },
          },
        });
        expect(ws?.quantity).toBe(80);

        // Verify FIFO layer created only for accepted quantity
        const layer = await prisma.fifoLayer.findFirst({
          where: {
            companyId: testCompanyId,
            warehouseId: warehouseA,
            itemId: testItemId,
            status: 'OPEN',
          },
        });
        expect(layer).toBeDefined();
        expect(Number(layer?.remainingQty)).toBe(80);
        expect(Number(layer?.unitCost)).toBe(200);
        expect(Number(layer?.trackedValue)).toBe(16000); // 80 * 200

        // Verify double-entry GL entry: Dr INVENTORY (16000) / Cr GRNI (16000)
        const journal = await prisma.journalEntry.findFirst({
          where: { reference: `GRN-${directGrnNumber}` },
          include: { items: { include: { account: true } } },
        });
        expect(journal).toBeDefined();
        const invItem = journal?.items.find((i) => i.account.accountCode === 'INVENTORY');
        const grniItem = journal?.items.find((i) => i.account.accountCode === 'GRNI');
        expect(invItem?.debitAmount).toBe(16000);
        expect(grniItem?.creditAmount).toBe(16000);
      });
    });

    it('should support cancellation of direct GRN through reverseVoucher', async () => {
      await runAsTenant(async () => {
        const cancelled = await grnService.cancel(directGrnId, testUserId);
        expect(cancelled.status).toBe('CANCELLED');

        // Verify warehouse stock reversed to 0
        const ws = await prisma.warehouseStock.findUnique({
          where: {
            warehouseId_itemId: { warehouseId: warehouseA, itemId: testItemId },
          },
        });
        expect(ws?.quantity).toBe(0);

        // Verify FIFO layer cancelled
        const layer = await prisma.fifoLayer.findFirst({
          where: {
            companyId: testCompanyId,
            warehouseId: warehouseA,
            itemId: testItemId,
            status: 'CANCELLED',
          },
        });
        expect(layer).toBeDefined();
        expect(Number(layer?.remainingQty)).toBe(0);
        expect(Number(layer?.trackedValue)).toBe(0);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // M3-GRN-02: PO-Linked GRN with Partial Delivery & Tolerance Acceptance
  // ───────────────────────────────────────────────────────────────────────────
  describe('M3-GRN-02: PO-Linked GRN with Tolerance Acceptance & Status Progression', () => {
    let testPoId: string;
    let poItemId: string;
    const poNumber = `PO-TOL-${Date.now().toString(36).toUpperCase()}`;

    beforeAll(async () => {
      await runAsTenant(async () => {
        const po = await poService.create({
          poNumber,
          vendorId: testVendorId,
          orderDate: new Date().toISOString(),
          paymentTerms: 'NET_30',
          qtyTolerancePct: 5, // 5% quantity tolerance allowed
          priceTolerancePct: 2, // 2% price tolerance allowed
          items: [
            {
              itemId: testItemId,
              quantity: 100,
              unitPrice: 150,
              taxPct: 0,
            },
          ],
        }, testUserId);

        testPoId = po.id;
        poItemId = po.items[0].id;
        await poService.approve(testPoId, testUserId);
      });
    });

    it('should receive partial delivery on GRN 1 and update PO to PARTIALLY_RECEIVED', async () => {
      await runAsTenant(async () => {
        const grn1Number = `GRN-P1-${Date.now().toString(36).toUpperCase()}`;
        const grn1 = await grnService.create({
          grnNumber: grn1Number,
          poId: testPoId,
          vendorId: testVendorId,
          warehouseId: warehouseA,
          status: 'RECEIVED',
          items: [
            {
              poItemId,
              itemId: testItemId,
              orderedQty: 100,
              receivedQty: 60,
              acceptedQty: 60,
              rejectedQty: 0,
              unitCost: 150,
            },
          ],
        }, testUserId);

        expect(grn1.status).toBe('RECEIVED');

        // Check PO item receivedQty and PO status
        const po = await poService.findOne(testPoId);
        expect(po.items[0].receivedQty).toBe(60);
        expect(po.status).toBe('PARTIALLY_RECEIVED');
      });
    });

    it('should accept final receipt with +3% variance within 5% tolerance cap and mark PO COMPLETED', async () => {
      await runAsTenant(async () => {
        const grn2Number = `GRN-P2-${Date.now().toString(36).toUpperCase()}`;
        // Ordering was 100. First GRN was 60. Now receiving 43 (total 103 <= 105 allowed under 5% tolerance)
        const grn2 = await grnService.create({
          grnNumber: grn2Number,
          poId: testPoId,
          vendorId: testVendorId,
          warehouseId: warehouseA,
          status: 'RECEIVED',
          items: [
            {
              poItemId,
              itemId: testItemId,
              orderedQty: 100,
              receivedQty: 43,
              acceptedQty: 43,
              rejectedQty: 0,
              unitCost: 150,
            },
          ],
        }, testUserId);

        expect(grn2.status).toBe('RECEIVED');

        const po = await poService.findOne(testPoId);
        expect(po.items[0].receivedQty).toBe(103);
        expect(po.status).toBe('COMPLETED');
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // M3-GRN-03: 3-Way Match Tolerance Rejections
  // ───────────────────────────────────────────────────────────────────────────
  describe('M3-GRN-03: 3-Way Match Tolerance Rejections & Duplicate Checks', () => {
    let strictPoId: string;
    let strictPoItemId: string;

    beforeAll(async () => {
      await runAsTenant(async () => {
        const po = await poService.create({
          poNumber: `PO-STRICT-${Date.now().toString(36).toUpperCase()}`,
          vendorId: testVendorId,
          qtyTolerancePct: 2, // only 2% tolerance allowed (max 102)
          priceTolerancePct: 0, // strict 0% price tolerance
          items: [{ itemId: testItemId, quantity: 100, unitPrice: 100 }],
        }, testUserId);
        strictPoId = po.id;
        strictPoItemId = po.items[0].id;
        await poService.approve(strictPoId, testUserId);
      });
    });

    it('should reject GRN over-receipt exceeding the 2% tolerance cap', async () => {
      await runAsTenant(async () => {
        // Attempting to receive 108 units (exceeds 102 cap)
        await expect(
          grnService.create({
            grnNumber: `GRN-FAIL-${Date.now().toString(36)}`,
            poId: strictPoId,
            vendorId: testVendorId,
            warehouseId: warehouseA,
            status: 'RECEIVED',
            items: [
              {
                poItemId: strictPoItemId,
                itemId: testItemId,
                orderedQty: 100,
                receivedQty: 108,
                acceptedQty: 108,
                unitCost: 100,
              },
            ],
          }, testUserId),
        ).rejects.toThrow(BadRequestException);
      });
    });

    it('should reject Supplier Bill when unit price exceeds agreed PO price (0% tolerance)', async () => {
      await runAsTenant(async () => {
        // First receive 50 units correctly
        const grn = await grnService.create({
          grnNumber: `GRN-MATCH-${Date.now().toString(36).toUpperCase()}`,
          poId: strictPoId,
          vendorId: testVendorId,
          warehouseId: warehouseA,
          status: 'RECEIVED',
          items: [
            {
              poItemId: strictPoItemId,
              itemId: testItemId,
              orderedQty: 100,
              receivedQty: 50,
              acceptedQty: 50,
              unitCost: 100,
            },
          ],
        }, testUserId);

        // Attempting to bill at PKR 110 (agreed was PKR 100, 0% tolerance)
        await expect(
          billService.create({
            billNumber: `BILL-PRICE-FAIL-${Date.now().toString(36)}`,
            vendorId: testVendorId,
            supplierInvoiceNumber: `INV-PRICE-ERR-${Date.now().toString(36)}`,
            items: [
              {
                grnId: grn.id,
                grnItemId: grn.items[0].id,
                poItemId: strictPoItemId,
                itemId: testItemId,
                billedQty: 50,
                unitPrice: 110, // Exceeds PO unit price 100
              },
            ],
          }, testUserId),
        ).rejects.toThrow(BadRequestException);
      });
    });

    it('should reject duplicate supplier invoice number for the same vendor', async () => {
      await runAsTenant(async () => {
        const invoiceNum = `INV-DUP-${Date.now().toString(36).toUpperCase()}`;
        // Create first valid bill
        await billService.create({
          billNumber: `BILL-DUP-1-${Date.now().toString(36)}`,
          vendorId: testVendorId,
          supplierInvoiceNumber: invoiceNum,
          items: [{ itemId: testItemId, billedQty: 10, unitPrice: 100 }],
        }, testUserId);

        // Submit same supplier invoice number again
        await expect(
          billService.create({
            billNumber: `BILL-DUP-2-${Date.now().toString(36)}`,
            vendorId: testVendorId,
            supplierInvoiceNumber: invoiceNum,
            items: [{ itemId: testItemId, billedQty: 10, unitPrice: 100 }],
          }, testUserId),
        ).rejects.toThrow(ConflictException);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // M3-DEM-01: Demand Note Multi-Line Requisition & Departmental Approval
  // ───────────────────────────────────────────────────────────────────────────
  describe('M3-DEM-01: Demand Note Multi-Line Requisition & Departmental Approval', () => {
    let demandNoteId: string;
    const demandNumber = `DEM-${Date.now().toString(36).toUpperCase()}`;

    it('should create multi-line demand note in DRAFT status with items', async () => {
      await runAsTenant(async () => {
        const demand = await demandService.create({
          demandNumber,
          priority: 'HIGH',
          requestedBy: 'Weaving Supervisor Akram',
          costCenter: 'COST-WEAVING-01',
          remarks: 'Urgent materials required for export lot # 4492',
          items: [
            {
              itemId: testItemId,
              description: 'Cotton Yarn 30/1 Combed Cones',
              quantity: 120,
              unit: 'BAG',
              remarks: 'Weaving warp preparation',
            },
            {
              itemId: testItem2Id,
              description: 'Reactive Blue Dye Powder',
              quantity: 25,
              unit: 'KG',
              remarks: 'Yarn dye lot',
            },
          ],
        }, testUserId);

        demandNoteId = demand.id;
        expect(demand.id).toBeDefined();
        expect(demand.status).toBe('DRAFT');
        expect(demand.items.length).toBe(2);
        expect(demand.items[0].issuedQty).toBe(0);
      });
    });

    it('should progress demand note through SUBMITTED and APPROVED lifecycle', async () => {
      await runAsTenant(async () => {
        const submitted = await demandService.submit(demandNoteId, testUserId);
        expect(submitted.status).toBe('SUBMITTED');

        const approved = await demandService.approve(demandNoteId, testUserId);
        expect(approved.status).toBe('APPROVED');
        expect(approved.approvedBy).toBe(testUserId);
        expect(approved.approvedAt).toBeDefined();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // M3-ISS-01: Demand-Driven Material Issue & Multi-Layer FIFO Consumption (ST-01)
  // ───────────────────────────────────────────────────────────────────────────
  describe('M3-ISS-01: Demand-Driven Material Issue & Multi-Layer FIFO Consumption (ST-01)', () => {
    let fifoDemandNoteId: string;
    let demandItem1Id: string;

    beforeAll(async () => {
      await runAsTenant(async () => {
        // Reset stock for clean ST-01 test fixture
        // Inward Layer 1: 100 units @ PKR 100 in warehouse B
        await grnService.create({
          grnNumber: `GRN-ST01-L1-${Date.now().toString(36).toUpperCase()}`,
          vendorId: testVendorId,
          warehouseId: warehouseB,
          status: 'RECEIVED',
          items: [
            {
              itemId: testItemId,
              orderedQty: 100,
              receivedQty: 100,
              acceptedQty: 100,
              unitCost: 100,
            },
          ],
        }, testUserId);

        // Inward Layer 2: 50 units @ PKR 130 in warehouse B
        await grnService.create({
          grnNumber: `GRN-ST01-L2-${Date.now().toString(36).toUpperCase()}`,
          vendorId: testVendorId,
          warehouseId: warehouseB,
          status: 'RECEIVED',
          items: [
            {
              itemId: testItemId,
              orderedQty: 50,
              receivedQty: 50,
              acceptedQty: 50,
              unitCost: 130,
            },
          ],
        }, testUserId);

        // Create and approve demand note for 120 units
        const dem = await demandService.create({
          demandNumber: `DEM-ST01-${Date.now().toString(36).toUpperCase()}`,
          status: 'DRAFT',
          items: [
            {
              itemId: testItemId,
              quantity: 120,
              unit: 'BAG',
            },
          ],
        }, testUserId);
        fifoDemandNoteId = dem.id;
        demandItem1Id = dem.items[0].id;
        await demandService.approve(fifoDemandNoteId, testUserId);
      });
    });

    it('should consume 120 units across 2 FIFO layers producing cost PKR 12,600 and remaining 30 @ PKR 130 = PKR 3,900', async () => {
      await runAsTenant(async () => {
        // Issue 120 units against approved Demand Note
        const issueNumber = `ISS-ST01-${Date.now().toString(36).toUpperCase()}`;
        const issue = await issueService.create({
          issueNumber,
          demandNoteId: fifoDemandNoteId,
          warehouseId: warehouseB,
          items: [
            {
              demandNoteItemId: demandItem1Id,
              itemId: testItemId,
              quantity: 120,
            },
          ],
        }, testUserId);

        expect(issue.id).toBeDefined();
        expect(issue.status).toBe('POSTED');
        expect(issue.totalCost).toBe(12600); // 100 * 100 + 20 * 130 = 12,600

        // Verify FIFO Layer 1 is EXHAUSTED (0 remaining, 0 tracked value)
        const openLayers = await prisma.fifoLayer.findMany({
          where: {
            companyId: testCompanyId,
            warehouseId: warehouseB,
            itemId: testItemId,
          },
          orderBy: [{ receiptDate: 'asc' }, { sequence: 'asc' }],
        });

        expect(openLayers.length).toBeGreaterThanOrEqual(2);
        const [layer1, layer2] = openLayers;

        expect(layer1.status).toBe('EXHAUSTED');
        expect(Number(layer1.remainingQty)).toBe(0);
        expect(Number(layer1.trackedValue)).toBe(0);

        // Verify FIFO Layer 2 is OPEN (30 remaining @ 130 = PKR 3,900)
        expect(layer2.status).toBe('OPEN');
        expect(Number(layer2.remainingQty)).toBe(30);
        expect(Number(layer2.trackedValue)).toBe(3900);

        // Verify DemandNoteItem issuedQty and DemandNote status
        const demand = await demandService.findOne(fifoDemandNoteId);
        expect(demand.items[0].issuedQty).toBe(120);
        expect(demand.status).toBe('FULFILLED');

        // Verify Balanced Journal Entry: Dr DEPARTMENT_EXPENSE 12600 / Cr INVENTORY 12600
        const journal = await prisma.journalEntry.findFirst({
          where: { reference: issueNumber },
          include: { items: { include: { account: true } } },
        });
        expect(journal).toBeDefined();
        const expItem = journal?.items.find((i) => i.account.accountCode === 'DEPARTMENT_EXPENSE');
        const invItem = journal?.items.find((i) => i.account.accountCode === 'INVENTORY');
        expect(expItem?.debitAmount).toBe(12600);
        expect(invItem?.creditAmount).toBe(12600);
      });
    });

    it('should reject over-issue attempting to issue more stock than authorized in DemandNote', async () => {
      await runAsTenant(async () => {
        // Attempting to issue additional 10 units against the fulfilled demand note
        await expect(
          issueService.create({
            issueNumber: `ISS-OVER-${Date.now().toString(36)}`,
            demandNoteId: fifoDemandNoteId,
            warehouseId: warehouseB,
            items: [
              {
                demandNoteItemId: demandItem1Id,
                itemId: testItemId,
                quantity: 10,
              },
            ],
          }, testUserId),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // M3-RET-01: Vendor Purchase Returns & Downstream Consumption Guard
  // ───────────────────────────────────────────────────────────────────────────
  describe('M3-RET-01: Vendor Purchase Returns & Downstream Consumption Guard', () => {
    let retGrnId: string;

    beforeAll(async () => {
      await runAsTenant(async () => {
        // Receive 40 units @ PKR 110 into Warehouse A
        const grn = await grnService.create({
          grnNumber: `GRN-RET-${Date.now().toString(36).toUpperCase()}`,
          vendorId: testVendorId,
          warehouseId: warehouseA,
          status: 'RECEIVED',
          items: [
            {
              itemId: testItem2Id,
              orderedQty: 40,
              receivedQty: 40,
              acceptedQty: 40,
              unitCost: 110,
            },
          ],
        }, testUserId);
        retGrnId = grn.id;
      });
    });

    it('should return 10 units to vendor: reduces stock and posts Dr GRNI / Cr INVENTORY', async () => {
      await runAsTenant(async () => {
        const retNumber = `RET-${Date.now().toString(36).toUpperCase()}`;
        const ret = await returnService.create({
          returnNumber: retNumber,
          vendorId: testVendorId,
          warehouseId: warehouseA,
          grnId: retGrnId,
          gatePassNumber: 'GP-OUT-9921',
          reason: 'Defective batch with improper color shade',
          items: [
            {
              itemId: testItem2Id,
              quantity: 10,
              unitCost: 110,
              reason: 'Off-shade pigment',
            },
          ],
        }, testUserId);

        expect(ret.id).toBeDefined();
        expect(ret.totalAmount).toBe(1100); // 10 * 110

        // Warehouse stock decremented by 10 (40 - 10 = 30)
        const ws = await prisma.warehouseStock.findUnique({
          where: {
            warehouseId_itemId: { warehouseId: warehouseA, itemId: testItem2Id },
          },
        });
        expect(ws?.quantity).toBe(30);

        // FIFO layer reduced by 10 (remaining: 30 @ 110 = 3300)
        const layer = await prisma.fifoLayer.findFirst({
          where: {
            companyId: testCompanyId,
            warehouseId: warehouseA,
            itemId: testItem2Id,
            sourceMovementId: retGrnId,
          },
        });
        expect(Number(layer?.remainingQty)).toBe(30);
        expect(Number(layer?.trackedValue)).toBe(3300);

        // Journal: Dr GRNI 1100 / Cr INVENTORY 1100
        const journal = await prisma.journalEntry.findFirst({
          where: { reference: retNumber },
          include: { items: { include: { account: true } } },
        });
        expect(journal).toBeDefined();
        const grniItem = journal?.items.find((i) => i.account.accountCode === 'GRNI');
        const invItem = journal?.items.find((i) => i.account.accountCode === 'INVENTORY');
        expect(grniItem?.debitAmount).toBe(1100);
        expect(invItem?.creditAmount).toBe(1100);
      });
    });

    it('should reject vendor return if requested quantity exceeds available unconsumed layer stock', async () => {
      await runAsTenant(async () => {
        // Remaining on layer is 30. Attempting to return 35
        await expect(
          returnService.create({
            vendorId: testVendorId,
            warehouseId: warehouseA,
            grnId: retGrnId,
            items: [{ itemId: testItem2Id, quantity: 35, unitCost: 110 }],
          }, testUserId),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // M3-REG-01: Reconciled Stock Register Derivation & GL Tie-Out
  // ───────────────────────────────────────────────────────────────────────────
  describe('M3-REG-01: Reconciled Stock Register Derivation & GL Tie-Out', () => {
    it('should derive Opening + Inward - Outward = Closing and reconcile with GL INVENTORY account balance', async () => {
      await runAsTenant(async () => {
        const register = await registerService.getRegister({
          startDate: new Date(new Date().getFullYear(), 0, 1).toISOString(),
          endDate: new Date().toISOString(),
        });

        expect(register).toBeDefined();
        expect(register.summary).toBeDefined();
        expect(register.items.length).toBeGreaterThan(0);

        // For each item line, check the fundamental conservation law:
        // Opening + Inward - Outward == Closing for both Qty and Value
        for (const item of register.items) {
          const expectedClosingQty =
            item.openingQty + item.inwardQty - item.outwardQty;
          expect(item.closingQty).toBeCloseTo(expectedClosingQty, 2);

          const expectedClosingVal =
            item.openingValue + item.inwardValue - item.outwardValue;
          expect(item.closingValue).toBeCloseTo(expectedClosingVal, 1);
        }

        // Verify GL Reconciliation tie-out
        expect(register.glReconciliation.isReconciled).toBe(true);
        expect(register.glReconciliation.variance).toBe(0);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // M3-TRAIL-01: Complete Vendor Audit Trail & Unbilled GRN Verification
  // ───────────────────────────────────────────────────────────────────────────
  describe('M3-TRAIL-01: Complete Vendor Audit Trail & Unbilled GRN Verification', () => {
    it('should return chronological procurement trail for vendor including PO, GRN, Bill, Return', async () => {
      await runAsTenant(async () => {
        const trail = await vendorService.getVendorTrail(testVendorId);
        expect(trail).toBeDefined();
        expect(trail.vendor.id).toBe(testVendorId);
        expect(trail.summary.totalPoValue).toBeGreaterThan(0);
        expect(trail.summary.totalGrnValue).toBeGreaterThan(0);
        expect(trail.timeline.length).toBeGreaterThanOrEqual(3);

        // Timeline contains entries of types PO, GRN, BILL, RETURN
        const types = new Set(trail.timeline.map((t: any) => t.type));
        expect(types.has('PO')).toBe(true);
        expect(types.has('GRN')).toBe(true);

        // Check unbilled GRNs list
        const unbilled = await grnService.findUnbilled();
        expect(Array.isArray(unbilled)).toBe(true);
      });
    });
  });
});
