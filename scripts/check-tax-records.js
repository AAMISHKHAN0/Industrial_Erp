const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));
const fs = require('fs');

async function main() {
  const creds = JSON.parse(fs.readFileSync('C:/Users/Aamishkhan/AppData/Roaming/Industrial ERP/data/.db_credentials.json', 'utf8'));
  const client = new Client({ host: '127.0.0.1', port: 5433, user: creds.adminUser, password: creds.adminPassword, database: 'textile_erp' });
  await client.connect();

  const cRes = await client.query('SELECT id, name, "customerCode", "taxNumber" FROM customers');
  console.log('Customers count:', cRes.rows.length);
  console.log('Customers sample:', cRes.rows);

  const invRes = await client.query('SELECT id, "invoiceNumber", "customerTaxId", subtotal, "taxAmount", "totalAmount" FROM sales_invoices');
  console.log('Invoices count:', invRes.rows.length);
  console.log('Invoices sample:', invRes.rows);

  // Check company tax info as well
  const compRes = await client.query('SELECT id, name, "taxNumber", ntn, strn FROM companies');
  console.log('Company tax info:', compRes.rows);

  await client.end();
}

main().catch(console.error);
