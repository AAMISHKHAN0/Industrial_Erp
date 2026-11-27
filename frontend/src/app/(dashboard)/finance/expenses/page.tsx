"use client";

import { useState, useEffect, useCallback, useId } from "react";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Fuel,
  Car,
  Wrench,
  Coffee,
  Briefcase,
  CheckCircle2,
  FileText,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

export type ExpenseCategory =
  | "CONVEYANCE"
  | "FUEL"
  | "DAILY_MISC"
  | "REPAIRS"
  | "OFFICE_SUPPLIES";

export interface SundryExpense {
  id: string;
  entryNumber: string;
  date: string;
  payee: string;
  category: ExpenseCategory;
  categoryLabel: string;
  amount: number;
  ntn?: string;
  paymentMode: "CASH" | "BANK";
  notes?: string;
  voucherNumber: string;
  isPosted: boolean;
  createdAt: string;
}

const CATEGORY_MAP: Record<
  ExpenseCategory,
  { label: string; icon: any; color: string }
> = {
  CONVEYANCE: {
    label: "Conveyance",
    icon: Car,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  FUEL: {
    label: "Fuel",
    icon: Fuel,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  DAILY_MISC: {
    label: "Daily / Miscellaneous",
    icon: Coffee,
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  REPAIRS: {
    label: "Repairs & Maintenance",
    icon: Wrench,
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  OFFICE_SUPPLIES: {
    label: "Office Supplies",
    icon: Briefcase,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

export default function SundryExpensesPage() {
  const [expenses, setExpenses] = useState<SundryExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<SundryExpense | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [postedVoucherBanner, setPostedVoucherBanner] = useState<{
    entryNumber: string;
    amount: number;
    payee: string;
  } | null>(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [payee, setPayee] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("CONVEYANCE");
  const [amount, setAmount] = useState("");
  const [ntn, setNtn] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "BANK">("CASH");
  const [notes, setNotes] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  );

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data?: any[]; meta?: any } | any[]>(
        "/finance/expenses?limit=500"
      );
      const rows: any[] = Array.isArray(res) ? res : (res as any)?.data || [];

      const parsedExpenses: SundryExpense[] = rows.map((e: any) => {
        const rawCat = String(e.category || "DAILY_MISC").toUpperCase();
        const detectedCategory: ExpenseCategory =
          rawCat in CATEGORY_MAP ? (rawCat as ExpenseCategory) : "DAILY_MISC";

        return {
          id: e.id,
          entryNumber: e.entryNumber || e.voucherNumber,
          voucherNumber: e.voucherNumber || e.entryNumber,
          date: e.date ? String(e.date).split("T")[0] : "",
          payee: e.payee || "Unknown Payee",
          category: detectedCategory,
          categoryLabel: CATEGORY_MAP[detectedCategory]?.label || detectedCategory,
          amount: Number(e.amount || 0),
          ntn: e.ntn || "",
          paymentMode: e.paymentMode === "BANK" ? "BANK" : "CASH",
          notes: e.notes || "",
          isPosted: e.isPosted ?? true,
          createdAt: e.createdAt,
        };
      });

      parsedExpenses.sort(
        (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
      );
      setExpenses(parsedExpenses);
    } catch (e: any) {
      toast.error(e.message || "Failed to load sundry expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setPayee("");
    setCategory("CONVEYANCE");
    setAmount("");
    setNtn("");
    setPaymentMode("CASH");
    setNotes("");
    setIdempotencyKey(`EXP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payee.trim()) {
      toast.error("Please enter a payee or recipient name");
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid expense amount greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const postedExpense = await api.post<any>("/finance/expenses", {
        category,
        payee: payee.trim(),
        amount: numAmount,
        paymentMethod: paymentMode,
        expenseDate: new Date(date).toISOString(),
        ntn: ntn.trim() || undefined,
        notes: notes.trim() || undefined,
        requestKey: idempotencyKey,
      });

      const generatedVoucherNumber =
        postedExpense?.voucherNumber || postedExpense?.entryNumber || "";

      setPostedVoucherBanner({
        entryNumber: generatedVoucherNumber,
        amount: numAmount,
        payee: payee.trim(),
      });

      toast.success(
        `Expense posted successfully! Voucher Number: ${generatedVoucherNumber}`
      );
      setDialogOpen(false);
      resetForm();
      await fetchExpenses();
    } catch (error: any) {
      toast.error(error.message || "Failed to post sundry expense");
    } finally {
      setSubmitting(false);
    }
  };

  // Calculations
  const filtered = expenses.filter((item) => {
    const matchesSearch =
      item.payee.toLowerCase().includes(search.toLowerCase()) ||
      item.entryNumber.toLowerCase().includes(search.toLowerCase()) ||
      (item.ntn && item.ntn.toLowerCase().includes(search.toLowerCase())) ||
      (item.notes && item.notes.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      categoryFilter === "ALL" || item.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const fuelAndConveyance = expenses
    .filter((e) => e.category === "FUEL" || e.category === "CONVEYANCE")
    .reduce((sum, e) => sum + e.amount, 0);
  const repairsAmount = expenses
    .filter((e) => e.category === "REPAIRS")
    .reduce((sum, e) => sum + e.amount, 0);
  const officeAndMisc = expenses
    .filter((e) => e.category === "OFFICE_SUPPLIES" || e.category === "DAILY_MISC")
    .reduce((sum, e) => sum + e.amount, 0);

  const exportCSV = () => {
    const headers = [
      "Voucher Number",
      "Date",
      "Payee",
      "Category",
      "Amount (PKR)",
      "NTN",
      "Payment Mode",
      "Status",
      "Notes",
    ];
    const rows = filtered.map((e) => [
      e.voucherNumber,
      e.date,
      `"${e.payee.replace(/"/g, '""')}"`,
      e.categoryLabel,
      e.amount.toFixed(2),
      e.ntn || "",
      e.paymentMode,
      e.isPosted ? "POSTED" : "DRAFT",
      `"${(e.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(",")), "", '"Powered by Digitalerena","https://digitalerena.com"'].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `sundry_expenses_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Sundry expenses exported to CSV");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Sundry Expenses
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Record petty cash and bank expenditures (Conveyance, Fuel, Misc, Repairs, Supplies) with direct General Ledger voucher posting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExpenses}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Record Expense
          </Button>
        </div>
      </div>

      {/* Success Voucher Banner */}
      {postedVoucherBanner && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                Voucher Posted: {postedVoucherBanner.entryNumber}
              </p>
              <p className="text-xs text-emerald-800">
                Payment of PKR {postedVoucherBanner.amount.toLocaleString()} to {postedVoucherBanner.payee} has been posted to the General Ledger.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPostedVoucherBanner(null)}
            className="text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Total Expenses Recorded
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              PKR {totalExpenseAmount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {expenses.length} voucher{expenses.length === 1 ? "" : "s"} posted
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider flex items-center justify-between">
              <span>Fuel & Conveyance</span>
              <Fuel className="h-4 w-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              PKR {fuelAndConveyance.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Fleet, transit, and generator fuel
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider flex items-center justify-between">
              <span>Repairs & Maintenance</span>
              <Wrench className="h-4 w-4 text-orange-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              PKR {repairsAmount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Factory & equipment servicing
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider flex items-center justify-between">
              <span>Office & Miscellaneous</span>
              <Coffee className="h-4 w-4 text-purple-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              PKR {officeAndMisc.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Supplies, tea/hospitality, daily sundries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by payee, voucher #, NTN, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val || "ALL")}>
            <SelectTrigger className="w-[200px] h-9 text-xs">
              <SelectValue placeholder="Filter Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              <SelectItem value="CONVEYANCE">Conveyance</SelectItem>
              <SelectItem value="FUEL">Fuel</SelectItem>
              <SelectItem value="DAILY_MISC">Daily / Miscellaneous</SelectItem>
              <SelectItem value="REPAIRS">Repairs & Maintenance</SelectItem>
              <SelectItem value="OFFICE_SUPPLIES">Office Supplies</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Expenses Table */}
      <Card className="shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[140px] text-xs font-semibold">Voucher #</TableHead>
                <TableHead className="w-[110px] text-xs font-semibold">Date</TableHead>
                <TableHead className="text-xs font-semibold">Payee</TableHead>
                <TableHead className="text-xs font-semibold">Category</TableHead>
                <TableHead className="text-xs font-semibold">NTN</TableHead>
                <TableHead className="text-xs font-semibold">Mode</TableHead>
                <TableHead className="text-right text-xs font-semibold">Amount (PKR)</TableHead>
                <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                <TableHead className="w-[70px] text-center text-xs font-semibold">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Loading sundry expenses...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <FileText className="h-6 w-6 text-muted-foreground/60" />
                      <p className="text-sm font-medium">No sundry expenses found</p>
                      <p className="text-xs text-muted-foreground">
                        Click "Record Expense" to create a new expense voucher.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => {
                  const CatBadge = CATEGORY_MAP[item.category] || CATEGORY_MAP.DAILY_MISC;
                  const Icon = CatBadge.icon;
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs font-medium text-foreground">
                        {item.voucherNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.date}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-foreground">
                          {item.payee}
                        </div>
                        {item.notes && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {item.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1 font-normal text-xs ${CatBadge.color}`}
                        >
                          <Icon className="h-3 w-3" />
                          {item.categoryLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.ntn || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-mono text-[11px] font-normal"
                        >
                          {item.paymentMode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm text-foreground">
                        {item.amount.toLocaleString("en-PK", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px]">
                          POSTED
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setSelectedExpense(item)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Record Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <form onSubmit={handleCreateExpense}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Record Sundry Expense
              </DialogTitle>
              <DialogDescription>
                Create and post a petty or miscellaneous expense voucher directly to the General Ledger.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="expense-date" className="text-xs">
                    Date *
                  </Label>
                  <Input
                    id="expense-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expense-category" className="text-xs">
                    Expense Category *
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(val) => {
                      if (val) setCategory(val as ExpenseCategory);
                    }}
                  >
                    <SelectTrigger id="expense-category" className="h-9 text-xs">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONVEYANCE">Conveyance (Taxi/Rickshaw)</SelectItem>
                      <SelectItem value="FUEL">Fuel (Petrol/Diesel)</SelectItem>
                      <SelectItem value="DAILY_MISC">Daily / Miscellaneous</SelectItem>
                      <SelectItem value="REPAIRS">Repairs & Maintenance</SelectItem>
                      <SelectItem value="OFFICE_SUPPLIES">Office Supplies</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="payee" className="text-xs">
                    Payee / Recipient *
                  </Label>
                  <Input
                    id="payee"
                    placeholder="e.g. Shell Petrol Pump, Electrician"
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="text-xs">
                    Amount (PKR) *
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ntn" className="text-xs">
                    NTN (Optional)
                  </Label>
                  <Input
                    id="ntn"
                    placeholder="e.g. 1234567-8"
                    value={ntn}
                    onChange={(e) => setNtn(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Required for tax deductible vendors
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payment-mode" className="text-xs">
                    Disbursement Mode *
                  </Label>
                  <Select
                    value={paymentMode}
                    onValueChange={(val) => {
                      if (val) setPaymentMode(val as "CASH" | "BANK");
                    }}
                  >
                    <SelectTrigger id="payment-mode" className="h-9 text-xs">
                      <SelectValue placeholder="Payment Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash in Hand (Petty Cash)</SelectItem>
                      <SelectItem value="BANK">Bank Account / Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs">
                  Notes & Details
                </Label>
                <Textarea
                  id="notes"
                  placeholder="e.g., 50 liters generator diesel for weaving unit A"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-xs resize-none"
                />
              </div>

              <div className="rounded-md border bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Unique Request Key:</span>
                <span className="font-mono text-[10px]">{idempotencyKey}</span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Posting Voucher...
                  </>
                ) : (
                  "Post Expense Voucher"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Expense Detail View Dialog */}
      <Dialog
        open={Boolean(selectedExpense)}
        onOpenChange={(open) => !open && setSelectedExpense(null)}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Sundry Expense Voucher Details
            </DialogTitle>
            <DialogDescription>
              Voucher #{selectedExpense?.voucherNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedExpense && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3 border rounded-lg p-3 bg-muted/20">
                <div>
                  <div className="text-xs text-muted-foreground">Payee</div>
                  <div className="font-semibold text-foreground">{selectedExpense.payee}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Date</div>
                  <div className="font-mono text-foreground">{selectedExpense.date}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Category</div>
                  <Badge variant="outline" className="mt-0.5">
                    {selectedExpense.categoryLabel}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Amount</div>
                  <div className="font-mono font-bold text-foreground">
                    PKR {selectedExpense.amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Payment Mode</div>
                  <div className="font-mono text-foreground">{selectedExpense.paymentMode}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">NTN</div>
                  <div className="font-mono text-foreground">{selectedExpense.ntn || "N/A"}</div>
                </div>
              </div>

              {selectedExpense.notes && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Notes / Purpose</div>
                  <div className="p-2.5 rounded-md border bg-card text-xs">
                    {selectedExpense.notes}
                  </div>
                </div>
              )}

              <div className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-1 font-mono">
                <div className="text-muted-foreground font-sans text-[11px] font-medium">
                  General Ledger Entry:
                </div>
                <div className="flex justify-between text-xs">
                  <span>Dr. {selectedExpense.categoryLabel} Expense</span>
                  <span>PKR {selectedExpense.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cr. {selectedExpense.paymentMode} Account</span>
                  <span>PKR {selectedExpense.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedExpense(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
