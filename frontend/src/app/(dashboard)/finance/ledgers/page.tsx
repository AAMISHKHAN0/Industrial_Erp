"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Users,
  ShoppingBag,
  Package,
  BadgePercent,
  Search,
  Download,
  RefreshCw,
  TrendingUp,
  FileText,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Briefcase,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EntitySelect } from "@/components/shared/entity-select";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

export default function UnifiedLedgersPage() {
  const [activeTab, setActiveTab] = useState<string>("vendor");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // 1. Vendor Ledger State
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [vendorTrail, setVendorTrail] = useState<any | null>(null);
  const [vendorError, setVendorError] = useState<string | null>(null);

  // 2. Customer Ledger State
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerStatement, setCustomerStatement] = useState<any | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // 3. Stock Ledger State
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("ALL");
  const [stockLines, setStockLines] = useState<any[]>([]);

  // 4. Employee Ledger State
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("ALL");
  const [wageRuns, setWageRuns] = useState<any[]>([]);

  // 5. Tax Ledger State
  const [statutoryRegister, setStatutoryRegister] = useState<any[]>([]);
  const [customerReceipts, setCustomerReceipts] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);

  // Initial Fetch of reference entities
  const fetchReferenceData = useCallback(async () => {
    try {
      // Vendors
      const vRes = await api.get<any>("/purchase/vendors?limit=200").catch(() => null);
      const vList = vRes?.data || (Array.isArray(vRes) ? vRes : []);
      setVendors(vList);
      if (vList.length > 0 && !selectedVendorId) {
        setSelectedVendorId(vList[0].id);
      }

      // Customers
      const cRes = await api.get<any>("/sales/customers?limit=200").catch(() => null);
      const cList = cRes?.data || (Array.isArray(cRes) ? cRes : []);
      setCustomers(cList);
      if (cList.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(cList[0].id);
      }

      // Items / Stock Register
      const sRes = await api.get<any>("/inventory/stock/register").catch(() => null);
      const sData = sRes?.data || sRes;
      const registerLines = sData?.items || sData?.lines;
      if (Array.isArray(registerLines)) {
        setStockLines(registerLines);
        setStockItems(registerLines);
      }

      // Employees
      const empRes = await api.get<any>("/master-data/employee?limit=200").catch(() => null);
      const empList = empRes?.data || (Array.isArray(empRes) ? empRes : []);
      setEmployees(empList);

      // Wage Runs
      const wRes = await api.get<any>("/hr/wages").catch(() => null);
      const wList = Array.isArray(wRes) ? wRes : wRes?.data || [];
      setWageRuns(wList);

      // Statutory / Taxes
      const statRes = await api.get<any>("/finance/statutory/register").catch(() => null);
      const statList = Array.isArray(statRes) ? statRes : statRes?.data || [];
      setStatutoryRegister(statList);

      // Receipts
      const recRes = await api.get<any>("/sales/receipts?limit=200").catch(() => null);
      const recList = recRes?.data || (Array.isArray(recRes) ? recRes : []);
      setCustomerReceipts(recList);

      // Invoices
      const invRes = await api.get<any>("/sales/invoices?limit=200").catch(() => null);
      const invList = invRes?.data || (Array.isArray(invRes) ? invRes : []);
      setSalesInvoices(invList);
    } catch {
      // ignore
    }
  }, [selectedVendorId, selectedCustomerId]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  // Fetch Vendor Trail when selected vendor changes
  useEffect(() => {
    if (!selectedVendorId) return;
    setVendorError(null);
    api
      .get<any>(`/purchase/vendors/${selectedVendorId}/trail`)
      .then((res) => {
        setVendorTrail(res);
        setVendorError(null);
      })
      .catch((err) => {
        setVendorTrail(null);
        setVendorError(err.message || "Failed to load vendor ledger data");
      });
  }, [selectedVendorId]);

  // Fetch Customer Statement when selected customer changes
  useEffect(() => {
    if (!selectedCustomerId) return;
    setCustomerError(null);
    api
      .get<any>(`/sales/customer-statements/${selectedCustomerId}`)
      .then((res) => {
        setCustomerStatement(res);
        setCustomerError(null);
      })
      .catch((err) => {
        setCustomerStatement(null);
        setCustomerError(err.message || "Failed to load customer statement");
      });
  }, [selectedCustomerId]);

  // Refresh active tab
  const handleRefresh = async () => {
    setLoading(true);
    setVendorError(null);
    setCustomerError(null);
    await fetchReferenceData();
    if (selectedVendorId) {
      await api
        .get<any>(`/purchase/vendors/${selectedVendorId}/trail`)
        .then((res) => {
          setVendorTrail(res);
          setVendorError(null);
        })
        .catch((err) => {
          setVendorTrail(null);
          setVendorError(err.message || "Failed to load vendor ledger data");
        });
    }
    if (selectedCustomerId) {
      await api
        .get<any>(`/sales/customer-statements/${selectedCustomerId}`)
        .then((res) => {
          setCustomerStatement(res);
          setCustomerError(null);
        })
        .catch((err) => {
          setCustomerStatement(null);
          setCustomerError(err.message || "Failed to load customer statement");
        });
    }
    setLoading(false);
    toast.success("Ledgers data refreshed");
  };

  // Export current tab to CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `ledger_${activeTab}_${new Date().toISOString().split("T")[0]}.csv`;

    if (activeTab === "vendor" && vendorTrail?.timeline) {
      headers = ["Date", "Type", "Doc Number", "Reference", "Status", "Amount (PKR)"];
      rows = vendorTrail.timeline.map((t: any) => [
        t.date?.split("T")[0] || "",
        t.type,
        t.docNumber || t.number || "",
        `"${(t.reference || "").replace(/"/g, '""')}"`,
        t.status,
        Number(t.amount).toFixed(2),
      ]);
    } else if (activeTab === "customer" && customerStatement?.entries) {
      headers = ["Date", "Type", "Doc Number", "Debit (Invoiced)", "Credit (Received)", "Balance", "WHT"];
      rows = customerStatement.entries.map((e: any) => [
        e.date?.split("T")[0] || "",
        e.type,
        e.documentNumber,
        Number(e.debit).toFixed(2),
        Number(e.credit).toFixed(2),
        Number(e.balance).toFixed(2),
        Number(e.withholdingAmount || 0).toFixed(2),
      ]);
    } else if (activeTab === "stock") {
      headers = ["Item Code", "Item Name", "Unit", "Opening Qty", "Inward Qty", "Outward Qty", "Closing Qty", "Closing Value (PKR)"];
      rows = stockLines.map((l: any) => [
        l.itemCode,
        `"${(l.itemName || "").replace(/"/g, '""')}"`,
        l.unit,
        l.openingQty,
        l.inwardQty,
        l.outwardQty,
        l.closingQty,
        Number(l.closingValue).toFixed(2),
      ]);
    } else if (activeTab === "employee") {
      headers = ["Run Number", "Period", "Employee", "Days Worked", "Daily Rate", "Gross", "Deductions", "Net", "Status"];
      wageRuns.forEach((run: any) => {
        (run.lines || []).forEach((line: any) => {
          rows.push([
            run.runNumber,
            `${run.periodYear}-${run.periodMonth}`,
            `"${line.employee?.firstName || ""} ${line.employee?.lastName || ""}"`,
            line.daysWorked,
            Number(line.dailyRate).toFixed(2),
            Number(line.grossAmount).toFixed(2),
            Number(line.deductions || 0).toFixed(2),
            Number(line.netAmount).toFixed(2),
            run.status,
          ]);
        });
      });
    } else if (activeTab === "tax") {
      headers = ["Head", "Authority", "Period", "Due Amount", "Paid Amount", "Outstanding", "CPR / Challan", "Status"];
      rows = statutoryRegister.map((s: any) => [
        s.head,
        s.authority,
        s.taxPeriod,
        Number(s.dueAmount).toFixed(2),
        Number(s.paidAmount || 0).toFixed(2),
        Number(s.outstandingAmount || 0).toFixed(2),
        s.challanNumber || s.cprNumber || "",
        s.status,
      ]);
    }

    if (headers.length === 0 || rows.length === 0) {
      toast.info("No records to export for this view");
      return;
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(",")), "", '"Powered by Digitalerena","https://digitalerena.com"'].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Ledger exported successfully");
  };

  // Stock filtering
  const currentStockLine =
    selectedItemId === "ALL"
      ? null
      : stockLines.find((l) => l.itemId === selectedItemId);

  const activeFifoLayers =
    selectedItemId === "ALL"
      ? stockLines.flatMap((l) => l.fifoLayers || [])
      : currentStockLine?.fifoLayers || [];

  const stockMovements =
    selectedItemId === "ALL"
      ? stockLines.flatMap((l) =>
          (l.movements || []).map((m: any) => ({ ...m, itemName: l.itemName, itemCode: l.itemCode }))
        )
      : (currentStockLine?.movements || []).map((m: any) => ({
          ...m,
          itemName: currentStockLine.itemName,
          itemCode: currentStockLine.itemCode,
        }));

  // Employee ledger filtering: combines both daily wages and monthly salaries
  const dailyWageLines = wageRuns.flatMap((run: any) =>
    (run.lines || []).map((l: any) => ({
      ...l,
      entryType: "DAILY_WAGE",
      runNumber: run.runNumber,
      period: `${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`,
      runStatus: run.status,
      voucherId: run.voucherId,
      disbursementVoucherId: run.disbursementVoucherId,
      createdAt: run.createdAt,
    }))
  );

  const monthlySalaryLines = employees.flatMap((emp: any) => {
    const monthlyRate = Number(emp.basicSalary || emp.salary || 0);
    if (!monthlyRate) return [];
    return [
      {
        id: `sal-${emp.id}`,
        employeeId: emp.id,
        employee: emp,
        entryType: "MONTHLY_SALARY",
        runNumber: `SAL-${emp.employeeCode || "EMP"}`,
        period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
        daysWorked: "30 (Monthly)",
        dailyRate: (monthlyRate / 30).toFixed(2),
        grossAmount: monthlyRate,
        deductions: 0,
        netAmount: monthlyRate,
        runStatus: "ACCRUED",
        createdAt: emp.createdAt || new Date().toISOString(),
      },
    ];
  });

  const employeeLines = [...dailyWageLines, ...monthlySalaryLines].filter(
    (l: any) => selectedEmployeeId === "ALL" || l.employeeId === selectedEmployeeId
  );

  // Tax calculations
  const totalSalesTaxInvoiced = salesInvoices.reduce(
    (sum, inv) => sum + (Number(inv.taxAmount) || 0),
    0
  );
  const totalWhtDeducted = customerReceipts.reduce(
    (sum, rec) => sum + (Number(rec.taxWithheld) || 0),
    0
  );
  const totalStatutoryPaid = statutoryRegister.reduce(
    (sum, s) => sum + (Number(s.paidAmount) || 0),
    0
  );
  const totalStatutoryDue = statutoryRegister.reduce(
    (sum, s) => sum + (Number(s.dueAmount) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              General & Subsidiary Ledgers
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Unified sub-ledgers for Vendors, Customers, Inventory (FIFO layers), Employees, and Tax Obligations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export Tab CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 5-Tab Ledger Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full bg-muted/60 p-1 rounded-lg">
          <TabsTrigger value="vendor" className="gap-1.5 text-xs">
            <ShoppingBag className="h-3.5 w-3.5" />
            Vendor Ledger
          </TabsTrigger>
          <TabsTrigger value="customer" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            Customer Ledger
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-1.5 text-xs">
            <Package className="h-3.5 w-3.5" />
            Stock Ledger & FIFO
          </TabsTrigger>
          <TabsTrigger value="employee" className="gap-1.5 text-xs">
            <Briefcase className="h-3.5 w-3.5" />
            Employee Ledger
          </TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5 text-xs">
            <BadgePercent className="h-3.5 w-3.5" />
            Tax Ledger
          </TabsTrigger>
        </TabsList>

        {/* ========================================================= */}
        {/* TAB 1: VENDOR LEDGER                                      */}
        {/* ========================================================= */}
        <TabsContent value="vendor" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border shadow-xs">
            <div className="flex items-center gap-3">
              <Label className="text-xs font-semibold whitespace-nowrap">
                Select Vendor:
              </Label>
              <EntitySelect
                value={selectedVendorId}
                onValueChange={(val) => setSelectedVendorId(val)}
                entityLabel="Vendor"
                pluralLabel="vendors"
                quickAddType="vendor"
                placeholder="Select Vendor"
                className="w-[280px] h-9 text-xs"
                options={vendors.map((v) => ({
                  value: v.id,
                  label: `${v.name} (${v.vendorCode || v.code || "VND"})`,
                }))}
                onQuickCreated={(created) => {
                  setVendors((prev) => [created, ...prev]);
                }}
              />
            </div>
            {vendorTrail?.vendor && (
              <div className="text-xs text-muted-foreground">
                Code: <span className="font-mono">{vendorTrail.vendor.vendorCode || vendorTrail.vendor.code || "N/A"}</span>
              </div>
            )}
          </div>

          {/* Vendor KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-xs border-l-4 border-l-rose-500">
              <CardHeader className="pb-1.5">
                <CardDescription className="text-xs uppercase font-medium">
                  Outstanding Payable Balance
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-rose-600">
                  PKR{" "}
                  {Number(
                    vendorTrail?.summary?.outstandingAp ??
                      vendorTrail?.summary?.outstandingPayable ??
                      0
                  ).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Open GRNI: PKR{" "}
                  {Number(
                    vendorTrail?.summary?.openGrniBalance ??
                      vendorTrail?.summary?.unbilledGrnValue ??
                      0
                  ).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-1.5">
                <CardDescription className="text-xs uppercase font-medium">
                  Total Invoiced / Billed
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                  PKR{" "}
                  {Number(
                    vendorTrail?.summary?.totalBilledValue || 0
                  ).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Cumulative supplier invoices
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-1.5">
                <CardDescription className="text-xs uppercase font-medium">
                  Total Disbursements / Paid
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-emerald-600">
                  PKR{" "}
                  {Number(
                    vendorTrail?.summary?.totalPaidValue || 0
                  ).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Settled payments & advances
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Vendor Error Banner */}
          {vendorError && (
            <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{vendorError}</span>
            </div>
          )}

          {/* Vendor Statement / Timeline Table */}
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Vendor Account Statement & Audit Trail
              </CardTitle>
              <CardDescription className="text-xs">
                History of Purchase Orders, Goods Receipts (GRN), Supplier Bills, and Outgoing Payments.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[100px] text-xs font-semibold">Date</TableHead>
                    <TableHead className="w-[100px] text-xs font-semibold">Doc Type</TableHead>
                    <TableHead className="text-xs font-semibold">Document Number</TableHead>
                    <TableHead className="text-xs font-semibold">Reference / Notes</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Amount (PKR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!vendorTrail || !vendorTrail.timeline || vendorTrail.timeline.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <FileText className="h-6 w-6 text-muted-foreground/60" />
                          <p className="text-sm font-medium">No ledger activity found for this vendor</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendorTrail.timeline.map((item: any, idx: number) => {
                      const isCredit = item.type === "BILL";
                      const isDebit = item.type === "PAYMENT" || item.type === "RETURN";

                      return (
                        <TableRow key={item.id || idx} className="hover:bg-muted/30">
                          <TableCell className="text-xs text-muted-foreground">
                            {item.date ? item.date.split("T")[0] : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-medium ${
                                item.type === "BILL"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : item.type === "PAYMENT"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : item.type === "GRN"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-gray-50 text-gray-700 border-gray-200"
                              }`}
                            >
                              {item.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-medium text-foreground">
                            {item.docNumber || item.number || "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.details || item.reference || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="text-[10px] bg-muted text-foreground border">
                              {item.status || "POSTED"}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono font-semibold text-xs ${
                              isDebit
                                ? "text-emerald-600"
                                : isCredit
                                ? "text-rose-600"
                                : "text-foreground"
                            }`}
                          >
                            {isDebit ? "- " : isCredit ? "+ " : ""}
                            PKR{" "}
                            {Number(item.amount).toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 2: CUSTOMER LEDGER                                    */}
        {/* ========================================================= */}
        <TabsContent value="customer" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border shadow-xs">
            <div className="flex items-center gap-3">
              <Label className="text-xs font-semibold whitespace-nowrap">
                Select Customer:
              </Label>
              <EntitySelect
                value={selectedCustomerId}
                onValueChange={(val) => setSelectedCustomerId(val)}
                entityLabel="Customer"
                pluralLabel="customers"
                quickAddType="customer"
                placeholder="Select Customer"
                className="w-[280px] h-9 text-xs"
                options={customers.map((c) => ({
                  value: c.id,
                  label: `${c.name} (${c.customerCode || "CUST"})`,
                }))}
                onQuickCreated={(created) => {
                  setCustomers((prev) => [created, ...prev]);
                }}
              />
            </div>
            {customerStatement?.customer && (
              <div className="text-xs text-muted-foreground">
                Tax Number: <span className="font-mono">{customerStatement.customer.taxNumber || "N/A"}</span>
              </div>
            )}
          </div>

          {/* Customer KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="shadow-xs border-l-4 border-l-blue-500">
              <CardHeader className="pb-1.5">
                <CardDescription className="text-xs uppercase font-medium">
                  Open Receivable Balance
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-blue-600">
                  PKR{" "}
                  {Number(
                    customerStatement?.closingBalance ??
                      customerStatement?.openInvoicesOutstanding ??
                      0
                  ).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Current balance receivable from customer
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-1.5">
                <CardDescription className="text-xs uppercase font-medium">
                  Total Invoiced (Debits)
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                  PKR{" "}
                  {Number(customerStatement?.totalDebits || 0).toLocaleString(
                    "en-PK",
                    { minimumFractionDigits: 2 }
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Sales invoices dispatched
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-1.5">
                <CardDescription className="text-xs uppercase font-medium">
                  Total Collected (Credits)
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-emerald-600">
                  PKR{" "}
                  {Number(customerStatement?.totalCredits || 0).toLocaleString(
                    "en-PK",
                    { minimumFractionDigits: 2 }
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Cash & bank receipts cleared
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-1.5">
                <CardDescription className="text-xs uppercase font-medium">
                  Reconciliation Status
                </CardDescription>
                <div className="pt-1">
                  {customerError ? (
                    <Badge variant="destructive" className="text-xs">
                      Sync Error
                    </Badge>
                  ) : customerStatement?.isReconciled ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">
                      Reconciled with GL
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Active Account
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mt-2">
                  Auto-validated with sales register
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Customer Error Banner */}
          {customerError && (
            <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{customerError}</span>
            </div>
          )}

          {/* Customer Statement Table */}
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Customer Statement & Ledger Entries
              </CardTitle>
              <CardDescription className="text-xs">
                Invoices, customer receipts, and withholding tax adjustments.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[100px] text-xs font-semibold">Date</TableHead>
                    <TableHead className="w-[90px] text-xs font-semibold">Type</TableHead>
                    <TableHead className="text-xs font-semibold">Document Number</TableHead>
                    <TableHead className="text-xs font-semibold">Reference / Notes</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Debit (Invoiced)</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Credit (Received)</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Running Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!customerStatement ||
                  !customerStatement.entries ||
                  customerStatement.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <FileText className="h-6 w-6 text-muted-foreground/60" />
                          <p className="text-sm font-medium">No ledger entries for this customer</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerStatement.entries.map((entry: any, idx: number) => (
                      <TableRow key={idx} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.date ? entry.date.split("T")[0] : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium ${
                              entry.type === "INVOICE"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : entry.type === "RECEIPT"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {entry.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium text-foreground">
                          {entry.documentNumber}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.description || entry.reference || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-foreground">
                          {entry.debit > 0
                            ? `PKR ${Number(entry.debit).toLocaleString("en-PK", {
                                minimumFractionDigits: 2,
                              })}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600">
                          {entry.credit > 0
                            ? `PKR ${Number(entry.credit).toLocaleString("en-PK", {
                                minimumFractionDigits: 2,
                              })}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-foreground">
                          PKR{" "}
                          {Number(entry.balance).toLocaleString("en-PK", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 3: STOCK LEDGER & FIFO LAYERS                         */}
        {/* ========================================================= */}
        <TabsContent value="stock" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border shadow-xs">
            <div className="flex items-center gap-3">
              <Label className="text-xs font-semibold whitespace-nowrap">
                Filter Item:
              </Label>
              <Select value={selectedItemId} onValueChange={(val) => setSelectedItemId(val || "ALL")}>
                <SelectTrigger className="w-[300px] h-9 text-xs">
                  <SelectValue placeholder="All Items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Inventory Items</SelectItem>
                  {stockItems.map((item) => (
                    <SelectItem key={item.itemId} value={item.itemId}>
                      {item.itemCode} - {item.itemName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">
              Costing Model: <span className="font-semibold text-foreground">FIFO Valuation</span>
            </div>
          </div>

          {/* Active FIFO Cost Layers Breakdown (Explicit Requirement) */}
          <Card className="shadow-xs border-primary/20">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Active FIFO Inventory Valuation Layers
                </CardTitle>
                <CardDescription className="text-xs">
                  First-in, first-out receipt cost layers tracked for authoritative stock valuation.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {activeFifoLayers.length} Active Layer{activeFifoLayers.length === 1 ? "" : "s"}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[70px] text-xs font-semibold">Layer #</TableHead>
                    <TableHead className="text-xs font-semibold">Receipt Date</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Remaining Qty</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Layer Unit Cost (PKR)</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Tracked Value (PKR)</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeFifoLayers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-xs">
                        No active FIFO layers found. Received inventory will be layered here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeFifoLayers.map((layer: any, idx: number) => (
                      <TableRow key={layer.id || idx} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          #{layer.sequence ?? idx + 1}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {layer.receiptDate ? layer.receiptDate.split("T")[0] : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-foreground font-semibold">
                          {Number(layer.remainingQty).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-foreground">
                          PKR{" "}
                          {Number(layer.unitCost).toLocaleString("en-PK", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-emerald-600">
                          PKR{" "}
                          {Number(
                            layer.trackedValue ?? layer.remainingQty * layer.unitCost
                          ).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                            OPEN
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Stock Movements Register */}
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Stock Movements Register
              </CardTitle>
              <CardDescription className="text-xs">
                Inward receipts, production consumption, transfers, and outward dispatches.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[100px] text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Item</TableHead>
                    <TableHead className="w-[100px] text-xs font-semibold">Type</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Qty In</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Qty Out</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Unit Cost (PKR)</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Total Cost (PKR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockMovements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-28 text-center text-muted-foreground text-xs">
                        No movement transactions recorded for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stockMovements.map((m: any, idx: number) => {
                      const isIn = m.quantity > 0;
                      return (
                        <TableRow key={m.id || idx} className="hover:bg-muted/30">
                          <TableCell className="text-xs text-muted-foreground">
                            {m.date ? m.date.split("T")[0] : "-"}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground">
                            {m.itemName || m.itemCode || "Item"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                isIn
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-orange-50 text-orange-700 border-orange-200"
                              }`}
                            >
                              {m.transactionType || (isIn ? "RECEIPT" : "ISSUE")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-blue-600">
                            {isIn ? `+${m.quantity}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-orange-600">
                            {!isIn ? Math.abs(m.quantity) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-foreground">
                            PKR {Number(m.unitCost || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-xs text-foreground">
                            PKR {Math.abs(Number(m.totalCost || 0)).toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 4: EMPLOYEE LEDGER                                    */}
        {/* ========================================================= */}
        <TabsContent value="employee" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border shadow-xs">
            <div className="flex items-center gap-3">
              <Label className="text-xs font-semibold whitespace-nowrap">
                Filter Employee:
              </Label>
              <Select
                value={selectedEmployeeId}
                onValueChange={(val) => setSelectedEmployeeId(val || "ALL")}
              >
                <SelectTrigger className="w-[280px] h-9 text-xs">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Employees</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode || "EMP"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">
              Total Wage Runs: <span className="font-semibold text-foreground">{wageRuns.length}</span>
            </div>
          </div>

          {/* Employee Wage Lines Table */}
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Salary & Daily Wage Allocations & Disbursements
              </CardTitle>
              <CardDescription className="text-xs">
                Accrued wage allocations, daily rates, days worked, and GL disbursement status.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[120px] text-xs font-semibold">Run / Slip #</TableHead>
                    <TableHead className="w-[110px] text-xs font-semibold">Type</TableHead>
                    <TableHead className="w-[80px] text-xs font-semibold">Period</TableHead>
                    <TableHead className="text-xs font-semibold">Employee</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Days / Basis</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Daily Rate (PKR)</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Gross Wage (PKR)</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Deductions</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Net Pay (PKR)</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeLines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center text-muted-foreground text-xs">
                        No employee salary or wage records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    employeeLines.map((line: any, idx: number) => {
                      const empName = line.employee
                        ? `${line.employee.firstName} ${line.employee.lastName}`
                        : "Worker";

                      return (
                        <TableRow key={line.id || idx} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs font-medium text-foreground">
                            {line.runNumber}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-medium ${
                                line.entryType === "MONTHLY_SALARY"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {line.entryType === "MONTHLY_SALARY" ? "Monthly Salary" : "Daily Wage"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {line.period}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground">
                            {empName}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {line.daysWorked}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {Number(line.dailyRate).toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-foreground font-semibold">
                            {Number(line.grossAmount).toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {Number(line.deductions || 0).toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-emerald-600">
                            {Number(line.netAmount).toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={`text-[10px] ${
                                line.runStatus === "DISBURSED"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-blue-100 text-blue-800 border-blue-300"
                              }`}
                            >
                              {line.runStatus || "ACCRUED"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 5: TAX LEDGER                                         */}
        {/* ========================================================= */}
        <TabsContent value="tax" className="space-y-6">
          {/* Tax KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="shadow-xs border-l-4 border-l-purple-500">
              <CardHeader className="pb-1.5">
                <CardDescription className="text-xs uppercase font-medium">
                  Sales Tax Output (Invoiced)
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-purple-600">
                  PKR{" "}
                  {totalSalesTaxInvoiced.toLocaleString("en-PK", {
                    minimumFractionDigits: 2,
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Charged on customer sales invoices
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-l-4 border-l-blue-500">
              <CardHeader className="pb-1.5">
                <CardDescription className="text-xs uppercase font-medium">
                  WHT Deductions (Receipts)
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-blue-600">
                  PKR{" "}
                  {totalWhtDeducted.toLocaleString("en-PK", {
                    minimumFractionDigits: 2,
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Withholding tax certificates collected
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-1.5">
                <CardDescription className="text-xs uppercase font-medium">
                  Total Statutory Paid
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-emerald-600">
                  PKR{" "}
                  {totalStatutoryPaid.toLocaleString("en-PK", {
                    minimumFractionDigits: 2,
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Remitted via CPR / PSID challans
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-1.5">
                <CardDescription className="text-xs uppercase font-medium">
                  Outstanding Tax Dues
                </CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-rose-600">
                  PKR{" "}
                  {(totalStatutoryDue - totalStatutoryPaid).toLocaleString(
                    "en-PK",
                    { minimumFractionDigits: 2 }
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Pending government obligations
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Statutory Tax Register Table */}
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Statutory Taxes & Obligations Register
              </CardTitle>
              <CardDescription className="text-xs">
                Sales Tax, Income Tax, Customs Duty, Professional Tax, and PESSI liabilities.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[120px] text-xs font-semibold">Head</TableHead>
                    <TableHead className="text-xs font-semibold">Authority</TableHead>
                    <TableHead className="w-[90px] text-xs font-semibold">Period</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Due (PKR)</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Paid (PKR)</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Outstanding (PKR)</TableHead>
                    <TableHead className="text-xs font-semibold">CPR / PSID</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statutoryRegister.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-xs">
                        No statutory tax obligations recorded. Record them under Outgoing Payments.
                      </TableCell>
                    </TableRow>
                  ) : (
                    statutoryRegister.map((s: any, idx: number) => {
                      const isLabour = s.head?.toUpperCase() === "LABOUR";
                      return (
                        <TableRow key={s.id || idx} className="hover:bg-muted/30">
                          <TableCell className="font-semibold text-xs text-foreground">
                            {s.head}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {s.authority}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {s.taxPeriod}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-foreground">
                            {Number(s.dueAmount).toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-emerald-600">
                            {Number(s.paidAmount || 0).toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-rose-600">
                            {Number(s.outstandingAmount || 0).toLocaleString(
                              "en-PK",
                              { minimumFractionDigits: 2 }
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {s.challanNumber || s.cprNumber || s.psid || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            {isLabour ? (
                              <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                                Pending Confirmation
                              </Badge>
                            ) : (
                              <Badge
                                className={`text-[10px] ${
                                  s.status === "PAID"
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : "bg-muted text-foreground border"
                                }`}
                              >
                                {s.status}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Withholding Tax (WHT) Deductions Register */}
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Withholding Tax (WHT) Deductions on Customer Receipts
              </CardTitle>
              <CardDescription className="text-xs">
                Tax withheld by clients at source under Income Tax Ordinance sections (e.g. Sec 153).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[110px] text-xs font-semibold">Receipt #</TableHead>
                    <TableHead className="w-[90px] text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Section</TableHead>
                    <TableHead className="text-xs font-semibold">Certificate / Ref #</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Amount Received (PKR)</TableHead>
                    <TableHead className="text-right text-xs font-semibold">WHT Withheld (PKR)</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerReceipts.filter((r) => Number(r.taxWithheld) > 0).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-28 text-center text-muted-foreground text-xs">
                        No customer withholding tax deductions recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerReceipts
                      .filter((r) => Number(r.taxWithheld) > 0)
                      .map((r: any, idx: number) => (
                        <TableRow key={r.id || idx} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs font-medium text-foreground">
                            {r.receiptNumber}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.receiptDate ? r.receiptDate.split("T")[0] : "-"}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {r.withholdingSection || "Sec 153"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {r.withholdingCertificate || "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-foreground">
                            PKR{" "}
                            {Number(r.amountReceived).toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-blue-600">
                            PKR{" "}
                            {Number(r.taxWithheld).toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                              VERIFIED
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Output Sales Tax Liabilities Register */}
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Output Sales Tax Liabilities on Sales Invoices
              </CardTitle>
              <CardDescription className="text-xs">
                Federal sales tax charged on customer tax invoices (standard 18% GST).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[120px] text-xs font-semibold">Invoice #</TableHead>
                    <TableHead className="w-[90px] text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Customer</TableHead>
                    <TableHead className="text-xs font-semibold">Customer Tax ID (NTN/STRN)</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Taxable Supplies (PKR)</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Sales Tax Output (PKR)</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesInvoices.filter((inv) => Number(inv.taxAmount) > 0).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-28 text-center text-muted-foreground text-xs">
                        No sales invoices with output sales tax recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    salesInvoices
                      .filter((inv) => Number(inv.taxAmount) > 0)
                      .map((inv: any, idx: number) => (
                        <TableRow key={inv.id || idx} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs font-medium text-foreground">
                            {inv.invoiceNumber}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {inv.invoiceDate ? inv.invoiceDate.split("T")[0] : "-"}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground">
                            {inv.customer?.name || "Customer"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {inv.customerTaxId || "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-foreground">
                            PKR{" "}
                            {Number(inv.subtotal).toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-purple-600">
                            PKR{" "}
                            {Number(inv.taxAmount).toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                inv.status === "PAID"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {inv.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
