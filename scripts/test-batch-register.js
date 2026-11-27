const { Client } = require('../backend/node_modules/pg');

async function testBatchRegister() {
  const client = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5433/textile_erp_test'
  });
  await client.connect();

  const userRes = await client.query('SELECT "companyId" FROM users WHERE email = $1', ['admin@industrialerp.local']);
  const companyId = userRes.rows[0].companyId;
  const start = '2026-11-01 00:00:00';
  const end = '2026-11-21 23:59:59.999';

  console.log('Testing batch aggregation queries for stock register...');
  const t0 = performance.now();

  const priorRes = await client.query(`
    SELECT "itemId", 
           COALESCE(SUM("qtyChange"), 0)::float as "openingQty",
           ROUND(COALESCE(SUM("costChange"), 0)::numeric, 2)::float as "openingValue"
    FROM stock_ledger
    WHERE "companyId" = $1 AND "createdAt" < $2
    GROUP BY "itemId"
  `, [companyId, start]);
  console.log(`Prior totals fetched: ${priorRes.rows.length} rows in ${(performance.now() - t0).toFixed(2)} ms`);

  const t1 = performance.now();
  const periodRes = await client.query(`
    SELECT "itemId",
           COALESCE(SUM(CASE WHEN "qtyChange" > 0 THEN "qtyChange" ELSE 0 END), 0)::float as "inwardQty",
           ROUND(COALESCE(SUM(CASE WHEN "qtyChange" > 0 THEN "costChange" ELSE 0 END), 0)::numeric, 2)::float as "inwardValue",
           COALESCE(SUM(CASE WHEN "qtyChange" < 0 THEN ABS("qtyChange") ELSE 0 END), 0)::float as "outwardQty",
           ROUND(COALESCE(SUM(CASE WHEN "qtyChange" < 0 THEN ABS("costChange") ELSE 0 END), 0)::numeric, 2)::float as "outwardValue"
    FROM stock_ledger
    WHERE "companyId" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3
    GROUP BY "itemId"
  `, [companyId, start, end]);
  console.log(`Period movements fetched: ${periodRes.rows.length} rows in ${(performance.now() - t1).toFixed(2)} ms`);

  const t2 = performance.now();
  const fifoRes = await client.query(`
    SELECT "itemId",
           ROUND(COALESCE(SUM("remainingQty" * "unitCost"), 0)::numeric, 2)::float as "layerValuation"
    FROM fifo_layers
    WHERE "companyId" = $1 AND status = 'OPEN' AND "remainingQty" > 0
    GROUP BY "itemId"
  `, [companyId]);
  console.log(`FIFO layers fetched: ${fifoRes.rows.length} rows in ${(performance.now() - t2).toFixed(2)} ms`);

  const totalTime = performance.now() - t0;
  console.log(`Total time for all 10,000 items: ${totalTime.toFixed(2)} ms!`);

  await client.end();
}

testBatchRegister().catch(console.error);
