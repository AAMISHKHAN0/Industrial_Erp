import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getStoredCompany } from "../company";

export function formatDateTime(val: string | Date | null | undefined): string {
  if (!val) return "-";
  try {
    return new Date(val).toLocaleString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export function formatDate(val: string | Date | null | undefined): string {
  if (!val) return "-";
  try {
    return new Date(val).toLocaleDateString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

export function fmt(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "0.00";
  return Number(val).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtQty(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "0";
  return Number(val).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * 1. Offline GRN Slip Generation
 */
export function generateGrnSlip(grn: any): jsPDF {
  const comp = getStoredCompany();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Title
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(comp.name?.toUpperCase() || "INDUSTRIAL ERP", 14, 11);

  const compContact = [
    comp.address,
    comp.phone ? `Ph: ${comp.phone}` : "",
    comp.taxNumber ? `NTN: ${comp.taxNumber}` : "",
  ].filter(Boolean).join("  •  ");

  if (compContact) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(compContact, 14, 19);
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("GOODS RECEIVING NOTE (GRN) SLIP", pageWidth - 14, 11, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Status: ${grn.status || "RECEIVED"}  |  ${formatDate(new Date())}`, pageWidth - 14, 19, { align: "right" });

  // Document Details Box
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("GRN Details & Logistics", 14, 32);

  const leftMeta = [
    `GRN Number: ${grn.grnNumber || "-"}`,
    `Received Date: ${formatDate(grn.receivedDate || grn.createdAt)}`,
    `Vendor: ${grn.vendor?.name || "Direct Vendor / Unspecified"}`,
    `PO Reference: ${grn.po?.poNumber || "Direct GRN (Non-PO)"}`,
    `Warehouse: ${grn.warehouse?.name || grn.warehouseId || "-"}`,
    `Department: ${grn.departmentId || grn.department?.name || "Stores"}`,
  ];

  const rightMeta = [
    `Delivery Challan #: ${grn.deliveryChallanNumber || "-"}`,
    `DC Date: ${formatDate(grn.deliveryChallanDate)}`,
    `Gate Pass #: ${grn.gatePassNumber || "-"}`,
    `Vehicle #: ${grn.vehicleNumber || "-"}`,
    `Driver: ${grn.driverName || "-"} ${grn.driverPhone ? "(" + grn.driverPhone + ")" : ""}`,
    `Supplier Inv #: ${grn.supplierInvoiceNumber || "-"}`,
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let y = 38;
  for (let i = 0; i < Math.max(leftMeta.length, rightMeta.length); i++) {
    if (leftMeta[i]) doc.text(leftMeta[i], 14, y);
    if (rightMeta[i]) doc.text(rightMeta[i], 115, y);
    y += 5.5;
  }

  // Items Table
  const items = grn.items || [];
  const tableData = items.map((item: any, idx: number) => {
    const itemCode = item.item?.itemCode || item.itemCode || "-";
    const itemName = item.item?.name || item.itemName || `Item ${idx + 1}`;
    const ordered = fmtQty(item.orderedQty);
    const received = fmtQty(item.receivedQty);
    const accepted = fmtQty(item.acceptedQty);
    const rejected = fmtQty(item.rejectedQty);
    const unitCost = fmt(item.unitCost);
    const totalCost = fmt(Number(item.acceptedQty || 0) * Number(item.unitCost || 0));
    const remarks = item.rejectionReason || item.remarks || (item.lotNumber ? `Lot: ${item.lotNumber}` : "-");

    return [
      idx + 1,
      itemCode,
      itemName,
      ordered,
      received,
      accepted,
      rejected,
      unitCost,
      totalCost,
      remarks,
    ];
  });

  autoTable(doc, {
    startY: y + 3,
    head: [[
      "#",
      "Item Code",
      "Item Name",
      "Ordered",
      "Received",
      "Accepted",
      "Rejected",
      "Unit Cost",
      "Total Cost (PKR)",
      "Lot / Remarks",
    ]],
    body: tableData,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 20 },
      2: { cellWidth: 30 },
      3: { halign: "right", cellWidth: 15 },
      4: { halign: "right", cellWidth: 15 },
      5: { halign: "right", cellWidth: 15 },
      6: { halign: "right", cellWidth: 15 },
      7: { halign: "right", cellWidth: 16 },
      8: { halign: "right", cellWidth: 20 },
      9: { cellWidth: 24 },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 50;

  // Totals & Inspection Section
  let totalAcceptedVal = 0;
  let totalAcceptedQty = 0;
  let totalReceivedQty = 0;
  for (const item of items) {
    totalReceivedQty += Number(item.receivedQty || 0);
    totalAcceptedQty += Number(item.acceptedQty || 0);
    totalAcceptedVal += Number(item.acceptedQty || 0) * Number(item.unitCost || 0);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(
    `Summary: Received: ${fmtQty(totalReceivedQty)} | Accepted: ${fmtQty(totalAcceptedQty)} | Total Accepted Value: PKR ${fmt(totalAcceptedVal)}`,
    14,
    finalY + 8
  );

  if (grn.inspectionNotes || grn.inspectionStatus) {
    doc.setFont("helvetica", "normal");
    doc.text(
      `Inspection: [${grn.inspectionStatus || "PASSED"}] ${grn.inspectionNotes || "Goods inspected and verified against specifications."}`,
      14,
      finalY + 14
    );
  }

  // Signatures
  const sigY = Math.min(finalY + 32, 275);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.line(14, sigY, 55, sigY);
  doc.text("Received By (Storekeeper)", 14, sigY + 5);

  doc.line(75, sigY, 115, sigY);
  doc.text("Inspected By (QC)", 75, sigY + 5);

  doc.line(135, sigY, 185, sigY);
  doc.text("Approved By (Stores In-Charge)", 135, sigY + 5);

  if (typeof window !== "undefined") {
    doc.save(`GRN-${grn.grnNumber || "slip"}.pdf`);
  }
  return doc;
}

/**
 * 2. Offline Demand Note Slip Generation
 */
export function generateDemandNoteSlip(demandNote: any): jsPDF {
  const comp = getStoredCompany();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(15, 23, 42); // slate-900
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
  doc.text("MATERIAL DEMAND NOTE (STORE REQUISITION)", pageWidth - 14, 11, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Status: ${demandNote.status || "DRAFT"}  |  ${formatDate(demandNote.demandDate || demandNote.createdAt)}`, pageWidth - 14, 19, { align: "right" });

  // Metadata
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Requisition Metadata", 14, 32);

  const leftMeta = [
    `Demand #: ${demandNote.demandNumber || "-"}`,
    `Department: ${demandNote.department?.name || demandNote.departmentId || "-"}`,
    `Requester: ${demandNote.requester || "-"}`,
    `Cost Center: ${demandNote.costCenter || "-"}`,
  ];

  const rightMeta = [
    `Priority: ${demandNote.priority || "NORMAL"}`,
    `Required Date: ${formatDate(demandNote.requiredDate)}`,
    `Approved By: ${demandNote.approvedBy || (demandNote.status === "APPROVED" ? "Department Head" : "Pending")}`,
    `Approved At: ${formatDateTime(demandNote.approvedAt)}`,
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let y = 38;
  for (let i = 0; i < Math.max(leftMeta.length, rightMeta.length); i++) {
    if (leftMeta[i]) doc.text(leftMeta[i], 14, y);
    if (rightMeta[i]) doc.text(rightMeta[i], 115, y);
    y += 5.5;
  }

  // Items
  const items = demandNote.items || [];
  const tableData = items.map((item: any, idx: number) => {
    const itemCode = item.item?.itemCode || item.itemCode || "-";
    const itemName = item.item?.name || item.itemName || `Item ${idx + 1}`;
    const unit = item.item?.unit?.code || item.unit || "Unit";
    const reqQty = fmtQty(item.requiredQty || item.quantity);
    const issuedQty = fmtQty(item.issuedQty || 0);
    const pendingQty = fmtQty(Math.max(0, Number(item.requiredQty || item.quantity || 0) - Number(item.issuedQty || 0)));
    const remarks = item.remarks || item.purpose || "-";

    return [
      idx + 1,
      itemCode,
      itemName,
      unit,
      reqQty,
      issuedQty,
      pendingQty,
      remarks,
    ];
  });

  autoTable(doc, {
    startY: y + 3,
    head: [[
      "#",
      "Item Code",
      "Item Name",
      "Unit",
      "Required Qty",
      "Issued Qty",
      "Pending Qty",
      "Remarks / Purpose",
    ]],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { cellWidth: 44 },
      3: { cellWidth: 16 },
      4: { halign: "right", cellWidth: 18 },
      5: { halign: "right", cellWidth: 18 },
      6: { halign: "right", cellWidth: 18 },
      7: { cellWidth: 34 },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 50;

  // Notes & Signatures
  if (demandNote.notes) {
    doc.setFontSize(8.5);
    doc.text(`Notes: ${demandNote.notes}`, 14, finalY + 8);
  }

  const sigY = Math.min(finalY + 30, 275);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.line(14, sigY, 55, sigY);
  doc.text("Requested By (User/Dept)", 14, sigY + 5);

  doc.line(75, sigY, 120, sigY);
  doc.text("HOD / Approval Authority", 75, sigY + 5);

  doc.line(140, sigY, 185, sigY);
  doc.text("Stores Issuing Officer", 140, sigY + 5);

  if (typeof window !== "undefined") {
    doc.save(`DemandNote-${demandNote.demandNumber || "slip"}.pdf`);
  }
  return doc;
}

/**
 * 3. Offline Material Issue Slip Generation
 */
export function generateMaterialIssueSlip(issue: any): jsPDF {
  const comp = getStoredCompany();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(3, 105, 161); // sky-700
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
  doc.text("STORE MATERIAL ISSUE SLIP (FIFO VALUED)", pageWidth - 14, 11, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Status: ${issue.status || "POSTED"}  |  ${formatDate(issue.issueDate || issue.createdAt)}`, pageWidth - 14, 19, { align: "right" });

  // Metadata
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Issue Order Details", 14, 32);

  const leftMeta = [
    `Issue #: ${issue.issueNumber || "-"}`,
    `Demand Note Ref: ${issue.demandNote?.demandNumber || issue.demandNoteId || "Direct Issue"}`,
    `Issuing Warehouse: ${issue.warehouse?.name || issue.warehouseId || "-"}`,
    `Department: ${issue.departmentId || issue.demandNote?.departmentId || "Production"}`,
  ];

  const rightMeta = [
    `Issued To: ${issue.issuedTo || "-"}`,
    `Cost Center: ${issue.costCenter || issue.demandNote?.costCenter || "-"}`,
    `GL Entry: Dr DEPT_EXPENSE / Cr INVENTORY`,
    `Total Cost: PKR ${fmt(issue.totalAmount || issue.totalCost)}`,
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let y = 38;
  for (let i = 0; i < Math.max(leftMeta.length, rightMeta.length); i++) {
    if (leftMeta[i]) doc.text(leftMeta[i], 14, y);
    if (rightMeta[i]) doc.text(rightMeta[i], 115, y);
    y += 5.5;
  }

  // Items
  const items = issue.items || [];
  const tableData = items.map((item: any, idx: number) => {
    const itemCode = item.item?.itemCode || item.itemCode || "-";
    const itemName = item.item?.name || item.itemName || `Item ${idx + 1}`;
    const unit = item.item?.unit?.code || item.unit || "Unit";
    const qty = fmtQty(item.quantity);
    const unitCost = fmt(item.unitCost);
    const totalCost = fmt(Number(item.totalCost || (Number(item.quantity || 0) * Number(item.unitCost || 0))));
    const layer = item.fifoLayerId ? `Layer: ${String(item.fifoLayerId).slice(-6)}` : "-";

    return [
      idx + 1,
      itemCode,
      itemName,
      unit,
      qty,
      unitCost,
      totalCost,
      layer,
    ];
  });

  autoTable(doc, {
    startY: y + 3,
    head: [[
      "#",
      "Item Code",
      "Item Name",
      "Unit",
      "Issued Qty",
      "Unit Cost (PKR)",
      "Total Cost (PKR)",
      "FIFO Layer Ref",
    ]],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [3, 105, 161], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { cellWidth: 46 },
      3: { cellWidth: 16 },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "right", cellWidth: 24 },
      7: { cellWidth: 20 },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 50;

  // Signatures
  const sigY = Math.min(finalY + 30, 275);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.line(14, sigY, 55, sigY);
  doc.text("Issued By (Storekeeper)", 14, sigY + 5);

  doc.line(75, sigY, 120, sigY);
  doc.text("Received By (Recipient)", 75, sigY + 5);

  doc.line(140, sigY, 185, sigY);
  doc.text("Verified / Cost Accounts", 140, sigY + 5);

  if (typeof window !== "undefined") {
    doc.save(`MaterialIssue-${issue.issueNumber || "slip"}.pdf`);
  }
  return doc;
}

/**
 * 4. Offline Stock Register & Valuation Report
 */
export function generateStockRegisterPdf(registerData: any, filters?: any): jsPDF {
  const comp = getStoredCompany();
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`${comp.name?.toUpperCase() || "INDUSTRIAL ERP"} - PERIOD STOCK REGISTER & FIFO VALUATION`, 14, 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  const compContact = [
    comp.address,
    comp.phone ? `Ph: ${comp.phone}` : "",
  ].filter(Boolean).join("  •  ");

  const startStr = registerData.dateRange?.startDate ? formatDate(registerData.dateRange.startDate) : "-";
  const endStr = registerData.dateRange?.endDate ? formatDate(registerData.dateRange.endDate) : "-";
  doc.text(`Period: ${startStr} to ${endStr}${compContact ? "  •  " + compContact : ""}`, 14, 18);

  const recon = registerData.glReconciliation;
  const isRecon = recon?.isReconciled ? "RECONCILED (0.00 Variance)" : `DISCREPANCY (Variance: PKR ${fmt(recon?.variance)})`;
  doc.text(`GL Status: ${isRecon}`, pageWidth - 90, 18);

  // Summary Metrics Bar
  const summary = registerData.summary || {};
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");

  const summaryText =
    `Opening: ${fmtQty(summary.totalOpeningQty)} units (PKR ${fmt(summary.totalOpeningValue)}) | ` +
    `Inward: +${fmtQty(summary.totalInwardQty)} units (PKR ${fmt(summary.totalInwardValue)}) | ` +
    `Outward: -${fmtQty(summary.totalOutwardQty)} units (PKR ${fmt(summary.totalOutwardValue)}) | ` +
    `Closing: ${fmtQty(summary.totalClosingQty)} units (PKR ${fmt(summary.totalClosingValue)})`;

  doc.text(summaryText, 14, 29);

  // Table Data
  const items = registerData.items || [];
  const tableData = items.map((item: any, idx: number) => {
    return [
      idx + 1,
      item.itemCode || "-",
      item.itemName || "-",
      item.unit || "Unit",
      fmtQty(item.openingQty),
      fmt(item.openingValue),
      fmtQty(item.inwardQty),
      fmt(item.inwardValue),
      fmtQty(item.outwardQty),
      fmt(item.outwardValue),
      fmtQty(item.closingQty),
      fmt(item.closingValue),
    ];
  });

  autoTable(doc, {
    startY: 33,
    head: [[
      "#",
      "Item Code",
      "Item Name",
      "Unit",
      "Open Qty",
      "Open Val",
      "In Qty",
      "In Val",
      "Out Qty",
      "Out Val",
      "Close Qty",
      "Close Val (PKR)",
    ]],
    body: tableData,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { cellWidth: 50 },
      3: { cellWidth: 14 },
      4: { halign: "right", cellWidth: 18 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "right", cellWidth: 18 },
      7: { halign: "right", cellWidth: 22 },
      8: { halign: "right", cellWidth: 18 },
      9: { halign: "right", cellWidth: 22 },
      10: { halign: "right", cellWidth: 18 },
      11: { halign: "right", cellWidth: 26 },
    },
  });

  if (typeof window !== "undefined") {
    doc.save(`StockRegister-${new Date().toISOString().slice(0, 10)}.pdf`);
  }
  return doc;
}
