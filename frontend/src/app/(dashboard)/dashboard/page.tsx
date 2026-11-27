"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FilePlus2,
  Receipt,
  Package,
  AlertTriangle,
  FileText,
  Landmark,
  RefreshCw,
  CheckCircle2,
  BarChart3,
  ExternalLink,
  ChevronRight,
  Building2,
  Users,
  ShoppingCart,
  Truck,
  Factory,
  Wallet,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api, getAuthSessionToken, UnauthorizedError } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface StockRegisterSummary {
  totalClosingQty?: number;
  totalClosingValue?: number;
  totalOpeningValue?: number;
  totalInwardValue?: number;
  totalOutwardValue?: number;
}

interface InventoryItem {
  id: string;
  itemCode: string;
  name: string;
  currentStock?: number;
  minStock?: number | null;
  reorderLevel?: number | null;
  averageCost?: number | null;
  purchasePrice?: number | null;
  category?: { name: string };
  unit?: { code?: string; name?: string };
}

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: { name: string };
  invoiceDate: string;
  dueDate?: string | null;
  status: string;
  totalAmount: number;
  paidAmount?: number;
  outstandingAmount?: number;
}

interface SupplierBill {
  id: string;
  billNumber: string;
  vendorId: string;
  vendor?: { name: string };
  billDate: string;
  dueDate?: string | null;
  status: string;
  totalAmount: number;
  paidAmount?: number;
}

interface StatutoryObligation {
  id: string;
  obligationNumber: string;
  head: string;
  authority: string;
  taxPeriod: string;
  dueAmount: number;
  paidAmount?: number;
  outstandingAmount?: number;
  dueDate?: string | null;
  status: string;
}

type RevenuePoint = {
  month: number;
  revenue: number;
  purchases?: number;
  orders: number;
  purchaseOrders?: number;
};

type DashboardSummary = {
  todayPurchases?: number;
  pendingApprovals?: number;
  inventoryValue?: number;
  monthlySales?: number;
  productionOutput?: number;
  activeEmployees?: number;
};

