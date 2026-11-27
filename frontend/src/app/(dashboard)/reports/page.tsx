"use client";

import { useState, useCallback } from "react";
import { AppShell } from "@/components/layouts/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ShoppingCart, Package, TrendingUp, Factory, DollarSign, Briefcase } from "lucide-react";
import { api } from "@/lib/api/client";
import { ReportDialog } from "@/components/reports/report-dialog";
import { formatDate, fmt } from "@/lib/reports/export-utils";
import type { ExportColumn } from "@/lib/reports/export-utils";

interface PO { id: string; poNumber: string; status: string; grandTotal: number; vendor?: { name: string }; orderDate: string; }
interface Vendor { id: string; vendorCode?: string; code?: string; name: string; email: string; phone: string; city: string; rating: number; status: string; }
interface DemandNote { id: string; demandNumber?: string; dnNumber?: string; department?: { name: string }; priority: string; status: string; requestedBy?: string; createdAt: string; }
interface Item { id: string; name: string; itemCode?: string; sku?: string; currentStock: number; reservedStock: number; availableStock: number; minStock: number; maxStock: number; reorderLevel: number; averageCost: number; purchasePrice: number; sellingPrice: number; category?: { name: string }; unit?: { name: string }; status: string; }
interface SO { id: string; soNumber: string; customer?: { name: string }; grandTotal: number; status: string; orderDate: string; }
interface Customer { id: string; name: string; email: string; phone: string; city: string; rating: number; creditLimit: number; status: string; }
interface RevenueItem { month: number | string; revenue: number; orders: number; }
interface ProdOrder { id: string; productionNumber: string; item?: { name: string }; quantity: number; producedQty: number; rejectedQty: number; status: string; priority: string; startDate: string; endDate: string; }
interface BOM { id: string; bomNumber?: string; name?: string; description?: string; item?: { name: string }; quantity?: number; wastePct?: number; totalCost?: number; status: string; }
interface QualityCheck { id: string; productionOrder?: { productionNumber: string }; item?: { name: string }; status: string; result: string; checkedBy: string; createdAt: string; }
interface Account { id: string; code?: string; accountCode?: string; name: string; type: string; balance: number; status: string; }
interface Attendance { id: string; employee?: { firstName: string; lastName: string }; date: string; status: string; clockIn: string; clockOut: string; }
interface Leave { id: string; employee?: { firstName: string; lastName: string }; leaveType: string; startDate: string; endDate: string; status: string; reason: string; }
interface PaySlip { id: string; employee?: { firstName: string; lastName: string }; grossPay: number; totalDeductions: number; netPay: number; presentDays: number; totalDays: number; status: string; }

const v = (x: string | null | undefined) => x || "-";
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const formatMonth = (m: number | string | null | undefined): string => {
  if (typeof m === "string" && isNaN(Number(m))) return m || "-";
  const n = Number(m);
  if (n >= 1 && n <= 12) return MONTH_NAMES[n - 1];
  return "-";
};

const groups = [
  { title: "Purchase Reports", icon: ShoppingCart, reports: [
    { name: "Purchase Order Summary", desc: "Overview of all purchase orders by status", key: "po" as const },
    { name: "Vendor Performance", desc: "Vendor delivery times, pricing, and quality metrics", key: "vendor" as const },
    { name: "Demand Note Analysis", desc: "Department-wise demand analysis and trends", key: "demand" as const },
  ]},
  { title: "Inventory Reports", icon: Package, reports: [
    { name: "Stock Status Report", desc: "Current stock levels across all warehouses", key: "stock" as const },
    { name: "Low Stock Alert", desc: "Items below reorder level needing replenishment", key: "lowstock" as const },
    { name: "Inventory Valuation", desc: "Stock value by item category and warehouse", key: "valuation" as const },
  ]},
  { title: "Sales Reports", icon: TrendingUp, reports: [
    { name: "Sales Order Summary", desc: "Sales performance by period and customer", key: "so" as const },
    { name: "Customer Analysis", desc: "Customer buying patterns and credit utilization", key: "customer" as const },
    { name: "Revenue Report", desc: "Revenue breakdown by month", key: "revenue" as const },
  ]},
  { title: "Production Reports", icon: Factory, reports: [
    { name: "Production Summary", desc: "Production output by order and period", key: "production" as const },
    { name: "BOM Cost Analysis", desc: "Bill of materials cost breakdown", key: "bom" as const },
    { name: "Quality Report", desc: "Quality check pass/fail rates by product", key: "quality" as const },
  ]},
  { title: "Financial Reports", icon: DollarSign, reports: [
    { name: "Trial Balance", desc: "Summary of all account balances", key: "trial" as const },
    { name: "Profit & Loss", desc: "Revenue and expense summary for a period", key: "pnl" as const },
    { name: "Balance Sheet", desc: "Assets, liabilities, and equity overview", key: "bs" as const },
  ]},
  { title: "HR Reports", icon: Briefcase, reports: [
    { name: "Attendance Summary", desc: "Employee attendance by department and period", key: "attendance" as const },
    { name: "Leave Analysis", desc: "Leave utilization by type and department", key: "leave" as const },
    { name: "Payroll Summary", desc: "Payroll costs by period and department", key: "payroll" as const },
  ]},
];

