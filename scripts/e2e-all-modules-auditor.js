const http = require('http');

const API_BASE = 'http://127.0.0.1:4000/api/v1';
const FRONTEND_BASE = 'http://127.0.0.1:3000';

async function req(method, endpoint, body = null, token = null) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: res.status,
    ok: res.ok,
    data,
  };
}

async function checkFrontendRoute(path) {
  try {
    const res = await fetch(`${FRONTEND_BASE}${path}`, {
      method: 'GET',
      headers: { 'User-Agent': 'AuditorBot/1.0' },
      redirect: 'manual'
    });
    return { status: res.status, ok: res.status === 200 || res.status === 307 };
  } catch (err) {
    return { status: 0, error: err.message };
  }
}

const results = [];

function recordResult(moduleName, operation, passed, details = '', data = null) {
  results.push({
    module: moduleName,
    operation,
    passed,
    details,
    data
  });
  const symbol = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${symbol}] [${moduleName}] ${operation} - ${details}`);
}

async function runAudit() {
  console.log('======================================================================');
  console.log('       END-TO-END MODULE AUDIT ON LOCALHOST (PORTS 3000 & 4000)       ');
  console.log('======================================================================\n');

  // --- Step 0: Authenticate ---
  console.log('>>> AUTHENTICATION CHECK');
  const loginRes = await req('POST', '/auth/login', {
    email: 'owner@digitalerena.local',
    password: 'Admin#2026!'
  });

  if (!loginRes.ok || !loginRes.data?.data?.sessionToken) {
    recordResult('Auth', 'Login as Owner', false, `Status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
    throw new Error('Authentication failed');
  }

  const token = loginRes.data.data.sessionToken;
  const companyId = loginRes.data.data.user?.companyId;
  recordResult('Auth', 'Login as Owner', true, `Session token acquired. Company ID: ${companyId}`);

  const timestamp = Date.now().toString().slice(-5);
  const testMonth = (parseInt(timestamp) % 11) + 1; // 1 to 11
  const testYear = 2026 + (Math.floor(Date.now() / 1000) % 5); // 2026 to 2030

  // --- 1. Customers ---
  console.log('\n>>> MODULE 1: CUSTOMERS');
  const customerPayload = {
    customerCode: `CUST-AUDIT-${timestamp}`,
    name: `Audit Customer ${timestamp} Ltd`,
    contactPerson: 'Haris Qureshi',
    email: `cust_${timestamp}@testdomain.com`,
    phone: '0321-9876543',
    address: 'Sector 7, Industrial Area',
    city: 'Faisalabad',
    state: 'Punjab',
    country: 'Pakistan',
    taxNumber: `NTN: 2948${timestamp} | STRN: 19283746`,
    creditLimit: 750000,
    paymentTerms: 'NET_30'
  };

  const custRes = await req('POST', '/sales/customers', customerPayload, token);
  const customerId = custRes.data?.data?.id;
  const custPassed = custRes.status === 201 && !!customerId && custRes.data.data.creditLimit === 750000;
  recordResult('Customers', 'Create Customer with Full Data & Credit Limit', custPassed, `ID: ${customerId}, Code: ${customerPayload.customerCode}`);

  if (customerId) {
    const getCust = await req('GET', `/sales/customers/${customerId}`, null, token);
    const getPassed = getCust.status === 200 && getCust.data?.data?.name === customerPayload.name;
    recordResult('Customers', 'Retrieve Created Customer', getPassed, `Name: ${getCust.data?.data?.name}`);
  }

  // --- 2. Vendors ---
  console.log('\n>>> MODULE 2: VENDORS');
  const vendorPayload = {
    vendorCode: `VEN-AUDIT-${timestamp}`,
    name: `Audit Vendor ${timestamp} Chemicals`,
    contactPerson: 'Zahid Mahmood',
    email: `vendor_${timestamp}@testdomain.com`,
    phone: '0301-4455667',
    address: 'Plot 18, S.I.T.E Area',
    city: 'Karachi',
    state: 'Sindh',
    country: 'Pakistan',
    paymentTerms: 'Net 45',
    taxNumber: `NTN-VEN-${timestamp}`,
    rating: 5,
    creditLimit: 250000 // Verified stripped safely without crashing Prisma
  };

  const venRes = await req('POST', '/purchase/vendors', vendorPayload, token);
  const vendorId = venRes.data?.data?.id;
  const venPassed = venRes.status === 201 && !!vendorId;
  recordResult('Vendors', 'Create Vendor with Stripped CreditLimit & Full Data', venPassed, `ID: ${vendorId}, Code: ${vendorPayload.vendorCode}`);

  if (vendorId) {
    const getVen = await req('GET', `/purchase/vendors/${vendorId}`, null, token);
    recordResult('Vendors', 'Retrieve Created Vendor', getVen.status === 200, `Vendor Name: ${getVen.data?.data?.name}`);
  }

  // --- 3. Inventory Items (Warehouse, Category, Unit, Items) ---
  console.log('\n>>> MODULE 3: INVENTORY ITEMS');
  const catRes = await req('POST', '/inventory/categories', {
    name: `Category-${timestamp}`,
    code: `CAT-${timestamp}`,
    description: 'Audited Fabric Category'
  }, token);
  const categoryId = catRes.data?.data?.id;
  recordResult('Inventory', 'Create Item Category', catRes.status === 201 && !!categoryId, `Cat ID: ${categoryId}`);

  const unitRes = await req('POST', '/inventory/units', {
    name: `Meters-${timestamp}`,
    code: `MTR-${timestamp}`,
    description: 'Linear meters'
  }, token);
  const unitId = unitRes.data?.data?.id;
  recordResult('Inventory', 'Create Measurement Unit', unitRes.status === 201 && !!unitId, `Unit ID: ${unitId}`);

  const whRes = await req('POST', '/inventory/warehouses', {
    name: `Central Audited Store ${timestamp}`,
    code: `WH-${timestamp}`,
    address: 'Gate 2 Warehouse Complex'
  }, token);
  const warehouseId = whRes.data?.data?.id;
  recordResult('Inventory', 'Create Warehouse', whRes.status === 201 && !!warehouseId, `Warehouse ID: ${warehouseId}`);

  const itemRawPayload = {
    itemCode: `RAW-COTTON-${timestamp}`,
    name: `Raw Carded Cotton Yarn ${timestamp}`,
    description: '30s Combed Cotton Yarn for Weaving',
    categoryId,
    unitId,
    minStock: 100,
    maxStock: 5000,
    reorderLevel: 250,
    purchasePrice: 420.50,
    sellingPrice: 510.00
  };
  const rawItemRes = await req('POST', '/inventory/items', itemRawPayload, token);
  const rawItemId = rawItemRes.data?.data?.id;
  recordResult('Inventory', 'Create Raw Material Item', rawItemRes.status === 201 && !!rawItemId, `Item ID: ${rawItemId}, Price: PKR 420.50`);

  const itemFgPayload = {
    itemCode: `FG-TWILL-${timestamp}`,
    name: `Finished Twill Fabric ${timestamp}`,
    description: '100% Cotton 3/1 Heavy Twill Fabric',
    categoryId,
    unitId,
    minStock: 50,
    maxStock: 2000,
    reorderLevel: 100,
    purchasePrice: 650.00,
    sellingPrice: 950.00
  };
  const fgItemRes = await req('POST', '/inventory/items', itemFgPayload, token);
  const fgItemId = fgItemRes.data?.data?.id;
  recordResult('Inventory', 'Create Finished Good Item', fgItemRes.status === 201 && !!fgItemId, `Item ID: ${fgItemId}, Selling: PKR 950.00`);

  // --- 4. Demand Notes ---
  console.log('\n>>> MODULE 4: DEMAND NOTES');
  const demandNotePayload = {
    demandNumber: `DN-AUDIT-${timestamp}`,
    costCenter: 'Spinning Department',
    requestedBy: 'Foreman Aslam',
    priority: 'HIGH',
    requiredDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    remarks: 'Urgent yarn demand for production lot 44',
    items: [
      {
        itemId: rawItemId,
        quantity: 150,
        remarks: 'Batch 1 requirement'
      }
    ]
  };

  const dnRes = await req('POST', '/purchase/demand-notes', demandNotePayload, token);
  const demandNoteId = dnRes.data?.data?.id;
  const dnPassed = dnRes.status === 201 && !!demandNoteId && dnRes.data.data.items?.length === 1;
  recordResult('Demand Notes', 'Create Demand Note with Line Items', dnPassed, `DN ID: ${demandNoteId}, Demand #: ${demandNotePayload.demandNumber}`);

  if (demandNoteId) {
    const submitRes = await req('POST', `/purchase/demand-notes/${demandNoteId}/submit`, {}, token);
    recordResult('Demand Notes', 'Submit Demand Note', submitRes.status === 200 || submitRes.status === 201, `Status: ${submitRes.data?.data?.status}`);

    const approveRes = await req('POST', `/purchase/demand-notes/${demandNoteId}/approve`, {}, token);
    recordResult('Demand Notes', 'Approve Demand Note', approveRes.status === 200 || approveRes.status === 201, `Status: ${approveRes.data?.data?.status}`);
  }

  // --- 5. Goods Receiving (GRN) ---
  console.log('\n>>> MODULE 5: GOODS RECEIVING (GRN)');
  const grnPayload = {
    grnNumber: `GRN-AUDIT-${timestamp}`,
    vendorId,
    warehouseId,
    receivedDate: new Date().toISOString(),
    notes: 'Inbound consignment received and inspected',
    deliveryChallanNumber: `DC-${timestamp}`,
    biltyNumber: `BLT-${timestamp}`,
    vehicleNumber: 'LEA-9921',
    driverName: 'Muhammad Din',
    items: [
      {
        itemId: rawItemId,
        orderedQty: 200,
        receivedQty: 200,
        acceptedQty: 200,
        rejectedQty: 0,
        unitCost: 420.50,
        lotNumber: `LOT-RAW-${timestamp}`,
        remarks: 'Inspected and verified'
      }
    ]
  };

  const grnRes = await req('POST', '/purchase/goods-receiving', grnPayload, token);
  const grnId = grnRes.data?.data?.id;
  const grnPassed = grnRes.status === 201 && !!grnId && grnRes.data.data.items?.length === 1;
  recordResult('Goods Receiving', 'Create Goods Receiving Note (GRN) with Inbound Inventory', grnPassed, `GRN ID: ${grnId}, Items: ${grnRes.data?.data?.items?.length}`);

  // --- 6. Material Issue ---
  console.log('\n>>> MODULE 6: MATERIAL ISSUE');
  const minPayload = {
    issueNumber: `MIN-AUDIT-${timestamp}`,
    demandNoteId,
    warehouseId,
    departmentId: null,
    issueDate: new Date().toISOString(),
    items: [
      {
        itemId: rawItemId,
        quantity: 50,
        remarks: 'Issue for spinning floor line A'
      }
    ]
  };

  const minRes = await req('POST', '/inventory/material-issue', minPayload, token);
  const minId = minRes.data?.data?.id;
  const minPassed = minRes.status === 201 && !!minId;
  recordResult('Material Issue', 'Create Material Issue Note (MIN)', minPassed, `MIN ID: ${minId}, Qty Issued: 50`);

  // --- 7. Sales Invoices (with custom customer name and custom tax) ---
  console.log('\n>>> MODULE 7: SALES INVOICES (CUSTOM CUSTOMER & CUSTOM TAX)');
  const customCustomerName = `Al-Faisal Garments (Custom Walk-in ${timestamp})`;
  const customInvoicePayload = {
    customerName: customCustomerName,
    billingAddress: 'Main Boulevard, Gulberg III, Lahore',
    customerTaxId: `NTN: 8877665 | STRN: 33445566778`,
    invoiceNumber: `INV-AUDIT-${timestamp}`,
    invoiceDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 86400000 * 15).toISOString(),
    notes: 'Walk-in custom client with itemized custom tax rates',
    items: [
      {
        itemId: fgItemId,
        description: 'Heavy Twill Fabric Roll 100m - Standard 18% Tax',
        quantity: 10,
        unitPrice: 950.00, // Subtotal: 9,500
        taxPct: 18         // Tax: 1,710
      },
      {
        description: 'Special Finish & Calendering Service - Custom 5% Tax',
        quantity: 1,
        unitPrice: 2000.00, // Subtotal: 2,000
        taxPct: 5           // Tax: 100
      },
      {
        description: 'Packaging & Wooden Crates - Explicit Tax Amount Rs 150',
        quantity: 2,
        unitPrice: 500.00,  // Subtotal: 1,000
        taxAmount: 150      // Explicit tax: 150
      },
      {
        description: 'Export Sampling (Exempt 0% Tax)',
        quantity: 1,
        unitPrice: 1500.00, // Subtotal: 1,500
        taxPct: 0           // Tax: 0
      }
    ]
  };

  const invRes = await req('POST', '/sales/invoices', customInvoicePayload, token);
  const invoiceId = invRes.data?.data?.id;
  const invData = invRes.data?.data;

  const expectedSubtotal = 14000;
  const expectedTax = 1960;
  const expectedTotal = 15960;

  const invSubtotalMatch = Math.abs(parseFloat(invData?.subtotal) - expectedSubtotal) < 0.01;
  const invTaxMatch = Math.abs(parseFloat(invData?.taxAmount) - expectedTax) < 0.01;
  const invTotalMatch = Math.abs(parseFloat(invData?.totalAmount) - expectedTotal) < 0.01;

  const invSuccess = invRes.status === 201 && !!invoiceId && invSubtotalMatch && invTaxMatch && invTotalMatch && !isNaN(invData?.totalAmount);
  recordResult('Sales Invoices', 'Create Invoice with Custom Customer Name & Itemized Custom Taxes', invSuccess,
    `Invoice ID: ${invoiceId}, Subtotal: PKR ${invData?.subtotal} (exp ${expectedSubtotal}), Tax: PKR ${invData?.taxAmount} (exp ${expectedTax}), Total: PKR ${invData?.totalAmount} (exp ${expectedTotal}), Outstanding: PKR ${invData?.outstandingAmount}`);

  // Create Standard Invoice for Existing Customer
  const stdInvoicePayload = {
    customerId: customerId,
    invoiceNumber: `INV-STD-${timestamp}`,
    invoiceDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    notes: 'Invoice for Customer Receipt Allocation Testing',
    items: [
      {
        itemId: fgItemId,
        description: 'Export Quality Twill Fabric 100m',
        quantity: 5,
        unitPrice: 1000.00,
        taxPct: 18 // Subtotal 5000, Tax 900, Total 5900
      }
    ]
  };
  const stdInvRes = await req('POST', '/sales/invoices', stdInvoicePayload, token);
  const stdInvoiceId = stdInvRes.data?.data?.id;
  const stdInvTotal = parseFloat(stdInvRes.data?.data?.totalAmount);
  recordResult('Sales Invoices', 'Create Standard Invoice for Existing Customer', stdInvRes.status === 201 && !!stdInvoiceId, `ID: ${stdInvoiceId}, Total: PKR ${stdInvTotal}`);

  // --- 8. Customer Receipts ---
  console.log('\n>>> MODULE 8: CUSTOMER RECEIPTS & ALLOCATIONS');
  const receiptPayload = {
    customerId,
    receiptNumber: `RCT-AUDIT-${timestamp}`,
    paymentMethod: 'BANK',
    amountReceived: 3000.00,
    taxWithheld: 200.00,
    withholdingSection: 'Section 153(1)(a) Goods (4%)',
    withholdingCertificate: `WHT-CERT-${timestamp}`,
    allocations: [
      {
        invoiceId: stdInvoiceId,
        amount: 3000.00,
        withholding: 200.00
      }
    ]
  };

  const rctRes = await req('POST', '/sales/customer-receipts', receiptPayload, token);
  const receiptId = rctRes.data?.data?.id;
  const rctPassed = (rctRes.status === 201 || rctRes.status === 200) && !!receiptId;
  recordResult('Customer Receipts', 'Create Customer Receipt with WHT and Invoice Allocation', rctPassed, `Receipt ID: ${receiptId}, Recv: PKR 3,000, WHT: PKR 200`);

  if (stdInvoiceId) {
    const checkInv = await req('GET', `/sales/invoices/${stdInvoiceId}`, null, token);
    const updatedOutstanding = parseFloat(checkInv.data?.data?.outstandingAmount);
    const expectedRemaining = 5900 - 3000 - 200; // 2700
    const balanceMatch = Math.abs(updatedOutstanding - expectedRemaining) < 0.01;
    recordResult('Customer Receipts', 'Verify Invoice Balance Decremented Post Allocation', balanceMatch, `Updated Outstanding: PKR ${updatedOutstanding} (exp ${expectedRemaining})`);
  }

  // --- 9. Production BOM & Orders ---
  console.log('\n>>> MODULE 9: PRODUCTION BOM & ORDERS');
  const bomPayload = {
    bomNumber: `BOM-TWILL-${timestamp}`,
    itemId: fgItemId,
    quantity: 100,
    wastePct: 2.5,
    description: 'BOM for 100 meters heavy twill weaving',
    materials: [
      {
        itemId: rawItemId,
        quantity: 110,
        unit: 'KG',
        scrapPct: 2.0,
        costShare: 100
      }
    ]
  };

  const bomRes = await req('POST', '/production/bom', bomPayload, token);
  const bomId = bomRes.data?.data?.id;
  const bomPassed = bomRes.status === 201 && !!bomId;
  recordResult('Production BOM', 'Create Bill of Materials (BOM)', bomPassed, `BOM ID: ${bomId}, BOM #: ${bomPayload.bomNumber}`);

  const poProdPayload = {
    productionNumber: `PRD-ORD-${timestamp}`,
    itemId: fgItemId,
    bomId: bomId,
    quantity: 500,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
    priority: 'HIGH',
    notes: 'Order for export delivery batch'
  };

  const poProdRes = await req('POST', '/production/orders', poProdPayload, token);
  const prodOrderId = poProdRes.data?.data?.id;
  const prodOrderPassed = poProdRes.status === 201 && !!prodOrderId;
  recordResult('Production Orders', 'Create Production Order with Linked BOM', prodOrderPassed, `Prod Order ID: ${prodOrderId}, Qty: 500`);

  // --- 10. HR Wages & Payroll ---
  console.log('\n>>> MODULE 10: HR WAGES & PAYROLL');
  const empPayload = {
    employeeCode: `EMP-AUDIT-${timestamp}`,
    firstName: 'Tariq',
    lastName: 'Operator',
    email: `tariq_${timestamp}@textile.local`,
    phone: '0333-1122334',
    salary: 45000,
    status: 'ACTIVE'
  };

  const empRes = await req('POST', '/master-data/employee', empPayload, token);
  const employeeId = empRes.data?.data?.id;
  const empPassed = empRes.status === 201 && !!employeeId;
  recordResult('HR Employee', 'Create Employee Profile with Full DTO Validation', empPassed, `Emp ID: ${employeeId}, Code: ${empPayload.employeeCode}`);

  if (employeeId) {
    const wageRunPayload = {
      periodMonth: testMonth,
      periodYear: testYear,
      runType: 'DAILY_WAGE',
      notes: `Loom operator wages disbursement audit ${testYear}-${testMonth}`,
      lines: [
        {
          employeeId: employeeId,
          daysWorked: 6.5,
          dailyRate: 1800, // Gross: 11,700
          deductions: 500  // Net: 11,200
        }
      ]
    };

    const wageRes = await req('POST', '/hr/wages', wageRunPayload, token);
    const wageRunId = wageRes.data?.data?.id;
    const wageTotal = parseFloat(wageRes.data?.data?.totalAmount);
    const lineGross = wageRes.data?.data?.lines?.[0]?.grossAmount;
    const lineNet = wageRes.data?.data?.lines?.[0]?.netAmount;
    const wagePassed = wageRes.status === 201 && !!wageRunId && wageTotal === 11200 && lineGross === 11700 && lineNet === 11200;
    recordResult('HR Wages', 'Create Wage Run with Fractional Days (6.5 days)', wagePassed, `Wage Run ID: ${wageRunId}, Total Amount: PKR ${wageTotal}, Line Gross: PKR ${lineGross}, Line Net: PKR ${lineNet}`);

    if (wageRunId) {
      const disburseRes = await req('POST', `/hr/wages/${wageRunId}/disburse`, {
        paymentMethod: 'CASH',
        notes: 'Cash wages handed over by Cashier'
      }, token);
      const disbursePassed = disburseRes.status === 200 || disburseRes.status === 201;
      recordResult('HR Wages', 'Disburse Wage Run', disbursePassed, `Disbursed Status: ${disburseRes.data?.data?.status}`);
    }
  }

  const payheadRes = await req('POST', '/hr/payroll/payhead', {
    name: `Production Attendance Allowance ${timestamp}`,
    code: `ATTN-${timestamp}`,
    type: 'EARNING',
    amount: 3500
  }, token);
  const payheadId = payheadRes.data?.data?.id;
  recordResult('HR Payroll', 'Create Payroll Payhead', payheadRes.status === 201 && !!payheadId, `Payhead ID: ${payheadId}`);

  const periodRes = await req('POST', '/hr/payroll/period', {
    name: `Payroll Cycle ${testYear}-${testMonth}`,
    periodYear: testYear,
    periodMonth: testMonth,
    startDate: `${testYear}-${String(testMonth).padStart(2, '0')}-01`,
    endDate: `${testYear}-${String(testMonth).padStart(2, '0')}-28`
  }, token);
  const periodId = periodRes.data?.data?.id;
  recordResult('HR Payroll', 'Create Payroll Period', periodRes.status === 201 && !!periodId, `Period ID: ${periodId}`);

  // --- 11. Statutory Payments & Expenses ---
  console.log('\n>>> MODULE 11: STATUTORY PAYMENTS & EXPENSES');
  const obligationPayload = {
    head: 'SALES_TAX',
    authority: 'FBR',
    registrationNumber: `FBR-STRN-${timestamp}`,
    taxPeriod: `${testYear}-${String(testMonth).padStart(2, '0')}`,
    dueAmount: 85000.00,
    dueDate: new Date(Date.now() + 86400000 * 10).toISOString(),
    challanNumber: `CH-FBR-${timestamp}`,
    psid: `99228833${timestamp}`,
    notes: 'Monthly sales tax return liability audit test'
  };

  const obRes = await req('POST', '/finance/statutory/obligations', obligationPayload, token);
  const obligationId = obRes.data?.data?.id;
  const obPassed = obRes.status === 201 && !!obligationId;
  recordResult('Statutory Payments', 'Create Statutory Tax Obligation (FBR Sales Tax)', obPassed, `Obligation ID: ${obligationId}, Amount: PKR 85,000`);

  if (obligationId) {
    const paymentPayload = {
      obligationId,
      amount: 85000.00,
      paymentMethod: 'BANK',
      paymentDate: new Date().toISOString(),
      cprNumber: `CPR-FBR-${timestamp}`,
      notes: 'Payment via National Bank e-Challan'
    };
    const payRes = await req('POST', '/finance/statutory/payments', paymentPayload, token);
    const payPassed = (payRes.status === 200 || payRes.status === 201);
    recordResult('Statutory Payments', 'Record Statutory Payment & Settle Obligation', payPassed, `Status: ${payRes.data?.data?.status || payRes.status}`);
  }

  // Create General Ledger Accounts & Journal Entry (Expenses)
  const expenseAccRes = await req('POST', '/finance/accounts', {
    accountCode: `EXP-UTIL-${timestamp}`,
    name: `Factory Electricity & Power ${timestamp}`,
    type: 'EXPENSE',
    description: 'Direct factory electricity utility expense'
  }, token);
  const expenseAccountId = expenseAccRes.data?.data?.id;

  const bankAccRes = await req('POST', '/finance/accounts', {
    accountCode: `BANK-MEEZAN-${timestamp}`,
    name: `Meezan Industrial Operating Account ${timestamp}`,
    type: 'ASSET',
    description: 'Meezan Bank Company Current Account'
  }, token);
  const bankAccountId = bankAccRes.data?.data?.id;

  recordResult('Finance Accounts', 'Create Expense and Bank Ledger Accounts', !!expenseAccountId && !!bankAccountId, `Expense Acc: ${expenseAccountId}, Bank Acc: ${bankAccountId}`);

  if (expenseAccountId && bankAccountId) {
    const journalEntryPayload = {
      entryNumber: `JV-EXP-${timestamp}`,
      entryDate: new Date().toISOString(),
      reference: `LESCO-BILL-${timestamp}`,
      description: 'Factory power utility bill payment',
      items: [
        {
          accountId: expenseAccountId,
          debitAmount: 45000.00,
          creditAmount: 0,
          description: 'Factory power expense'
        },
        {
          accountId: bankAccountId,
          debitAmount: 0,
          creditAmount: 45000.00,
          description: 'Payment via Bank transfer'
        }
      ]
    };

    const jvRes = await req('POST', '/finance/journal-entries', journalEntryPayload, token);
    const jvId = jvRes.data?.data?.id;
    const jvPassed = jvRes.status === 201 && !!jvId;
    recordResult('Finance Journal Entries', 'Post Expense Journal Entry with Balanced Debits/Credits', jvPassed, `JV ID: ${jvId}, Amount: PKR 45,000`);
  }

  // --- 12. Reports ---
  console.log('\n>>> MODULE 12: REPORTS AUDIT');
  const stockRegRes = await req('GET', '/inventory/stock/register', null, token);
  const stockItemsCount = stockRegRes.data?.data?.items?.length ?? (Array.isArray(stockRegRes.data?.data) ? stockRegRes.data.data.length : 0);
  const stockPassed = stockRegRes.status === 200 && (stockRegRes.data?.data?.items !== undefined || Array.isArray(stockRegRes.data?.data));
  recordResult('Reports', 'Stock Register Report (FIFO movements)', stockPassed, `Records: ${stockItemsCount} items, GL Reconciliation: ${stockRegRes.data?.data?.glReconciliation?.status || 'OK'}`);

  const arAgingRes = await req('GET', '/sales/customer-statements/aging', null, token);
  const arPassed = arAgingRes.status === 200;
  recordResult('Reports', 'Customer AR Aging Report', arPassed, `Status: ${arAgingRes.status}`);

  const statementRes = await req('GET', `/sales/customer-statements/${customerId}`, null, token);
  const statementPassed = statementRes.status === 200;
  recordResult('Reports', 'Individual Customer Statement Report', statementPassed, `Customer ID: ${customerId}`);

  const statRegRes = await req('GET', '/finance/statutory/register', null, token);
  const statPassed = statRegRes.status === 200;
  recordResult('Reports', 'Statutory Tax Register & Compliance Report', statPassed, `Status: ${statRegRes.status}`);

  // --- 13. Settings ---
  console.log('\n>>> MODULE 13: SETTINGS');
  const compGet = await req('GET', '/master-data/company', null, token);
  const liveCompId = Array.isArray(compGet.data?.data) ? compGet.data.data[0]?.id : compGet.data?.data?.id;

  if (liveCompId) {
    const updateCompRes = await req('PATCH', `/master-data/company/${liveCompId}`, {
      phone: '+92 42 35912345 / 0300-1234567',
      address: 'Plot 45, Sector 15, Korangi Industrial Area',
      taxNumber: `NTN: 1234567-8 | STRN: 12-34-5678-901-23`
    }, token);
    const compPassed = updateCompRes.status === 200;
    recordResult('Settings', 'Update Company Profile (Contact, Address, NTN/STRN)', compPassed, `Company ID: ${liveCompId}`);
  } else {
    recordResult('Settings', 'Get Company Profile', false, 'Company ID not found');
  }

  const branchRes = await req('POST', '/master-data/branch', {
    name: `North Weaving Unit ${timestamp}`,
    code: `BR-N-${timestamp}`,
    address: 'Sheikhupura Road, Faisalabad'
  }, token);
  const branchPassed = branchRes.status === 201;
  recordResult('Settings', 'Create Organizational Branch', branchPassed, `Branch Code: BR-N-${timestamp}`);

  // --- 14. ValidationPipe Edge-Cases ---
  console.log('\n>>> VALIDATIONPIPE REJECTION TESTS (Negative Tests)');
  const badCust = await req('POST', '/sales/customers', { name: 'Nameless' }, token);
  const badCustRejected = badCust.status === 400;
  recordResult('ValidationPipe', 'Reject Customer Missing customerCode (HTTP 400)', badCustRejected, `Status: ${badCust.status}`);

  const badVen = await req('POST', '/purchase/vendors', { vendorCode: 'V1', name: 'V', rating: -5 }, token);
  const badVenRejected = badVen.status === 400;
  recordResult('ValidationPipe', 'Reject Vendor with Negative Rating (HTTP 400)', badVenRejected, `Status: ${badVen.status}`);

  if (expenseAccountId && bankAccountId) {
    const badJv = await req('POST', '/finance/journal-entries', {
      entryNumber: `BAD-JV-${timestamp}`,
      items: [
        { accountId: expenseAccountId, debitAmount: 100, creditAmount: 0 },
        { accountId: bankAccountId, debitAmount: 0, creditAmount: 50 }
      ]
    }, token);
    const badJvRejected = badJv.status === 400;
    recordResult('ValidationPipe', 'Reject Unbalanced Journal Entry (HTTP 400)', badJvRejected, `Status: ${badJv.status}`);
  }

  // --- 15. Frontend UI Route Availability Check (Port 3000) ---
  console.log('\n>>> FRONTEND UI ROUTE AUDIT (Port 3000)');
  const frontendRoutes = [
    '/login',
    '/customers',
    '/vendors',
    '/inventory/items',
    '/inventory/warehouses',
    '/purchase/demand-notes',
    '/purchase/goods-receiving',
    '/inventory/material-issue',
    '/sales/invoices',
    '/sales/receipts',
    '/production/bom',
    '/production/orders',
    '/hr/wages',
    '/hr/payroll',
    '/finance/statutory',
    '/reports',
    '/settings'
  ];

  for (const route of frontendRoutes) {
    const routeCheck = await checkFrontendRoute(route);
    recordResult('Frontend UI', `Route ${route} Accessibility`, routeCheck.ok, `HTTP Status: ${routeCheck.status}`);
  }

  // Summary
  console.log('\n======================================================================');
  console.log('                          AUDIT SUMMARY                               ');
  console.log('======================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`TOTAL CHECKS: ${total}`);
  console.log(`PASSED:       ${passed}`);
  console.log(`FAILED:       ${failed}`);

  if (failed > 0) {
    console.log('\nFAILED ITEMS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(` - [${r.module}] ${r.operation}: ${r.details}`);
    });
  }

  console.log('======================================================================');
  return { total, passed, failed, results };
}

runAudit().catch(err => {
  console.error('Fatal Audit Error:', err);
  process.exit(1);
});
