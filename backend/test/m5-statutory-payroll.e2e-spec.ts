import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException, ConflictException } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PostingService } from '../src/modules/finance/services/posting.service';
import { StatutoryService } from '../src/modules/finance/statutory/statutory.service';
import { WageService } from '../src/modules/hr/wages/wage.service';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { seedDefaultAccounts } from '../src/modules/finance/account/default-accounts';

describe('Milestone 5 Acceptance Test Suite: Statutory Payments, Payroll & Daily Wages (Slice E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let postingService: PostingService;
  let statutoryService: StatutoryService;
  let wageService: WageService;
  let tenant: TenantContext;

  let testCompanyId: string;
  let testUserId: string;
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
    statutoryService = app.get<StatutoryService>(StatutoryService);
    wageService = app.get<WageService>(WageService);
    tenant = app.get<TenantContext>(TenantContext);

    // Setup isolated test company
    const comp = await prisma.company.create({
      data: {
        name: `Test M5 Textile ${Date.now()}`,
        status: 'ACTIVE',
      },
    });
    testCompanyId = comp.id;

    // Seed chart of accounts
    await seedDefaultAccounts(prisma, testCompanyId, 'SYSTEM');

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `m5admin-${Date.now()}@example.com`,
        password: 'dummyhash',
        role: 'ADMIN',
        companyId: testCompanyId,
      },
    });
    testUserId = user.id;

    // Create test employee
    const emp = await prisma.employee.create({
      data: {
        companyId: testCompanyId,
        employeeCode: `EMP-M5-${Date.now().toString().slice(-4)}`,
        firstName: 'Muhammad',
        lastName: 'Usman',
        email: `usman-${Date.now()}@textile.local`,
        status: 'ACTIVE',
      },
    });
    testEmployeeId = emp.id;

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

  describe('TAX-01: Approved Statutory Payable, Partial Remittance, Duplicate Protection & Pending Labour', () => {
    let salesTaxObligationId: string;
    let labourObligationId: string;
    const paymentReqKey = `STAT-REQ-${Date.now()}`;

    it('should create approved statutory payable of PKR 20,000 for Sales Tax', async () => {
      const obligation = await runAsTenant(async () => {
        return statutoryService.createObligation({
          head: 'SALES_TAX',
          authority: 'FBR',
          registrationNumber: 'STRN-0701980001',
          taxPeriod: '2026-03',
          dueAmount: 20000,
          assessmentReference: 'FBR-E-ASSESS-90021',
          challanNumber: 'CH-2026-FBR-009',
          psid: 'PSID-99081234',
          notes: 'March 2026 Sales Tax Return Liability',
        });
      });

      expect(obligation.id).toBeDefined();
      expect(obligation.head).toBe('SALES_TAX');
      expect(obligation.authority).toBe('FBR');
      expect(obligation.dueAmount).toBe(20000);
      expect(obligation.paidAmount).toBe(0);
      expect(obligation.outstandingAmount).toBe(20000);
      expect(obligation.status).toBe('APPROVED');

      salesTaxObligationId = obligation.id;
    });

    it('should record payment of PKR 12,000 with evidence: part-paid and outstanding PKR 8,000', async () => {
      const payment = await runAsTenant(async () => {
        return statutoryService.recordPayment({
          obligationId: salesTaxObligationId,
          amount: 12000,
          paymentMethod: 'BANK',
          cprNumber: 'CPR-2026-FBR-7718',
          psid: 'PSID-99081234',
          bankReference: 'HBL-FT-8899120',
          evidenceUrl: '/evidence/cpr-march-2026.pdf',
          requestKey: paymentReqKey,
          notes: 'Part-payment of Sales Tax against CPR 7718',
        });
      });

      expect(payment.id).toBeDefined();
      expect(payment.amount).toBe(12000);
      expect(payment.cprNumber).toBe('CPR-2026-FBR-7718');
      expect(payment.evidenceStatus).toBe('VERIFIED');
      expect(payment.replayed).toBe(false);

      // Verify obligation: Part-paid and outstanding PKR 8,000
      const obAfter = await runAsTenant(async () => statutoryService.findOne(salesTaxObligationId));
      expect(obAfter.paidAmount).toBe(12000);
      expect(obAfter.outstandingAmount).toBe(8000);
      expect(obAfter.status).toBe('PART_PAID');

      // Verify GL postings: One correct debit to SALES_TAX_PAYABLE and one bank credit
      const taxPayableAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'SALES_TAX_PAYABLE' } },
      });
      // In GL, debiting a liability decrements its credit balance by PKR 12,000
      expect(Number(taxPayableAcc?.balance)).toBe(-12000);

      const bankAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'BANK' } },
      });
      // Crediting an asset decrements its debit balance by PKR 12,000
      expect(Number(bankAcc?.balance)).toBe(-12000);
    });

    it('should handle repeat identical submission: returns cached result and outstanding remains PKR 8,000', async () => {
      const duplicateSubmission = await runAsTenant(async () => {
        return statutoryService.recordPayment({
          obligationId: salesTaxObligationId,
          amount: 12000,
          paymentMethod: 'BANK',
          cprNumber: 'CPR-2026-FBR-7718',
          psid: 'PSID-99081234',
          requestKey: paymentReqKey, // identical request key
        });
      });

      expect(duplicateSubmission.replayed).toBe(true);

      // Verify obligation was NOT decremented again: outstanding remains PKR 8,000
      const obAfter = await runAsTenant(async () => statutoryService.findOne(salesTaxObligationId));
      expect(obAfter.paidAmount).toBe(12000);
      expect(obAfter.outstandingAmount).toBe(8000);
      expect(obAfter.status).toBe('PART_PAID');

      // Verify GL accounts were not debited twice
      const taxPayableAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'SALES_TAX_PAYABLE' } },
      });
      expect(Number(taxPayableAcc?.balance)).toBe(-12000);
    });

    it('should verify complete statutory audit trail in register', async () => {
      const register = await runAsTenant(async () => {
        return statutoryService.getRegister({ head: 'SALES_TAX' });
      });

      expect(register.length).toBeGreaterThan(0);
      const entry = register.find((r) => r.id === salesTaxObligationId);
      expect(entry).toBeDefined();
      expect(entry?.head).toBe('SALES_TAX');
      expect(entry?.authority).toBe('FBR');
      expect(entry?.payments.length).toBe(1);
      expect(entry?.payments[0].cprNumber).toBe('CPR-2026-FBR-7718');
      expect(entry?.payments[0].voucherId).toBeDefined();
    });

    it('should strictly reject payment against Labour head: Pending Labour cannot post', async () => {
      // Create Labour obligation
      const labourObligation = await runAsTenant(async () => {
        return statutoryService.createObligation({
          head: 'LABOUR',
          authority: 'PUNJAB_LABOUR_DEPT',
          taxPeriod: '2026-Q1',
          dueAmount: 50000,
          notes: 'Pending classification: direct vs indirect labour welfare challan',
        });
      });

      labourObligationId = labourObligation.id;

      // Attempting to post payment against Labour MUST fail per owner decision
      await expect(
        runAsTenant(async () => {
          return statutoryService.recordPayment({
            obligationId: labourObligationId,
            amount: 50000,
            paymentMethod: 'BANK',
          });
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('HR-01: Daily Wages Half-Day Fixture, Duplicate Accrual Guard & Clean Disbursement', () => {
    let wageRunId: string;

    it('should accrue wages: PKR 2,000 × 5.5 approved days = PKR 11,000 (Dr Wage Expense / Cr Wage Payable)', async () => {
      const wageRun = await runAsTenant(async () => {
        return wageService.createWageRun({
          periodYear: 2026,
          periodMonth: 5,
          runType: 'DAILY_WAGE',
          notes: 'HR-01 Acceptance Fixture: 5.5 Days at PKR 2,000/day',
          lines: [
            {
              employeeId: testEmployeeId,
              daysWorked: 5.5, // 5.5 approved days
              dailyRate: 2000, // PKR 2,000 per day
              deductions: 0,
            },
          ],
        });
      });

      expect(wageRun.id).toBeDefined();
      expect(wageRun.status).toBe('ACCRUED');
      expect(wageRun.totalAmount).toBe(11000);
      expect(wageRun.lines[0].grossAmount).toBe(11000);
      expect(wageRun.lines[0].netAmount).toBe(11000);

      wageRunId = wageRun.id;

      // Verify GL: Wage Expense debited PKR 11,000
      const expAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'WAGE_EXPENSE' } },
      });
      expect(Number(expAcc?.balance)).toBe(11000);

      // Verify GL: Wage Payable credited PKR 11,000
      const payAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'WAGE_PAYABLE' } },
      });
      expect(Number(payAcc?.balance)).toBe(11000);
    });

    it('should reject duplicate salary/wage run for the same period and type with ConflictException', async () => {
      await expect(
        runAsTenant(async () => {
          return wageService.createWageRun({
            periodYear: 2026,
            periodMonth: 5, // same period!
            runType: 'DAILY_WAGE', // same run type!
            lines: [
              {
                employeeId: testEmployeeId,
                daysWorked: 5.5,
                dailyRate: 2000,
              },
            ],
          });
        }),
      ).rejects.toThrow(ConflictException);

      // Verify Wage Expense was not doubled
      const expAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'WAGE_EXPENSE' } },
      });
      expect(Number(expAcc?.balance)).toBe(11000);
    });

    it('should disburse wages: clears employee payable without duplicate wage expense', async () => {
      const disbursed = await runAsTenant(async () => {
        return wageService.disburseWageRun(wageRunId, {
          paymentMethod: 'BANK',
          notes: 'Bank transfer disbursement for May 2026 daily wages',
        });
      });

      expect(disbursed.status).toBe('DISBURSED');
      expect(disbursed.disbursementVoucherNumber).toBeDefined();

      // Verify Wage Payable is completely cleared to PKR 0.00
      const payAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'WAGE_PAYABLE' } },
      });
      expect(Number(payAcc?.balance)).toBe(0);

      // Verify Wage Expense remains exactly PKR 11,000 (ZERO duplicate expense)
      const expAcc = await prisma.account.findUnique({
        where: { companyId_accountCode: { companyId: testCompanyId, accountCode: 'WAGE_EXPENSE' } },
      });
      expect(Number(expAcc?.balance)).toBe(11000);
    });

    it('should reject duplicate disbursement of already disbursed run', async () => {
      await expect(
        runAsTenant(async () => {
          return wageService.disburseWageRun(wageRunId, { paymentMethod: 'BANK' });
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
