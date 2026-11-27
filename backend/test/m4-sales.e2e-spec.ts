import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException, ConflictException } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PostingService } from '../src/modules/finance/services/posting.service';
import { SalesInvoiceService } from '../src/modules/sales/sales-invoice/sales-invoice.service';
import { SalesDispatchService } from '../src/modules/sales/sales-dispatch/sales-dispatch.service';
import { CustomerReceiptService } from '../src/modules/sales/customer-receipt/customer-receipt.service';
import { CustomerStatementService } from '../src/modules/sales/customer-statement/customer-statement.service';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { seedDefaultAccounts } from '../src/modules/finance/account/default-accounts';

describe('Milestone 4 Acceptance Test Suite: Sales, Settlement & AR Reconciliation (Slice D)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let postingService: PostingService;
  let invoiceService: SalesInvoiceService;
  let dispatchService: SalesDispatchService;
  let receiptService: CustomerReceiptService;
  let statementService: CustomerStatementService;
  let tenant: TenantContext;

  let testCompanyId: string;
  let testWarehouseId: string;
  let testItemId: string;
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
    invoiceService = app.get<SalesInvoiceService>(SalesInvoiceService);
    dispatchService = app.get<SalesDispatchService>(SalesDispatchService);
    receiptService = app.get<CustomerReceiptService>(CustomerReceiptService);
    statementService = app.get<CustomerStatementService>(CustomerStatementService);
    tenant = app.get<TenantContext>(TenantContext);

    // Setup isolated test company
    const comp = await prisma.company.create({
      data: {
        name: `Test M4 Textile ${Date.now()}`,
        status: 'ACTIVE',
      },
    });
    testCompanyId = comp.id;

    // Seed chart of accounts
    await seedDefaultAccounts(prisma, testCompanyId, 'SYSTEM');

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `m4admin-${Date.now()}@example.com`,
        password: 'dummyhash',
        role: 'ADMIN',
        companyId: testCompanyId,
      },
    });
    testUserId = user.id;

    // Create warehouse
    const wh = await prisma.warehouse.create({
      data: {
        companyId: testCompanyId,
        name: 'Main Sales Dispatch Depot',
        code: `WH-SLS-${Date.now().toString().slice(-4)}`,
        status: 'ACTIVE',
      },
    });
    testWarehouseId = wh.id;

    // Create item
    const item = await prisma.item.create({
      data: {
        companyId: testCompanyId,
        itemCode: `FABRIC-M4-${Date.now().toString().slice(-4)}`,
        name: 'Premium Finished Fabric Roll',
        currentStock: 0,
        availableStock: 0,
        status: 'ACTIVE',
      },
    });
    testItemId = item.id;

    // Create customer
    const cust = await prisma.customer.create({
      data: {
        companyId: testCompanyId,
        customerCode: `CUST-${Date.now().toString().slice(-4)}`,
        name: 'Al-Rahim Garments & Export Corp',
        taxNumber: 'NTN-3349921-8',
        address: 'Plot 45, SITE Industrial Area, Karachi',
        status: 'ACTIVE',
      },
    });
    testCustomerId = cust.id;

    // Open active accounting period
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const endOfYear = new Date(new Date().getFullYear(), 11, 31);
    await postingService.openAccountingPeriod(
      testCompanyId,
      `FY-${startOfYear.getFullYear()}`,
      startOfYear,
      endOfYear,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('AR-01: Sales Invoicing, Partial Settlement, Eligible Withholding & Full Reversal', () => {
    let invoiceId: string;
    let receiptId: string;
    let invoiceNumber: string;

    it('should create sales invoice of PKR 100,000 (Dr AR PKR 100,000 / Cr Sales Revenue PKR 100,000)', async () => {
      const result = await runAsTenant(async () => {
        return invoiceService.create({
          customerId: testCustomerId,
          invoiceNumber: `INV-AR01-${Date.now().toString().slice(-4)}`,
          items: [
            {
              itemId: testItemId,
              description: 'Finished Fabric Rolls Batch 1',
              quantity: 100,
              unitPrice: 1000, // 100 * 1000 = PKR 100,000
              taxPct: 0, // 0 tax for baseline fixture
            },
          ],
          notes: 'AR-01 Acceptance Test Invoice',
        });
      });

      expect(result.id).toBeDefined();
      expect(result.totalAmount).toBe(100000);
      expect(result.outstandingAmount).toBe(100000);
      expect(result.paidAmount).toBe(0);
      expect(result.withheldAmount).toBe(0);
      expect(result.status).toBe('POSTED');

      invoiceId = result.id;
      invoiceNumber = result.invoiceNumber;

      // Verify GL Accounts Receivable balance is debited by PKR 100,000
      const arAccount = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'ACCOUNTS_RECEIVABLE' } },
      });
      expect(Number(arAccount?.balance)).toBe(100000);

      // Verify GL Sales Revenue balance is credited by PKR 100,000
      const revAccount = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'SALES_REVENUE' } },
      });
      expect(Number(revAccount?.balance)).toBe(100000);
    });

    it('should receive PKR 94,000 cash and document PKR 3,000 withholding, leaving exactly PKR 3,000 outstanding', async () => {
      const receipt = await runAsTenant(async () => {
        return receiptService.create({
          customerId: testCustomerId,
          receiptNumber: `REC-AR01-${Date.now().toString().slice(-4)}`,
          paymentMethod: 'CASH',
          amountReceived: 94000,
          taxWithheld: 3000,
          withholdingCertificate: 'WHT-CERT-2026-FBR-001',
          withholdingSection: 'Section 153(1)(a)',
          notes: 'Partial payment with eligible withholding under FBR Section 153',
          allocations: [
            {
              invoiceId,
              amount: 94000,
              withholding: 3000,
            },
          ],
        });
      });

      expect(receipt.id).toBeDefined();
      expect(receipt.totalSettled).toBe(97000);
      expect(receipt.amountReceived).toBe(94000);
      expect(receipt.taxWithheld).toBe(3000);
      expect(receipt.status).toBe('POSTED');

      receiptId = receipt.id;

      // Verify invoice state: Outstanding must be exactly PKR 3,000 before reversal
      const invAfter = await runAsTenant(async () => invoiceService.findOne(invoiceId));
      expect(invAfter.paidAmount).toBe(94000);
      expect(invAfter.withheldAmount).toBe(3000);
      expect(invAfter.outstandingAmount).toBe(3000);
      expect(invAfter.status).toBe('PARTIALLY_PAID');

      // Verify GL: Cash debited PKR 94,000
      const cashAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'CASH' } },
      });
      expect(Number(cashAcc?.balance)).toBe(94000);

      // Verify GL: Withholding Tax Receivable debited PKR 3,000
      const whtAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'WITHHOLDING_TAX_RECEIVABLE' } },
      });
      expect(Number(whtAcc?.balance)).toBe(3000);

      // Verify GL: Accounts Receivable balance is reduced to PKR 3,000
      const arAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'ACCOUNTS_RECEIVABLE' } },
      });
      expect(Number(arAcc?.balance)).toBe(3000);
    });

    it('should reverse receipt: invoice outstanding restored to PKR 100,000 and withholding account mirrored to 0', async () => {
      const reversed = await runAsTenant(async () => {
        return receiptService.reverse(
          receiptId,
          'Reversal due to incorrect bank allocation and customer withholding review',
        );
      });

      expect(reversed.status).toBe('REVERSED');
      expect(reversed.reversalVoucherNumber).toBeDefined();

      // Verify invoice state: Outstanding must be exactly PKR 100,000 after reversal
      const invReopened = await runAsTenant(async () => invoiceService.findOne(invoiceId));
      expect(invReopened.outstandingAmount).toBe(100000);
      expect(invReopened.paidAmount).toBe(0);
      expect(invReopened.withheldAmount).toBe(0);
      expect(invReopened.status).toBe('POSTED');

      // Verify GL Withholding account mirrored back to 0.00
      const whtAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'WITHHOLDING_TAX_RECEIVABLE' } },
      });
      expect(Number(whtAcc?.balance)).toBe(0);

      // Verify GL Cash balance restored to 0.00
      const cashAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'CASH' } },
      });
      expect(Number(cashAcc?.balance)).toBe(0);

      // Verify GL Accounts Receivable balance restored to full PKR 100,000
      const arAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'ACCOUNTS_RECEIVABLE' } },
      });
      expect(Number(arAcc?.balance)).toBe(100000);
    });
  });

  describe('AR-02: Sales Dispatch, Linked Invoicing, Cheque Lifecycle & Bounced Return', () => {
    let dispatchId: string;
    let invoiceId: string;
    let chequeReceiptId: string;

    beforeAll(async () => {
      // Inward stock via GRN to create FIFO layers: 100 units @ PKR 150 = PKR 15,000
      await postingService.postGoodsReceipt({
        requestKey: `GRN-SEED-M4-${Date.now()}`,
        grnNumber: `GRN-M4-01`,
        warehouseId: testWarehouseId,
        companyId: testCompanyId,
        vendorName: 'Textile Chemical & Yarns Ltd',
        items: [{ itemId: testItemId, quantity: 100, unitCost: 150 }],
      });
    });

    it('should create sales dispatch: FIFO issue posts Dr COGS / Cr Inventory and exactly ONE stock deduction', async () => {
      const stockBefore = await prisma.warehouseStock.findUnique({
        where: { warehouseId_itemId: { warehouseId: testWarehouseId, itemId: testItemId } },
      });
      expect(stockBefore?.quantity).toBe(100);

      const dispatch = await runAsTenant(async () => {
        return dispatchService.create({
          customerId: testCustomerId,
          warehouseId: testWarehouseId,
          dispatchNumber: `DSP-AR02-${Date.now().toString().slice(-4)}`,
          items: [{ itemId: testItemId, quantity: 40 }],
          notes: 'AR-02 Dispatch 40 units',
        });
      });

      expect(dispatch.id).toBeDefined();
      expect(dispatch.status).toBe('DISPATCHED');
      // FIFO cost: 40 units * PKR 150 = PKR 6,000
      expect(dispatch.totalCost).toBe(6000);

      dispatchId = dispatch.id;

      // Verify stock was deducted exactly once
      const stockAfter = await prisma.warehouseStock.findUnique({
        where: { warehouseId_itemId: { warehouseId: testWarehouseId, itemId: testItemId } },
      });
      expect(stockAfter?.quantity).toBe(60);

      // Verify COGS account debited PKR 6,000
      const cogsAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'COGS' } },
      });
      expect(Number(cogsAcc?.balance)).toBe(6000);
    });

    it('should create linked invoice without duplicating stock deduction', async () => {
      const invoice = await runAsTenant(async () => {
        return invoiceService.create({
          customerId: testCustomerId,
          dispatchId,
          invoiceNumber: `INV-DSP-${Date.now().toString().slice(-4)}`,
          items: [
            {
              itemId: testItemId,
              description: 'Dispatched Goods Billed',
              quantity: 40,
              unitPrice: 250, // 40 * 250 = PKR 10,000
              taxPct: 0,
            },
          ],
          notes: 'Invoice linked to dispatch DSP-AR02',
        });
      });

      expect(invoice.id).toBeDefined();
      expect(invoice.totalAmount).toBe(10000);
      expect(invoice.dispatchId).toBe(dispatchId);

      invoiceId = invoice.id;

      // Verify stock was NOT deducted again (still 60)
      const stockCheck = await prisma.warehouseStock.findUnique({
        where: { warehouseId_itemId: { warehouseId: testWarehouseId, itemId: testItemId } },
      });
      expect(stockCheck?.quantity).toBe(60);
    });

    it('should record cheque receipt in PENDING_CLEARANCE (Dr UNCLEARED_CHEQUES / Cr AR)', async () => {
      const receipt = await runAsTenant(async () => {
        return receiptService.create({
          customerId: testCustomerId,
          receiptNumber: `REC-CHQ-${Date.now().toString().slice(-4)}`,
          paymentMethod: 'CHEQUE',
          amountReceived: 10000,
          chequeNumber: 'CHQ-990881',
          chequeDate: new Date(),
          chequeBank: 'Habib Bank Limited (HBL)',
          notes: 'Cheque received pending deposit',
          allocations: [{ invoiceId, amount: 10000, withholding: 0 }],
        });
      });

      expect(receipt.chequeStatus).toBe('PENDING_CLEARANCE');
      expect(receipt.amountReceived).toBe(10000);

      chequeReceiptId = receipt.id;

      // Invoice marked PAID
      const inv = await runAsTenant(async () => invoiceService.findOne(invoiceId));
      expect(inv.outstandingAmount).toBe(0);
      expect(inv.status).toBe('PAID');

      // Verify Uncleared Cheques debited
      const chqAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'UNCLEARED_CHEQUES' } },
      });
      expect(Number(chqAcc?.balance)).toBe(10000);
    });

    it('should clear cheque: transfers funds Dr BANK / Cr UNCLEARED_CHEQUES', async () => {
      const cleared = await runAsTenant(async () => {
        return receiptService.clearCheque(chequeReceiptId);
      });

      expect(cleared.chequeStatus).toBe('CLEARED');
      expect(cleared.clearanceVoucherNumber).toBeDefined();

      // Uncleared cheques account cleared to 0
      const chqAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'UNCLEARED_CHEQUES' } },
      });
      expect(Number(chqAcc?.balance)).toBe(0);

      // Bank account debited PKR 10,000
      const bankAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'BANK' } },
      });
      expect(Number(bankAcc?.balance)).toBe(10000);
    });

    it('should test cheque bounce/return on independent fixture: re-opens invoice balance and preserves audit trail', async () => {
      // 1. Create fresh independent invoice of PKR 25,000
      const bounceInvoice = await runAsTenant(async () => {
        return invoiceService.create({
          customerId: testCustomerId,
          invoiceNumber: `INV-BOUNCE-${Date.now().toString().slice(-4)}`,
          items: [{ itemId: testItemId, quantity: 25, unitPrice: 1000, taxPct: 0 }],
          notes: 'Cheque bounce test fixture',
        });
      });
      expect(bounceInvoice.outstandingAmount).toBe(25000);

      // 2. Pay via Cheque
      const bounceReceipt = await runAsTenant(async () => {
        return receiptService.create({
          customerId: testCustomerId,
          receiptNumber: `REC-BOUNCE-${Date.now().toString().slice(-4)}`,
          paymentMethod: 'CHEQUE',
          amountReceived: 25000,
          chequeNumber: 'CHQ-BOUNCE-77',
          chequeBank: 'Meezan Bank Ltd',
          allocations: [{ invoiceId: bounceInvoice.id, amount: 25000 }],
        });
      });
      expect(bounceReceipt.chequeStatus).toBe('PENDING_CLEARANCE');

      // Verify invoice settled
      const settledInv = await runAsTenant(async () => invoiceService.findOne(bounceInvoice.id));
      expect(settledInv.outstandingAmount).toBe(0);
      expect(settledInv.status).toBe('PAID');

      // 3. Process Cheque Return (bounced cheque)
      const returnedResult = await runAsTenant(async () => {
        return receiptService.returnCheque(
          bounceReceipt.id,
          'Cheque returned by bank: Insufficient funds (Drawer signature mismatch)',
        );
      });

      expect(returnedResult.chequeStatus).toBe('RETURNED');
      expect(returnedResult.status).toBe('REVERSED');
      expect(returnedResult.reversalVoucherNumber).toBeDefined();

      // 4. Verify Invoice outstanding is re-opened back to full PKR 25,000
      const reopenedInv = await runAsTenant(async () => invoiceService.findOne(bounceInvoice.id));
      expect(reopenedInv.outstandingAmount).toBe(25000);
      expect(reopenedInv.paidAmount).toBe(0);
      expect(reopenedInv.status).toBe('POSTED');

      // 5. Verify Uncleared Cheques balance returned to 0
      const chqAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'UNCLEARED_CHEQUES' } },
      });
      expect(Number(chqAcc?.balance)).toBe(0);
    });
  });

  describe('Customer Statement & AR Aging Reconciliation', () => {
    it('should generate customer statement reconciling 100% with open invoices and GL AR balance', async () => {
      const statement = await runAsTenant(async () => {
        return statementService.getCustomerStatement(testCustomerId);
      });

      expect(statement.customer.id).toBe(testCustomerId);
      expect(statement.entries.length).toBeGreaterThan(0);
      expect(statement.isReconciled).toBe(true);
      expect(statement.closingBalance).toBe(statement.openInvoicesOutstanding);

      // Verify that closing balance ties out to open invoices
      // Open invoices:
      // Invoice 1 (INV-AR01): PKR 100,000 (reopened after reversal)
      // Invoice 2 (INV-DSP): PKR 0 (paid via cleared cheque)
      // Invoice 3 (INV-BOUNCE): PKR 25,000 (reopened after cheque return)
      // Total open = PKR 125,000
      expect(statement.closingBalance).toBe(125000);

      // Reconcile with GL AR account
      const arAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'ACCOUNTS_RECEIVABLE' } },
      });
      expect(Number(arAcc?.balance)).toBe(125000);
    });

    it('should generate AR Aging report tying out to GL with PKR 0.00 variance', async () => {
      const aging = await runAsTenant(async () => {
        return statementService.getArAging();
      });

      expect(aging.isGlReconciled).toBe(true);
      expect(aging.variance).toBe(0);
      expect(aging.grandTotalOutstanding).toBe(125000);
      expect(aging.glArBalance).toBe(125000);
      expect(aging.totalCurrent).toBe(125000); // Created today
    });
  });

  describe('Idempotency & Concurrency Protections', () => {
    it('should return cached result on identical duplicate sales invoice submission', async () => {
      const reqKey = `IDEMP-INV-${Date.now()}`;
      const invNumber = `INV-IDEMP-${Date.now().toString().slice(-4)}`;

      const first = await postingService.postSalesInvoice({
        requestKey: reqKey,
        invoiceNumber: invNumber,
        companyId: testCompanyId,
        grossAmount: 50000,
        netAmount: 50000,
        taxAmount: 0,
      });

      expect(first.replayed).toBe(false);

      const second = await postingService.postSalesInvoice({
        requestKey: reqKey,
        invoiceNumber: invNumber,
        companyId: testCompanyId,
        grossAmount: 50000,
        netAmount: 50000,
        taxAmount: 0,
      });

      expect(second.replayed).toBe(true);
      expect(second.voucherId).toBe(first.voucherId);
    });

    it('should reject same request key with altered payload with 409 Conflict', async () => {
      const reqKey = `IDEMP-CONF-${Date.now()}`;
      const invNumber = `INV-CONF-${Date.now().toString().slice(-4)}`;

      await postingService.postSalesInvoice({
        requestKey: reqKey,
        invoiceNumber: invNumber,
        companyId: testCompanyId,
        grossAmount: 40000,
        netAmount: 40000,
      });

      await expect(
        postingService.postSalesInvoice({
          requestKey: reqKey,
          invoiceNumber: invNumber,
          companyId: testCompanyId,
          grossAmount: 45000, // altered amount!
          netAmount: 45000,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
