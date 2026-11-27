"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  RefreshCw,
  Search,
  Download,
  Calendar,
  CheckCircle2,
  FileText,
  Trash2,
  Eye,
  CreditCard,
  DollarSign,
  AlertCircle,
  Briefcase,
  Layers,
  Check,
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
import { EntitySelect } from "@/components/shared/entity-select";
import { toast } from "sonner";

export interface WageLineItem {
  id?: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  daysWorked: number;
  dailyRate: number;
  deductions: number;
  grossAmount: number;
  netAmount: number;
}

export interface WageRun {
  id: string;
  runNumber: string;
  periodMonth: number;
  periodYear: number;
  runType: string;
  status: "ACCRUED" | "DISBURSED";
  totalAmount: number;
  voucherId?: string;
  voucherNumber?: string;
  disbursementVoucherId?: string;
  disbursementVoucherNumber?: string;
  disbursedAt?: string;
  notes?: string;
  lines: WageLineItem[];
  createdAt: string;
}

export default function DailyWagesPage() {
  const [wageRuns, setWageRuns] = useState<WageRun[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewRun, setViewRun] = useState<WageRun | null>(null);
  const [disburseRun, setDisburseRun] = useState<WageRun | null>(null);
  const [disburseMethod, setDisburseMethod] = useState<"BANK" | "CASH">("BANK");
  const [disbursing, setDisbursing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  // Recent success notification
  const [successBanner, setSuccessBanner] = useState<{
    runNumber: string;
    voucherNumber?: string;
    totalAmount: number;
    action: "ACCRUED" | "DISBURSED";
  } | null>(null);

  // New Wage Run Form State
  const currentDate = new Date();
  const [periodYear, setPeriodYear] = useState<number>(currentDate.getFullYear());
  const [periodMonth, setPeriodMonth] = useState<number>(currentDate.getMonth() + 1);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<
    Array<{
      employeeId: string;
      daysWorked: string;
      dailyRate: string;
      deductions: string;
    }>
  >([{ employeeId: "", daysWorked: "6", dailyRate: "2000", deductions: "0" }]);

  // Fetch Wage Runs and Employees
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [runsRes, empRes] = await Promise.all([
        api.get<any[]>("/hr/wages"),
        api.get<any>("/master-data/employee?limit=300"),
      ]);

      const runs = Array.isArray(runsRes) ? runsRes : (runsRes as any)?.data || [];
      const emps = Array.isArray(empRes) ? empRes : (empRes as any)?.data || [];

      setEmployees(emps);

      const allRuns = [...runs];
      allRuns.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setWageRuns(allRuns);
    } catch (err: any) {
      toast.error(err.message || "Failed to load daily wage runs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Form row handlers
  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      { employeeId: "", daysWorked: "6", dailyRate: "2000", deductions: "0" },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length === 1) {
      toast.info("At least one employee wage line is required");
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, val: string) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  // Real-time calculations for form
  const computedLines = lines.map((l) => {
    const days = parseFloat(l.daysWorked) || 0;
    const rate = parseFloat(l.dailyRate) || 0;
    const ded = parseFloat(l.deductions) || 0;
    const gross = Math.round(days * rate * 100) / 100;
    const net = Math.max(0, Math.round((gross - ded) * 100) / 100);
    return { gross, net, days, rate, ded };
  });

  const formTotalGross = computedLines.reduce((sum, l) => sum + l.gross, 0);
  const formTotalDeductions = computedLines.reduce((sum, l) => sum + l.ded, 0);
  const formTotalNet = computedLines.reduce((sum, l) => sum + l.net, 0);

  const resetForm = () => {
    setPeriodYear(new Date().getFullYear());
    setPeriodMonth(new Date().getMonth() + 1);
    setNotes("");
    setLines([
      { employeeId: "", daysWorked: "6", dailyRate: "2000", deductions: "0" },
    ]);
  };

  // Submit New Wage Run
  const handleCreateWageRun = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validLines = lines.filter((l) => l.employeeId.trim() !== "");
    if (validLines.length === 0) {
      toast.error("Please select an employee for at least one wage line");
      return;
    }

    setSubmitting(true);
    try {
      const payloadLines = validLines.map((l) => {
        const days = parseFloat(l.daysWorked) || 0;
        const rate = parseFloat(l.dailyRate) || 0;
        const ded = parseFloat(l.deductions) || 0;
        return {
          employeeId: l.employeeId,
          daysWorked: days,
          dailyRate: rate,
          deductions: ded,
        };
      });

      const payload = {
        periodMonth: Number(periodMonth),
        periodYear: Number(periodYear),
        runType: "DAILY_WAGE",
        notes: notes.trim() || `Daily wages for period ${periodYear}-${periodMonth}`,
        lines: payloadLines,
      };

      const createdRun = await api.post<any>("/hr/wages", payload);

      const generatedRunNumber = createdRun?.runNumber || "WRUN";
      const generatedVoucherNumber = createdRun?.voucherNumber || createdRun?.voucherId || "";

      setSuccessBanner({
        runNumber: generatedRunNumber,
        voucherNumber: generatedVoucherNumber,
        totalAmount: createdRun?.totalAmount ?? formTotalNet,
        action: "ACCRUED",
      });

      toast.success(
        `Wage run ${generatedRunNumber} created & accrued!${generatedVoucherNumber ? ` Voucher: ${generatedVoucherNumber}` : ""}`
      );
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create daily wage run");
    } finally {
      setSubmitting(false);
    }
  };

  // Disburse Wage Run
  const handleDisburseWageRun = async () => {
    if (!disburseRun) return;

    setDisbursing(true);
    try {
      const result = await api.post<any>(`/hr/wages/${disburseRun.id}/disburse`, {
        paymentMethod: disburseMethod,
        notes: `Disbursed daily wages via ${disburseMethod}`,
      });

      const disbVoucherNumber =
        result?.disbursementVoucherNumber || result?.disbursementVoucherId || "";

      setSuccessBanner({
        runNumber: disburseRun.runNumber,
        voucherNumber: disbVoucherNumber,
        totalAmount: disburseRun.totalAmount,
        action: "DISBURSED",
      });

      toast.success(
        `Wages disbursed!${disbVoucherNumber ? ` GL Disbursement Voucher: ${disbVoucherNumber}` : ""}`
      );
      setDisburseRun(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to disburse wage run");
    } finally {
      setDisbursing(false);
    }
  };

  // Calculations & Filtering
  const filteredRuns = wageRuns.filter((r) => {
    return (
      r.runNumber.toLowerCase().includes(search.toLowerCase()) ||
      (r.voucherNumber && r.voucherNumber.toLowerCase().includes(search.toLowerCase())) ||
      (r.notes && r.notes.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const totalAccrued = wageRuns.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalDisbursed = wageRuns
    .filter((r) => r.status === "DISBURSED")
    .reduce((sum, r) => sum + r.totalAmount, 0);
  const pendingLiability = totalAccrued - totalDisbursed;

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Daily Wages & Labour Payroll
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Calculate daily wages (days worked × daily rate), post balanced accrual vouchers to General Ledger, and process disbursements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
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
            New Daily Wage Run
          </Button>
        </div>
      </div>

      {/* Success Banner */}
      {successBanner && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                Wage Run {successBanner.runNumber}{" "}
                {successBanner.action === "DISBURSED" ? "Disbursed" : "Accrued"}
              </p>
              <p className="text-xs text-emerald-800">
                Amount of PKR {successBanner.totalAmount.toLocaleString()} posted to GL with Voucher #{" "}
                <span className="font-mono font-bold">
                  {successBanner.voucherNumber}
                </span>
                .
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Total Wages Accrued
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              PKR {totalAccrued.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Total wage expenses recognized in GL
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider flex items-center justify-between">
              <span>Wages Disbursed</span>
              <Check className="h-4 w-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-emerald-600">
              PKR {totalDisbursed.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Disbursed via cash or bank transfers
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider flex items-center justify-between">
              <span>Pending Wage Liability</span>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-amber-600">
              PKR {pendingLiability.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Accrued wages awaiting disbursement
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider flex items-center justify-between">
              <span>Wage Runs</span>
              <Layers className="h-4 w-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {wageRuns.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {wageRuns.filter((r) => r.status === "ACCRUED").length} pending disbursement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search run #, voucher #, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Wage Runs Table */}
      <Card className="shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[150px] text-xs font-semibold">Run Number</TableHead>
                <TableHead className="w-[120px] text-xs font-semibold">Period</TableHead>
                <TableHead className="w-[100px] text-center text-xs font-semibold">Workers</TableHead>
                <TableHead className="text-right text-xs font-semibold">Net Wages (PKR)</TableHead>
                <TableHead className="text-xs font-semibold">Accrual Voucher #</TableHead>
                <TableHead className="text-center text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Disbursement Voucher</TableHead>
                <TableHead className="w-[140px] text-center text-xs font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Loading daily wage runs...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <FileText className="h-6 w-6 text-muted-foreground/60" />
                      <p className="text-sm font-medium">No daily wage runs found</p>
                      <p className="text-xs text-muted-foreground">
                        Click "New Daily Wage Run" to calculate and post worker wages.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRuns.map((run) => (
                  <TableRow key={run.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-bold text-foreground">
                      {run.runNumber}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {MONTH_NAMES[run.periodMonth - 1]} {run.periodYear}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {run.lines?.length || 0}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-foreground">
                      PKR{" "}
                      {Number(run.totalAmount).toLocaleString("en-PK", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {run.voucherNumber || run.voucherId || "Auto-Accrued"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={`text-[10px] ${
                          run.status === "DISBURSED"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-blue-100 text-blue-800 border-blue-300"
                        }`}
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {run.disbursementVoucherNumber || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => setViewRun(run)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Breakdown
                        </Button>
                        {run.status === "ACCRUED" && (
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => setDisburseRun(run)}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Disburse
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Create Daily Wage Run */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="wide">
          <form onSubmit={handleCreateWageRun} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0 bg-background">
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                New Daily Wage Run
              </DialogTitle>
              <DialogDescription>
                Enter days worked and daily rates per employee. Balanced GL accrual voucher (Dr: Wage Expense / Cr: Wage Payable) will be posted automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto min-h-0 flex-1 px-6 py-4 space-y-4">
              {/* Period selection */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/20">
                <div className="space-y-1.5">
                  <Label htmlFor="wage-month" className="text-xs">
                    Period Month *
                  </Label>
                  <Select
                    value={String(periodMonth)}
                    onValueChange={(val) => {
                      if (val) setPeriodMonth(Number(val));
                    }}
                  >
                    <SelectTrigger id="wage-month" className="h-9 text-xs">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((name, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {name} ({i + 1})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="wage-year" className="text-xs">
                    Period Year *
                  </Label>
                  <Input
                    id="wage-year"
                    type="number"
                    value={periodYear}
                    onChange={(e) => setPeriodYear(Number(e.target.value))}
                    required
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Employee Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Employee Wage Calculations
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={handleAddLine}
                  >
                    <Plus className="h-3 w-3" />
                    Add Worker Line
                  </Button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {lines.map((line, idx) => {
                    const days = parseFloat(line.daysWorked) || 0;
                    const rate = parseFloat(line.dailyRate) || 0;
                    const ded = parseFloat(line.deductions) || 0;
                    const gross = days * rate;
                    const net = Math.max(0, gross - ded);

                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center p-2 rounded-md border bg-card text-xs"
                      >
                        <div className="col-span-4">
                          <Label className="text-[10px] text-muted-foreground block mb-0.5">
                            Employee *
                          </Label>
                          <EntitySelect
                            value={line.employeeId}
                            onValueChange={(val) =>
                              handleLineChange(idx, "employeeId", val)
                            }
                            entityLabel="Employee"
                            pluralLabel="employees"
                            quickAddType="employee"
                            placeholder="Select Worker"
                            className="h-8 text-xs"
                            options={employees.map((emp) => ({
                              value: emp.id,
                              label: `${emp.firstName} ${emp.lastName || ""}`.trim(),
                              subLabel: emp.employeeCode || "EMP",
                            }))}
                            onQuickCreated={(created) => {
                              setEmployees((prev) => [created, ...prev]);
                            }}
                          />
                        </div>

                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground block mb-0.5">
                            Days Worked
                          </Label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={line.daysWorked}
                            onChange={(e) =>
                              handleLineChange(idx, "daysWorked", e.target.value)
                            }
                            className="h-8 text-xs font-mono"
                            required
                          />
                        </div>

                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground block mb-0.5">
                            Daily Rate (PKR)
                          </Label>
                          <Input
                            type="number"
                            step="50"
                            min="0"
                            value={line.dailyRate}
                            onChange={(e) =>
                              handleLineChange(idx, "dailyRate", e.target.value)
                            }
                            className="h-8 text-xs font-mono"
                            required
                          />
                        </div>

                        <div className="col-span-2">
                          <Label className="text-[10px] text-muted-foreground block mb-0.5">
                            Deductions (PKR)
                          </Label>
                          <Input
                            type="number"
                            step="10"
                            min="0"
                            value={line.deductions}
                            onChange={(e) =>
                              handleLineChange(idx, "deductions", e.target.value)
                            }
                            className="h-8 text-xs font-mono"
                          />
                        </div>

                        <div className="col-span-2 flex items-center justify-between pt-3">
                          <div className="text-right font-mono font-bold text-xs text-foreground">
                            PKR {net.toLocaleString()}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                            onClick={() => handleRemoveLine(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Summary Footer */}
              <div className="p-3 rounded-lg border bg-muted/40 grid grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Total Workers:</span>
                  <span className="font-bold text-sm">{lines.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Gross Wages:</span>
                  <span className="font-mono font-bold text-sm">
                    PKR {formTotalGross.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Deductions:</span>
                  <span className="font-mono font-bold text-sm text-rose-600">
                    PKR {formTotalDeductions.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Net Payable:</span>
                  <span className="font-mono font-bold text-sm text-emerald-600">
                    PKR {formTotalNet.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wage-notes" className="text-xs">
                  Run Notes / Section Reference
                </Label>
                <Textarea
                  id="wage-notes"
                  placeholder="e.g., Weaving Section A - Weekly Wage Run"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-xs resize-none"
                />
              </div>
            </div>

            <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0 gap-2 sm:gap-0">
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
                    Posting Wage Accrual...
                  </>
                ) : (
                  "Post Daily Wage Accrual"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: View Wage Breakdown */}
      <Dialog
        open={Boolean(viewRun)}
        onOpenChange={(open) => !open && setViewRun(null)}
      >
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Wage Breakdown: {viewRun?.runNumber}
            </DialogTitle>
            <DialogDescription>
              Period: {viewRun ? `${MONTH_NAMES[viewRun.periodMonth - 1]} ${viewRun.periodYear}` : ""} | Status: {viewRun?.status}
            </DialogDescription>
          </DialogHeader>

          {viewRun && (
            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-md border p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs font-semibold">Worker</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Days</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Daily Rate</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Gross</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Deductions</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Net Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(viewRun.lines || []).map((l: any, i: number) => {
                      const empName = l.employee
                        ? `${l.employee.firstName} ${l.employee.lastName}`
                        : l.employeeName || "Worker";

                      return (
                        <TableRow key={l.id || i}>
                          <TableCell className="font-medium text-xs">
                            {empName}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {l.daysWorked}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            PKR {Number(l.dailyRate).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            PKR {Number(l.grossAmount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            PKR {Number(l.deductions || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-emerald-600">
                            PKR {Number(l.netAmount).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 text-xs">
                <div>
                  <span className="text-muted-foreground">Accrual Voucher: </span>
                  <span className="font-mono font-semibold">{viewRun.voucherNumber || viewRun.voucherId || "Auto-Posted"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Disbursement Voucher: </span>
                  <span className="font-mono font-semibold">{viewRun.disbursementVoucherNumber || "Pending"}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewRun(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Disburse Wage Run */}
      <Dialog
        open={Boolean(disburseRun)}
        onOpenChange={(open) => !open && setDisburseRun(null)}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              Disburse Wage Run
            </DialogTitle>
            <DialogDescription>
              Post the GL disbursement voucher (Dr: Wage Payable / Cr: Bank or Cash) for {disburseRun?.runNumber}.
            </DialogDescription>
          </DialogHeader>

          {disburseRun && (
            <div className="space-y-4 py-2 text-sm">
              <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Wage Run:</span>
                  <span className="font-mono font-semibold">{disburseRun.runNumber}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Workers:</span>
                  <span className="font-semibold">{disburseRun.lines?.length || 0} employees</span>
                </div>
                <div className="flex justify-between text-xs border-t pt-1.5">
                  <span className="font-medium text-foreground">Total Disbursable:</span>
                  <span className="font-mono font-bold text-sm text-emerald-600">
                    PKR {Number(disburseRun.totalAmount).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="disb-method" className="text-xs">
                  Disbursement Account *
                </Label>
                <Select
                  value={disburseMethod}
                  onValueChange={(val) => {
                    if (val) setDisburseMethod(val as "BANK" | "CASH");
                  }}
                >
                  <SelectTrigger id="disb-method" className="h-9 text-xs">
                    <SelectValue placeholder="Payment Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK">Bank Account / Transfer (Dr Wage Payable / Cr Bank)</SelectItem>
                    <SelectItem value="CASH">Cash in Hand (Dr Wage Payable / Cr Cash)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisburseRun(null)}
              disabled={disbursing}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDisburseWageRun}
              disabled={disbursing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {disbursing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Posting Disbursement...
                </>
              ) : (
                "Confirm & Post Disbursement"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
