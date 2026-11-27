const { Client } = require('../backend/node_modules/pg');

async function checkDbSize() {
  const client = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5433/textile_erp_test'
  });
  await client.connect();
  const dbRes = await client.query("SELECT pg_database_size('textile_erp_test') as bytes, pg_size_pretty(pg_database_size('textile_erp_test')) as pretty");
  console.log('Database size on disk:', dbRes.rows[0]);

  const tblRes = await client.query(`
    SELECT relname, pg_size_pretty(pg_total_relation_size(c.oid)) as pretty, pg_total_relation_size(c.oid) as bytes
    FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE relkind = 'r' AND nspname = 'public' 
    ORDER BY pg_total_relation_size(c.oid) DESC 
    LIMIT 10;
  `);
  console.log('Top tables by size:');
  console.table(tblRes.rows);
  await client.end();
}

checkDbSize().catch(console.error);
