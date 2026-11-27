"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, DollarSign, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table/data-table";
import { EntitySelect } from "@/components/shared/entity-select";
import { generateNextCodeFromRows } from "@/lib/code-generator";
import { createCrudService, type QueryParams } from "@/lib/api/crud";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { createdByColumn } from "@/components/shared/columns";
import { AppShell } from "@/components/layouts/app-shell";
import { cn } from "@/lib/utils";

type TabKey = "payheads" | "periods" | "payslips";

const TABS: { key: TabKey; label: string }[] = [
  { key: "payheads", label: "Payheads" },
  { key: "periods", label: "Payroll Periods" },
  { key: "payslips", label: "Pay Slips" },
];

// --- Payhead ---
interface Payhead {
  id: string;
  name: string;
  code: string;
  type: "EARNING" | "DEDUCTION" | "STATUTORY";
  description: string;
  amount: number;
  percentage: number;
}

const PAYHEAD_TYPES = ["EARNING", "DEDUCTION", "STATUTORY"] as const;

function PayheadsSection() {
  const service = createCrudService<Payhead>("/hr/payroll/payhead");
  const [data, setData] = useState<Payhead[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payhead | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Payhead | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { name: "", code: "", type: "EARNING", description: "", amount: "0", percentage: "0" };
  const [form, setForm] = useState<Record<string, string>>(emptyForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.findAll(query);
      setData(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchData(); }, [query]);

  const columns: ColumnDef<Payhead>[] = [
    { accessorKey: "code", header: "Code" },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className={
          row.original.type === "EARNING" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
          row.original.type === "DEDUCTION" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        }>
          {row.original.type}
        </Badge>
      ),
    },
    { accessorKey: "amount", header: "Amount" },
    { accessorKey: "percentage", header: "Percentage" },
    createdByColumn,
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => {
              setEditing(row.original);
              setForm({
                name: row.original.name,
                code: row.original.code,
                type: row.original.type,
                description: row.original.description || "",
                amount: String(row.original.amount || 0),
                percentage: String(row.original.percentage || 0),
              });
              setDialogOpen(true);
            }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(row.original)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        percentage: parseFloat(form.percentage) || 0,
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Payhead updated");
      } else {
        await service.create(payload);
        toast.success("Payhead created");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await service.remove(deleteDialog.id);
      toast.success("Payhead deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage pay components</p>
        <Button size="sm" onClick={() => {
          setEditing(null);
          const nextCode = generateNextCodeFromRows("PH", data, (r) => r.code);
          setForm({ ...emptyForm, code: nextCode });
          setDialogOpen(true);
          service.findAll({ limit: 500 }).then((res) => {
            const freshCode = generateNextCodeFromRows("PH", res.data || [], (r) => r.code);
            setForm((prev) => (prev.code === nextCode ? { ...prev, code: freshCode } : prev));
          }).catch(() => {});
        }}>
          <Plus className="h-4 w-4 mr-2" /> Add Payhead
        </Button>
      </div>
      <DataTable columns={columns} data={data} loading={loading} meta={meta} onPageChange={(page) => setQuery({ ...query, page })} searchPlaceholder="Search payheads..." />

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Payhead" : "Add Payhead"}</DialogTitle>
            <DialogDescription>Fill in the payhead details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} placeholder="e.g. Basic Salary" onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code} placeholder="e.g. BASIC" onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v: string | null) => setForm({ ...form, type: v || "EARNING" })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYHEAD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} placeholder="Optional description" onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" placeholder="e.g. 50000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Percentage (%)</Label>
                <Input type="number" placeholder="e.g. 10" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Payhead</DialogTitle><DialogDescription>Are you sure?</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Payroll Period ---
interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isProcessed?: boolean;
  processedAt?: string | null;
}

