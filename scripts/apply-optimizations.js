const { Client } = require('../backend/node_modules/pg');

async function applyIndices() {
  const client = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5433/textile_erp_test'
  });
  await client.connect();

  console.log('Creating optimized composite indices...');
  const t0 = performance.now();

  const commands = [
    // 1. Stock Ledger composite indices
    `CREATE INDEX IF NOT EXISTS idx_stock_ledger_comp_item_created ON stock_ledger ("companyId", "itemId", "createdAt" ASC);`,
    `CREATE INDEX IF NOT EXISTS idx_stock_ledger_comp_created ON stock_ledger ("companyId", "createdAt" ASC);`,
    `CREATE INDEX IF NOT EXISTS idx_stock_ledger_warehouse_item ON stock_ledger ("warehouseId", "itemId", "createdAt" ASC);`,

    // 2. Vouchers composite indices
    `CREATE INDEX IF NOT EXISTS idx_vouchers_comp_date ON vouchers ("companyId", "businessDate" DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_vouchers_comp_status_date ON vouchers ("companyId", status, "businessDate" DESC);`,

    // 3. Journal Entries indices
    `CREATE INDEX IF NOT EXISTS idx_journal_entries_comp_date ON journal_entries ("companyId", "entryDate" DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_journal_entries_comp_created ON journal_entries ("companyId", "createdAt" DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_journal_entries_voucher_id ON journal_entries ("voucherId");`,

    // 4. Journal Entry Items foreign key indices (CRITICAL - currently missing!)
    `CREATE INDEX IF NOT EXISTS idx_journal_entry_items_je_id ON journal_entry_items ("journalEntryId");`,
    `CREATE INDEX IF NOT EXISTS idx_journal_entry_items_account_id ON journal_entry_items ("accountId");`,

    // 5. FIFO Layers composite index
    `CREATE INDEX IF NOT EXISTS idx_fifo_layers_lookup ON fifo_layers ("companyId", "itemId", status, "remainingQty");`,

    // 6. Update optimizer statistics
    `ANALYZE stock_ledger;`,
    `ANALYZE vouchers;`,
    `ANALYZE journal_entries;`,
    `ANALYZE journal_entry_items;`,
    `ANALYZE items;`
  ];

  for (const cmd of commands) {
    const s0 = performance.now();
    await client.query(cmd);
    const s1 = performance.now();
    console.log(`Executed: ${cmd.split('ON')[0].trim()}... in ${(s1 - s0).toFixed(2)} ms`);
  }

  const t1 = performance.now();
  console.log(`\nAll indices applied and statistics analyzed in ${(t1 - t0).toFixed(2)} ms.`);

  await client.end();
}

applyIndices().catch(console.error);
