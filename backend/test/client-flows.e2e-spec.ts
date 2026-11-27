import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException, ConflictException } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PostingService } from '../src/modules/finance/services/posting.service';
import { GoodsReceivingNoteService } from '../src/modules/purchase/goods-receiving/GoodsReceivingNote.service';
import { DemandNoteService } from '../src/modules/purchase/demand-note/DemandNote.service';
import { MaterialIssueService } from '../src/modules/inventory/material-issue/material-issue.service';
import { StockRegisterService } from '../src/modules/inventory/stock-register/stock-register.service';
import { SalesInvoiceService } from '../src/modules/sales/sales-invoice/sales-invoice.service';
import { CustomerReceiptService } from '../src/modules/sales/customer-receipt/customer-receipt.service';
import { CustomerStatementService } from '../src/modules/sales/customer-statement/customer-statement.service';
import { StatutoryService } from '../src/modules/finance/statutory/statutory.service';
import { WageService } from '../src/modules/hr/wages/wage.service';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { seedDefaultAccounts } from '../src/modules/finance/account/default-accounts';

describe('Client Workspace Verification Suite: Core E2E Business Flows', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let postingService: PostingService;
  let grnService: GoodsReceivingNoteService;
  let demandService: DemandNoteService;
  let issueService: MaterialIssueService;
  let stockRegisterService: StockRegisterService;
  let invoiceService: SalesInvoiceService;
  let receiptService: CustomerReceiptService;
  let statementService: CustomerStatementService;
  let statutoryService: StatutoryService;
  let wageService: WageService;
  let tenant: TenantContext;

  let testCompanyId: string;
  let testUserId: string;
  let testWarehouseId: string;
  let testVendorId: string;
  let testCustomerId: string;
  let testItemId: string;
  let testEmployeeId: string;

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
    grnService = app.get<GoodsReceivingNoteService>(GoodsReceivingNoteService);
    demandService = app.get<DemandNoteService>(DemandNoteService);
    issueService = app.get<MaterialIssueService>(MaterialIssueService);
    stockRegisterService = app.get<StockRegisterService>(StockRegisterService);
    invoiceService = app.get<SalesInvoiceService>(SalesInvoiceService);
    receiptService = app.get<CustomerReceiptService>(CustomerReceiptService);
    statementService = app.get<CustomerStatementService>(CustomerStatementService);
    statutoryService = app.get<StatutoryService>(StatutoryService);
    wageService = app.get<WageService>(WageService);
    tenant = app.get<TenantContext>(TenantContext);

    // 1. Create isolated test tenant
    const comp = await prisma.company.create({
      data: {
        name: `Flow Verification Textile Co ${Date.now()}`,
        status: 'ACTIVE',
      },
    });
    testCompanyId = comp.id;

    // 2. Seed Default Chart of Accounts
    await seedDefaultAccounts(prisma, testCompanyId, 'SYSTEM');

    // 3. Create test user
    const user = await prisma.user.create({
      data: {
        email: `flowadmin-${Date.now()}@digitalerena.local`,
        password: 'dummyhash-verified',
        role: 'ADMIN',
        status: 'ACTIVE',
        companyId: testCompanyId,
      },
    });
    testUserId = user.id;

    // 4. Warehouse fixture
    const wh = await prisma.warehouse.create({
      data: {
        companyId: testCompanyId,
        code: `WH-FLOW-${Date.now().toString().slice(-4)}`,
        name: 'Main Yarn Warehouse',
        status: 'ACTIVE',
      },
    });
    testWarehouseId = wh.id;

    // 5. Vendor fixture
    const vendor = await prisma.vendor.create({
      data: {
        companyId: testCompanyId,
        vendorCode: `V-FLOW-${Date.now().toString().slice(-4)}`,
        name: 'Premier Spinning Mills',
        taxNumber: '1234567-8',
      },
    });
    testVendorId = vendor.id;

    // 6. Customer fixture
    const customer = await prisma.customer.create({
      data: {
        companyId: testCompanyId,
        customerCode: `C-FLOW-${Date.now().toString().slice(-4)}`,
        name: 'Sapphire Apparels Ltd',
        taxNumber: '7654321-0',
      },
    });
    testCustomerId = customer.id;

    // 7. Item fixture
    const item = await prisma.item.create({
      data: {
        companyId: testCompanyId,
        itemCode: `ITM-FLOW-${Date.now().toString().slice(-4)}`,
        name: 'Cotton Yarn 30/1 Combed',
        currentStock: 0,
        availableStock: 0,
        averageCost: 0,
        minStock: 10,
        reorderLevel: 25,
      },
    });
    testItemId = item.id;

    // 8. Employee fixture
    const dept = await prisma.department.create({
      data: {
        companyId: testCompanyId,
        name: 'Spinning & Weaving',
        code: 'SPIN',
      },
    });

    const desig = await prisma.designation.create({
      data: {
        companyId: testCompanyId,
        name: 'Master Weaver',
        code: `MW-${Date.now().toString().slice(-4)}`,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        companyId: testCompanyId,
        employeeCode: `EMP-FLOW-${Date.now().toString().slice(-4)}`,
        firstName: 'Muhammad',
        lastName: 'Tariq',
        email: `tariq-${Date.now()}@example.com`,
        departmentId: dept.id,
        designationId: desig.id,
      },
    });
    testEmployeeId = employee.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // FLOW 1: Material Inward -> Issue against demand -> verify Stock Register
  // updates with FIFO layers.
  // =========================================================================
  describe('Flow 1: Material Inward -> Issue against demand -> verify Stock Register with FIFO layers', () => {
    let demandNoteId: string;
    let demandItemId: string;

    it('Step 1.1: Material Inward (GRN) with multiple cost layers', async () => {
      await runAsTenant(async () => {
        // Inward Layer 1: 100 units @ PKR 200/unit
        await grnService.create({
          grnNumber: `GRN-FLOW-L1-${Date.now().toString(36).toUpperCase()}`,
          vendorId: testVendorId,
          warehouseId: testWarehouseId,
          status: 'RECEIVED',
          items: [
            {
              itemId: testItemId,
              orderedQty: 100,
              receivedQty: 100,
              acceptedQty: 100,
              unitCost: 200,
            },
          ],
        }, testUserId);

        // Inward Layer 2: 50 units @ PKR 250/unit
        await grnService.create({
          grnNumber: `GRN-FLOW-L2-${Date.now().toString(36).toUpperCase()}`,
          vendorId: testVendorId,
          warehouseId: testWarehouseId,
          status: 'RECEIVED',
          items: [
            {
              itemId: testItemId,
              orderedQty: 50,
              receivedQty: 50,
              acceptedQty: 50,
              unitCost: 250,
            },
          ],
        }, testUserId);
      });

      // Verify FIFO layers created
      const openLayers = await prisma.fifoLayer.findMany({
        where: {
          companyId: testCompanyId,
          warehouseId: testWarehouseId,
          itemId: testItemId,
          status: 'OPEN',
        },
        orderBy: { sequence: 'asc' },
      });

      expect(openLayers.length).toBe(2);
      expect(Number(openLayers[0].remainingQty)).toBe(100);
      expect(Number(openLayers[0].unitCost)).toBe(200);
      expect(Number(openLayers[1].remainingQty)).toBe(50);
      expect(Number(openLayers[1].unitCost)).toBe(250);

      // Verify total stock quantity is 150
      const stock = await prisma.warehouseStock.findUnique({
        where: {
          warehouseId_itemId: { warehouseId: testWarehouseId, itemId: testItemId },
        },
      });
      expect(stock?.quantity).toBe(150);
    });

    it('Step 1.2: Create and approve Demand Note for 120 units', async () => {
      await runAsTenant(async () => {
        const dem = await demandService.create({
          demandNumber: `DEM-FLOW-${Date.now().toString(36).toUpperCase()}`,
          status: 'DRAFT',
          items: [
            {
              itemId: testItemId,
              quantity: 120,
              unit: 'KG',
            },
          ],
        }, testUserId);

        demandNoteId = dem.id;
        demandItemId = dem.items[0].id;
        await demandService.approve(demandNoteId, testUserId);
      });

      const approvedDem = await demandService.findOne(demandNoteId);
      expect(approvedDem.status).toBe('APPROVED');
    });

    it('Step 1.3: Issue Material against Demand Note & verify FIFO Layer consumption and Stock Register', async () => {
      const issueNumber = `ISS-FLOW-${Date.now().toString(36).toUpperCase()}`;

      await runAsTenant(async () => {
        await issueService.create({
          issueNumber,
          demandNoteId,
          warehouseId: testWarehouseId,
          items: [
            {
              demandNoteItemId: demandItemId,
              itemId: testItemId,
              quantity: 120,
            },
          ],
        }, testUserId);
      });

      // Verify FIFO Layers:
      // Layer 1 (100 units @ 200) -> completely EXHAUSTED (0 remaining)
      // Layer 2 (50 units @ 250) -> 20 consumed, 30 remaining OPEN (30 @ 250 = PKR 7,500)
      const allLayers = await prisma.fifoLayer.findMany({
        where: {
          companyId: testCompanyId,
          warehouseId: testWarehouseId,
          itemId: testItemId,
        },
        orderBy: { sequence: 'asc' },
      });

      expect(allLayers.length).toBe(2);
      expect(allLayers[0].status).toBe('EXHAUSTED');
      expect(Number(allLayers[0].remainingQty)).toBe(0);
      expect(Number(allLayers[0].trackedValue)).toBe(0);

      expect(allLayers[1].status).toBe('OPEN');
      expect(Number(allLayers[1].remainingQty)).toBe(30);
      expect(Number(allLayers[1].trackedValue)).toBe(7500);

      // Verify Warehouse Stock remaining = 30
      const stock = await prisma.warehouseStock.findUnique({
        where: {
          warehouseId_itemId: { warehouseId: testWarehouseId, itemId: testItemId },
        },
      });
      expect(stock?.quantity).toBe(30);

      // Verify Demand Note is FULFILLED
      const demand = await demandService.findOne(demandNoteId);
      expect(demand.status).toBe('FULFILLED');
      expect(demand.items[0].issuedQty).toBe(120);

      // Verify Stock Register updates via StockRegisterService
      const register = await runAsTenant(async () => {
        return stockRegisterService.getRegister({ warehouseId: testWarehouseId });
      });
      const regItem = register.items.find((r: any) => r.itemId === testItemId);
      expect(regItem).toBeDefined();
      expect(regItem?.inwardQty).toBe(150);
      expect(regItem?.outwardQty).toBe(120);
      expect(regItem?.closingQty).toBe(30);
      expect(regItem?.closingValue).toBe(7500);

      // Verify Balanced Journal Entry:
      // Total cost = 100*200 (20,000) + 20*250 (5,000) = PKR 25,000
      // Dr DEPARTMENT_EXPENSE 25000 / Cr INVENTORY 25000
      const journal = await prisma.journalEntry.findFirst({
        where: { reference: issueNumber },
        include: { items: { include: { account: true } } },
      });
      expect(journal).toBeDefined();
      expect(journal?.isPosted).toBe(true);
      const totalDebit = journal?.items.reduce((sum, item) => sum + Number(item.debitAmount), 0);
      const totalCredit = journal?.items.reduce((sum, item) => sum + Number(item.creditAmount), 0);
      expect(totalDebit).toBe(25000);
      expect(totalCredit).toBe(25000);
    });
  });

  // =========================================================================
  // FLOW 2: Create Sales Invoice -> record partial receipt -> verify remaining
  // open balance in Customer Ledger.
  // =========================================================================
  describe('Flow 2: Create Sales Invoice -> record partial receipt -> verify Customer Ledger remaining open balance', () => {
    let invoiceId: string;
    let invoiceNumber: string;
    const itemSubtotal = 100000;
    const taxRate = 18;
    const salesTaxAmount = 18000;
    const totalInvoiceAmount = 118000;
    const partialReceivedAmount = 70000;
    const expectedRemainingBalance = 48000;

    it('Step 2.1: Create Sales Invoice of PKR 118,000 (100k + 18k tax)', async () => {
      const inv = await runAsTenant(async () => {
        return invoiceService.create({
          customerId: testCustomerId,
          customerPoRef: 'PO-CLIENT-9912',
          invoiceDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
          notes: 'Standard textile goods order',
          items: [
            {
              itemId: testItemId,
              description: 'Cotton Yarn 30/1 Combed - Export Grade',
              quantity: 200,
              unitPrice: 500,
              taxPct: taxRate,
            },
          ],
        }, testUserId);
      });

      expect(inv.id).toBeDefined();
      expect(inv.status).toBe('POSTED');
      expect(inv.totalAmount).toBe(totalInvoiceAmount);
      expect(inv.outstandingAmount).toBe(totalInvoiceAmount);
      expect(inv.voucherNumber).toBeDefined();

      invoiceId = inv.id;
      invoiceNumber = inv.invoiceNumber;

      // Verify GL postings: Dr ACCOUNTS_RECEIVABLE 118000 / Cr SALES_REVENUE 100000 / Cr SALES_TAX_PAYABLE 18000
      const voucher = await prisma.voucher.findUnique({
        where: { id: inv.voucherId! },
        include: { journalEntry: { include: { items: true } } },
      });
      expect(voucher).toBeDefined();
      expect(voucher?.status).toBe('POSTED');
      expect(voucher?.journalEntry).toBeDefined();
      const totalDebit = voucher?.journalEntry?.items.reduce((sum, item) => sum + Number(item.debitAmount), 0);
      expect(totalDebit).toBe(totalInvoiceAmount);
    });

    it('Step 2.2: Record Partial Customer Receipt of PKR 70,000', async () => {
      const receipt = await runAsTenant(async () => {
        return receiptService.create({
          customerId: testCustomerId,
          receiptNumber: `REC-FLOW-${Date.now().toString().slice(-4)}`,
          paymentMethod: 'BANK',
          amountReceived: partialReceivedAmount,
          taxWithheld: 0,
          bankReference: 'HBL-ONFT-332901',
          allocations: [
            {
              invoiceId: invoiceId,
              amount: partialReceivedAmount,
            },
          ],
        }, testUserId);
      });

      expect(receipt.id).toBeDefined();
      expect(receipt.amountReceived).toBe(partialReceivedAmount);
      expect(receipt.voucherNumber).toBeDefined();

      // Verify Invoice outstandingAmount updated to PKR 48,000 and status is PARTIALLY_PAID
      const updatedInv = await runAsTenant(async () => invoiceService.findOne(invoiceId));
      expect(updatedInv.outstandingAmount).toBe(expectedRemainingBalance);
      expect(updatedInv.status).toBe('PARTIALLY_PAID');
    });

    it('Step 2.3: Verify Customer Ledger statement reflects exact open balance of PKR 48,000', async () => {
      const statement = await runAsTenant(async () => {
        return statementService.getCustomerStatement(testCustomerId);
      });

      expect(statement.customer.id).toBe(testCustomerId);
      expect(statement.entries.length).toBeGreaterThanOrEqual(2); // Invoice entry + Receipt entry
      expect(statement.closingBalance).toBe(expectedRemainingBalance);
      expect(statement.openInvoicesOutstanding).toBe(expectedRemainingBalance);
      expect(statement.isReconciled).toBe(true);

      // Verify AR reconciliation with general ledger
      const arAccount = await prisma.account.findUnique({
        where: {
          companyId_accountCode: {
            companyId: testCompanyId,
            accountCode: 'ACCOUNTS_RECEIVABLE',
          },
        },
      });
      expect(Number(arAccount?.balance)).toBe(expectedRemainingBalance);
    });
  });

  // =========================================================================
  // FLOW 3: Enter Daily Wages -> verify Employee Ledger entry.
  // =========================================================================
  describe('Flow 3: Enter Daily Wages -> verify Employee Ledger entry', () => {
    let wageRunId: string;
    const daysWorked = 6.5;
    const dailyRate = 1800;
    const expectedGrossWage = 11700; // 6.5 * 1800 = 11,700

    it('Step 3.1: Enter Daily Wage Run for Employee', async () => {
      const wageRun = await runAsTenant(async () => {
        return wageService.createWageRun({
          periodYear: 2026,
          periodMonth: 7,
          runType: 'DAILY_WAGE',
          lines: [
            {
              employeeId: testEmployeeId,
              daysWorked: daysWorked,
              dailyRate: dailyRate,
              deductions: 0,
            },
          ],
        }, testUserId);
      });

      expect(wageRun.id).toBeDefined();
      expect(wageRun.status).toBe('ACCRUED');
      expect(wageRun.totalAmount).toBe(expectedGrossWage);
      expect(wageRun.voucherId).toBeDefined();

      wageRunId = wageRun.id;

      // Verify Employee Ledger / Wage accrual Journal Entry:
      // Dr WAGE_EXPENSE 11700 / Cr WAGE_PAYABLE 11700
      const wageExpenseAcc = await prisma.account.findUnique({
        where: {
          companyId_accountCode: {
            companyId: testCompanyId,
            accountCode: 'WAGE_EXPENSE',
          },
        },
      });
      expect(Number(wageExpenseAcc?.balance)).toBe(expectedGrossWage);

      const wagePayableAcc = await prisma.account.findUnique({
        where: {
          companyId_accountCode: {
            companyId: testCompanyId,
            accountCode: 'WAGE_PAYABLE',
          },
        },
      });
      expect(Number(wagePayableAcc?.balance)).toBe(expectedGrossWage);
    });

    it('Step 3.2: Disburse Daily Wages & verify clear Employee Ledger liability without duplicate expense', async () => {
      const disbursed = await runAsTenant(async () => {
        return wageService.disburseWageRun(wageRunId, {
          paymentMethod: 'CASH',
          notes: 'Daily wage cash distribution to weaver',
        }, testUserId);
      });

      expect(disbursed.status).toBe('DISBURSED');
      expect(disbursed.disbursementVoucherNumber).toBeDefined();

      // Verify WAGE_PAYABLE is completely cleared to PKR 0.00
      const wagePayableAcc = await prisma.account.findUnique({
        where: {
          companyId_accountCode: {
            companyId: testCompanyId,
            accountCode: 'WAGE_PAYABLE',
          },
        },
      });
      expect(Number(wagePayableAcc?.balance)).toBe(0);

      // Verify WAGE_EXPENSE remains exactly 11,700 (strictly 0 duplicate expense)
      const wageExpenseAcc = await prisma.account.findUnique({
        where: {
          companyId_accountCode: {
            companyId: testCompanyId,
            accountCode: 'WAGE_EXPENSE',
          },
        },
      });
      expect(Number(wageExpenseAcc?.balance)).toBe(expectedGrossWage);
    });
  });

  // =========================================================================
  // FLOW 4: Post Outgoing Payment -> verify ledger entry and idempotency
  // (submitting duplicate request returns original result and creates no
  // duplicate ledger entries).
  // =========================================================================
  describe('Flow 4: Post Outgoing Payment -> verify ledger entry & duplicate idempotency protection', () => {
    let salesTaxObligationId: string;
    const paymentReqKey = `OUTGOING-PAY-IDEMP-${Date.now()}`;
    const obligationTotal = 50000;
    const paymentAmount = 30000;
    const remainingObligation = 20000;

    it('Step 4.1: Create Statutory Obligation for Sales Tax of PKR 50,000', async () => {
      const ob = await runAsTenant(async () => {
        return statutoryService.createObligation({
          head: 'SALES_TAX',
          authority: 'FBR',
          registrationNumber: 'ST-REG-991823',
          taxPeriod: '2026-05',
          dueAmount: obligationTotal,
          notes: 'Monthly provincial sales tax obligation',
        }, testUserId);
      });

      expect(ob.id).toBeDefined();
      expect(ob.status).toBe('APPROVED');
      expect(ob.dueAmount).toBe(obligationTotal);
      expect(ob.outstandingAmount).toBe(obligationTotal);

      salesTaxObligationId = ob.id;
    });

    it('Step 4.2: Post Outgoing Payment of PKR 30,000 with unique idempotency requestKey', async () => {
      const payment = await runAsTenant(async () => {
        return statutoryService.recordPayment({
          obligationId: salesTaxObligationId,
          amount: paymentAmount,
          paymentMethod: 'BANK',
          cprNumber: 'CPR-2026-FBR-FLOW-01',
          psid: 'PSID-99081234',
          requestKey: paymentReqKey,
          notes: 'Remittance of Sales Tax against CPR 01',
        }, testUserId);
      });

      expect(payment.id).toBeDefined();
      expect(payment.amount).toBe(paymentAmount);
      expect(payment.replayed).toBe(false);

      // Verify obligation outstanding reduced to PKR 20,000 and status PART_PAID
      const obAfter = await runAsTenant(async () => statutoryService.findOne(salesTaxObligationId));
      expect(obAfter.paidAmount).toBe(paymentAmount);
      expect(obAfter.outstandingAmount).toBe(remainingObligation);
      expect(obAfter.status).toBe('PART_PAID');

      // Verify Ledger Entry:
      // SALES_TAX_PAYABLE: 18,000 (tax accrued from sales invoice) - 30,000 (tax remittance debit) = -12,000
      const taxPayable = await prisma.account.findUnique({
        where: {
          companyId_accountCode: {
            companyId: testCompanyId,
            accountCode: 'SALES_TAX_PAYABLE',
          },
        },
      });
      expect(Number(taxPayable?.balance)).toBe(-12000);

      // BANK: 70,000 (customer receipt bank deposit) - 30,000 (tax remittance bank credit) = 40,000
      const bank = await prisma.account.findUnique({
        where: {
          companyId_accountCode: {
            companyId: testCompanyId,
            accountCode: 'BANK',
          },
        },
      });
      expect(Number(bank?.balance)).toBe(40000);
    });

    it('Step 4.3: Submit duplicate request with same requestKey -> returns cached result with 0 duplicate ledger postings', async () => {
      // Re-submit identical payment payload with identical requestKey
      const duplicateRes = await runAsTenant(async () => {
        return statutoryService.recordPayment({
          obligationId: salesTaxObligationId,
          amount: paymentAmount,
          paymentMethod: 'BANK',
          cprNumber: 'CPR-2026-FBR-FLOW-01',
          psid: 'PSID-99081234',
          requestKey: paymentReqKey, // IDENTICAL REQUEST KEY
          notes: 'Duplicate replay attempt',
        }, testUserId);
      });

      // Verify duplicate submission returns original result marked as replayed
      expect(duplicateRes.replayed).toBe(true);
      expect(duplicateRes.amount).toBe(paymentAmount);

      // Verify obligation outstanding is NOT decremented again (still PKR 20,000)
      const obCheck = await runAsTenant(async () => statutoryService.findOne(salesTaxObligationId));
      expect(obCheck.paidAmount).toBe(paymentAmount);
      expect(obCheck.outstandingAmount).toBe(remainingObligation);

      // Verify General Ledger accounts were NOT posted twice:
      // SALES_TAX_PAYABLE must still be -12000 (NOT -42000)
      const taxPayable = await prisma.account.findUnique({
        where: {
          companyId_accountCode: {
            companyId: testCompanyId,
            accountCode: 'SALES_TAX_PAYABLE',
          },
        },
      });
      expect(Number(taxPayable?.balance)).toBe(-12000);

      // BANK must still be 40000 (NOT 10000)
      const bank = await prisma.account.findUnique({
        where: {
          companyId_accountCode: {
            companyId: testCompanyId,
            accountCode: 'BANK',
          },
        },
      });
      expect(Number(bank?.balance)).toBe(40000);
    });

    it('Step 4.4: Verify Labour head payment restriction & owner confirmation flag', async () => {
      // Attempting to post payment against Labour head must be rejected as pending owner confirmation
      const labourOb = await runAsTenant(async () => {
        return statutoryService.createObligation({
          head: 'LABOUR',
          authority: 'PUNJAB_LABOUR_DEPT',
          taxPeriod: '2026-Q2',
          dueAmount: 45000,
          notes: 'Welfare fund levy - pending confirmation',
        }, testUserId);
      });

      await expect(
        runAsTenant(async () => {
          return statutoryService.recordPayment({
            obligationId: labourOb.id,
            amount: 45000,
            paymentMethod: 'BANK',
            requestKey: `LABOUR-PAY-${Date.now()}`,
          }, testUserId);
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
