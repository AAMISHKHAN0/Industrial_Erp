const { Client } = require('../backend/node_modules/pg');

async function getFinalStats() {
  const client = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5433/textile_erp_test'
  });
  await client.connect();

  const userRes = await client.query('SELECT "companyId" FROM users WHERE email = $1', ['admin@industrialerp.local']);
  const companyId = userRes.rows[0].companyId;

  const counts = await client.query(`
    SELECT 
      (SELECT count(*) FROM items) as total_items,
      (SELECT count(*) FROM items WHERE "companyId" = $1) as company_items,
      (SELECT count(*) FROM vouchers) as total_vouchers,
      (SELECT count(*) FROM vouchers WHERE "companyId" = $1) as company_vouchers,
      (SELECT count(*) FROM journal_entries) as total_journal_entries,
      (SELECT count(*) FROM journal_entry_items) as total_journal_items,
      (SELECT count(*) FROM stock_ledger) as total_stock_ledger,
      (SELECT count(*) FROM stock_ledger WHERE "companyId" = $1) as company_stock_ledger
  `, [companyId]);

  const dbSize = await client.query("SELECT pg_database_size('textile_erp_test') as bytes, pg_size_pretty(pg_database_size('textile_erp_test')) as pretty");

  const tableSizes = await client.query(`
    SELECT relname, pg_size_pretty(pg_total_relation_size(c.oid)) as pretty, pg_total_relation_size(c.oid) as bytes
    FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE relkind = 'r' AND nspname = 'public' 
    ORDER BY pg_total_relation_size(c.oid) DESC 
    LIMIT 6;
  `);

  console.log('Record Counts:');
  console.table(counts.rows[0]);

  console.log('\nDatabase Size on Disk:');
  console.log(dbSize.rows[0]);

  console.log('\nTop Table Sizes (data + indices):');
  console.table(tableSizes.rows);

  await client.end();
}

getFinalStats().catch(console.error);
