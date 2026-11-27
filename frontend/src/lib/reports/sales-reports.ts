import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmt, formatDate, formatDateTime } from "./stores-reports";
import { getStoredCompany } from "../company";

/**
 * 1. Offline Sales Invoice Document Generator
 */
export function generateSalesInvoicePdf(invoice: any): jsPDF {
  const comp = getStoredCompany();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Title Banner with Active Company Profile
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(comp.name?.toUpperCase() || "INDUSTRIAL ERP", 14, 11);

  const compContact = [
    comp.address,
    comp.phone ? `Ph: ${comp.phone}` : "",
    comp.taxNumber ? `NTN/STRN: ${comp.taxNumber}` : "",
  ].filter(Boolean).join("  •  ");

  if (compContact) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(compContact, 14, 19);
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("OFFICIAL SALES TAX INVOICE", pageWidth - 14, 15, { align: "right" });

  doc.setTextColor(0, 0, 0);

  // Metadata block
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE DETAILS:", 14, 32);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, 14, 38);
  doc.text(`Date: ${formatDate(invoice.invoiceDate)}`, 14, 44);
  doc.text(`Status: ${invoice.status}`, 14, 50);
  if (invoice.voucherId) {
    doc.text(`GL Voucher: ${invoice.voucherNumber ?? invoice.voucherId}`, 14, 56);
  }

  // Customer block
  const custX = 110;
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO (CUSTOMER):", custX, 32);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${invoice.customer?.name ?? "-"}`, custX, 38);
  doc.text(`Customer Code: ${invoice.customer?.customerCode ?? "-"}`, custX, 44);
  doc.text(`NTN / STRN: ${invoice.customerTaxId ?? invoice.customer?.taxNumber ?? "Unregistered"}`, custX, 50);
  doc.text(`Address: ${invoice.billingAddress ?? invoice.customer?.address ?? "-"}`, custX, 56);

  // Line Items Table
  const tableRows = (invoice.items || []).map((item: any, idx: number) => [
    idx + 1,
    item.item?.itemCode ?? item.itemId ?? "-",
    item.description ?? item.item?.name ?? "Finished Goods",
    fmt(item.quantity),
    `PKR ${fmt(item.unitPrice)}`,
    `${item.taxPct ?? 0}%`,
    `PKR ${fmt(item.taxAmount ?? 0)}`,
    `PKR ${fmt(item.lineTotal ?? 0)}`,
  ]);

  autoTable(doc, {
    startY: 64,
    head: [["#", "Item Code", "Description", "Qty", "Unit Price", "Tax %", "Tax Amt", "Total (PKR)"]],
    body: tableRows,
    theme: "grid",
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10 },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "center" },
      6: { halign: "right" },
      7: { halign: "right", fontStyle: "bold" },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;

  // Summary Totals
  const sumX = 130;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Subtotal (Excl. Tax):`, sumX, finalY + 10);
  doc.text(`PKR ${fmt(invoice.subtotal)}`, pageWidth - 14, finalY + 10, { align: "right" });

  doc.text(`Sales Tax Output:`, sumX, finalY + 16);
  doc.text(`PKR ${fmt(invoice.taxAmount)}`, pageWidth - 14, finalY + 16, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text(`Gross Total Amount:`, sumX, finalY + 24);
  doc.text(`PKR ${fmt(invoice.totalAmount)}`, pageWidth - 14, finalY + 24, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.text(`Paid / Settled:`, sumX, finalY + 30);
  doc.text(`PKR ${fmt(invoice.paidAmount)}`, pageWidth - 14, finalY + 30, { align: "right" });

  doc.text(`Withholding Tax:`, sumX, finalY + 36);
  doc.text(`PKR ${fmt(invoice.withheldAmount)}`, pageWidth - 14, finalY + 36, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text(`Net Outstanding Balance:`, sumX, finalY + 44);
  doc.text(`PKR ${fmt(invoice.outstandingAmount)}`, pageWidth - 14, finalY + 44, { align: "right" });

  // Signature Block
  const sigY = Math.max(finalY + 65, 240);
  doc.setDrawColor(150);
  doc.line(14, sigY, 70, sigY);
  doc.text("Prepared By (Accounts)", 14, sigY + 5);

  doc.line(pageWidth - 70, sigY, pageWidth - 14, sigY);
  doc.text("Authorized Signature & Stamp", pageWidth - 70, sigY + 5);

  return doc;
}

/**
 * 2. Offline Customer Receipt Voucher Generator
 */
export function generateCustomerReceiptPdf(receipt: any): jsPDF {
  const comp = getStoredCompany();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 118, 110); // teal-700
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(comp.name?.toUpperCase() || "INDUSTRIAL ERP", 14, 11);

  const compContact = [
    comp.address,
    comp.phone ? `Ph: ${comp.phone}` : "",
    comp.taxNumber ? `NTN/STRN: ${comp.taxNumber}` : "",
  ].filter(Boolean).join("  •  ");

  if (compContact) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(compContact, 14, 19);
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("OFFICIAL RECEIPT VOUCHER", pageWidth - 14, 15, { align: "right" });

  doc.setTextColor(0, 0, 0);

  // Metadata
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("RECEIPT DETAILS:", 14, 32);
  doc.setFont("helvetica", "normal");
  doc.text(`Receipt No: ${receipt.receiptNumber}`, 14, 38);
  doc.text(`Receipt Date: ${formatDate(receipt.receiptDate)}`, 14, 44);
  doc.text(`Payment Method: ${receipt.paymentMethod}`, 14, 50);
  doc.text(`Status: ${receipt.status}`, 14, 56);

  const custX = 110;
  doc.setFont("helvetica", "bold");
  doc.text("RECEIVED FROM (CUSTOMER):", custX, 32);
  doc.setFont("helvetica", "normal");
  doc.text(`Customer: ${receipt.customer?.name ?? "-"}`, custX, 38);
  doc.text(`Customer Code: ${receipt.customer?.customerCode ?? "-"}`, custX, 44);
  if (receipt.chequeNumber) {
    doc.text(`Cheque No: ${receipt.chequeNumber} (${receipt.chequeBank ?? "Bank"})`, custX, 50);
    doc.text(`Cheque Status: ${receipt.chequeStatus}`, custX, 56);
  }
  if (receipt.withholdingCertificate) {
    doc.text(`WHT Cert: ${receipt.withholdingCertificate} (${receipt.withholdingSection ?? "Sec 153"})`, custX, 62);
  }

  // Invoice Allocations Table
  const tableRows = (receipt.allocations || []).map((alloc: any, idx: number) => [
    idx + 1,
    alloc.invoice?.invoiceNumber ?? alloc.invoiceId,
    formatDate(alloc.invoice?.invoiceDate),
    `PKR ${fmt(alloc.invoice?.totalAmount)}`,
    `PKR ${fmt(alloc.allocatedAmount)}`,
    `PKR ${fmt(alloc.allocatedWithholding ?? 0)}`,
    `PKR ${fmt(alloc.totalAllocated)}`,
  ]);

  autoTable(doc, {
    startY: 70,
    head: [["#", "Invoice No", "Inv Date", "Inv Total", "Cash/Bank Settled", "Tax Withheld", "Total Allocated"]],
    body: tableRows,
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right", fontStyle: "bold" },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;

  // Totals
  const sumX = 120;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Amount Received (Bank/Cash):`, sumX, finalY + 10);
  doc.text(`PKR ${fmt(receipt.amountReceived)}`, pageWidth - 14, finalY + 10, { align: "right" });

  doc.text(`Tax Withheld (Advance Tax):`, sumX, finalY + 16);
  doc.text(`PKR ${fmt(receipt.taxWithheld)}`, pageWidth - 14, finalY + 16, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text(`Total Settlement Amount:`, sumX, finalY + 24);
  doc.text(`PKR ${fmt(receipt.totalSettled)}`, pageWidth - 14, finalY + 24, { align: "right" });

  // Signature
  const sigY = Math.max(finalY + 50, 240);
  doc.line(14, sigY, 70, sigY);
  doc.text("Received & Posted By", 14, sigY + 5);

  doc.line(pageWidth - 70, sigY, pageWidth - 14, sigY);
  doc.text("Customer Acknowledgment", pageWidth - 70, sigY + 5);

  return doc;
}

