const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));

const client = new Client({
  host: '127.0.0.1',
  port: 5433,
  user: 'postgres',
  password: '1YKVdCM2Fq2zZSoC80gWnd35lIzbJA1G',
  database: 'textile_erp'
});

async function run() {
  await client.connect();

  const tables = [
    'companies', 'users', 'customers', 'vendors', 'items',
    'demand_notes', 'demand_note_items',
    'purchase_orders', 'purchase_order_items',
    'goods_receiving_notes', 'goods_receiving_items',
    'material_issues', 'material_issue_items',
    'sales_orders', 'sales_invoices', 'sales_invoice_items', 'customer_receipts',
    'supplier_bills', 'supplier_bill_items', 'vendor_payments',
    'vouchers', 'voucher_lines', 'general_ledger',
    'salary_slips', 'daily_wage_payments', 'expenses'
  ];

  const counts = {};
  for (const t of tables) {
    try {
      const res = await client.query(`SELECT count(*)::int as count FROM "${t}"`);
      counts[t] = res.rows[0].count;
    } catch (e) {
      counts[t] = `ERROR: ${e.message}`;
    }
  }

  console.log('ACTIVE CLUSTER RECORD COUNTS:');
  console.table(counts);

  // Check some vouchers and ledger balances
  const vouchers = await client.query(`SELECT id, "voucherNumber", "voucherType", amount, "isPosted" FROM vouchers LIMIT 10`);
  console.log('SAMPLE VOUCHERS:', vouchers.rows);

  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
