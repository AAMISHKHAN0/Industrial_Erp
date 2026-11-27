import { AccountType } from '@prisma/client';

/** Standard chart-of-accounts codes used by the finance integrations.
 *  If an account with one of these codes is missing, it is auto-created
 *  (scoped to the company) with the correct type so journal entries never fail. */
export const SYSTEM_ACCOUNTS: Record<
  string,
  { type: AccountType; name: string }
> = {
  INVENTORY: { type: 'ASSET', name: 'Inventory' },
  ACCOUNTS_PAYABLE: { type: 'LIABILITY', name: 'Accounts Payable' },
  ACCOUNTS_RECEIVABLE: { type: 'ASSET', name: 'Accounts Receivable' },
  SALES_REVENUE: { type: 'INCOME', name: 'Sales Revenue' },
  SALARY_EXPENSE: { type: 'EXPENSE', name: 'Salary Expense' },
  SALARY_PAYABLE: { type: 'LIABILITY', name: 'Salary Payable' },
  CASH: { type: 'ASSET', name: 'Cash' },
  BANK: { type: 'ASSET', name: 'Bank' },
  GRNI: { type: 'LIABILITY', name: 'Goods Received Not Invoiced' },
  COGS: { type: 'EXPENSE', name: 'Cost of Goods Sold' },
  SALES_TAX_PAYABLE: { type: 'LIABILITY', name: 'Sales Tax Payable' },
  INPUT_TAX_RECEIVABLE: { type: 'ASSET', name: 'Input Tax Receivable' },
  PAYROLL_DEDUCTIONS: { type: 'LIABILITY', name: 'Payroll Deductions Payable' },
  DEPARTMENT_EXPENSE: { type: 'EXPENSE', name: 'Department Expense' },
  WIP: { type: 'ASSET', name: 'Work in Progress' },
  WITHHOLDING_TAX_RECEIVABLE: { type: 'ASSET', name: 'Withholding Tax Receivable' },
  UNCLEARED_CHEQUES: { type: 'ASSET', name: 'Uncleared Cheques' },
  STATUTORY_PAYABLE: { type: 'LIABILITY', name: 'Statutory Payable' },
  INCOME_TAX_PAYABLE: { type: 'LIABILITY', name: 'Income Tax Payable' },
  PESSI_PAYABLE: { type: 'LIABILITY', name: 'PESSI Payable' },
  PROFESSIONAL_TAX_PAYABLE: { type: 'LIABILITY', name: 'Professional Tax Payable' },
  WAGE_EXPENSE: { type: 'EXPENSE', name: 'Wage Expense' },
  WAGE_PAYABLE: { type: 'LIABILITY', name: 'Wage Payable' },
  UTILITY_EXPENSE: { type: 'EXPENSE', name: 'Utility Expense' },
  SUNDRY_EXPENSE: { type: 'EXPENSE', name: 'Sundry Expense' },
  FIXED_ASSETS: { type: 'ASSET', name: 'Fixed Assets' },
};

/** Idempotently seed the standard accounts for a company. */
export async function seedDefaultAccounts(
  prisma: { account: { upsert: (args: any) => Promise<any> } },
  companyId: string,
  createdBy?: string,
) {
  for (const [code, def] of Object.entries(SYSTEM_ACCOUNTS)) {
    await prisma.account.upsert({
      where: { companyId_accountCode: { companyId, accountCode: code } },
      update: {},
      create: {
        companyId,
        accountCode: code,
        name: def.name,
        type: def.type,
        isActive: true,
        balance: 0,
        createdBy,
      },
    });
  }
}
