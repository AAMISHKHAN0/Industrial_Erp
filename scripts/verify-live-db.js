const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));
const fs = require('fs');

async function main() {
  const creds = JSON.parse(fs.readFileSync('C:/Users/Aamishkhan/AppData/Roaming/Industrial ERP/data/.db_credentials.json', 'utf8'));
  const client = new Client({ host: '127.0.0.1', port: 5433, user: creds.adminUser, password: creds.adminPassword, database: 'textile_erp' });
  await client.connect();

  const migs = await client.query('SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3');
  console.log('Latest applied migrations:');
  for (const m of migs.rows) {
    console.log(`  - ${m.migration_name} (finished: ${m.finished_at})`);
  }

  const res = await client.query(`
    SELECT count(*)::int as count 
    FROM information_schema.columns 
    WHERE (table_name = 'demand_notes' AND column_name = 'costCenter')
       OR (table_name = 'demand_note_items' AND column_name = 'issuedQty')
       OR (table_name = 'goods_receiving_notes' AND column_name = 'deliveryChallanNumber')
       OR (table_name = 'purchase_order_items' AND column_name = 'billedQty');
  `);
  console.log(`Key columns present in live textile_erp: ${res.rows[0].count} / 4`);

  // Count all 28 columns
  const all28Res = await client.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE (table_name = 'demand_notes' AND column_name IN ('costCenter', 'approvedBy', 'approvedAt'))
       OR (table_name = 'demand_note_items' AND column_name IN ('issuedQty'))
       OR (table_name = 'purchase_orders' AND column_name IN ('qtyTolerancePct', 'priceTolerancePct'))
       OR (table_name = 'purchase_order_items' AND column_name IN ('billedQty', 'tolerancePct'))
       OR (table_name = 'goods_receiving_notes' AND column_name IN ('deliveryChallanNumber', 'deliveryChallanDate', 'supplierInvoiceNumber', 'supplierInvoiceDate', 'supplierInvoiceAmount', 'gatePassNumber', 'vehicleNumber', 'driverName', 'driverPhone', 'transporterName', 'biltyNumber', 'departmentId', 'costCenter', 'inspectionStatus', 'inspectionNotes', 'inspectedBy', 'inspectedAt', 'voucherId'))
       OR (table_name = 'goods_receiving_items' AND column_name IN ('lotNumber', 'remarks'));
  `);
  console.log(`Total missing M4/M5 columns present: ${all28Res.rows.length} / 28`);

  await client.end();
}
main().catch(console.error);