/**
 * 3. Offline Customer Statement Generator
 */
export function generateCustomerStatementPdf(statement: any): jsPDF {
  const comp = getStoredCompany();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(comp.name?.toUpperCase() || "INDUSTRIAL ERP", 14, 11);

  const compContact = [
    comp.address,
    comp.phone ? `Ph: ${comp.phone}` : "",
    comp.taxNumber ? `NTN/STRN: ${comp.taxNumber}` : "",
  ].filter(Boolean).join("  •  ");

  if (compContact) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(compContact, 14, 19);
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CUSTOMER ACCOUNT STATEMENT", pageWidth - 14, 15, { align: "right" });

  doc.setTextColor(0, 0, 0);

  // Customer Info
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("CUSTOMER:", 14, 32);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${statement.customer.name}`, 14, 38);
  doc.text(`Code: ${statement.customer.customerCode}`, 14, 44);
  doc.text(`NTN: ${statement.customer.taxNumber ?? "Unregistered"}`, 14, 50);

  // Period Info
  const pX = 120;
  doc.setFont("helvetica", "bold");
  doc.text("STATEMENT PERIOD:", pX, 32);
  doc.setFont("helvetica", "normal");
  doc.text(`From: ${formatDate(statement.period.startDate)}`, pX, 38);
  doc.text(`To: ${formatDate(statement.period.endDate)}`, pX, 44);
  doc.setFont("helvetica", "bold");
  doc.text(`Opening Balance: PKR ${fmt(statement.openingBalance)}`, pX, 50);

  // Ledger Table
  const rows = (statement.entries || []).map((e: any) => [
    formatDate(e.date),
    e.type,
    e.documentNumber,
    e.description,
    e.debit > 0 ? fmt(e.debit) : "-",
    e.credit > 0 ? fmt(e.credit) : "-",
    fmt(e.balance),
  ]);

  autoTable(doc, {
    startY: 58,
    head: [["Date", "Type", "Ref #", "Description", "Debit (PKR)", "Credit (PKR)", "Balance (PKR)"]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right", fontStyle: "bold" },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;

  // Closing Balance Summary
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Period Debits: PKR ${fmt(statement.totalDebits)}`, 14, finalY + 12);
  doc.text(`Total Period Credits: PKR ${fmt(statement.totalCredits)}`, 14, finalY + 18);
  doc.text(`Closing Balance Due: PKR ${fmt(statement.closingBalance)}`, 14, finalY + 24);

  if (statement.isReconciled) {
    doc.setTextColor(16, 185, 129); // green
    doc.text("✔ Reconciled 100% with open invoices and GL AR control account", 14, finalY + 32);
  }

  return doc;
}

