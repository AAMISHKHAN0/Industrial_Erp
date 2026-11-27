const path = require('path');
const fs = require('fs');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));

async function main() {
  console.log('=== VERIFYING POST-RESTART RECORD PERSISTENCE ===\n');

  const creds = JSON.parse(fs.readFileSync('C:/Users/Aamishkhan/AppData/Roaming/Industrial ERP/data/.db_credentials.json', 'utf8'));
  const db = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: creds.adminUser,
    password: creds.adminPassword,
    database: 'textile_erp',
  });
  await db.connect();

  // Check saved customer
  const custRes = await db.query(`SELECT id, name, "customerCode", city FROM customers ORDER BY "createdAt" DESC LIMIT 1;`);
  console.log(`[1] Latest Customer: ${custRes.rows[0].name} (${custRes.rows[0].customerCode}), City: ${custRes.rows[0].city}`);

  // Check saved vendor
  const vendRes = await db.query(`SELECT id, name, "vendorCode", city FROM vendors ORDER BY "createdAt" DESC LIMIT 1;`);
  console.log(`[2] Latest Vendor: ${vendRes.rows[0].name} (${vendRes.rows[0].vendorCode}), City: ${vendRes.rows[0].city}`);

  // Check saved item
  const itemRes = await db.query(`SELECT id, name, "itemCode", "currentStock" FROM items ORDER BY "createdAt" DESC LIMIT 1;`);
  console.log(`[3] Latest Item: ${itemRes.rows[0].name} (${itemRes.rows[0].itemCode}), Stock: ${itemRes.rows[0].currentStock}`);

  // Check invoice balance
  const invRes = await db.query(`SELECT "invoiceNumber", "totalAmount", "paidAmount", ("totalAmount" - "paidAmount") as balance FROM sales_invoices ORDER BY "createdAt" DESC LIMIT 1;`);
  console.log(`[4] Latest Invoice: ${invRes.rows[0].invoiceNumber}, Total: ${invRes.rows[0].totalAmount}, Paid: ${invRes.rows[0].paidAmount}, Outstanding: ${invRes.rows[0].balance}`);

  // Check bill balance
  const billRes = await db.query(`SELECT "billNumber", "totalAmount", "paidAmount", ("totalAmount" - "paidAmount") as balance FROM supplier_bills ORDER BY "createdAt" DESC LIMIT 1;`);
  console.log(`[5] Latest Bill: ${billRes.rows[0].billNumber}, Total: ${billRes.rows[0].totalAmount}, Paid: ${billRes.rows[0].paidAmount}, Outstanding: ${billRes.rows[0].balance}`);

  // Check Stock Register items
  const stockRes = await db.query(`
    SELECT count(*)::int as count 
    FROM demand_notes dn 
    WHERE dn."costCenter" = 'SPINNING-01';
  `);
  console.log(`[6] Demand Notes with costCenter: ${stockRes.rows[0].count}`);

  const passed = custRes.rows.length === 1 &&
                 vendRes.rows.length === 1 &&
                 itemRes.rows.length === 1 &&
                 parseFloat(invRes.rows[0].balance) === 400.0 &&
                 parseFloat(billRes.rows[0].balance) === 1000.0 &&
                 stockRes.rows[0].count >= 1;

  console.log(`\n=== POST-RESTART PERSISTENCE VERIFICATION: ${passed ? 'PASS' : 'FAIL'} ===`);
  await db.end();
}

main().catch(console.error);
