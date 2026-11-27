import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getStoredCompany, type CompanyProfile } from "@/lib/company";

export interface ExportColumn {
  header: string;
  accessor: (row: any) => string | number;
}

export function exportExcel(
  data: any[],
  columns: ExportColumn[],
  filename: string,
  customCompany?: CompanyProfile
) {
  const comp = customCompany || getStoredCompany();
  const rows = data.map((r) => {
    const row: Record<string, any> = {};
    for (const col of columns) {
      row[col.header] = col.accessor(r);
    }
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([
    [comp.name?.toUpperCase() || "INDUSTRIAL ERP"],
    [
      [
        comp.address,
        comp.phone ? `Ph: ${comp.phone}` : "",
        comp.taxNumber ? `NTN/STRN: ${comp.taxNumber}` : "",
      ]
        .filter(Boolean)
        .join(" | ") || "Official Enterprise Report",
    ],
    [],
  ]);
  XLSX.utils.sheet_add_json(ws, rows, { origin: "A4" } as any);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  const cols = columns.map((c) => ({ wch: Math.max(c.header.length, 14) }));
  ws["!cols"] = cols;
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportPdf(
  title: string,
  data: any[],
  columns: ExportColumn[],
  filename: string,
  customCompany?: CompanyProfile
) {
  const comp = customCompany || getStoredCompany();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Company Branding Header Banner
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(comp.name?.toUpperCase() || "INDUSTRIAL ERP", 14, 11);

  const contactParts = [
    comp.address,
    comp.phone ? `Ph: ${comp.phone}` : "",
    comp.taxNumber ? `NTN/STRN: ${comp.taxNumber}` : "",
  ].filter(Boolean).join("  •  ");

  if (contactParts) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(contactParts, 14, 18);
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), pageWidth - 14, 14, { align: "right" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

  const head = [columns.map((c) => c.header)];
  const body = data.map((r) => columns.map((c) => String(c.accessor(r))));
  autoTable(doc, {
    head,
    body,
    startY: 34,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  doc.save(`${filename}.pdf`);
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
  if (val == null) return "0";
  return val.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
