const http = require('http');

async function login() {
  const res = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@industrialerp.local', password: 'Admin#2026!' })
  });
  const data = await res.json();
  return data.data?.sessionToken;
}

async function measureRoute(token, path, runs = 5) {
  const times = [];
  let status = 0;
  let dataSize = 0;

  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const res = await fetch('http://localhost:4000/api/v1' + path, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text = await res.text();
    const t1 = performance.now();
    times.push(t1 - t0);
    status = res.status;
    dataSize = text.length;
  }

  // Calculate stats
  times.sort((a, b) => a - b);
  const avg = times.reduce((s, x) => s + x, 0) / times.length;
  const p50 = times[Math.floor(times.length / 2)];
  const min = times[0];
  const max = times[times.length - 1];

  return {
    path,
    status,
    runs,
    minMs: min.toFixed(2),
    avgMs: avg.toFixed(2),
    p50Ms: p50.toFixed(2),
    maxMs: max.toFixed(2),
    dataSizeBytes: dataSize
  };
}

async function main() {
  const token = await login();
  if (!token) throw new Error('Could not log in to get sessionToken');
  console.log('Logged in successfully. Measuring routes...');

  const routes = [
    '/dashboard/revenue',
    '/inventory/stock/register',
    '/inventory/items?limit=100',
    '/sales/invoices',
    '/finance/journal-entries',
    '/purchase/bills?limit=100',
    '/finance/statutory/register'
  ];

  const results = [];
  for (const r of routes) {
    const res = await measureRoute(token, r, 5);
    results.push(res);
  }

  console.table(results);
}

main().catch(console.error);
