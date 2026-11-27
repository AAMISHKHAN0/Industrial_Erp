"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Filter, FileSpreadsheet, Printer, ChevronDown, ChevronRight,
  ShieldCheck, AlertTriangle, Layers, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createCrudService } from "@/lib/api/crud";
import { api } from "@/lib/api/client";
import { AppShell } from "@/components/layouts/app-shell";
import { EntitySelect } from "@/components/shared/entity-select";
import { exportExcel } from "@/lib/reports/export-utils";
import { generateStockRegisterPdf } from "@/lib/reports/stores-reports";
import { toast } from "sonner";

interface Warehouse { id: string; name: string; code: string; }
interface Category { id: string; name: string; }

interface StockRegisterLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  category?: string;
  unit: string;
  openingQty: number;
  openingValue: number;
  inwardQty: number;
  inwardValue: number;
  outwardQty: number;
  outwardValue: number;
  closingQty: number;
  closingValue: number;
  fifoLayers: Array<{
    id: string;
    receiptDate: string;
    sequence: number;
    remainingQty: number;
    unitCost: number;
    trackedValue: number;
  }>;
  movements: Array<{
    id: string;
    date: string;
    transactionType: string;
    referenceType?: string;
    referenceId?: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    notes?: string;
  }>;
}

interface RegisterResponse {
  dateRange: { startDate: string; endDate: string };
  filters: { warehouseId: string | null; itemId: string | null; categoryId: string | null };
  summary: {
    totalOpeningQty: number;
    totalOpeningValue: number;
    totalInwardQty: number;
    totalInwardValue: number;
    totalOutwardQty: number;
    totalOutwardValue: number;
    totalClosingQty: number;
    totalClosingValue: number;
  };
  glReconciliation: {
    inventoryValuation: number;
    glInventoryBalance: number;
    variance: number;
    isReconciled: boolean;
    accountName: string;
  };
  items: StockRegisterLine[];
}

