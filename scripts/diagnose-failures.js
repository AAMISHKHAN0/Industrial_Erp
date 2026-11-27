const API_BASE = 'http://127.0.0.1:4000/api/v1';

async function req(method, endpoint, body = null, token = null) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function debug() {
  const loginRes = await req('POST', '/auth/login', {
    email: 'owner@digitalerena.local',
    password: 'Admin#2026!'
  });
  const token = loginRes.data.data.sessionToken;

  console.log('--- 1. Debug Employee Create ---');
  const empRes = await req('POST', '/master-data/employee', {
    employeeCode: `EMP-DBG-${Date.now().toString().slice(-4)}`,
    name: 'Tariq Loom Operator',
    salary: 45000,
    dailyWageRate: 1800,
    status: 'ACTIVE'
  }, token);
  console.log('Employee res:', empRes);

  console.log('\n--- 2. Debug Statutory Payment ---');
  // First create obligation
  const obRes = await req('POST', '/finance/statutory/obligations', {
    head: 'SALES_TAX',
    authority: 'FBR',
    taxPeriod: '2026-10',
    dueAmount: 5000
  }, token);
  console.log('Obligation res:', obRes);
  const obId = obRes.data?.data?.id;
  if (obId) {
    const payRes = await req('POST', '/finance/statutory/payments', {
      obligationId: obId,
      paidAmount: 5000,
      paymentDate: new Date().toISOString()
    }, token);
    console.log('Payment res:', payRes);
  }

  console.log('\n--- 3. Debug Finance Account ---');
  const accRes = await req('POST', '/finance/accounts', {
    accountCode: `EXP-DBG-${Date.now().toString().slice(-4)}`,
    accountName: 'Factory Electricity',
    accountType: 'EXPENSE',
    classification: 'INDIRECT_EXPENSE'
  }, token);
  console.log('Account res:', accRes);

  console.log('\n--- 4. Debug Stock Register Report ---');
  const stockRes = await req('GET', '/inventory/stock/register', null, token);
  console.log('Stock register res:', stockRes);
  const stockAliasRes = await req('GET', '/inventory/stock-register', null, token);
  console.log('Stock register alias res:', stockAliasRes);
}

debug().catch(console.error);
