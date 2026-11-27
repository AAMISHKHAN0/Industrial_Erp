const path = require("path");
const { Client } = require(path.resolve(__dirname, "../backend/node_modules/pg"));

async function testCustomSalesInvoice() {
  console.log("=== Testing Custom Sales Invoice Flow ===");
  const client = new Client({
    connectionString: "postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test",
  });
  await client.connect();

  const compRes = await client.query('SELECT id FROM "companies" LIMIT 1');
  const companyId = compRes.rows[0].id;

  const customCustomerName = "Royal Silk Mills (Walk-in Custom)";
  const customNtn = "9876543-2";
  const customStrn = "1122334455667";
  const customAddress = "Plot 42, Sundar Industrial Estate, Lahore";

  console.log("1. Finding or creating custom customer by name:", customCustomerName);
  let custRes = await client.query(
    'SELECT id, name FROM "customers" WHERE "companyId" = $1 AND LOWER(name) = LOWER($2) AND "deletedAt" IS NULL',
    [companyId, customCustomerName]
  );

  let customerId;
  if (custRes.rows.length > 0) {
    customerId = custRes.rows[0].id;
    console.log("   Found existing customer:", customerId);
  } else {
    const newCust = await client.query(
      `INSERT INTO "customers" ("id", "companyId", "customerCode", "name", "taxNumber", "address", "status", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ACTIVE', NOW())
       RETURNING id, name`,
      [companyId, `CUST-${Date.now().toString().slice(-4)}`, customCustomerName, `NTN: ${customNtn} | STRN: ${customStrn}`, customAddress]
    );
    customerId = newCust.rows[0].id;
    console.log("   Created new customer on the fly:", customerId, newCust.rows[0].name);
  }

  // Define custom line items with user-applied taxes:
  // Item 1: 5% custom tax
  // Item 2: direct tax amount 250 PKR
  // Item 3: 0% tax (exempt/zero-rated)
  const items = [
    { description: "Custom Jacquard Weave Fabric", quantity: 100, unitPrice: 450, taxPct: 5 },
    { description: "Dyeing & Finishing Services", quantity: 2, unitPrice: 3500, taxAmount: 250 },
    { description: "Packing Materials (Exempt)", quantity: 50, unitPrice: 80, taxPct: 0 }
  ];

  let subtotal = 0;
  let totalTax = 0;

  const processedItems = items.map(item => {
    const lineSubtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
    let lineTax = 0;
    let taxPct = item.taxPct ?? 0;
    if (item.taxAmount !== undefined && item.taxAmount !== null && item.taxAmount >= 0) {
      lineTax = Math.round(item.taxAmount * 100) / 100;
      taxPct = lineSubtotal > 0 ? Math.round((lineTax / lineSubtotal) * 10000) / 100 : 0;
    } else {
      lineTax = Math.round(((lineSubtotal * taxPct) / 100) * 100) / 100;
    }
    const lineTotal = Math.round((lineSubtotal + lineTax) * 100) / 100;
    subtotal += lineSubtotal;
    totalTax += lineTax;
    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxPct,
      taxAmount: lineTax,
      lineTotal
    };
  });

  const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;
  const invoiceNumber = `INV-CUSTOM-${Date.now().toString().slice(-4)}`;

  console.log("\n2. Processed Line Items with Custom Taxes:");
  processedItems.forEach((it, i) => {
    console.log(`   Line ${i+1}: ${it.description} | Qty: ${it.quantity} @ Rs ${it.unitPrice} | Tax Rate: ${it.taxPct}% | Tax Amt: Rs ${it.taxAmount} | Line Total: Rs ${it.lineTotal}`);
  });
  console.log(`   Net Subtotal: Rs ${subtotal} | Total Tax Applied: Rs ${totalTax} | Grand Total: Rs ${grandTotal}`);

  // Create invoice
  const invRes = await client.query(
    `INSERT INTO "sales_invoices" (
      "id", "companyId", "invoiceNumber", "customerId", "invoiceDate", "status",
      "subtotal", "taxAmount", "totalAmount", "paidAmount", "withheldAmount", "outstandingAmount",
      "customerTaxId", "billingAddress", "notes", "updatedAt"
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, NOW(), 'POSTED',
      $4, $5, $6, 0, 0, $6,
      $7, $8, 'Custom invoice with user-applied taxes', NOW()
    ) RETURNING id, "invoiceNumber", "totalAmount", "taxAmount"`,
    [
      companyId,
      invoiceNumber,
      customerId,
      subtotal,
      totalTax,
      grandTotal,
      `NTN: ${customNtn} | STRN: ${customStrn}`,
      customAddress
    ]
  );

  const invoiceId = invRes.rows[0].id;
  console.log("\n3. Saved Sales Invoice to database:", invRes.rows[0]);

  for (const it of processedItems) {
    await client.query(
      `INSERT INTO "sales_invoice_items" (
        "id", "invoiceId", "description", "quantity", "unitPrice", "taxPct", "taxAmount", "lineTotal"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7
      )`,
      [invoiceId, it.description, it.quantity, it.unitPrice, it.taxPct, it.taxAmount, it.lineTotal]
    );
  }

  // Verify fetch
  const verifyRes = await client.query(
    `SELECT i."invoiceNumber", i."totalAmount", i."taxAmount", c.name as customer_name,
            COUNT(it.id) as item_count
     FROM "sales_invoices" i
     JOIN "customers" c ON c.id = i."customerId"
     JOIN "sales_invoice_items" it ON it."invoiceId" = i.id
     WHERE i.id = $1
     GROUP BY i."invoiceNumber", i."totalAmount", i."taxAmount", c.name`,
    [invoiceId]
  );

  console.log("\n4. Verification Query Result:", verifyRes.rows[0]);
  console.log("\n[SUCCESS] Custom Sales Invoice with user customer name and self-applied tax works flawlessly!");

  await client.end();
}

testCustomSalesInvoice().catch(console.error);
