import {
  generateGrnSlip,
  generateDemandNoteSlip,
  generateMaterialIssueSlip,
  generateStockRegisterPdf,
} from './src/lib/reports/stores-reports.js';

console.log('Testing offline PDF slip generation in Node.js...');

// 1. GRN slip test
const mockGrn = {
  grnNumber: 'GRN-2026-TEST-001',
  receivedDate: new Date().toISOString(),
  status: 'RECEIVED',
  vendor: { name: 'Al-Karam Textile Mills' },
  po: { poNumber: 'PO-2026-009' },
  warehouse: { name: 'Raw Material Godown A' },
  deliveryChallanNumber: 'DC-88912',
  deliveryChallanDate: '2026-11-20',
  gatePassNumber: 'GP-IN-4451',
  vehicleNumber: 'LES-9921',
  driverName: 'Muhammad Aslam',
  driverPhone: '0300-1234567',
  supplierInvoiceNumber: 'INV-44021',
  items: [
    {
      item: { itemCode: 'YRN-C30', name: 'Cotton Yarn 30s Combed' },
      orderedQty: 100,
      receivedQty: 100,
      acceptedQty: 95,
      rejectedQty: 5,
      unitCost: 160,
      rejectionReason: 'Moisture above tolerance threshold',
    },
  ],
};

const doc1 = generateGrnSlip(mockGrn);
console.log('✔ generateGrnSlip created successfully, pages:', doc1.getNumberOfPages());

// 2. Demand Note slip test
const mockDemand = {
  demandNumber: 'DEM-2026-004',
  demandDate: new Date().toISOString(),
  status: 'APPROVED',
  department: { name: 'Weaving Unit 1' },
  requester: 'Tariq Mehmood',
  costCenter: 'CC-WEAVING-01',
  priority: 'HIGH',
  items: [
    {
      item: { itemCode: 'YRN-C30', name: 'Cotton Yarn 30s Combed', unit: { code: 'KG' } },
      quantity: 50,
      issuedQty: 25,
      remarks: 'Urgent loom feeding',
    },
  ],
};

const doc2 = generateDemandNoteSlip(mockDemand);
console.log('✔ generateDemandNoteSlip created successfully, pages:', doc2.getNumberOfPages());

// 3. Material Issue slip test
const mockIssue = {
  issueNumber: 'ISS-2026-001',
  issueDate: new Date().toISOString(),
  status: 'POSTED',
  demandNote: { demandNumber: 'DEM-2026-004' },
  warehouse: { name: 'Raw Material Godown A' },
  departmentId: 'Weaving Unit 1',
  issuedTo: 'Tariq Mehmood',
  totalAmount: 4000,
  items: [
    {
      item: { itemCode: 'YRN-C30', name: 'Cotton Yarn 30s Combed', unit: { code: 'KG' } },
      quantity: 25,
      unitCost: 160,
      totalCost: 4000,
      fifoLayerId: 'layer-12345',
    },
  ],
};

const doc3 = generateMaterialIssueSlip(mockIssue);
console.log('✔ generateMaterialIssueSlip created successfully, pages:', doc3.getNumberOfPages());

// 4. Stock Register PDF test
const mockRegister = {
  dateRange: { startDate: '2026-01-01', endDate: '2026-11-21' },
  summary: {
    totalOpeningQty: 100,
    totalOpeningValue: 15000,
    totalInwardQty: 200,
    totalInwardValue: 32000,
    totalOutwardQty: 50,
    totalOutwardValue: 8000,
    totalClosingQty: 250,
    totalClosingValue: 39000,
  },
  glReconciliation: {
    inventoryValuation: 39000,
    glInventoryBalance: 39000,
    variance: 0,
    isReconciled: true,
  },
  items: [
    {
      itemCode: 'YRN-C30',
      itemName: 'Cotton Yarn 30s Combed',
      unit: 'KG',
      openingQty: 100,
      openingValue: 15000,
      inwardQty: 200,
      inwardValue: 32000,
      outwardQty: 50,
      outwardValue: 8000,
      closingQty: 250,
      closingValue: 39000,
    },
  ],
};

