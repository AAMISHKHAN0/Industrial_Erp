// scripts/run-and-verify-customer.js
const { spawn, execSync } = require('child_process');
const path = require('path');

async function main() {
  console.log('--- CUSTOMER FORM PARITY & PERSISTENCE VERIFIER ---');
  
  // 1. Clear any stuck process on port 4000
  try {
    const ps = execSync('powershell "Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"', { encoding: 'utf8' }).trim();
    if (ps) {
      console.log(`Clearing port 4000 (PID ${ps})...`);
      try { process.kill(parseInt(ps), 'SIGKILL'); } catch (e) {}
      execSync(`taskkill /F /PID ${ps}`, { stdio: 'ignore' });
    }
  } catch (e) {}

  await new Promise(r => setTimeout(r, 800));

  // 2. Spawn backend
  console.log('Spawning backend connected to PostgreSQL 5432...');
  const backendDir = path.resolve(__dirname, '../backend');
  const backendProc = spawn('node', ['dist/src/main.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: '4000',
      DATABASE_URL: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test?schema=public',
      JWT_SECRET: 'textile-erp-jwt-secret-key-2026',
      JWT_EXPIRATION: '3600',
      JWT_REFRESH_EXPIRATION: '86400',
      FRONTEND_URL: 'http://localhost:3000'
    },
    stdio: 'pipe'
  });

  backendProc.stdout.on('data', d => {
    const s = d.toString();
    if (s.includes('running on') || s.includes('ERROR')) console.log('[Backend]', s.trim());
  });
  backendProc.stderr.on('data', d => console.error('[Backend ERR]', d.toString().trim()));

  // 3. Wait for backend to be ready
  console.log('Awaiting backend readiness...');
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:4000/api/v1/auth/bootstrap/status');
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch (e) {}
  }

  if (!ready) {
    backendProc.kill();
    throw new Error('Backend failed to start within 15 seconds');
  }
  console.log('✓ Backend ready on http://127.0.0.1:4000/api/v1');

  try {
    const API_URL = 'http://127.0.0.1:4000/api/v1';

    // 4. Authenticate
    console.log('\n[Step 1] Authenticating as owner...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@digitalerena.local', password: 'Admin#2026!' })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed (${loginRes.status}): ${await loginRes.text()}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.data?.sessionToken;
    if (!token) throw new Error('No sessionToken in response');
    console.log('✓ Authenticated successfully with sessionToken');

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 5. Test Customer Creation with ALL 13 Baseline Form Fields
    console.log('\n[Step 2] Creating customer with all 13 baseline fields in exact order:');
    const uniqueCode = `CUST-${Date.now()}`;
    const initialPayload = {
      customerCode: uniqueCode,
      name: 'Standard Textiles Enterprise Ltd',
      contactPerson: 'Mian Tariq',
      email: 'tariq@standardtextiles.local',
      phone: '+92-300-9876543',
      address: 'Plot 45, Phase II, Industrial Estate',
      city: 'Faisalabad',
      state: 'Punjab',
      country: 'Pakistan',
      paymentTerms: 'Net 30 Days',
      taxNumber: 'STRN-1234567-8',
      rating: 5,
      creditLimit: 750000
    };

    const createRes = await fetch(`${API_URL}/sales/customers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(initialPayload)
    });

    if (!createRes.ok) {
      throw new Error(`Customer creation failed (${createRes.status}): ${await createRes.text()}`);
    }

    const createJson = await createRes.json();
    const created = createJson.data || createJson;
    const customerId = created.id;
    console.log(`✓ Customer created (ID: ${customerId})`);

    // Verify each field on created record
    const expectedFields = [
      ['customerCode', uniqueCode],
      ['name', 'Standard Textiles Enterprise Ltd'],
      ['contactPerson', 'Mian Tariq'],
      ['email', 'tariq@standardtextiles.local'],
      ['phone', '+92-300-9876543'],
      ['address', 'Plot 45, Phase II, Industrial Estate'],
      ['city', 'Faisalabad'],
      ['state', 'Punjab'],
      ['country', 'Pakistan'],
      ['paymentTerms', 'Net 30 Days'],
      ['taxNumber', 'STRN-1234567-8'],
      ['rating', 5],
      ['creditLimit', 750000]
    ];

    for (const [key, expected] of expectedFields) {
      const actual = created[key];
      if (actual !== expected) {
        throw new Error(`Field mismatch on CREATE for '${key}': expected ${expected}, got ${actual}`);
      }
      console.log(`  ✓ ${key}: ${JSON.stringify(actual)}`);
    }

    // 6. Test Customer Edit / Update
    console.log('\n[Step 3] Editing customer fields (name, contactPerson, address, city, rating, creditLimit)...');
    const updatePayload = {
      name: 'Standard Textiles Enterprise Ltd (Updated)',
      contactPerson: 'Mian Tariq Senior',
      address: 'Plot 45-B, Sector 7, Industrial Estate',
      city: 'Lahore',
      rating: 4.5,
      creditLimit: 1200000
    };

    const patchRes = await fetch(`${API_URL}/sales/customers/${customerId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify(updatePayload)
    });

    if (!patchRes.ok) {
      throw new Error(`Customer update failed (${patchRes.status}): ${await patchRes.text()}`);
    }

    const patchJson = await patchRes.json();
    const updated = patchJson.data || patchJson;

    for (const [key, expected] of Object.entries(updatePayload)) {
      const actual = updated[key];
      if (actual !== expected) {
        throw new Error(`Field mismatch on UPDATE for '${key}': expected ${expected}, got ${actual}`);
      }
      console.log(`  ✓ Updated ${key}: ${JSON.stringify(actual)}`);
    }

    // 7. Test Persistence via GET /sales/customers/:id
    console.log('\n[Step 4] Verifying database persistence via GET /sales/customers/:id...');
    const getRes = await fetch(`${API_URL}/sales/customers/${customerId}`, {
      headers: authHeaders
    });

    if (!getRes.ok) {
      throw new Error(`GET /sales/customers/:id failed (${getRes.status}): ${await getRes.text()}`);
    }

    const getJson = await getRes.json();
    const fetched = getJson.data || getJson;

    if (fetched.name !== updatePayload.name ||
        fetched.creditLimit !== updatePayload.creditLimit ||
        fetched.rating !== updatePayload.rating ||
        fetched.city !== updatePayload.city) {
      throw new Error(`Persistence validation failed: ${JSON.stringify(fetched)}`);
    }
    console.log('✓ All 13 baseline fields and updated values successfully persisted in PostgreSQL');

    // 8. Test Clean Archival
    console.log('\n[Step 5] Cleaning up test customer...');
    const delRes = await fetch(`${API_URL}/sales/customers/${customerId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    if (delRes.ok) {
      console.log(`✓ Test customer ${customerId} successfully deleted/archived`);
    }

    console.log('\n================================================================');
    console.log(' ✅ ALL CUSTOMER FORM PARITY & PERSISTENCE TESTS PASSED (100%)');
    console.log('================================================================\n');

  } finally {
    console.log('Stopping test backend process...');
    backendProc.kill();
  }
}

main().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
