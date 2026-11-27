const { Client } = require('../backend/node_modules/pg');

async function main() {
  for (const port of [5432, 5433]) {
    try {
      const c = new Client({
        connectionString: `postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:${port}/textile_erp_test`
      });
      await c.connect();
      console.log(`=== Port ${port} ===`);
      const comps = await c.query('SELECT id, name FROM companies');
      console.log('Companies:', comps.rows);
      const userRes = await c.query('SELECT id, email, role, "companyId" FROM users');
      console.log('Users:', userRes.rows);
      const cntRes = await c.query(`
        SELECT 
          (SELECT count(*) FROM items) as items,
          (SELECT count(*) FROM vouchers) as vouchers,
          (SELECT count(*) FROM stock_ledger) as stock_ledger,
          (SELECT count(*) FROM journal_entries) as journal_entries,
          (SELECT count(*) FROM journal_entry_items) as journal_items
      `);
      console.log('Counts:', cntRes.rows[0]);
      await c.end();
    } catch (e) {
      console.log(`Port ${port} error:`, e.message);
    }
  }
}

main().catch(console.error);