const doc4 = generateStockRegisterPdf(mockRegister);
console.log('✔ generateStockRegisterPdf created successfully, pages:', doc4.getNumberOfPages());

// 5. Sales Invoice PDF test (Slice D)
import('./src/lib/reports/sales-reports.js').then((m) => {
  const { generateSalesInvoicePdf, generateCustomerReceiptPdf, generateCustomerStatementPdf, generateWageSlipPdf } = m;

  const mockInv = {
    invoiceNumber: 'INV-2026-0091',
    invoiceDate: new Date().toISOString(),
    status: 'POSTED',
    voucherNumber: 'VCH-INV-001',
    subtotal: 85000,
    taxAmount: 15000,
    totalAmount: 100000,
    paidAmount: 94000,
    withheldAmount: 3000,
    outstandingAmount: 3000,
    customer: { name: 'Al-Rahim Garments', customerCode: 'CUST-001', taxNumber: 'NTN-3349921', address: 'SITE Karachi' },
    items: [
      { item: { itemCode: 'FABRIC-01' }, description: 'Cotton Twill Fabric', quantity: 100, unitPrice: 850, taxPct: 17.65, taxAmount: 15000, lineTotal: 100000 },
    ],
  };
  const doc5 = generateSalesInvoicePdf(mockInv);
  console.log('✔ generateSalesInvoicePdf created successfully, pages:', doc5.getNumberOfPages());

  const mockRec = {
    receiptNumber: 'REC-2026-0082',
    receiptDate: new Date().toISOString(),
    paymentMethod: 'CASH',
    amountReceived: 94000,
    taxWithheld: 3000,
    totalSettled: 97000,
    status: 'POSTED',
    customer: { name: 'Al-Rahim Garments', customerCode: 'CUST-001' },
    allocations: [
      { invoice: { invoiceNumber: 'INV-2026-0091', invoiceDate: new Date(), totalAmount: 100000 }, allocatedAmount: 94000, allocatedWithholding: 3000, totalAllocated: 97000 },
    ],
  };
  const doc6 = generateCustomerReceiptPdf(mockRec);
  console.log('✔ generateCustomerReceiptPdf created successfully, pages:', doc6.getNumberOfPages());

  const mockStmt = {
    customer: { id: 'c1', customerCode: 'CUST-001', name: 'Al-Rahim Garments' },
    period: { startDate: new Date('2026-01-01'), endDate: new Date() },
    openingBalance: 0,
    totalDebits: 100000,
    totalCredits: 97000,
    closingBalance: 3000,
    isReconciled: true,
    entries: [
      { date: new Date(), type: 'INVOICE', documentNumber: 'INV-2026-0091', description: 'Sales Invoice', debit: 100000, credit: 0, balance: 100000 },
      { date: new Date(), type: 'RECEIPT', documentNumber: 'REC-2026-0082', description: 'Payment Received', debit: 0, credit: 97000, balance: 3000 },
    ],
  };
  const doc7 = generateCustomerStatementPdf(mockStmt);
  console.log('✔ generateCustomerStatementPdf created successfully, pages:', doc7.getNumberOfPages());

  const mockWage = {
    periodYear: 2026,
    periodMonth: 5,
    runType: 'DAILY_WAGE',
    status: 'ACCRUED',
  };
  const mockLine = {
    employee: { firstName: 'Muhammad', lastName: 'Usman', employeeCode: 'EMP-001' },
    daysWorked: 5.5,
    dailyRate: 2000,
    grossAmount: 11000,
    deductions: 0,
    netAmount: 11000,
  };
  const doc8 = generateWageSlipPdf(mockWage, mockLine);
  console.log('✔ generateWageSlipPdf created successfully, pages:', doc8.getNumberOfPages());

  console.log('All 8 offline PDF generation tests passed successfully!');
});