type ChartSeriesPoint = {
  month: string;
  revenue: number;
  purchases: number;
  orders: number;
  purchaseOrders: number;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("Syncing");

  // Metrics Data States
  const [stockValue, setStockValue] = useState<number>(0);
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);

  const [unpaidInvoices, setUnpaidInvoices] = useState<SalesInvoice[]>([]);
  const [unpaidInvoicesTotal, setUnpaidInvoicesTotal] = useState<number>(0);

  const [unpaidBills, setUnpaidBills] = useState<SupplierBill[]>([]);
  const [unpaidStatutory, setUnpaidStatutory] = useState<StatutoryObligation[]>([]);
  const [paymentsDueTotal, setPaymentsDueTotal] = useState<number>(0);

  // Revenue & Cashflow chart
  const [revenue, setRevenue] = useState<ChartSeriesPoint[]>([]);
  const [chartMode, setChartMode] = useState<"cashflow" | "orders">("cashflow");
  const [summaryStats, setSummaryStats] = useState<DashboardSummary | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  // Active tab for the Action Queue
  const [activeQueueTab, setActiveQueueTab] = useState<string>("low-stock");

  const loadData = useCallback(async (isSilent = false) => {
    if (!getAuthSessionToken()) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!isSilent) setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        api.get<{ summary?: StockRegisterSummary }>("/inventory/stock/register"),
        api.get<any>("/inventory/items?limit=250"),
        api.get<SalesInvoice[]>("/sales/invoices"),
        api.get<any>("/purchase/bills?limit=100"),
        api.get<StatutoryObligation[]>("/finance/statutory/register"),
      ]);
      const [stockRegRes, itemsRes, invoicesRes, billsRes, statutoryRes] = results;

      const hasUnauthorized = results.some(
        (r) => r.status === "rejected" && r.reason instanceof UnauthorizedError
      );
      if (hasUnauthorized) {
        setDataError(null);
        return;
      }

      // 1. Process Items & Low Stock
      let itemsList: InventoryItem[] = [];
      if (itemsRes.status === "fulfilled" && itemsRes.value) {
        if (Array.isArray(itemsRes.value)) {
          itemsList = itemsRes.value;
        } else if (Array.isArray(itemsRes.value.data)) {
          itemsList = itemsRes.value.data;
        }
      }
      setAllItems(itemsList);

      const computedLowStock = itemsList.filter((item) => {
        const stock = Number(item.currentStock ?? 0);
        const min = item.minStock != null ? Number(item.minStock) : null;
        const reorder = item.reorderLevel != null ? Number(item.reorderLevel) : null;
        if (min != null && stock <= min) return true;
        if (reorder != null && stock <= reorder) return true;
        return false;
      });
      setLowStockItems(computedLowStock);

      // 2. Process Stock Value
      let totalValue = 0;
      if (
        stockRegRes.status === "fulfilled" &&
        stockRegRes.value &&
        typeof stockRegRes.value.summary?.totalClosingValue === "number"
      ) {
        totalValue = Number(stockRegRes.value.summary.totalClosingValue);
      } else {
        totalValue = itemsList.reduce((sum, item) => {
          const qty = Number(item.currentStock ?? 0);
          const price = Number(item.averageCost ?? item.purchasePrice ?? 0);
          return sum + qty * price;
        }, 0);
      }
      setStockValue(totalValue);

      // 3. Process Unpaid Customer Invoices
      let invList: SalesInvoice[] = [];
      if (invoicesRes.status === "fulfilled" && invoicesRes.value) {
        if (Array.isArray(invoicesRes.value)) {
          invList = invoicesRes.value;
        } else if (Array.isArray((invoicesRes.value as any).data)) {
          invList = (invoicesRes.value as any).data;
        }
      }

      const openInvoices = invList.filter((inv) => {
        const s = (inv.status || "").toUpperCase();
        if (s === "PAID" || s === "CANCELLED" || s === "VOID") return false;
        const total = Number(inv.totalAmount || 0);
        const paid = Number(inv.paidAmount || 0);
        const balance = inv.outstandingAmount != null ? Number(inv.outstandingAmount) : total - paid;
        return balance > 0;
      });
      setUnpaidInvoices(openInvoices);

      const openInvoicesSum = openInvoices.reduce((sum, inv) => {
        const total = Number(inv.totalAmount || 0);
        const paid = Number(inv.paidAmount || 0);
        const balance = inv.outstandingAmount != null ? Number(inv.outstandingAmount) : total - paid;
        return sum + Math.max(0, balance);
      }, 0);
      setUnpaidInvoicesTotal(openInvoicesSum);

      // 4. Process Unpaid Supplier Bills
      let billsList: SupplierBill[] = [];
      if (billsRes.status === "fulfilled" && billsRes.value) {
        if (Array.isArray(billsRes.value)) {
          billsList = billsRes.value;
        } else if (Array.isArray(billsRes.value.data)) {
          billsList = billsRes.value.data;
        }
      }

      const openBills = billsList.filter((bill) => {
        const s = (bill.status || "").toUpperCase();
        if (s === "PAID" || s === "CANCELLED") return false;
        const total = Number(bill.totalAmount || 0);
        const paid = Number(bill.paidAmount || 0);
        return total - paid > 0;
      });
      setUnpaidBills(openBills);

      const billsSum = openBills.reduce((sum, b) => {
        const total = Number(b.totalAmount || 0);
        const paid = Number(b.paidAmount || 0);
        return sum + Math.max(0, total - paid);
      }, 0);

      // 5. Process Unpaid Statutory Obligations
      let statList: StatutoryObligation[] = [];
      if (statutoryRes.status === "fulfilled" && statutoryRes.value) {
        if (Array.isArray(statutoryRes.value)) {
          statList = statutoryRes.value;
        } else if (Array.isArray((statutoryRes.value as any).data)) {
          statList = (statutoryRes.value as any).data;
        }
      }

      const openStatutory = statList.filter((stat) => {
        const s = (stat.status || "").toUpperCase();
        if (s === "PAID" || s === "CANCELLED") return false;
        const due =
          stat.outstandingAmount != null
            ? Number(stat.outstandingAmount)
            : Number(stat.dueAmount || 0) - Number(stat.paidAmount || 0);
        return due > 0;
      });
      setUnpaidStatutory(openStatutory);

      const statutorySum = openStatutory.reduce(
        (sum, s) =>
          sum +
          Math.max(
            0,
            s.outstandingAmount != null
              ? Number(s.outstandingAmount)
              : Number(s.dueAmount || 0) - Number(s.paidAmount || 0)
          ),
        0
      );
      setPaymentsDueTotal(billsSum + statutorySum);

      const rejectedCount = [stockRegRes, itemsRes, invoicesRes, billsRes, statutoryRes].filter(
        (r) => r.status === "rejected" && !(r.reason instanceof UnauthorizedError)
      ).length;
      if (rejectedCount === 5) {
        setDataError("Could not load dashboard metrics");
      } else if (rejectedCount > 0) {
        setDataError("Some metrics could not be loaded");
      } else {
        setDataError(null);
      }

      const now = new Date();
      setLastUpdated(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch (err) {
      if (!(err instanceof UnauthorizedError)) {
        setDataError("Unable to reach API server");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Revenue & summary chart loader
  const loadRevenue = useCallback(async () => {
    if (!getAuthSessionToken()) {
      setRevenueLoading(false);
      return;
    }
    setRevenueLoading(true);
    try {
      const [revRes, sumRes] = await Promise.allSettled([
        api.get<RevenuePoint[]>("/dashboard/revenue"),
        api.get<DashboardSummary>("/dashboard/summary"),
      ]);
      if (revRes.status === "fulfilled") {
        const mapped: ChartSeriesPoint[] = (revRes.value || []).map((d, i) => {
          const monthNum = Number(d.month);
          const label =
            monthNum >= 1 && monthNum <= 12
              ? MONTH_LABELS[monthNum - 1]
              : MONTH_LABELS[i] ?? String(d.month);
          return {
            month: label,
            revenue: Number(d.revenue || 0),
            purchases: Number(d.purchases || 0),
            orders: Number(d.orders || 0),
            purchaseOrders: Number(d.purchaseOrders || 0),
          };
        });
        setRevenue(mapped);
        setRevenueError(null);
      } else {
        throw revRes.reason;
      }
      if (sumRes.status === "fulfilled" && sumRes.value) {
        setSummaryStats(sumRes.value);
      }
    } catch (e: any) {
      if (e instanceof UnauthorizedError) {
        setRevenueError(null);
      } else {
        setRevenue([]);
        setRevenueError(e.message || "Failed to load revenue data");
      }
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRevenue();
  }, [loadRevenue]);

  // Initial load and periodic refresh (30s)
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const totalPaymentsCount = unpaidBills.length + unpaidStatutory.length;
  const currentMonthIndex = new Date().getMonth();

  const annualRevenueTotal = useMemo(
    () => revenue.reduce((sum, item) => sum + item.revenue, 0),
    [revenue]
  );

  const annualPurchaseTotal = useMemo(
    () => revenue.reduce((sum, item) => sum + item.purchases, 0),
    [revenue]
  );

  const annualOrdersTotal = useMemo(
    () => revenue.reduce((sum, item) => sum + item.orders, 0),
    [revenue]
  );

  const annualPurchaseOrdersTotal = useMemo(
    () => revenue.reduce((sum, item) => sum + item.purchaseOrders, 0),
    [revenue]
  );

  const hasChartActivity = useMemo(
    () =>
      revenue.some(
        (r) => r.revenue > 0 || r.purchases > 0 || r.orders > 0 || r.purchaseOrders > 0
      ),
    [revenue]
  );

  const chartSeries: ChartSeriesPoint[] = useMemo(() => {
    if (revenue.length > 0) return revenue;
    return MONTH_LABELS.map((month) => ({
      month,
      revenue: 0,
      purchases: 0,
      orders: 0,
      purchaseOrders: 0,
    }));
  }, [revenue]);

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">
            Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Material flow, stock valuation, receivables, and disbursements
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            Synced {lastUpdated}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadData(false);
              loadRevenue();
            }}
            disabled={refreshing}
            className="h-8 gap-2 border-border text-xs font-normal hover:bg-muted"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing ? "animate-spin text-foreground" : "text-muted-foreground"
              }`}
              strokeWidth={1.5}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {dataError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" strokeWidth={1.5} />
            <span>{dataError}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(false)}
            className="h-7 px-3 text-xs font-normal"
          >
            Retry
          </Button>
        </div>
      )}

      {/* 2. Factory Operations Lifecycle */}
      <Card className="gap-0 rounded-xl border border-border bg-card p-5 shadow-none ring-0">
        <div className="flex flex-col justify-between gap-2 border-b border-border pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Factory className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <span>Operations lifecycle</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Standard flow from master setup through sourcing, production, and settlement
            </p>
          </div>
          <span className="self-start font-mono text-xs text-muted-foreground sm:self-auto">
            4 stages
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Stage 01: Master setup */}
          <div className="flex flex-col justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  01
                </span>
                <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="text-sm font-medium text-foreground">Master setup</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Register buyers, suppliers, and catalog items
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 text-xs">
              <Link href="/customers" className="font-medium text-primary hover:underline">
                Customers
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/purchase/vendors" className="font-medium text-primary hover:underline">
                Vendors
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/inventory/items" className="font-medium text-primary hover:underline">
                Items
              </Link>
            </div>
          </div>

          {/* Stage 02: Sourcing & inward */}
          <div className="flex flex-col justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  02
                </span>
                <Truck className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="text-sm font-medium text-foreground">Sourcing &amp; inward</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Issue purchase orders and receive deliveries into store
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 text-xs">
              <Link href="/purchase/orders" className="font-medium text-primary hover:underline">
                Purchase orders
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/purchase/goods-receiving" className="font-medium text-primary hover:underline">
                Receive GRN
              </Link>
            </div>
          </div>

          {/* Stage 03: Production & stores */}
          <div className="flex flex-col justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  03
                </span>
                <Layers className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="text-sm font-medium text-foreground">Production &amp; stores</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Manage BOM recipes, floor issue, and stock balances
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 text-xs">
              <Link href="/production/bom" className="font-medium text-primary hover:underline">
                BOM
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/inventory/material-issue" className="font-medium text-primary hover:underline">
                Issue stock
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/inventory/stock-ledger" className="font-medium text-primary hover:underline">
                Stock ledger
              </Link>
            </div>
          </div>

          {/* Stage 04: Sales & settlement */}
          <div className="flex flex-col justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  04
                </span>
                <Wallet className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="text-sm font-medium text-foreground">Sales &amp; settlement</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Bill customers, record receipts, and reconcile ledgers
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 text-xs">
              <Link href="/sales/invoices" className="font-medium text-primary hover:underline">
                Sales invoices
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/sales/receipts" className="font-medium text-primary hover:underline">
                Receipts
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/finance/ledgers" className="font-medium text-primary hover:underline">
                Ledgers
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Quick Actions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-foreground">
            Quick actions
          </div>
          <div className="text-xs text-muted-foreground">
            Daily operational entries
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/purchase/goods-receiving"
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <ArrowDownToLine className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">
                Receive material
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Log vendor GRN &amp; batch
              </div>
            </div>
          </Link>

          <Link
            href="/inventory/material-issue"
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <ArrowUpFromLine className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">
                Issue material
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Floor stock to production
              </div>
            </div>
          </Link>

          <Link
            href="/sales/invoices"
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <FilePlus2 className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">
                Sales invoice
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Bill customer orders
              </div>
            </div>
          </Link>

          <Link
            href="/sales/receipts"
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <Receipt className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">
                Customer receipt
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Record payment allocation
              </div>
            </div>
          </Link>

          <Link
            href="/customers"
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <Users className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">
                Add customer
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Register buyer &amp; NTN/STRN
              </div>
            </div>
          </Link>

          <Link
            href="/purchase/vendors"
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <Building2 className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">
                Add vendor
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Supplier &amp; sourcing profiles
              </div>
            </div>
          </Link>

          <Link
            href="/purchase/orders"
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <ShoppingCart className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">
                Purchase order
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Issue PO for yarn &amp; materials
              </div>
            </div>
          </Link>

          <Link
            href="/hr/wages"
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <Wallet className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">
                Daily wages
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Shift labor &amp; worker muster
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* 4. Four Core Figures Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Stock Value */}
        <Card className="flex flex-col justify-between gap-0 rounded-xl border border-border bg-card p-5 shadow-none ring-0">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Stock value (PKR)</span>
              <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </div>

            <div className="mt-3 font-mono text-[28px] font-medium leading-none tabular-nums text-foreground">
              {loading ? "—" : formatCurrency(stockValue)}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
            <span className="text-muted-foreground">FIFO valuation</span>
            <Link
              href="/inventory/stock-ledger"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
            >
              <span>Register</span>
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
        </Card>

        {/* Metric 2: Low-Stock Items */}
        <Card className="flex flex-col justify-between gap-0 rounded-xl border border-border bg-card p-5 shadow-none ring-0">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Low-stock items</span>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-2">
              <div className="font-mono text-[28px] font-medium leading-none tabular-nums text-foreground">
                {loading ? "—" : lowStockItems.length}
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {allItems.length > 0 ? `of ${allItems.length} SKUs` : "SKUs"}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  lowStockItems.length > 0 ? "bg-warning" : "bg-success"
                }`}
              />
              <span
                className={
                  lowStockItems.length > 0
                    ? "font-medium text-warning"
                    : "text-muted-foreground"
                }
              >
                {lowStockItems.length === 0
                  ? "Above thresholds"
                  : `${lowStockItems.length} to reorder`}
              </span>
            </span>
            <Link
              href="/inventory/items"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
            >
              <span>Catalog</span>
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
        </Card>

        {/* Metric 3: Unpaid Customer Invoices */}
        <Card className="flex flex-col justify-between gap-0 rounded-xl border border-border bg-card p-5 shadow-none ring-0">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Unpaid customer invoices</span>
              <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </div>

            <div className="mt-3 font-mono text-[28px] font-medium leading-none tabular-nums text-foreground">
              {loading ? "—" : formatCurrency(unpaidInvoicesTotal)}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
            <span className="font-mono tabular-nums text-muted-foreground">
              {unpaidInvoices.length === 0
                ? "0 open invoices"
                : `${unpaidInvoices.length} invoice${unpaidInvoices.length === 1 ? "" : "s"} open`}
            </span>
            <Link
              href="/sales/invoices"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
            >
              <span>Invoices</span>
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
        </Card>

        {/* Metric 4: Payments Due */}
        <Card className="flex flex-col justify-between gap-0 rounded-xl border border-border bg-card p-5 shadow-none ring-0">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Payments due</span>
              <Landmark className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </div>

            <div className="mt-3 font-mono text-[28px] font-medium leading-none tabular-nums text-foreground">
              {loading ? "—" : formatCurrency(paymentsDueTotal)}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
            <span className="font-mono tabular-nums text-muted-foreground">
              {totalPaymentsCount === 0
                ? "0 due"
                : `${unpaidBills.length} bill${unpaidBills.length === 1 ? "" : "s"} · ${unpaidStatutory.length} statutory`}
            </span>
            <Link
              href="/finance/payments"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
            >
              <span>Disburse</span>
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
        </Card>
      </div>

      {/* 5. Financial & Order Performance (Hero Graph) */}
      <Card className="gap-0 rounded-xl border border-border bg-card p-5 shadow-none ring-0">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <BarChart3 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <span>Monthly performance</span>
              {!revenueLoading && !revenueError && !hasChartActivity && (
                <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                  Awaiting posted transactions
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {chartMode === "cashflow"
                ? "Sales revenue vs purchase spend across the fiscal year (PKR)"
                : "Monthly sales orders vs purchase orders volume"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            {chartMode === "cashflow" ? (
              <div className="flex items-center gap-5">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span>Sales revenue</span>
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-medium tabular-nums text-foreground">
                    {revenueLoading ? "—" : formatCurrency(annualRevenueTotal)}
                  </div>
                </div>
                <div className="h-7 w-px bg-border" />
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-slate-500" />
                    <span>Purchase spend</span>
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-medium tabular-nums text-foreground">
                    {revenueLoading ? "—" : formatCurrency(annualPurchaseTotal)}
                  </div>
                </div>
                <div className="hidden h-7 w-px bg-border sm:block" />
                <div className="hidden sm:block">
                  <div className="text-[11px] text-muted-foreground">Net spread</div>
                  <div
                    className={`mt-0.5 font-mono text-sm font-medium tabular-nums ${
                      annualRevenueTotal - annualPurchaseTotal >= 0
                        ? "text-foreground"
                        : "text-warning"
                    }`}
                  >
                    {revenueLoading
                      ? "—"
                      : formatCurrency(annualRevenueTotal - annualPurchaseTotal)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span>Sales orders</span>
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-medium tabular-nums text-foreground">
                    {revenueLoading ? "—" : annualOrdersTotal}
                  </div>
                </div>
                <div className="h-7 w-px bg-border" />
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>Purchase orders</span>
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-medium tabular-nums text-foreground">
                    {revenueLoading ? "—" : annualPurchaseOrdersTotal}
                  </div>
                </div>
              </div>
            )}

            <div
              role="group"
              aria-label="Chart view"
              className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs"
            >
              <button
                type="button"
                onClick={() => setChartMode("cashflow")}
                className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  chartMode === "cashflow"
                    ? "bg-card font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Revenue vs Spend
              </button>
              <button
                type="button"
                onClick={() => setChartMode("orders")}
                className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  chartMode === "orders"
                    ? "bg-card font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Orders
              </button>
            </div>
          </div>
        </div>

        <div className="h-[300px] pt-5">
          {revenueLoading ? (
            <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground">
              Loading performance graph
            </div>
          ) : revenueError ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <AlertTriangle className="mb-2 h-5 w-5 text-warning" strokeWidth={1.5} />
              <p className="text-xs text-muted-foreground">{revenueError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadRevenue()}
                className="mt-3 h-7 text-xs font-normal"
              >
                Retry
              </Button>
            </div>
          ) : chartMode === "cashflow" ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartSeries}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="purchaseSpendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64748b" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#64748b" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  dy={6}
                  tick={{
                    fontSize: 11,
                    fill: "var(--muted-foreground)",
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  domain={hasChartActivity ? ["auto", "auto"] : [0, 100000]}
                  tick={{
                    fontSize: 11,
                    fill: "var(--muted-foreground)",
                    fontFamily: "var(--font-mono)",
                  }}
                  tickFormatter={(v) =>
                    v >= 1000000
                      ? `${(v / 1000000).toFixed(1)}M`
                      : v >= 1000
                      ? `${(v / 1000).toFixed(0)}k`
                      : String(v)
                  }
                />
                <Tooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0]?.payload as ChartSeriesPoint;
                    const spread = point.revenue - point.purchases;
                    return (
                      <div className="min-w-[190px] rounded-lg border border-border bg-card p-3 text-xs text-foreground">
                        <div className="mb-2 flex items-center justify-between border-b border-border pb-1.5 font-medium">
                          <span>{label}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {point.orders} SO · {point.purchaseOrders} PO
                          </span>
                        </div>
                        <div className="space-y-1 font-mono tabular-nums">
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 font-sans text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-primary" />
                              Sales
                            </span>
                            <span>{formatCurrency(point.revenue)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 font-sans text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-slate-500" />
                              Purchases
                            </span>
                            <span>{formatCurrency(point.purchases)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 border-t border-border pt-1">
                            <span className="font-sans text-muted-foreground">Spread</span>
                            <span className={spread < 0 ? "text-warning" : "text-foreground"}>
                              {formatCurrency(spread)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Sales revenue"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#salesRevenueFill)"
                  activeDot={{ r: 4, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 1.5 }}
                />
                <Area
                  type="monotone"
                  dataKey="purchases"
                  name="Purchase spend"
                  stroke="#64748b"
                  strokeWidth={1.75}
                  fill="url(#purchaseSpendFill)"
                  activeDot={{ r: 3.5, fill: "#64748b", stroke: "#ffffff", strokeWidth: 1.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartSeries}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                barGap={4}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  dy={6}
                  tick={{
                    fontSize: 11,
                    fill: "var(--muted-foreground)",
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  allowDecimals={false}
                  domain={hasChartActivity ? ["auto", "auto"] : [0, 10]}
                  tick={{
                    fontSize: 11,
                    fill: "var(--muted-foreground)",
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.45 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0]?.payload as ChartSeriesPoint;
                    return (
                      <div className="min-w-[170px] rounded-lg border border-border bg-card p-3 text-xs text-foreground">
                        <div className="mb-2 border-b border-border pb-1.5 font-medium">
                          {label} orders
                        </div>
                        <div className="space-y-1 font-mono tabular-nums">
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 font-sans text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-primary" />
                              Sales orders
                            </span>
                            <span>{point.orders}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 font-sans text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-slate-400" />
                              Purchase orders
                            </span>
                            <span>{point.purchaseOrders}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="orders"
                  name="Sales orders"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="purchaseOrders"
                  name="Purchase orders"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-4 flex flex-col justify-between gap-2 border-t border-border pt-3 text-xs sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span>{MONTH_LABELS[currentMonthIndex]} active</span>
            </span>
            {summaryStats && (
              <>
                <span>·</span>
                <span>Pending POs: {summaryStats.pendingApprovals ?? 0}</span>
                <span>·</span>
                <span>Production units: {summaryStats.productionOutput ?? 0}</span>
                <span>·</span>
                <span>Active staff: {summaryStats.activeEmployees ?? 0}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/finance/ledgers"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
            >
              <span>Partner ledgers</span>
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
            <Link
              href="/finance/ledger"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
            >
              <span>General ledger</span>
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </Card>

      {/* 6. Action Queue */}
      <Card className="gap-0 rounded-xl border border-border bg-card p-5 shadow-none ring-0">
          <Tabs value={activeQueueTab} onValueChange={setActiveQueueTab} className="space-y-4">
            <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
              <div>
                <div className="text-sm font-medium text-foreground">Action queue</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Items requiring inward, receipt, or payment
                </div>
              </div>

              <TabsList className="h-9 border border-border bg-muted p-1">
                <TabsTrigger
                  value="low-stock"
                  className="px-3 py-1 text-xs font-normal tabular-nums data-[state=active]:bg-card data-[state=active]:font-medium data-[state=active]:shadow-none"
                >
                  Low stock ({lowStockItems.length})
                </TabsTrigger>
                <TabsTrigger
                  value="unpaid-invoices"
                  className="px-3 py-1 text-xs font-normal tabular-nums data-[state=active]:bg-card data-[state=active]:font-medium data-[state=active]:shadow-none"
                >
                  Invoices ({unpaidInvoices.length})
                </TabsTrigger>
                <TabsTrigger
                  value="payments-due"
                  className="px-3 py-1 text-xs font-normal tabular-nums data-[state=active]:bg-card data-[state=active]:font-medium data-[state=active]:shadow-none"
                >
                  Payables ({totalPaymentsCount})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab 1: Low Stock */}
            <TabsContent value="low-stock" className="m-0 pt-1 focus-visible:outline-none">
              {lowStockItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-foreground">All items above thresholds</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    No catalog items are at or below safety reorder levels
                  </p>
                  <Link
                    href="/inventory/items"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "mt-4 h-8 text-xs font-normal",
                    })}
                  >
                    View inventory catalog
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-3 pl-1 font-mono font-normal">Code</th>
                        <th className="pb-3 font-normal">Item</th>
                        <th className="pb-3 text-right font-normal">Stock</th>
                        <th className="pb-3 text-right font-normal">Reorder</th>
                        <th className="pb-3 pr-1 text-right font-normal">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lowStockItems.slice(0, 5).map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-muted/40">
                          <td className="py-3 pl-1 font-mono text-foreground">
                            {item.itemCode}
                          </td>
                          <td className="py-3 text-foreground">
                            <div className="max-w-[180px] truncate font-medium">{item.name}</div>
                            {item.category && (
                              <span className="text-xs text-muted-foreground">
                                {item.category.name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right font-mono font-medium tabular-nums text-warning">
                            {item.currentStock ?? 0} {item.unit?.code || ""}
                          </td>
                          <td className="py-3 text-right font-mono tabular-nums text-muted-foreground">
                            {item.reorderLevel ?? item.minStock ?? "—"}
                          </td>
                          <td className="py-3 pr-1 text-right">
                            <Link
                              href="/purchase/goods-receiving"
                              className={buttonVariants({
                                variant: "outline",
                                size: "xs",
                                className: "h-7 px-2.5 text-xs font-normal",
                              })}
                            >
                              Receive
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {lowStockItems.length > 5 && (
                    <div className="mt-3 border-t border-border pt-3 text-center">
                      <Link
                        href="/inventory/items"
                        className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary"
                      >
                        <span>View all {lowStockItems.length} low-stock items</span>
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Tab 2: Unpaid Customer Invoices */}
            <TabsContent value="unpaid-invoices" className="m-0 pt-1 focus-visible:outline-none">
              {unpaidInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-foreground">0 open customer invoices</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    All customer sales invoices have been settled
                  </p>
                  <Link
                    href="/sales/invoices"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "mt-4 h-8 text-xs font-normal",
                    })}
                  >
                    New sales invoice
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-3 pl-1 font-mono font-normal">Invoice</th>
                        <th className="pb-3 font-normal">Customer</th>
                        <th className="pb-3 text-right font-normal">Total</th>
                        <th className="pb-3 text-right font-normal">Balance due</th>
                        <th className="pb-3 pr-1 text-right font-normal">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {unpaidInvoices.slice(0, 5).map((inv) => {
                        const total = Number(inv.totalAmount || 0);
                        const paid = Number(inv.paidAmount || 0);
                        const balance =
                          inv.outstandingAmount != null
                            ? Number(inv.outstandingAmount)
                            : total - paid;
                        return (
                          <tr key={inv.id} className="transition-colors hover:bg-muted/40">
                            <td className="py-3 pl-1 font-mono text-foreground">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-3 text-foreground">
                              <div className="max-w-[180px] truncate font-medium">
                                {inv.customer?.name || "Customer"}
                              </div>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : ""}
                              </span>
                            </td>
                            <td className="py-3 text-right font-mono tabular-nums text-muted-foreground">
                              {formatCurrency(total)}
                            </td>
                            <td className="py-3 text-right font-mono font-medium tabular-nums text-foreground">
                              {formatCurrency(balance)}
                            </td>
                            <td className="py-3 pr-1 text-right">
                              <Link
                                href="/sales/receipts"
                                className={buttonVariants({
                                  variant: "outline",
                                  size: "xs",
                                  className: "h-7 px-2.5 text-xs font-normal",
                                })}
                              >
                                Receipt
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {unpaidInvoices.length > 5 && (
                    <div className="mt-3 border-t border-border pt-3 text-center">
                      <Link
                        href="/sales/invoices"
                        className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary"
                      >
                        <span>View all {unpaidInvoices.length} open invoices</span>
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Tab 3: Payments Due */}
            <TabsContent value="payments-due" className="m-0 pt-1 focus-visible:outline-none">
              {totalPaymentsCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-foreground">0 payments due</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    No supplier bills or statutory obligations awaiting payment
                  </p>
                  <Link
                    href="/finance/payments"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "mt-4 h-8 text-xs font-normal",
                    })}
                  >
                    Outgoing payments
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-3 pl-1 font-mono font-normal">Reference</th>
                        <th className="pb-3 font-normal">Payee</th>
                        <th className="pb-3 font-normal">Type</th>
                        <th className="pb-3 text-right font-normal">Amount due</th>
                        <th className="pb-3 pr-1 text-right font-normal">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {unpaidBills.slice(0, 3).map((bill) => {
                        const due = Number(bill.totalAmount || 0) - Number(bill.paidAmount || 0);
                        return (
                          <tr key={bill.id} className="transition-colors hover:bg-muted/40">
                            <td className="py-3 pl-1 font-mono text-foreground">
                              {bill.billNumber}
                            </td>
                            <td className="max-w-[160px] truncate py-3 text-foreground">
                              {bill.vendor?.name || "Vendor"}
                            </td>
                            <td className="py-3 text-muted-foreground">
                              Vendor bill
                            </td>
                            <td className="py-3 text-right font-mono font-medium tabular-nums text-foreground">
                              {formatCurrency(due)}
                            </td>
                            <td className="py-3 pr-1 text-right">
                              <Link
                                href="/finance/payments"
                                className={buttonVariants({
                                  variant: "outline",
                                  size: "xs",
                                  className: "h-7 px-2.5 text-xs font-normal",
                                })}
                              >
                                Pay
                              </Link>
                            </td>
                          </tr>
                        );
                      })}

                      {unpaidStatutory.slice(0, 3).map((stat) => {
                        const due =
                          stat.outstandingAmount != null
                            ? Number(stat.outstandingAmount)
                            : Number(stat.dueAmount || 0) - Number(stat.paidAmount || 0);
                        return (
                          <tr key={stat.id} className="transition-colors hover:bg-muted/40">
                            <td className="py-3 pl-1 font-mono text-foreground">
                              {stat.obligationNumber}
                            </td>
                            <td className="max-w-[160px] truncate py-3 text-foreground">
                              {stat.head} ({stat.authority})
                            </td>
                            <td className="py-3 text-muted-foreground">
                              Statutory
                            </td>
                            <td className="py-3 text-right font-mono font-medium tabular-nums text-foreground">
                              {formatCurrency(due)}
                            </td>
                            <td className="py-3 pr-1 text-right">
                              <Link
                                href="/finance/payments"
                                className={buttonVariants({
                                  variant: "outline",
                                  size: "xs",
                                  className: "h-7 px-2.5 text-xs font-normal",
                                })}
                              >
                                Disburse
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {totalPaymentsCount > 6 && (
                    <div className="mt-3 border-t border-border pt-3 text-center">
                      <Link
                        href="/finance/payments"
                        className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary"
                      >
                        <span>View all {totalPaymentsCount} due payables</span>
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
    </div>
  );
}
