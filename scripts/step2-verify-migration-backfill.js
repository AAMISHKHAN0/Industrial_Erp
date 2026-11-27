const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));
const fs = require('fs');

async function main() {
  console.log('=== STEP 2: CHECK 28 COLUMNS, MIGRATION & BACKFILL ON ISOLATED TEST DB ===');

  const credsFile = 'C:\\Users\\Aamishkhan\\AppData\\Roaming\\Industrial ERP\\data\\.db_credentials.json';
  const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));

  const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: creds.adminUser,
    password: creds.adminPassword,
    database: 'textile_erp_isolated_test',
  });
  await client.connect();

  // Inspect existing demand_notes, demand_note_items, material_issues, material_issue_items
  console.log('\n[1] Checking existing Demands and POs in isolated DB:');
  const dnItems = await client.query(`SELECT id, "demandId", quantity FROM demand_note_items;`);
  console.log(`    Total demand_note_items: ${dnItems.rows.length}`);
  
  const miItems = await client.query(`SELECT count(*)::int as count FROM material_issue_items;`);
  console.log(`    Total material_issue_items: ${miItems.rows[0].count}`);

  const poItems = await client.query(`SELECT id, "poId", quantity FROM purchase_order_items;`);
  console.log(`    Total purchase_order_items: ${poItems.rows.length}`);

  const sbItems = await client.query(`SELECT count(*)::int as count FROM supplier_bill_items;`);
  console.log(`    Total supplier_bill_items: ${sbItems.rows[0].count}`);

  // Create test records if none exist: an old partially issued demand, an old partially billed PO
  console.log('\n[2] Seeding test partially-issued demand and partially-billed PO to test upgrade:');
  
  // Find a company
  const compRes = await client.query(`SELECT id FROM companies LIMIT 1;`);
  const companyId = compRes.rows[0].id;
  const userRes = await client.query(`SELECT id FROM users LIMIT 1;`);
  const userId = userRes.rows[0].id;

  // Find or create warehouse
  let whRes = await client.query(`SELECT id FROM warehouses LIMIT 1;`);
  let warehouseId;
  if (whRes.rows.length === 0) {
    const newWh = await client.query(`
      INSERT INTO warehouses (id, "companyId", name, code, "createdAt", "updatedAt")
      VALUES ('wh-test-upgrade-001', $1, 'Main Warehouse', 'WH-01', NOW(), NOW())
      RETURNING id;
    `, [companyId]);
    warehouseId = newWh.rows[0].id;
  } else {
    warehouseId = whRes.rows[0].id;
  }

  // Find or create item
  let itemRes = await client.query(`SELECT id FROM items LIMIT 1;`);
  let itemId;
  if (itemRes.rows.length === 0) {
    const newItem = await client.query(`
      INSERT INTO items (id, "companyId", name, "itemCode", "createdAt", "updatedAt")
      VALUES ('item-test-upgrade-001', $1, 'Test Yarn', 'YARN-01', NOW(), NOW())
      RETURNING id;
    `, [companyId]);
    itemId = newItem.rows[0].id;
  } else {
    itemId = itemRes.rows[0].id;
  }

  // Insert a test Demand Note and Item
  const testDnId = 'test-dn-upgrade-001';
  const testDniId = 'test-dni-upgrade-001';
  await client.query(`
    INSERT INTO demand_notes (id, "companyId", "demandNumber", status, "createdAt", "updatedAt")
    VALUES ($1, $2, 'DN-TEST-001', 'APPROVED', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [testDnId, companyId]);

  await client.query(`
    INSERT INTO demand_note_items (id, "demandId", "itemId", quantity, "createdAt")
    VALUES ($1, $2, $3, 50.0, NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [testDniId, testDnId, itemId]);

  // Insert Material Issue with 20 units issued against testDniId
  const testMiId = 'test-mi-upgrade-001';
  const testMiiId = 'test-mii-upgrade-001';
  await client.query(`
    INSERT INTO material_issues (id, "companyId", "issueNumber", "demandNoteId", "warehouseId", "issueDate", status, "createdAt", "updatedAt")
    VALUES ($1, $2, 'MI-TEST-001', $3, $4, NOW(), 'POSTED', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [testMiId, companyId, testDnId, warehouseId]);

  await client.query(`
    INSERT INTO material_issue_items (id, "issueId", "demandNoteItemId", "itemId", quantity, "createdAt")
    VALUES ($1, $2, $3, $4, 20.0, NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [testMiiId, testMiId, testDniId, itemId]);

  // Insert a test PO and PO Item
  const testPoId = 'test-po-upgrade-001';
  const testPoiId = 'test-poi-upgrade-001';
  let vendorRes = await client.query(`SELECT id FROM vendors LIMIT 1;`);
  let vendorId;
  if (vendorRes.rows.length === 0) {
    const newVendor = await client.query(`
      INSERT INTO vendors (id, "companyId", name, "vendorCode", "createdAt", "updatedAt")
      VALUES ('vendor-test-upgrade-001', $1, 'Test Vendor Ltd', 'VEND-01', NOW(), NOW())
      RETURNING id;
    `, [companyId]);
    vendorId = newVendor.rows[0].id;
  } else {
    vendorId = vendorRes.rows[0].id;
  }

  await client.query(`
    INSERT INTO purchase_orders (id, "companyId", "poNumber", "vendorId", status, "grandTotal", "createdAt", "updatedAt")
    VALUES ($1, $2, 'PO-TEST-001', $3, 'APPROVED', 10000.0, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [testPoId, companyId, vendorId]);

  await client.query(`
    INSERT INTO purchase_order_items (id, "poId", "itemId", quantity, "unitPrice", "totalPrice", "receivedQty", "createdAt")
    VALUES ($1, $2, $3, 100.0, 100.0, 10000.0, 50.0, NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [testPoiId, testPoId, itemId]);

  // Insert a Supplier Bill with 35.0 billed against testPoiId
  const testSbId = 'test-sb-upgrade-001';
  const testSbiId = 'test-sbi-upgrade-001';
  await client.query(`
    INSERT INTO supplier_bills (id, "companyId", "billNumber", "vendorId", "supplierInvoiceNumber", "billDate", status, "totalAmount", "createdAt", "updatedAt")
    VALUES ($1, $2, 'BILL-TEST-001', $3, 'INV-TEST-001', NOW(), 'POSTED', 3500.0, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [testSbId, companyId, vendorId]);

  await client.query(`
    INSERT INTO supplier_bill_items (id, "billId", "poItemId", "itemId", "billedQty", "unitPrice", "lineTotal", "createdAt")
    VALUES ($1, $2, $3, $4, 35.0, 100.0, 3500.0, NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [testSbiId, testSbId, testPoiId, itemId]);

  console.log('    Pre-upgrade test records created:');
  console.log('    - Demand Note DN-TEST-001: 50 ordered, 20 issued via material_issues');
  console.log('    - PO PO-TEST-001: 100 ordered, 35 billed via supplier_bills');

  // 3. Now Execute the 28-column Migration SQL on the isolated test database
  console.log('\n[3] Applying 28-column Migration & Backfill SQL:');
  const migrationSql = `
    -- 1. demand_notes (3 columns)
    ALTER TABLE "demand_notes" ADD COLUMN IF NOT EXISTS "costCenter" TEXT;
    ALTER TABLE "demand_notes" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
    ALTER TABLE "demand_notes" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

    -- 2. demand_note_items (1 column)
    ALTER TABLE "demand_note_items" ADD COLUMN IF NOT EXISTS "issuedQty" DOUBLE PRECISION NOT NULL DEFAULT 0;

    -- 3. purchase_orders (2 columns)
    ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "qtyTolerancePct" DOUBLE PRECISION NOT NULL DEFAULT 0;
    ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "priceTolerancePct" DOUBLE PRECISION NOT NULL DEFAULT 0;

    -- 4. purchase_order_items (2 columns)
    ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "billedQty" DOUBLE PRECISION NOT NULL DEFAULT 0;
    ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "tolerancePct" DOUBLE PRECISION;

    -- 5. goods_receiving_notes (18 columns)
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "deliveryChallanNumber" TEXT;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "deliveryChallanDate" TIMESTAMP(3);
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "supplierInvoiceNumber" TEXT;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "supplierInvoiceDate" TIMESTAMP(3);
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "supplierInvoiceAmount" DOUBLE PRECISION;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "gatePassNumber" TEXT;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "vehicleNumber" TEXT;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "driverName" TEXT;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "driverPhone" TEXT;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "transporterName" TEXT;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "biltyNumber" TEXT;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "costCenter" TEXT;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "inspectionStatus" TEXT NOT NULL DEFAULT 'PENDING';
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "inspectionNotes" TEXT;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "inspectedBy" TEXT;
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "inspectedAt" TIMESTAMP(3);
    ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "voucherId" TEXT;

    -- 6. goods_receiving_items (2 columns)
    ALTER TABLE "goods_receiving_items" ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;
    ALTER TABLE "goods_receiving_items" ADD COLUMN IF NOT EXISTS "remarks" TEXT;

    -- BACKFILL LOGIC:
    -- Backfill demand_note_items.issuedQty from posted material_issue_items
    UPDATE "demand_note_items" dni
    SET "issuedQty" = COALESCE((
      SELECT SUM(mii.quantity)
      FROM "material_issue_items" mii
      JOIN "material_issues" mi ON mi.id = mii."issueId"
      WHERE mii."demandNoteItemId" = dni.id
        AND mi.status IN ('POSTED', 'APPROVED', 'ISSUED')
    ), 0);

    -- Backfill purchase_order_items.billedQty from posted supplier_bill_items
    UPDATE "purchase_order_items" poi
    SET "billedQty" = COALESCE((
      SELECT SUM(sbi."billedQty")
      FROM "supplier_bill_items" sbi
      JOIN "supplier_bills" sb ON sb.id = sbi."billId"
      WHERE sbi."poItemId" = poi.id
        AND sb.status IN ('POSTED', 'APPROVED', 'PAID')
    ), 0);
  `;

  await client.query(migrationSql);
  console.log('    Migration SQL executed successfully.');

  // 4. Verify post-upgrade values for test records
  console.log('\n[4] Verifying Post-Upgrade Backfill Results:');
  const upgradedDni = await client.query(`SELECT id, quantity, "issuedQty" FROM demand_note_items WHERE id = $1;`, [testDniId]);
  console.log(`    DN Item test-dni-upgrade-001: ordered=${upgradedDni.rows[0].quantity}, issuedQty=${upgradedDni.rows[0].issuedQty}`);

  const upgradedPoi = await client.query(`SELECT id, quantity, "billedQty" FROM purchase_order_items WHERE id = $1;`, [testPoiId]);
  console.log(`    PO Item test-poi-upgrade-001: ordered=${upgradedPoi.rows[0].quantity}, billedQty=${upgradedPoi.rows[0].billedQty}`);

  if (upgradedDni.rows[0].issuedQty === 20.0 && upgradedPoi.rows[0].billedQty === 35.0) {
    console.log('    TEST PASS: Both partial issuedQty and partial billedQty backfilled with 100% precision!');
  } else {
    console.error('    TEST FAIL: Mismatch in backfilled values.');
    process.exit(1);
  }

  // 5. Check if any record in the database cannot be reconciled
  console.log('\n[5] Checking for unreconciled or orphaned records:');
  const orphanedMi = await client.query(`
    SELECT count(*)::int as count 
    FROM material_issue_items mii 
    WHERE mii."demandNoteItemId" IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM demand_note_items dni WHERE dni.id = mii."demandNoteItemId");
  `);
  console.log(`    Orphaned material_issue_items: ${orphanedMi.rows[0].count}`);

  const orphanedSbi = await client.query(`
    SELECT count(*)::int as count 
    FROM supplier_bill_items sbi 
    WHERE sbi."poItemId" IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM purchase_order_items poi WHERE poi.id = sbi."poItemId");
  `);
  console.log(`    Orphaned supplier_bill_items: ${orphanedSbi.rows[0].count}`);

  // Check all 28 columns exist in information_schema
  const expectedCols = [
    { table: 'demand_notes', col: 'costCenter' },
    { table: 'demand_notes', col: 'approvedBy' },
    { table: 'demand_notes', col: 'approvedAt' },
    { table: 'demand_note_items', col: 'issuedQty' },
    { table: 'purchase_orders', col: 'qtyTolerancePct' },
    { table: 'purchase_orders', col: 'priceTolerancePct' },
    { table: 'purchase_order_items', col: 'billedQty' },
    { table: 'purchase_order_items', col: 'tolerancePct' },
    { table: 'goods_receiving_notes', col: 'deliveryChallanNumber' },
    { table: 'goods_receiving_notes', col: 'deliveryChallanDate' },
    { table: 'goods_receiving_notes', col: 'supplierInvoiceNumber' },
    { table: 'goods_receiving_notes', col: 'supplierInvoiceDate' },
    { table: 'goods_receiving_notes', col: 'supplierInvoiceAmount' },
    { table: 'goods_receiving_notes', col: 'gatePassNumber' },
    { table: 'goods_receiving_notes', col: 'vehicleNumber' },
    { table: 'goods_receiving_notes', col: 'driverName' },
    { table: 'goods_receiving_notes', col: 'driverPhone' },
    { table: 'goods_receiving_notes', col: 'transporterName' },
    { table: 'goods_receiving_notes', col: 'biltyNumber' },
    { table: 'goods_receiving_notes', col: 'departmentId' },
    { table: 'goods_receiving_notes', col: 'costCenter' },
    { table: 'goods_receiving_notes', col: 'inspectionStatus' },
    { table: 'goods_receiving_notes', col: 'inspectionNotes' },
    { table: 'goods_receiving_notes', col: 'inspectedBy' },
    { table: 'goods_receiving_notes', col: 'inspectedAt' },
    { table: 'goods_receiving_notes', col: 'voucherId' },
    { table: 'goods_receiving_items', col: 'lotNumber' },
    { table: 'goods_receiving_items', col: 'remarks' },
  ];

  console.log('\n[6] Verifying all 28 columns in information_schema:');
  let missing = 0;
  for (const item of expectedCols) {
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2;
    `, [item.table, item.col]);

    if (res.rows.length === 0) {
      console.error(`    MISSING: ${item.table}.${item.col}`);
      missing++;
    } else {
      const r = res.rows[0];
      console.log(`    OK: ${item.table}.${item.col} (${r.data_type}, nullable: ${r.is_nullable}, default: ${r.column_default})`);
    }
  }

  if (missing === 0) {
    console.log(`\n=== ALL 28 COLUMNS VERIFIED SUCCESSFULLY (PASS) ===`);
  } else {
    console.error(`\n=== FAILED: ${missing} COLUMNS STILL MISSING ===`);
    process.exit(1);
  }

  await client.end();
}

main().catch(err => {
  console.error('Fatal error in Step 2:', err);
  process.exit(1);
});
