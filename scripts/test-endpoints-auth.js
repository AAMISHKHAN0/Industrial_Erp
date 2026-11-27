async function main() {
  const loginRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@industrialerp.local', password: 'Admin#2026!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.sessionToken;
  console.log('Login status:', loginRes.status, 'Token obtained:', !!token);

  const endpoints = [
    '/dashboard/revenue',
    '/inventory/stock/register',
    '/inventory/items?limit=250',
    '/sales/invoices'
  ];

  for (const ep of endpoints) {
    // 1. Without auth
    const resNoAuth = await fetch('http://localhost:4000/api/v1' + ep);
    console.log(`[NO AUTH]  ${resNoAuth.status} ${ep}`);

    // 2. With Bearer token
    const resAuth = await fetch('http://localhost:4000/api/v1' + ep, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const textAuth = await resAuth.text();
    console.log(`[AUTH OK]  ${resAuth.status} ${ep} -> ${textAuth.slice(0, 80)}`);
  }
}

main().catch(console.error);