type ReportKey = "po" | "vendor" | "demand" | "stock" | "lowstock" | "valuation" | "so" | "customer" | "revenue" | "production" | "bom" | "quality" | "trial" | "pnl" | "bs" | "attendance" | "leave" | "payroll";

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportKey | null>(null);
  const close = () => setActiveReport(null);

  const poCols: ExportColumn[] = [
    { header: "PO #", accessor: (r: PO) => v(r.poNumber) },
    { header: "Vendor", accessor: (r: PO) => r.vendor?.name || r.id.slice(0, 8) },
    { header: "Amount", accessor: (r: PO) => fmt(r.grandTotal) },
    { header: "Status", accessor: (r: PO) => v(r.status) },
    { header: "Date", accessor: (r: PO) => formatDate(r.orderDate) },
  ];
  const fetchPo = useCallback(() => api.get<PO[]>("/purchase/orders?limit=9999"), []);

  const vendorCols: ExportColumn[] = [
    { header: "Code", accessor: (r: Vendor) => v(r.vendorCode || r.code) },
    { header: "Name", accessor: (r: Vendor) => v(r.name) },
    { header: "Email", accessor: (r: Vendor) => v(r.email) },
    { header: "Phone", accessor: (r: Vendor) => v(r.phone) },
    { header: "City", accessor: (r: Vendor) => v(r.city) },
    { header: "Rating", accessor: (r: Vendor) => v(String(r.rating ?? "")) },
    { header: "Status", accessor: (r: Vendor) => v(r.status) },
  ];
  const fetchVendors = useCallback(() => api.get<Vendor[]>("/purchase/vendors?limit=9999"), []);

  const demandCols: ExportColumn[] = [
    { header: "DN #", accessor: (r: DemandNote) => v(r.demandNumber || r.dnNumber) },
    { header: "Department", accessor: (r: DemandNote) => r.department?.name || "-" },
    { header: "Priority", accessor: (r: DemandNote) => v(r.priority) },
    { header: "Requested By", accessor: (r: DemandNote) => v(r.requestedBy) },
    { header: "Status", accessor: (r: DemandNote) => v(r.status) },
    { header: "Date", accessor: (r: DemandNote) => formatDate(r.createdAt) },
  ];
  const fetchDemand = useCallback(() => api.get<DemandNote[]>("/purchase/demand-notes?limit=9999"), []);

  const stockCols: ExportColumn[] = [
    { header: "Item Code", accessor: (r: Item) => v(r.itemCode || r.sku) },
    { header: "Name", accessor: (r: Item) => v(r.name) },
    { header: "Category", accessor: (r: Item) => r.category?.name || "-" },
    { header: "In Stock", accessor: (r: Item) => fmt(r.currentStock) },
    { header: "Available", accessor: (r: Item) => fmt(r.availableStock) },
    { header: "Reserved", accessor: (r: Item) => fmt(r.reservedStock) },
    { header: "Min Stock", accessor: (r: Item) => fmt(r.minStock) },
    { header: "Unit", accessor: (r: Item) => r.unit?.name || "-" },
  ];
  const fetchItems = useCallback(() => api.get<Item[]>("/inventory/items?limit=9999"), []);

  const soCols: ExportColumn[] = [
    { header: "SO #", accessor: (r: SO) => v(r.soNumber) },
    { header: "Customer", accessor: (r: SO) => r.customer?.name || "-" },
    { header: "Amount", accessor: (r: SO) => fmt(r.grandTotal) },
    { header: "Status", accessor: (r: SO) => v(r.status) },
    { header: "Date", accessor: (r: SO) => formatDate(r.orderDate) },
  ];
  const fetchSO = useCallback(() => api.get<SO[]>("/sales/orders?limit=9999"), []);

  const customerCols: ExportColumn[] = [
    { header: "Name", accessor: (r: Customer) => v(r.name) },
    { header: "Email", accessor: (r: Customer) => v(r.email) },
    { header: "Phone", accessor: (r: Customer) => v(r.phone) },
    { header: "City", accessor: (r: Customer) => v(r.city) },
    { header: "Rating", accessor: (r: Customer) => v(String(r.rating ?? "")) },
    { header: "Credit Limit", accessor: (r: Customer) => fmt(r.creditLimit) },
    { header: "Status", accessor: (r: Customer) => v(r.status) },
  ];
  const fetchCustomers = useCallback(() => api.get<Customer[]>("/sales/customers?limit=9999"), []);

  const revenueCols: ExportColumn[] = [
    { header: "Month", accessor: (r: RevenueItem) => formatMonth(r.month) },
    { header: "Revenue", accessor: (r: RevenueItem) => fmt(r.revenue) },
    { header: "Orders", accessor: (r: RevenueItem) => fmt(r.orders) },
  ];
  const fetchRevenue = useCallback(() => api.get<RevenueItem[]>("/dashboard/revenue"), []);

  const prodCols: ExportColumn[] = [
    { header: "Prod #", accessor: (r: ProdOrder) => v(r.productionNumber) },
    { header: "Item", accessor: (r: ProdOrder) => r.item?.name || "-" },
    { header: "Planned Qty", accessor: (r: ProdOrder) => fmt(r.quantity) },
    { header: "Produced", accessor: (r: ProdOrder) => fmt(r.producedQty || 0) },
    { header: "Rejected", accessor: (r: ProdOrder) => fmt(r.rejectedQty || 0) },
    { header: "Yield %", accessor: (r: ProdOrder) => r.quantity ? fmt((((r.producedQty || 0) - (r.rejectedQty || 0)) / r.quantity) * 100) + "%" : "-" },
    { header: "Status", accessor: (r: ProdOrder) => v(r.status) },
    { header: "Priority", accessor: (r: ProdOrder) => v(r.priority) },
    { header: "Start", accessor: (r: ProdOrder) => formatDate(r.startDate) },
    { header: "End", accessor: (r: ProdOrder) => formatDate(r.endDate) },
  ];
  const fetchProd = useCallback(() => api.get<ProdOrder[]>("/production/orders?limit=9999"), []);

  const bomCols: ExportColumn[] = [
    { header: "BOM #", accessor: (r: BOM) => v(r.bomNumber || r.name) },
    { header: "Item", accessor: (r: BOM) => r.item?.name || "-" },
    { header: "Batch Qty", accessor: (r: BOM) => fmt(r.quantity || 1) },
    { header: "Waste %", accessor: (r: BOM) => `${r.wastePct ?? 0}%` },
    { header: "Status", accessor: (r: BOM) => v(r.status) },
  ];
  const fetchBOM = useCallback(() => api.get<BOM[]>("/production/bom?limit=9999"), []);

  const qualityCols: ExportColumn[] = [
    { header: "Prod Order", accessor: (r: QualityCheck) => r.productionOrder?.productionNumber || "-" },
    { header: "Item", accessor: (r: QualityCheck) => r.item?.name || "-" },
    { header: "Result", accessor: (r: QualityCheck) => v(r.result) },
    { header: "Status", accessor: (r: QualityCheck) => v(r.status) },
    { header: "Checked By", accessor: (r: QualityCheck) => v(r.checkedBy) },
    { header: "Date", accessor: (r: QualityCheck) => formatDate(r.createdAt) },
  ];
  const fetchQuality = useCallback(() => api.get<QualityCheck[]>("/production/quality?limit=9999"), []);

  const accountCols: ExportColumn[] = [
    { header: "Code", accessor: (r: Account) => v(r.accountCode || r.code) },
    { header: "Account Name", accessor: (r: Account) => v(r.name) },
    { header: "Type", accessor: (r: Account) => v(r.type) },
    { header: "Balance", accessor: (r: Account) => fmt(r.balance || 0) },
    { header: "Status", accessor: (r: Account) => v(r.status) },
  ];
  const fetchAccounts = useCallback(() => api.get<Account[]>("/finance/accounts?limit=9999"), []);

  const attendanceCols: ExportColumn[] = [
    { header: "Employee", accessor: (r: Attendance) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : "-" },
    { header: "Date", accessor: (r: Attendance) => formatDate(r.date) },
    { header: "Status", accessor: (r: Attendance) => v(r.status) },
    { header: "Clock In", accessor: (r: Attendance) => v(r.clockIn) },
    { header: "Clock Out", accessor: (r: Attendance) => v(r.clockOut) },
  ];
  const fetchAttendance = useCallback(() => api.get<Attendance[]>("/hr/attendance?limit=9999"), []);

  const leaveCols: ExportColumn[] = [
    { header: "Employee", accessor: (r: Leave) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : "-" },
    { header: "Leave Type", accessor: (r: Leave) => v(r.leaveType) },
    { header: "Start", accessor: (r: Leave) => formatDate(r.startDate) },
    { header: "End", accessor: (r: Leave) => formatDate(r.endDate) },
    { header: "Status", accessor: (r: Leave) => v(r.status) },
  ];
  const fetchLeaves = useCallback(() => api.get<Leave[]>("/hr/leaves?limit=9999"), []);

  const payrollCols: ExportColumn[] = [
    { header: "Employee", accessor: (r: PaySlip) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : "-" },
    { header: "Gross Pay", accessor: (r: PaySlip) => fmt(r.grossPay || 0) },
    { header: "Deductions", accessor: (r: PaySlip) => fmt(r.totalDeductions || 0) },
    { header: "Net Pay", accessor: (r: PaySlip) => fmt(r.netPay || 0) },
    { header: "Present Days", accessor: (r: PaySlip) => fmt(r.presentDays || 0) },
    { header: "Total Days", accessor: (r: PaySlip) => fmt(r.totalDays || 0) },
    { header: "Status", accessor: (r: PaySlip) => v(r.status) },
  ];
  const fetchPayroll = useCallback(() => api.get<PaySlip[]>("/hr/payroll/slip?limit=9999"), []);

  const renderReport = () => {
    switch (activeReport) {
      case "po":
        return <ReportDialog key="po" open onClose={close} title="Purchase Order Summary" description="Overview of all purchase orders by status" fetchFn={fetchPo} columns={poCols} filename="purchase-order-summary" />;
      case "vendor":
        return <ReportDialog key="vendor" open onClose={close} title="Vendor Performance" description="Vendor details including contact info and rating" fetchFn={fetchVendors} columns={vendorCols} filename="vendor-performance" />;
      case "demand":
        return <ReportDialog key="demand" open onClose={close} title="Demand Note Analysis" description="Department-wise demand analysis and trends" fetchFn={fetchDemand} columns={demandCols} filename="demand-note-analysis" />;
      case "stock":
        return <ReportDialog key="stock" open onClose={close} title="Stock Status Report" description="Current stock levels across all warehouses" fetchFn={fetchItems} columns={stockCols} filename="stock-status" />;
      case "lowstock":
        return <ReportDialog key="lowstock" open onClose={close} title="Low Stock Alert" description="Items below reorder level needing replenishment" fetchFn={async () => (await fetchItems()).filter((i: Item) => i.availableStock <= (i.reorderLevel || 0))} columns={stockCols} filename="low-stock-alert" />;
      case "valuation":
        return <ReportDialog key="valuation" open onClose={close} title="Inventory Valuation" description="Stock value by item" fetchFn={fetchItems} columns={[
          { header: "Item Code", accessor: (r: Item) => v(r.itemCode || r.sku) },
          { header: "Name", accessor: (r: Item) => v(r.name) },
          { header: "Category", accessor: (r: Item) => r.category?.name || "-" },
          { header: "In Stock", accessor: (r: Item) => fmt(r.currentStock) },
          { header: "Avg Cost", accessor: (r: Item) => fmt(r.averageCost || r.purchasePrice || 0) },
          { header: "Total Value", accessor: (r: Item) => fmt((r.currentStock || 0) * (r.averageCost || r.purchasePrice || 0)) },
          { header: "Selling Price", accessor: (r: Item) => fmt(r.sellingPrice || 0) },
        ]} filename="inventory-valuation" />;
      case "so":
        return <ReportDialog key="so" open onClose={close} title="Sales Order Summary" description="Sales performance by period and customer" fetchFn={fetchSO} columns={soCols} filename="sales-order-summary" />;
      case "customer":
        return <ReportDialog key="customer" open onClose={close} title="Customer Analysis" description="Customer buying patterns and credit utilization" fetchFn={fetchCustomers} columns={customerCols} filename="customer-analysis" />;
      case "revenue":
        return <ReportDialog key="revenue" open onClose={close} title="Revenue Report" description="Revenue breakdown by month" fetchFn={fetchRevenue} columns={revenueCols} filename="revenue-report" />;
      case "production":
        return <ReportDialog key="production" open onClose={close} title="Production Summary" description="Production output by order and period" fetchFn={fetchProd} columns={prodCols} filename="production-summary" />;
      case "bom":
        return <ReportDialog key="bom" open onClose={close} title="BOM Cost Analysis" description="Bill of materials cost breakdown" fetchFn={fetchBOM} columns={bomCols} filename="bom-cost-analysis" />;
      case "quality":
        return <ReportDialog key="quality" open onClose={close} title="Quality Report" description="Quality check pass/fail rates by product" fetchFn={fetchQuality} columns={qualityCols} filename="quality-report" />;
      case "trial":
        return <ReportDialog key="trial" open onClose={close} title="Trial Balance" description="Summary of all account balances" fetchFn={fetchAccounts} columns={accountCols} filename="trial-balance" />;
      case "pnl":
        return <ReportDialog key="pnl" open onClose={close} title="Profit & Loss" description="Revenue and expense summary" fetchFn={async () => (await fetchAccounts()).filter((a: Account) => a.type === "INCOME" || a.type === "EXPENSE")} columns={accountCols} filename="profit-and-loss" />;
      case "bs":
        return <ReportDialog key="bs" open onClose={close} title="Balance Sheet" description="Assets, liabilities, and equity overview" fetchFn={async () => (await fetchAccounts()).filter((a: Account) => a.type === "ASSET" || a.type === "LIABILITY" || a.type === "EQUITY")} columns={accountCols} filename="balance-sheet" />;
      case "attendance":
        return <ReportDialog key="attendance" open onClose={close} title="Attendance Summary" description="Employee attendance by department and period" fetchFn={fetchAttendance} columns={attendanceCols} filename="attendance-summary" />;
      case "leave":
        return <ReportDialog key="leave" open onClose={close} title="Leave Analysis" description="Leave utilization by type and department" fetchFn={fetchLeaves} columns={leaveCols} filename="leave-analysis" />;
      case "payroll":
        return <ReportDialog key="payroll" open onClose={close} title="Payroll Summary" description="Payroll costs by period and department" fetchFn={fetchPayroll} columns={payrollCols} filename="payroll-summary" />;
      default:
        return null;
    }
  };

  return (
    <AppShell title="Reports">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Generate and view business reports</p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <group.icon className="h-5 w-5 text-primary" />
                  {group.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.reports.map((report) => (
                  <button key={report.name} className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer" onClick={() => setActiveReport(report.key)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{report.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{report.desc}</p>
                      </div>
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      {renderReport()}
    </AppShell>
  );
}
