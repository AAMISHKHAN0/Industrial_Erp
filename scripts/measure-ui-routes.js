async function measureUiRoutes() {
  const routes = [
    '/dashboard',
    '/inventory/stock-ledger',
    '/sales/invoices',
    '/finance/ledgers'
  ];

  const results = [];
  for (const r of routes) {
    const times = [];
    let status = 0;
    let size = 0;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const res = await fetch('http://localhost:3000' + r);
      const text = await res.text();
      const t1 = performance.now();
      times.push(t1 - t0);
      status = res.status;
      size = text.length;
    }
    const avg = times.reduce((s, x) => s + x, 0) / times.length;
    results.push({
      route: r,
      status,
      avgMs: avg.toFixed(2),
      sizeBytes: size
    });
  }
  console.table(results);
}

measureUiRoutes().catch(console.error);