/**
 * 4. Offline Employee Wage Slip Generator (HR-01)
 */
export function generateWageSlipPdf(wageRun: any, line: any): jsPDF {
  const comp = getStoredCompany();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(comp.name?.toUpperCase() || "INDUSTRIAL ERP", 14, 11);

  const compContact = [
    comp.address,
    comp.phone ? `Ph: ${comp.phone}` : "",
  ].filter(Boolean).join("  •  ");

  if (compContact) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(compContact, 14, 19);
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("EMPLOYEE WAGE SLIP", pageWidth - 14, 15, { align: "right" });

  doc.setTextColor(0, 0, 0);

  // Employee details
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("EMPLOYEE DETAILS:", 14, 32);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${line.employee?.firstName} ${line.employee?.lastName}`, 14, 38);
  doc.text(`Employee Code: ${line.employee?.employeeCode ?? "-"}`, 14, 44);
  doc.text(`Period: ${wageRun.periodYear}-${String(wageRun.periodMonth).padStart(2, "0")}`, 14, 50);
  doc.text(`Run Type: ${wageRun.runType}`, 14, 56);

  // Breakdown
  autoTable(doc, {
    startY: 64,
    head: [["Pay Component", "Basis / Days", "Rate (PKR)", "Amount (PKR)"]],
    body: [
      ["Daily Wages Earned", `${line.daysWorked} Days`, `PKR ${fmt(line.dailyRate)}`, `PKR ${fmt(line.grossAmount)}`],
      ["Statutory Deductions", "-", "-", `PKR ${fmt(line.deductions ?? 0)}`],
      ["Net Disbursable Wages", "-", "-", `PKR ${fmt(line.netAmount)}`],
    ],
    theme: "grid",
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      3: { halign: "right", fontStyle: "bold" },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFont("helvetica", "bold");
  doc.text(`Status: ${wageRun.status}`, 14, finalY + 12);
  if (wageRun.disbursedAt) {
    doc.text(`Disbursed On: ${formatDateTime(wageRun.disbursedAt)}`, 14, finalY + 18);
  }

  return doc;
}
