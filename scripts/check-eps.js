(async () => {
  const login = await fetch("http://127.0.0.1:4000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@digitalerena.local", password: "Admin#2026!" })
  }).then(r => r.json());
  const token = login.data.sessionToken;
  
  const endpoints = [
    "/reports/sales-summary",
    "/inventory/stock-register",
    "/sales/invoices?limit=50",
    "/inventory/items?limit=50",
    "/finance/statutory/register",
    "/dashboard/summary"
  ];
  for (const ep of endpoints) {
    const res = await fetch("http://127.0.0.1:4000/api/v1" + ep, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    console.log(ep, "->", res.status);
  }
})();
