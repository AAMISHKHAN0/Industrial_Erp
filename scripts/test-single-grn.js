const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));

function request(method, pathUrl, data, token, port = 4000) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const options = {
      hostname: '127.0.0.1',
      port: port,
      path: pathUrl.startsWith('/api/v1') ? pathUrl : `/api/v1${pathUrl}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  const db = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test?schema=public'
  });
  await db.connect();

  const userRes = await db.query(`SELECT id, email, "companyId", role FROM users WHERE role = 'OWNER' LIMIT 1;`);
  const user = userRes.rows[0];

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.query(`
    INSERT INTO sessions (id, "tokenHash", "userId", "expiresAt", "lastActivity", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW());
  `, [crypto.randomUUID(), tokenHash, user.id, expiresAt]);

  const rand = Math.floor(1000 + Math.random() * 9000);

  // 1. Vendor
  const vendRes = await request('POST', '/purchase/vendors', {
    vendorCode: `VEN-TEST-${rand}`,
    name: `Test Vendor ${rand}`,
    taxNumber: '1234567-8',
  }, sessionToken);
  console.log('Vendor res:', vendRes.status, vendRes.body);
  const vendorId = vendRes.body.data ? vendRes.body.data.id : vendRes.body.id;

  // 2. Item
  const itemRes = await request('POST', '/inventory/items', {
    itemCode: `ITEM-TEST-${rand}`,
    name: `Test Item ${rand}`,
    unitCost: 100,
    sellingPrice: 150,
  }, sessionToken);
  console.log('Item res:', itemRes.status, itemRes.body);
  const itemId = itemRes.body.data ? itemRes.body.data.id : itemRes.body.id;

  // 3. GRN
  const grnRes = await request('POST', '/purchase/goods-receiving', {
    grnNumber: `GRN-TEST-${rand}`,
    vendorId: vendorId,
    notes: 'Test GRN',
    items: [
      {
        itemId: itemId,
        receivedQty: 100,
        acceptedQty: 100,
        rejectedQty: 0,
        unitCost: 100,
      }
    ]
  }, sessionToken);
  console.log('GRN res:', grnRes.status, JSON.stringify(grnRes.body, null, 2));

  await db.end();
}

run().catch(console.error);
