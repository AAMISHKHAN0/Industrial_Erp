const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));

const client = new Client({
  connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test'
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
    'vouchers', 'voucher_lines', 'general_ledger'
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

  console.log('DEV DB (textile_erp_test:5432) RECORD COUNTS:');
  console.table(counts);

  // Check database list
  const dbs = await client.query(`SELECT datname FROM pg_database WHERE datistemplate = false`);
  console.log('DATABASES ON 5432:', dbs.rows.map(r => r.datname));

  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
