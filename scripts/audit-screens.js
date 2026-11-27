const fs = require('fs');

const screens = [
  { name: 'Customers', path: 'frontend/src/app/(dashboard)/customers/page.tsx', api: '/api/v1/customers', model: 'Customer' },
  { name: 'Vendors', path: 'frontend/src/app/(dashboard)/vendors/page.tsx', altPath: 'frontend/src/app/(dashboard)/purchase/vendors/page.tsx', api: '/api/v1/vendors', model: 'Vendor' },
  { name: 'Items', path: 'frontend/src/app/(dashboard)/inventory/items/page.tsx', api: '/api/v1/items', model: 'Item' },
  { name: 'Material Inward (GRN)', path: 'frontend/src/app/(dashboard)/purchase/goods-receiving/page.tsx', api: '/api/v1/goods-receiving', model: 'GoodsReceivingNote' },
  { name: 'Material Issue (MIN)', path: 'frontend/src/app/(dashboard)/inventory/material-issue/page.tsx', api: '/api/v1/material-issue', model: 'MaterialIssue' },
  { name: 'Stock Register', path: 'frontend/src/app/(dashboard)/inventory/stock-ledger/page.tsx', api: '/api/v1/inventory/stock-ledger', model: 'StockLedger' },
  { name: 'Sales Invoices', path: 'frontend/src/app/(dashboard)/sales/invoices/page.tsx', api: '/api/v1/sales/invoices', model: 'SalesInvoice' },
  { name: 'Customer Receipts', path: 'frontend/src/app/(dashboard)/sales/receipts/page.tsx', api: '/api/v1/sales/receipts', model: 'CustomerReceipt' },
  { name: 'Monthly Salaries', path: 'frontend/src/app/(dashboard)/hr/payroll/page.tsx', api: '/api/v1/payroll', model: 'Payroll' },
  { name: 'Daily Wages', path: 'frontend/src/app/(dashboard)/hr/wages/page.tsx', api: '/api/v1/hr/wages', model: 'WageRun' },
  { name: 'Sundry Expenses', path: 'frontend/src/app/(dashboard)/finance/expenses/page.tsx', api: '/api/v1/expenses', model: 'Expense' },
  { name: 'Payments', path: 'frontend/src/app/(dashboard)/finance/payments/page.tsx', api: '/api/v1/finance/payments', model: 'Payment' },
  { name: 'Ledgers', path: 'frontend/src/app/(dashboard)/finance/ledgers/page.tsx', api: '/api/v1/finance/ledgers', model: 'GeneralLedger' }
];

for (const s of screens) {
  const p = fs.existsSync(s.path) ? s.path : (s.altPath && fs.existsSync(s.altPath) ? s.altPath : null);
  if (!p) {
    console.log(`=== ${s.name}: NOT FOUND ===`);
    continue;
  }
  const content = fs.readFileSync(p, 'utf8');
  console.log(`=== ${s.name} (${p}) ===`);
  // Find state variables or form fields
  const stateMatches = content.match(/const\s+\[(\w+),\s*set\w+\]\s*=\s*useState/g) || [];
  console.log('States:', stateMatches.map(m => m.replace(/const\s+\[(\w+).*/, '$1')).join(', '));
  // Find form inputs
  const lines = content.split('\n');
  const formFields = [];
  lines.forEach((line, idx) => {
    if (line.includes('<label') || line.includes('placeholder=') || line.includes('name=')) {
      formFields.push(`L${idx+1}: ${line.trim().slice(0, 80)}`);
    }
  });
  console.log('Labels/Inputs Sample (first 10):');
  console.log(formFields.slice(0, 10).join('\n'));
}