function fmt(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "0.00";
  return Number(val).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtQty(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "0";
  return Number(val).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function StockLedgerPage() {
  const [data, setData] = useState<RegisterResponse | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [warehouseId, setWarehouseId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");

  // Drill-down modal
  const [drillDownItem, setDrillDownItem] = useState<StockRegisterLine | null>(null);

  const fetchRefs = useCallback(async () => {
    try {
      const [whRes, catRes] = await Promise.allSettled([
        createCrudService<Warehouse>("/inventory/warehouses").findAll({ limit: 100, isActive: true }),
        createCrudService<Category>("/inventory/categories").findAll({ limit: 100, status: "ACTIVE" }),
      ]);
      if (whRes.status === "fulfilled") setWarehouses(whRes.value.data);
      if (catRes.status === "fulfilled") setCategories(catRes.value.data);
    } catch { /* ignore */ }
  }, []);

  const fetchRegister = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(`${endDate}T23:59:59.999Z`).toISOString(),
      });
      if (warehouseId !== "all") params.append("warehouseId", warehouseId);
      if (categoryId !== "all") params.append("categoryId", categoryId);

      const json = await api.get<RegisterResponse>(`/inventory/stock/register?${params.toString()}`);
      setData(json);
    } catch (e: any) {
      toast.error(e.message || "Failed to load stock register");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, warehouseId, categoryId]);

  useEffect(() => { fetchRefs(); }, []);
  useEffect(() => { fetchRegister(); }, [fetchRegister]);

  const items = data?.items || [];
  const filtered = items.filter((item) => {
    if (search && !item.itemName.toLowerCase().includes(search.toLowerCase()) && !item.itemCode.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleExportPdf = () => {
    if (!data) return;
    try {
      generateStockRegisterPdf(data);
      toast.success("Stock register PDF generated");
    } catch (err: any) {
      toast.error(`PDF export error: ${err.message}`);
    }
  };

  const handleExportExcel = () => {
    if (!data) return;
    try {
      const exportCols = [
        { header: "Item Code", accessor: (r: StockRegisterLine) => r.itemCode },
        { header: "Item Name", accessor: (r: StockRegisterLine) => r.itemName },
        { header: "Category", accessor: (r: StockRegisterLine) => r.category || "-" },
        { header: "Unit", accessor: (r: StockRegisterLine) => r.unit },
        { header: "Opening Qty", accessor: (r: StockRegisterLine) => r.openingQty },
        { header: "Opening Value (PKR)", accessor: (r: StockRegisterLine) => r.openingValue },
        { header: "Inward Qty", accessor: (r: StockRegisterLine) => r.inwardQty },
        { header: "Inward Value (PKR)", accessor: (r: StockRegisterLine) => r.inwardValue },
        { header: "Outward Qty", accessor: (r: StockRegisterLine) => r.outwardQty },
        { header: "Outward Value (PKR)", accessor: (r: StockRegisterLine) => r.outwardValue },
        { header: "Closing Qty", accessor: (r: StockRegisterLine) => r.closingQty },
        { header: "Closing Value (PKR)", accessor: (r: StockRegisterLine) => r.closingValue },
      ];
      exportExcel(filtered, exportCols, `StockRegister-${endDate}`);
      toast.success("Excel report exported successfully");
    } catch (err: any) {
      toast.error(`Excel export error: ${err.message}`);
    }
  };

  const summary = data?.summary;
  const gl = data?.glReconciliation;

  return (
    <AppShell title="Stock Register & Valuation">
      <div className="space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Stock Register & FIFO Valuation</h2>
            <p className="text-sm text-muted-foreground">
              Period stock conservation (Opening + Inward - Outward = Closing) with live General Ledger tie-out
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!data}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" /> Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!data}>
              <Printer className="h-4 w-4 mr-2 text-sky-600" /> Print PDF Report
            </Button>
            <Button variant="outline" size="sm" onClick={fetchRegister}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        {/* Filter Card */}
        <Card className="border-muted">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" /> Date Range & Warehouse Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="flex flex-wrap items-end gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs w-36"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs w-36"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Warehouse</Label>
                <EntitySelect
                  value={warehouseId === "all" ? "" : warehouseId}
                  onValueChange={(v) => setWarehouseId(v || "all")}
                  entityLabel="Warehouse"
                  pluralLabel="warehouses"
                  quickAddType="warehouse"
                  allowNone
                  noneLabel="All Warehouses"
                  placeholder="All Warehouses"
                  className="h-8 text-xs w-44"
                  options={warehouses.map((w) => ({
                    value: w.id,
                    label: `${w.name} (${w.code})`,
                  }))}
                  onQuickCreated={(created) => {
                    setWarehouses((prev) => [created, ...prev]);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <EntitySelect
                  value={categoryId === "all" ? "" : categoryId}
                  onValueChange={(v) => setCategoryId(v || "all")}
                  entityLabel="Category"
                  pluralLabel="categories"
                  quickAddType="category"
                  allowNone
                  noneLabel="All Categories"
                  placeholder="All Categories"
                  className="h-8 text-xs w-40"
                  options={categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  onQuickCreated={(created) => {
                    setCategories((prev) => [created, ...prev]);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quick Search</Label>
                <Input
                  placeholder="Filter item name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-xs w-52"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valuation & GL Tie-Out Metrics Cards */}
        {summary && gl && (
          <div className="grid grid-cols-5 gap-3">
            <Card className="p-3 bg-slate-50/70 border-slate-200">
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Opening Valuation</span>
              <div className="text-lg font-bold text-slate-800">PKR {fmt(summary.totalOpeningValue)}</div>
              <span className="text-xs text-muted-foreground">{fmtQty(summary.totalOpeningQty)} units in stock</span>
            </Card>

            <Card className="p-3 bg-emerald-50/50 border-emerald-200">
              <span className="text-[11px] font-medium text-emerald-800 uppercase">Inward (Receipts)</span>
              <div className="text-lg font-bold text-emerald-700">+PKR {fmt(summary.totalInwardValue)}</div>
              <span className="text-xs text-emerald-600">+{fmtQty(summary.totalInwardQty)} units received</span>
            </Card>

            <Card className="p-3 bg-amber-50/50 border-amber-200">
              <span className="text-[11px] font-medium text-amber-800 uppercase">Outward (Issues/Ret)</span>
              <div className="text-lg font-bold text-amber-700">-PKR {fmt(summary.totalOutwardValue)}</div>
              <span className="text-xs text-amber-600">-{fmtQty(summary.totalOutwardQty)} units dispatched</span>
            </Card>

            <Card className="p-3 bg-sky-50/50 border-sky-200">
              <span className="text-[11px] font-medium text-sky-800 uppercase">Closing FIFO Value</span>
              <div className="text-lg font-bold text-sky-700">PKR {fmt(summary.totalClosingValue)}</div>
              <span className="text-xs text-sky-600">{fmtQty(summary.totalClosingQty)} units on hand</span>
            </Card>

            <Card className={`p-3 border ${gl.isReconciled ? "bg-emerald-50/80 border-emerald-300" : "bg-destructive/10 border-destructive"}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase">GL Inventory Tie-Out</span>
                {gl.isReconciled ? (
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                    <ShieldCheck className="h-3 w-3 mr-1" /> Reconciled
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Variance
                  </Badge>
                )}
              </div>
              <div className="text-lg font-bold text-foreground">PKR {fmt(gl.glInventoryBalance)}</div>
              <span className="text-xs text-muted-foreground">
                Variance: PKR {fmt(gl.variance)}
              </span>
            </Card>
          </div>
        )}

        {/* Stock Register Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead className="min-w-[180px]">Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Unit</TableHead>
                  <TableHead className="text-right">Opening Qty</TableHead>
                  <TableHead className="text-right">Opening Val</TableHead>
                  <TableHead className="text-right text-emerald-700">Inward Qty</TableHead>
                  <TableHead className="text-right text-emerald-700">Inward Val</TableHead>
                  <TableHead className="text-right text-amber-700">Outward Qty</TableHead>
                  <TableHead className="text-right text-amber-700">Outward Val</TableHead>
                  <TableHead className="text-right font-semibold">Closing Qty</TableHead>
                  <TableHead className="text-right font-semibold text-primary">Closing Val (PKR)</TableHead>
                  <TableHead className="text-center w-24">Drill-Down</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-28 text-center text-muted-foreground">
                      Calculating live FIFO register and reconciliations...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-24 text-center text-muted-foreground">
                      No stock records found for the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item, idx) => (
                    <TableRow key={item.itemId} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground">{item.itemName}</div>
                        <div className="text-[10px] text-muted-foreground">{item.itemCode}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.category || "-"}</TableCell>
                      <TableCell className="text-center font-mono">{item.unit}</TableCell>
                      <TableCell className="text-right font-mono">{fmtQty(item.openingQty)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{fmt(item.openingValue)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-700 font-medium">+{fmtQty(item.inwardQty)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-700">+{fmt(item.inwardValue)}</TableCell>
                      <TableCell className="text-right font-mono text-amber-700 font-medium">-{fmtQty(item.outwardQty)}</TableCell>
                      <TableCell className="text-right font-mono text-amber-700">-{fmt(item.outwardValue)}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{fmtQty(item.closingQty)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">PKR {fmt(item.closingValue)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-primary"
                          onClick={() => setDrillDownItem(item)}
                        >
                          Movements ({item.movements?.length || 0})
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Movement Drill-Down Modal */}
        <Dialog open={!!drillDownItem} onOpenChange={() => setDrillDownItem(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[85vh] grid grid-rows-[auto_1fr_auto] p-0">
            <DialogHeader className="px-6 pt-5 pb-3 border-b">
              <DialogTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <span>Audit Trail & FIFO Layers: {drillDownItem?.itemName} ({drillDownItem?.itemCode})</span>
              </DialogTitle>
              <DialogDescription>
                Chronological stock movements and open FIFO layers determining closing valuation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-6 py-4 overflow-y-auto min-h-0 text-xs">
              {/* Active FIFO Layers */}
              <div className="space-y-2">
                <span className="font-semibold text-slate-800">Active Open FIFO Layers</span>
                {drillDownItem && drillDownItem.fifoLayers.length > 0 ? (
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="p-2 text-left">Receipt Date</th>
                          <th className="p-2 text-center">Seq</th>
                          <th className="p-2 text-right">Remaining Qty</th>
                          <th className="p-2 text-right">Unit Cost</th>
                          <th className="p-2 text-right">Valuation (PKR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drillDownItem.fifoLayers.map((l) => (
                          <tr key={l.id} className="border-b last:border-0">
                            <td className="p-2">{formatDate(l.receiptDate)}</td>
                            <td className="p-2 text-center font-mono">{l.sequence}</td>
                            <td className="p-2 text-right font-mono font-semibold">{fmtQty(l.remainingQty)}</td>
                            <td className="p-2 text-right font-mono">PKR {fmt(l.unitCost)}</td>
                            <td className="p-2 text-right font-mono font-bold text-primary">PKR {fmt(l.trackedValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">No active FIFO layers remaining (stock is zero).</p>
                )}
              </div>

              {/* Movement Ledger Audit */}
              <div className="space-y-2">
                <span className="font-semibold text-slate-800">Period Movement Ledger</span>
                {drillDownItem && drillDownItem.movements.length > 0 ? (
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="p-2 text-left">Date</th>
                          <th className="p-2 text-left">Transaction Type</th>
                          <th className="p-2 text-left">Reference</th>
                          <th className="p-2 text-right">Qty Change</th>
                          <th className="p-2 text-right">Cost Impact (PKR)</th>
                          <th className="p-2 text-left">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drillDownItem.movements.map((m) => (
                          <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-2 text-muted-foreground">{formatDate(m.date)}</td>
                            <td className="p-2 font-medium">{m.transactionType}</td>
                            <td className="p-2 font-mono text-[11px] text-muted-foreground">
                              {m.referenceType ? `${m.referenceType} #` : ""}{m.referenceId || "-"}
                            </td>
                            <td className={`p-2 text-right font-mono font-semibold ${m.quantity > 0 ? "text-emerald-700" : "text-amber-700"}`}>
                              {m.quantity > 0 ? `+${fmtQty(m.quantity)}` : fmtQty(m.quantity)}
                            </td>
                            <td className="p-2 text-right font-mono">
                              PKR {fmt(m.totalCost)}
                            </td>
                            <td className="p-2 text-muted-foreground">{m.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">No movements recorded during this period.</p>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t bg-muted/10 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setDrillDownItem(null)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
