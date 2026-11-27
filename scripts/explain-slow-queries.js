const { Client } = require('../backend/node_modules/pg');

async function testExplains() {
  const client = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5433/textile_erp_test'
  });
  await client.connect();

  const userRes = await client.query('SELECT "companyId" FROM users WHERE email = $1', ['admin@industrialerp.local']);
  const companyId = userRes.rows[0].companyId;
  const itemRes = await client.query('SELECT id FROM items WHERE "companyId" = $1 LIMIT 1', [companyId]);
  const sampleItemId = itemRes.rows[0].id;
  const accountRes = await client.query('SELECT id FROM accounts WHERE "companyId" = $1 LIMIT 1', [companyId]);
  const sampleAccountId = accountRes.rows[0].id;

  console.log('=== QUERY 1: Stock ledger range query for an item (Stock Register / Item Card) ===');
  const q1 = `
    EXPLAIN ANALYZE 
    SELECT * FROM stock_ledger 
    WHERE "companyId" = '${companyId}' 
      AND "itemId" = '${sampleItemId}' 
      AND "createdAt" >= '2026-06-01' 
      AND "createdAt" <= '2026-11-20' 
    ORDER BY "createdAt" ASC;
  `;
  const res1 = await client.query(q1);
  console.log(res1.rows.map(r => r['QUERY PLAN']).join('\n'));

  console.log('\n=== QUERY 2: Stock ledger aggregated opening balances for all items ===');
  const q2 = `
    EXPLAIN ANALYZE 
    SELECT "itemId", SUM("qtyChange") as qty, SUM(COALESCE("costChange", 0)) as cost 
    FROM stock_ledger 
    WHERE "companyId" = '${companyId}' 
      AND "createdAt" < '2026-11-01' 
    GROUP BY "itemId";
  `;
  const res2 = await client.query(q2);
  console.log(res2.rows.map(r => r['QUERY PLAN']).join('\n'));

  console.log('\n=== QUERY 3: General Ledger Account query on journal_entry_items ===');
  const q3 = `
    EXPLAIN ANALYZE 
    SELECT jei.*, je."entryNumber", je."entryDate"
    FROM journal_entry_items jei
    JOIN journal_entries je ON jei."journalEntryId" = je.id
    WHERE je."companyId" = '${companyId}'
      AND jei."accountId" = '${sampleAccountId}'
      AND je."entryDate" >= '2026-01-01'
    ORDER BY je."entryDate" DESC
    LIMIT 100;
  `;
  const res3 = await client.query(q3);
  console.log(res3.rows.map(r => r['QUERY PLAN']).join('\n'));

  console.log('\n=== QUERY 4: Vouchers by date range ===');
  const q4 = `
    EXPLAIN ANALYZE
    SELECT * FROM vouchers
    WHERE "companyId" = '${companyId}'
      AND "businessDate" >= '2026-09-01'
      AND "businessDate" <= '2026-11-20'
    ORDER BY "businessDate" DESC
    LIMIT 100;
  `;
  const res4 = await client.query(q4);
  console.log(res4.rows.map(r => r['QUERY PLAN']).join('\n'));

  await client.end();
}

testExplains().catch(console.error);
