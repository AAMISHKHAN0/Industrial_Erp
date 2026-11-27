const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test'
  });
  try {
    await client.connect();
    const cRes = await client.query('SELECT id, name, "customerCode", "taxNumber" FROM customers WHERE "taxNumber" IS NOT NULL');
    console.log('5432 Customers with taxNumber:', cRes.rows);
    const invRes = await client.query('SELECT id, "invoiceNumber", "customerTaxId" FROM sales_invoices WHERE "customerTaxId" IS NOT NULL');
    console.log('5432 Invoices with customerTaxId:', invRes.rows);
    await client.end();
  } catch (err) {
    console.log('5432 connection error:', err.message);
  }
}
main();
