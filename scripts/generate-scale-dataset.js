const { Client } = require('../backend/node_modules/pg');
const crypto = require('crypto');

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5433/textile_erp_test';

async function generateDataset() {
  const startTime = performance.now();
  console.log('Connecting to PostgreSQL database...');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    // 1. Resolve target company
    const userRes = await client.query('SELECT "companyId" FROM users WHERE email = $1', ['admin@industrialerp.local']);
    if (!userRes.rows.length) {
      throw new Error('Admin user admin@industrialerp.local not found');
    }
    const companyId = userRes.rows[0].companyId;
    console.log(`Target companyId: ${companyId}`);

    // 2. Resolve or create Warehouse
    let whRes = await client.query('SELECT id, name FROM warehouses WHERE "companyId" = $1 LIMIT 1', [companyId]);
    let warehouseId;
    if (whRes.rows.length === 0) {
      warehouseId = crypto.randomUUID();
      await client.query(`
        INSERT INTO warehouses (id, "companyId", name, code, "createdAt", "updatedAt", status)
        VALUES ($1, $2, 'Main Textile Facility', 'WH-MAIN', NOW(), NOW(), 'ACTIVE')
      `, [warehouseId, companyId]);
    } else {
      warehouseId = whRes.rows[0].id;
    }
    console.log(`Warehouse: ${warehouseId}`);

    // 3. Resolve or create Units
    const unitCodes = [
      { name: 'Kilograms', code: 'KG' },
      { name: 'Meters', code: 'MTR' },
      { name: 'Cones', code: 'CONE' },
      { name: 'Bags', code: 'BAG' },
      { name: 'Liters', code: 'LTR' }
    ];
    const unitIds = [];
    for (const u of unitCodes) {
      let uRes = await client.query('SELECT id FROM units WHERE "companyId" = $1 AND code = $2', [companyId, u.code]);
      if (uRes.rows.length === 0) {
        const uid = crypto.randomUUID();
        await client.query('INSERT INTO units (id, "companyId", name, code, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())', [uid, companyId, u.name, u.code]);
        unitIds.push(uid);
      } else {
        unitIds.push(uRes.rows[0].id);
      }
    }

    // 4. Resolve or create Categories
    const catList = [
      { name: 'Raw Cotton & Fibers', code: 'CAT-FIBER' },
      { name: 'Spun Yarn & Thread', code: 'CAT-YARN' },
      { name: 'Greige & Finished Fabric', code: 'CAT-FABRIC' },
      { name: 'Dyes & Auxiliary Chemicals', code: 'CAT-CHEM' },
      { name: 'Accessories & Trims', code: 'CAT-TRIM' },
      { name: 'Packaging Materials', code: 'CAT-PACK' }
    ];
    const catIds = [];
    for (const c of catList) {
      let cRes = await client.query('SELECT id FROM categories WHERE "companyId" = $1 AND code = $2', [companyId, c.code]);
      if (cRes.rows.length === 0) {
        const cid = crypto.randomUUID();
        await client.query('INSERT INTO categories (id, "companyId", name, code, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())', [cid, companyId, c.name, c.code]);
        catIds.push(cid);
      } else {
        catIds.push(cRes.rows[0].id);
      }
    }

    // 5. Resolve or create Accounting Period
    let perRes = await client.query('SELECT id FROM accounting_periods WHERE "companyId" = $1 LIMIT 1', [companyId]);
    let periodId;
    if (perRes.rows.length === 0) {
      periodId = crypto.randomUUID();
      await client.query(`
        INSERT INTO accounting_periods (id, "companyId", name, "startDate", "endDate", "isClosed", "createdAt", "updatedAt")
        VALUES ($1, $2, 'FY 2026-2027', '2026-01-01', '2026-12-31', false, NOW(), NOW())
      `, [periodId, companyId]);
    } else {
      periodId = perRes.rows[0].id;
    }

    // 6. Resolve Accounts for GL postings
    const accRes = await client.query('SELECT id, "accountCode", type FROM accounts WHERE "companyId" = $1', [companyId]);
    const accounts = accRes.rows;
    let invAcc = accounts.find(a => a.accountCode === 'INVENTORY')?.id;
    let cogsAcc = accounts.find(a => a.accountCode === 'COGS')?.id;
    let arAcc = accounts.find(a => a.accountCode === 'ACCOUNTS_RECEIVABLE')?.id;
    let apAcc = accounts.find(a => a.accountCode === 'ACCOUNTS_PAYABLE')?.id;
    let salesAcc = accounts.find(a => a.accountCode === 'SALES_REVENUE')?.id;
    let cashAcc = accounts.find(a => a.accountCode === 'CASH')?.id || accounts[0]?.id;

    if (!invAcc) invAcc = accounts[0]?.id;
    if (!cogsAcc) cogsAcc = accounts[1]?.id;
    if (!arAcc) arAcc = accounts[2]?.id;
    if (!apAcc) apAcc = accounts[3]?.id;
    if (!salesAcc) salesAcc = accounts[4]?.id;

    // Check existing counts
    const countCheck = await client.query(`
      SELECT 
        (SELECT count(*) FROM items WHERE "companyId" = $1) as existing_items,
        (SELECT count(*) FROM vouchers WHERE "companyId" = $1) as existing_vouchers,
        (SELECT count(*) FROM stock_ledger WHERE "companyId" = $1) as existing_stock_ledger,
        (SELECT count(*) FROM journal_entry_items WHERE "journalEntryId" IN (SELECT id FROM journal_entries WHERE "companyId" = $1)) as existing_journal_items
    `, [companyId]);
    console.log('Current counts before scale insertion:', countCheck.rows[0]);

    const TARGET_ITEMS = 10000;
    const TARGET_VOUCHERS = 50000;
    const TARGET_STOCK_ROWS = 250000;

    const itemsNeeded = Math.max(0, TARGET_ITEMS - parseInt(countCheck.rows[0].existing_items));
    const vouchersNeeded = Math.max(0, TARGET_VOUCHERS - parseInt(countCheck.rows[0].existing_vouchers));
    const stockRowsNeeded = Math.max(0, TARGET_STOCK_ROWS - parseInt(countCheck.rows[0].existing_stock_ledger));

    console.log(`Needed: ${itemsNeeded} items, ${vouchersNeeded} vouchers, ${stockRowsNeeded} stock ledger rows`);

    // --- STEP A: GENERATE 10,000 ITEMS ---
    const existingItemIds = (await client.query('SELECT id FROM items WHERE "companyId" = $1', [companyId])).rows.map(r => r.id);
    const itemIds = [...existingItemIds];

    if (itemsNeeded > 0) {
      console.log(`Generating ${itemsNeeded} inventory items in batches of 1,000...`);
      const startIndex = parseInt(countCheck.rows[0].existing_items) + 1;
      const BATCH_SIZE = 1000;

      for (let b = 0; b < itemsNeeded; b += BATCH_SIZE) {
        const batchEnd = Math.min(itemsNeeded, b + BATCH_SIZE);
        const rows = [];
        for (let i = b; i < batchEnd; i++) {
          const idx = startIndex + i;
          const id = crypto.randomUUID();
          itemIds.push(id);
          const itemCode = `ITM-${String(idx).padStart(5, '0')}`;
          const catId = catIds[idx % catIds.length];
          const unitId = unitIds[idx % unitIds.length];
          const yarnCounts = ['20/1', '24/1', '30/1', '40/1', '50/1', '60/2'];
          const qualities = ['Combed', 'Carded', 'Compact', 'Slub', 'Open End'];
          const title = `Cotton Yarn ${yarnCounts[idx % yarnCounts.length]} ${qualities[idx % qualities.length]} Lot-${idx}`;
          const purchasePrice = 450 + (idx % 2500);
          const sellingPrice = purchasePrice * 1.25;

          rows.push({
            id,
            companyId,
            itemCode,
            name: title,
            description: `Industrial high-tenacity textile material specification #${idx}`,
            categoryId: catId,
            unitId: unitId,
            brand: 'PakTextile Mills',
            minStock: 100,
            maxStock: 25000,
            reorderLevel: 250,
            purchasePrice,
            sellingPrice,
            currentStock: 0,
            reservedStock: 0,
            availableStock: 0,
            averageCost: purchasePrice,
            hsnCode: `5205.${String(idx % 900 + 100)}`,
            createdAt: '2026-01-01 08:00:00',
            updatedAt: '2026-01-01 08:00:00',
            status: 'ACTIVE',
            version: 1
          });
        }

        // Construct multi-row INSERT
        const keys = [
          'id', 'companyId', 'itemCode', 'name', 'description', 'categoryId', 'unitId',
          'brand', 'minStock', 'maxStock', 'reorderLevel', 'purchasePrice', 'sellingPrice',
          'currentStock', 'reservedStock', 'availableStock', 'averageCost', 'hsnCode',
          'createdAt', 'updatedAt', 'status', 'version'
        ];
        const valPlaceholders = [];
        const flatVals = [];
        let pIndex = 1;

        for (const row of rows) {
          const rowP = [];
          for (const k of keys) {
            rowP.push(`$${pIndex++}`);
            flatVals.push(row[k]);
          }
          valPlaceholders.push(`(${rowP.join(', ')})`);
        }

        const query = `
          INSERT INTO items (${keys.map(k => `"${k}"`).join(', ')})
          VALUES ${valPlaceholders.join(', ')}
        `;
        await client.query(query, flatVals);
        process.stdout.write(`\r  Inserted ${b + rows.length} / ${itemsNeeded} items...`);
      }
      console.log('\nItems generation complete.');
    }

    // --- STEP B: GENERATE 50,000 VOUCHERS + JOURNAL ENTRIES + GL ITEMS ---
    const voucherTypes = ['GRN', 'ISSUE', 'INVOICE', 'RECEIPT', 'PAYMENT', 'EXPENSE'];
    const voucherIds = [];

    if (vouchersNeeded > 0) {
      console.log(`Generating ${vouchersNeeded} vouchers and journal entries in batches of 2,000...`);
      const startV = parseInt(countCheck.rows[0].existing_vouchers) + 1;
      const BATCH_SIZE = 2000;

      for (let b = 0; b < vouchersNeeded; b += BATCH_SIZE) {
        const batchEnd = Math.min(vouchersNeeded, b + BATCH_SIZE);
        const vRows = [];
        const jeRows = [];
        const jeiRows = [];

        for (let i = b; i < batchEnd; i++) {
          const vIdx = startV + i;
          const vId = crypto.randomUUID();
          voucherIds.push(vId);
          const vType = voucherTypes[vIdx % voucherTypes.length];
          const vNum = `VCH-2026-${String(vIdx).padStart(6, '0')}`;
          
          // Spread dates evenly across 2026
          const dayOffset = (vIdx * 7) % 320;
          const bDate = new Date(Date.UTC(2026, 0, 1 + dayOffset, 9, (vIdx * 13) % 60));
          const dateStr = bDate.toISOString();

          vRows.push({
            id: vId,
            companyId,
            voucherNumber: vNum,
            voucherType: vType,
            businessDate: dateStr,
            status: 'POSTED',
            periodId,
            reference: `REF-2026-${String(vIdx).padStart(6, '0')}`,
            notes: `Batch transaction posting sequence ${vIdx} (${vType})`,
            createdAt: dateStr,
            updatedAt: dateStr
          });

          // Corresponding Journal Entry
          const jeId = crypto.randomUUID();
          const jeNum = `JE-2026-${String(vIdx).padStart(6, '0')}`;
          jeRows.push({
            id: jeId,
            companyId,
            entryNumber: jeNum,
            entryDate: dateStr,
            reference: vNum,
            description: `Automated transaction entry for voucher ${vNum}`,
            isPosted: true,
            postedAt: dateStr,
            createdAt: dateStr,
            updatedAt: dateStr,
            periodId,
            voucherId: vId
          });

          // Two balanced GL lines (Dr and Cr)
          const amount = 5000 + (vIdx % 50000);
          let drAcc = invAcc;
          let crAcc = apAcc;
          if (vType === 'INVOICE') { drAcc = arAcc; crAcc = salesAcc; }
          else if (vType === 'RECEIPT') { drAcc = cashAcc; crAcc = arAcc; }
          else if (vType === 'PAYMENT') { drAcc = apAcc; crAcc = cashAcc; }
          else if (vType === 'ISSUE') { drAcc = cogsAcc; crAcc = invAcc; }

          jeiRows.push({
            id: crypto.randomUUID(),
            journalEntryId: jeId,
            accountId: drAcc,
            debitAmount: amount,
            creditAmount: 0,
            description: `Debit line for ${vNum}`,
            createdAt: dateStr
          });
          jeiRows.push({
            id: crypto.randomUUID(),
            journalEntryId: jeId,
            accountId: crAcc,
            debitAmount: 0,
            creditAmount: amount,
            description: `Credit line for ${vNum}`,
            createdAt: dateStr
          });
        }

        // Insert Vouchers
        {
          const vKeys = ['id', 'companyId', 'voucherNumber', 'voucherType', 'businessDate', 'status', 'periodId', 'reference', 'notes', 'createdAt', 'updatedAt'];
          const vPlaceholders = [];
          const vFlat = [];
          let pIdx = 1;
          for (const row of vRows) {
            const p = [];
            for (const k of vKeys) { p.push(`$${pIdx++}`); vFlat.push(row[k]); }
            vPlaceholders.push(`(${p.join(', ')})`);
          }
          await client.query(`
            INSERT INTO vouchers (${vKeys.map(k => `"${k}"`).join(', ')})
            VALUES ${vPlaceholders.join(', ')}
          `, vFlat);
        }

        // Insert Journal Entries
        {
          const jeKeys = ['id', 'companyId', 'entryNumber', 'entryDate', 'reference', 'description', 'isPosted', 'postedAt', 'createdAt', 'updatedAt', 'periodId', 'voucherId'];
          const jePlaceholders = [];
          const jeFlat = [];
          let pIdx = 1;
          for (const row of jeRows) {
            const p = [];
            for (const k of jeKeys) { p.push(`$${pIdx++}`); jeFlat.push(row[k]); }
            jePlaceholders.push(`(${p.join(', ')})`);
          }
          await client.query(`
            INSERT INTO journal_entries (${jeKeys.map(k => `"${k}"`).join(', ')})
            VALUES ${jePlaceholders.join(', ')}
          `, jeFlat);
        }

        // Insert Journal Entry Items
        {
          const jeiKeys = ['id', 'journalEntryId', 'accountId', 'debitAmount', 'creditAmount', 'description', 'createdAt'];
          const jeiPlaceholders = [];
          const jeiFlat = [];
          let pIdx = 1;
          for (const row of jeiRows) {
            const p = [];
            for (const k of jeiKeys) { p.push(`$${pIdx++}`); jeiFlat.push(row[k]); }
            jeiPlaceholders.push(`(${p.join(', ')})`);
          }
          await client.query(`
            INSERT INTO journal_entry_items (${jeiKeys.map(k => `"${k}"`).join(', ')})
            VALUES ${jeiPlaceholders.join(', ')}
          `, jeiFlat);
        }

        process.stdout.write(`\r  Inserted ${b + vRows.length} / ${vouchersNeeded} vouchers + journal entries...`);
      }
      console.log('\nVouchers & Journal entries generation complete.');
    } else {
      const existingVouchers = await client.query('SELECT id FROM vouchers WHERE "companyId" = $1 LIMIT 50000', [companyId]);
      voucherIds.push(...existingVouchers.rows.map(r => r.id));
    }

    // --- STEP C: GENERATE 250,000 STOCK LEDGER ROWS ---
    if (stockRowsNeeded > 0) {
      console.log(`Generating ${stockRowsNeeded} stock ledger rows in batches of 2,500...`);
      const BATCH_SIZE = 2500;
      const transTypes = ['GRN_RECEIPT', 'PRODUCTION_ISSUE', 'PRODUCTION_RECEIPT', 'SALES_ISSUE', 'ADJUSTMENT_PLUS'];

      // Running stock tracking map: itemId -> { qty, cost }
      const stockState = new Map();
      const existingStock = await client.query('SELECT id, "currentStock", "averageCost" FROM items WHERE "companyId" = $1', [companyId]);
      for (const r of existingStock.rows) {
        stockState.set(r.id, { qty: r.currentStock || 0, cost: r.averageCost || 500 });
      }

      for (let b = 0; b < stockRowsNeeded; b += BATCH_SIZE) {
        const batchEnd = Math.min(stockRowsNeeded, b + BATCH_SIZE);
        const sRows = [];

        for (let i = b; i < batchEnd; i++) {
          const sIdx = i;
          const sId = crypto.randomUUID();
          const targetItemId = itemIds[sIdx % itemIds.length];
          const current = stockState.get(targetItemId) || { qty: 0, cost: 500 };

          const tType = transTypes[sIdx % transTypes.length];
          let qtyDelta = 25 + (sIdx % 100);
          if (tType === 'PRODUCTION_ISSUE' || tType === 'SALES_ISSUE') {
            // Ensure stock stays non-negative
            if (current.qty < qtyDelta) {
              qtyDelta = Math.max(1, Math.floor(current.qty / 2));
            }
            qtyDelta = -qtyDelta;
          }

          const qtyBefore = current.qty;
          const qtyAfter = Math.max(0, qtyBefore + qtyDelta);
          const costBefore = current.cost;
          const costChange = 0;
          const costAfter = costBefore;

          current.qty = qtyAfter;
          stockState.set(targetItemId, current);

          const linkedVoucher = voucherIds[sIdx % voucherIds.length] || null;
          const dayOffset = (sIdx * 3) % 320;
          const sDate = new Date(Date.UTC(2026, 0, 1 + dayOffset, 10, (sIdx * 17) % 60)).toISOString();

          sRows.push({
            id: sId,
            companyId,
            itemId: targetItemId,
            warehouseId,
            transactionType: tType,
            referenceId: linkedVoucher,
            referenceType: 'VOUCHER',
            qtyBefore,
            qtyChange: qtyDelta,
            qtyAfter,
            costBefore,
            costChange,
            costAfter,
            notes: `Material stock ledger movement seq #${sIdx} (${tType})`,
            createdAt: sDate
          });
        }

        // Multi-row insert for stock_ledger
        const sKeys = [
          'id', 'companyId', 'itemId', 'warehouseId', 'transactionType', 'referenceId',
          'referenceType', 'qtyBefore', 'qtyChange', 'qtyAfter', 'costBefore', 'costChange',
          'costAfter', 'notes', 'createdAt'
        ];
        const sPlaceholders = [];
        const sFlat = [];
        let pIdx = 1;
        for (const row of sRows) {
          const p = [];
          for (const k of sKeys) {
            p.push(`$${pIdx++}`);
            sFlat.push(row[k]);
          }
          sPlaceholders.push(`(${p.join(', ')})`);
        }

        await client.query(`
          INSERT INTO stock_ledger (${sKeys.map(k => `"${k}"`).join(', ')})
          VALUES ${sPlaceholders.join(', ')}
        `, sFlat);

        process.stdout.write(`\r  Inserted ${b + sRows.length} / ${stockRowsNeeded} stock ledger rows...`);
      }
      console.log('\nStock ledger generation complete.');

      // Sync final item currentStock and availableStock
      console.log('Synchronizing final item stock balances...');
      const itemUpdates = Array.from(stockState.entries()).slice(0, 10000);
      for (let i = 0; i < itemUpdates.length; i += 1000) {
        const chunk = itemUpdates.slice(i, i + 1000);
        const cases = chunk.map(([id, st]) => `WHEN id = '${id}' THEN ${st.qty}`).join(' ');
        const ids = chunk.map(([id]) => `'${id}'`).join(', ');
        await client.query(`
          UPDATE items 
          SET "currentStock" = CASE ${cases} ELSE "currentStock" END,
              "availableStock" = CASE ${cases} ELSE "availableStock" END
          WHERE id IN (${ids})
        `);
      }
      console.log('Item stock balances synchronized.');
    }

    // --- FINAL VERIFICATION OF DATASET TOTALS ---
    const finalCounts = await client.query(`
      SELECT 
        (SELECT count(*) FROM items) as total_items,
        (SELECT count(*) FROM vouchers) as total_vouchers,
        (SELECT count(*) FROM journal_entries) as total_journal_entries,
        (SELECT count(*) FROM journal_entry_items) as total_journal_items,
        (SELECT count(*) FROM stock_ledger) as total_stock_ledger,
        (SELECT count(*) FROM items WHERE "companyId" = $1) as company_items,
        (SELECT count(*) FROM vouchers WHERE "companyId" = $1) as company_vouchers,
        (SELECT count(*) FROM stock_ledger WHERE "companyId" = $1) as company_stock_ledger
    `, [companyId]);

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`\n================ DATASET GENERATION SUMMARY ================`);
    console.log(`Elapsed time: ${elapsed} seconds`);
    console.log(`Total Inventory Items:       ${finalCounts.rows[0].total_items} (Company: ${finalCounts.rows[0].company_items})`);
    console.log(`Total Vouchers:               ${finalCounts.rows[0].total_vouchers} (Company: ${finalCounts.rows[0].company_vouchers})`);
    console.log(`Total Journal Entries:        ${finalCounts.rows[0].total_journal_entries}`);
    console.log(`Total Journal Entry Lines:    ${finalCounts.rows[0].total_journal_items}`);
    console.log(`Total Stock Ledger Movements: ${finalCounts.rows[0].total_stock_ledger} (Company: ${finalCounts.rows[0].company_stock_ledger})`);
    console.log(`============================================================`);

  } finally {
    await client.end();
  }
}

generateDataset().catch(console.error);
