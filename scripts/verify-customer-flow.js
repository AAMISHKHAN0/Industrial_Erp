// scripts/verify-customer-flow.js
const API_URL = process.env.API_URL || 'http://127.0.0.1:4000/api/v1';

async function verifyCustomerFlow() {
  console.log(`[Customer Verification] Connecting to ${API_URL}...`);

  // 1. Authenticate as owner
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@digitalerena.local', password: 'Admin#2026!' })
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.data?.sessionToken;
  if (!token) throw new Error('No session token returned');
  console.log('✓ Successfully authenticated as owner@digitalerena.local');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Create customer with all 13 baseline fields
  const uniqueCode = `CUST-${Date.now()}`;
  const initialPayload = {
    customerCode: uniqueCode,
    name: 'Standard Textiles Enterprise',
    contactPerson: 'Mian Tariq',
    email: 'tariq@standardtextiles.local',
    phone: '+92-300-9876543',
    address: 'Plot 45, Phase II, Textile City',
    city: 'Faisalabad',
    state: 'Punjab',
    country: 'Pakistan',
    paymentTerms: 'Net 30 Days',
    taxNumber: 'STRN-1234567-8',
    rating: 5,
    creditLimit: 750000
  };

  console.log(`[Customer Verification] Creating customer ${uniqueCode}...`);
  const createRes = await fetch(`${API_URL}/sales/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(initialPayload)
  });

  if (!createRes.ok) {
    throw new Error(`Customer creation failed (${createRes.status}): ${await createRes.text()}`);
  }

  const createJson = await createRes.json();
  const createdCustomer = createJson.data || createJson;
  const customerId = createdCustomer.id;
  console.log(`✓ Customer created with ID: ${customerId}`);

  // Validate all fields present on created entity
  for (const [key, expected] of Object.entries(initialPayload)) {
    const actual = createdCustomer[key];
    if (actual !== expected) {
      throw new Error(`Field mismatch on CREATE for ${key}: expected ${expected}, got ${actual}`);
    }
  }
  console.log('✓ All 13 baseline fields verified on creation:');
  console.log(`  - customerCode: "${createdCustomer.customerCode}"`);
  console.log(`  - name: "${createdCustomer.name}"`);
  console.log(`  - contactPerson: "${createdCustomer.contactPerson}"`);
  console.log(`  - email: "${createdCustomer.email}"`);
  console.log(`  - phone: "${createdCustomer.phone}"`);
  console.log(`  - address: "${createdCustomer.address}"`);
  console.log(`  - city: "${createdCustomer.city}"`);
  console.log(`  - state: "${createdCustomer.state}"`);
  console.log(`  - country: "${createdCustomer.country}"`);
  console.log(`  - paymentTerms: "${createdCustomer.paymentTerms}"`);
  console.log(`  - taxNumber: "${createdCustomer.taxNumber}"`);
  console.log(`  - rating: ${createdCustomer.rating}`);
  console.log(`  - creditLimit: ${createdCustomer.creditLimit}`);

  // 3. Edit / Update customer
  const updatePayload = {
    name: 'Standard Textiles Enterprise Updated',
    contactPerson: 'Mian Tariq Senior',
    address: 'Plot 45-B, Phase II, Textile City',
    city: 'Lahore',
    rating: 4.5,
    creditLimit: 1200000
  };

  console.log(`\n[Customer Verification] Editing customer ${customerId}...`);
  const updateRes = await fetch(`${API_URL}/sales/customers/${customerId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify(updatePayload)
  });

  if (!updateRes.ok) {
    throw new Error(`Customer update failed (${updateRes.status}): ${await updateRes.text()}`);
  }

  const updateJson = await updateRes.json();
  const updatedCustomer = updateJson.data || updateJson;

  for (const [key, expected] of Object.entries(updatePayload)) {
    const actual = updatedCustomer[key];
    if (actual !== expected) {
      throw new Error(`Field mismatch on UPDATE for ${key}: expected ${expected}, got ${actual}`);
    }
  }
  console.log('✓ All updated fields verified on update');

  // 4. Fetch customer by ID and verify persistence
  console.log(`[Customer Verification] Fetching customer ${customerId} to verify persistence...`);
  const fetchRes = await fetch(`${API_URL}/sales/customers/${customerId}`, {
    headers: authHeaders
  });

  if (!fetchRes.ok) {
    throw new Error(`Customer fetch failed (${fetchRes.status}): ${await fetchRes.text()}`);
  }

  const fetchJson = await fetchRes.json();
  const persisted = fetchJson.data || fetchJson;

  if (persisted.name !== updatePayload.name || persisted.creditLimit !== updatePayload.creditLimit || persisted.rating !== updatePayload.rating) {
    throw new Error(`Persistence verification failed: ${JSON.stringify(persisted)}`);
  }
  console.log('✓ Customer persistence confirmed in database');

  // 5. Clean up (delete customer)
  const delRes = await fetch(`${API_URL}/sales/customers/${customerId}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  if (delRes.ok) {
    console.log(`✓ Test customer ${customerId} cleanly archived`);
  }

  console.log('\n======================================================');
  console.log(' [PASS] All Customer Form Parity & Persistence Checks Passed 100%!');
  console.log('======================================================\n');
}

verifyCustomerFlow().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});