function PeriodsSection() {
  const service = createCrudService<Period>("/hr/payroll/period");
  const [data, setData] = useState<Period[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Period | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Period | null>(null);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const buildDefaultPeriodForm = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return {
      name: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      startDate: new Date(y, m, 1).toISOString().split("T")[0],
      endDate: new Date(y, m + 1, 0).toISOString().split("T")[0],
    };
  };
  const emptyForm = buildDefaultPeriodForm();
  const [form, setForm] = useState<Record<string, string>>(emptyForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.findAll(query);
      setData(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchData(); }, [query]);

  const handleProcessPeriod = async (period: Period) => {
    setProcessingId(period.id);
    try {
      await api.post(`/hr/payroll/period/${period.id}/process`, {});
      toast.success(`Payroll processed for ${period.name}`);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Failed to process payroll period");
    } finally {
      setProcessingId(null);
    }
  };

  const columns: ColumnDef<Period>[] = [
    { accessorKey: "name", header: "Name" },
    {
      header: "Start Date",
      cell: ({ row }) => <span>{row.original.startDate ? String(row.original.startDate).split("T")[0] : "-"}</span>,
    },
    {
      header: "End Date",
      cell: ({ row }) => <span>{row.original.endDate ? String(row.original.endDate).split("T")[0] : "-"}</span>,
    },
    {
      id: "isProcessed",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isProcessed ? "secondary" : "outline"}>
          {row.original.isProcessed ? "Processed" : "Open"}
        </Badge>
      ),
    },
    createdByColumn,
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer" disabled={processingId === row.original.id}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {!row.original.isProcessed && (
              <DropdownMenuItem onClick={() => handleProcessPeriod(row.original)}>
                <Play className="h-4 w-4 mr-2 text-emerald-600" /> Process Payroll
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => {
              setEditing(row.original);
              setForm({
                name: row.original.name,
                startDate: row.original.startDate ? String(row.original.startDate).split("T")[0] : "",
                endDate: row.original.endDate ? String(row.original.endDate).split("T")[0] : "",
              });
              setDialogOpen(true);
            }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(row.original)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleSave = async () => {
    if (!form.name?.trim() || !form.startDate || !form.endDate) {
      toast.error("Period name, start date, and end date are required");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("End date cannot be earlier than start date");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Period updated");
      } else {
        await service.create(payload);
        toast.success("Period created");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(buildDefaultPeriodForm());
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await service.remove(deleteDialog.id);
      toast.success("Period deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage payroll periods</p>
        <Button size="sm" onClick={() => { setEditing(null); setForm(buildDefaultPeriodForm()); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Period
        </Button>
      </div>
      <DataTable columns={columns} data={data} loading={loading} meta={meta} onPageChange={(page) => setQuery({ ...query, page })} searchPlaceholder="Search periods..." />

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Period" : "Add Period"}</DialogTitle>
            <DialogDescription>Fill in the period details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. January 2025" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Period</DialogTitle><DialogDescription>Are you sure?</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Pay Slip ---
interface PaySlip {
  id: string;
  employeeId: string;
  employeeName?: string;
  periodId: string;
  periodName?: string;
  basicPay: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  grossPay: number;
  status: string;
}

function PaySlipsSection() {
  const service = createCrudService<PaySlip>("/hr/payroll/slip");
  const empService = createCrudService<any>("/master-data/employee");
  const periodService = createCrudService<any>("/hr/payroll/period");

  const [data, setData] = useState<PaySlip[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaySlip | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<PaySlip | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { employeeId: "", periodId: "", basicPay: "0", totalEarnings: "0", totalDeductions: "0", netPay: "0", grossPay: "0", status: "DRAFT" };
  const [form, setForm] = useState<Record<string, string>>(emptyForm);

  useEffect(() => {
    empService.findAll({ limit: 500, status: "ACTIVE" }).then((r) => setEmployees(r.data || [])).catch(() => {});
    periodService.findAll({ limit: 500 }).then((r) => setPeriods(r.data || [])).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.findAll(query);
      setData(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchData(); }, [query]);

  const getEmployeeName = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    return emp ? `${emp.firstName} ${emp.lastName || ""}`.trim() || emp.employeeCode || id : id;
  };

  const getPeriodName = (id: string) => {
    const p = periods.find((pr) => pr.id === id);
    return p?.name || id;
  };

  const columns: ColumnDef<PaySlip>[] = [
    { header: "Employee", cell: ({ row }) => getEmployeeName(row.original.employeeId) },
    { header: "Period", cell: ({ row }) => getPeriodName(row.original.periodId) },
    { accessorKey: "basicPay", header: "Basic Pay" },
    { accessorKey: "grossPay", header: "Gross" },
    { accessorKey: "totalDeductions", header: "Deductions" },
    { accessorKey: "netPay", header: "Net Pay" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "PAID" ? "secondary" : "outline"}>{row.original.status}</Badge>
      ),
    },
    createdByColumn,
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => {
              setEditing(row.original);
              setForm({
                employeeId: row.original.employeeId,
                periodId: row.original.periodId,
                basicPay: String(row.original.basicPay || 0),
                totalEarnings: String(row.original.totalEarnings || 0),
                totalDeductions: String(row.original.totalDeductions || 0),
                netPay: String(row.original.netPay || 0),
                grossPay: String(row.original.grossPay || 0),
                status: row.original.status || "DRAFT",
              });
              setDialogOpen(true);
            }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(row.original)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleSave = async () => {
    if (!form.employeeId || !form.periodId) {
      toast.error("Employee and Pay Period are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        basicPay: parseFloat(form.basicPay) || 0,
        totalEarnings: parseFloat(form.totalEarnings) || 0,
        totalDeductions: parseFloat(form.totalDeductions) || 0,
        netPay: parseFloat(form.netPay) || 0,
        grossPay: parseFloat(form.grossPay) || 0,
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Pay slip updated");
      } else {
        await service.create(payload);
        toast.success("Pay slip created");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await service.remove(deleteDialog.id);
      toast.success("Pay slip deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage employee pay slips</p>
        <Button size="sm" onClick={() => { setEditing(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Pay Slip
        </Button>
      </div>
      <DataTable columns={columns} data={data} loading={loading} meta={meta} onPageChange={(page) => setQuery({ ...query, page })} searchPlaceholder="Search pay slips..." />

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Pay Slip" : "Add Pay Slip"}</DialogTitle>
            <DialogDescription>Fill in the pay slip details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <EntitySelect
                value={form.employeeId}
                onValueChange={(v) => setForm({ ...form, employeeId: v })}
                entityLabel="Employee"
                pluralLabel="employees"
                quickAddType="employee"
                placeholder="Select employee..."
                options={employees.map((emp) => ({
                  value: emp.id,
                  label: `${emp.firstName} ${emp.lastName || ""}`.trim(),
                  subLabel: emp.employeeCode || undefined,
                }))}
                onQuickCreated={(created) => {
                  setEmployees((prev) => [created, ...prev]);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Payroll Period</Label>
              <EntitySelect
                value={form.periodId}
                onValueChange={(v) => setForm({ ...form, periodId: v })}
                entityLabel="Payroll Period"
                pluralLabel="payroll periods"
                quickAddType="payrollPeriod"
                placeholder="Select period..."
                options={periods.map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
                onQuickCreated={(created) => {
                  setPeriods((prev) => [created, ...prev]);
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Basic Pay</Label>
                <Input type="number" placeholder="e.g. 50000" value={form.basicPay} onChange={(e) => setForm({ ...form, basicPay: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Gross Pay</Label>
                <Input type="number" placeholder="e.g. 60000" value={form.grossPay} onChange={(e) => setForm({ ...form, grossPay: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Earnings</Label>
                <Input type="number" placeholder="e.g. 55000" value={form.totalEarnings} onChange={(e) => setForm({ ...form, totalEarnings: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Total Deductions</Label>
                <Input type="number" placeholder="e.g. 5000" value={form.totalDeductions} onChange={(e) => setForm({ ...form, totalDeductions: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Net Pay</Label>
                <Input type="number" placeholder="e.g. 50000" value={form.netPay} onChange={(e) => setForm({ ...form, netPay: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: string | null) => setForm({ ...form, status: v || "DRAFT" })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">DRAFT</SelectItem>
                    <SelectItem value="COMPUTED">COMPUTED</SelectItem>
                    <SelectItem value="PAID">PAID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Pay Slip</DialogTitle><DialogDescription>Are you sure?</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("payheads");

  return (
    <AppShell title="Payroll">
      <div className="space-y-6">
        <div className="flex items-center gap-1 border-b">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "payheads" && <PayheadsSection />}
        {activeTab === "periods" && <PeriodsSection />}
        {activeTab === "payslips" && <PaySlipsSection />}
      </div>
    </AppShell>
  );
}
