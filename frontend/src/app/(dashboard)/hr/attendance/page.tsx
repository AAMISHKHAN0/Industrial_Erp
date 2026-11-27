"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, Upload } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table/data-table";
import { EntitySelect } from "@/components/shared/entity-select";
import { QuickCreateDialog } from "@/components/shared/quick-create-dialog";
import { createCrudService, type QueryParams } from "@/lib/api/crud";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { createdByColumn } from "@/components/shared/columns";
import { AppShell } from "@/components/layouts/app-shell";

interface Attendance {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  clockIn: string;
  clockOut: string;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LATE" | "HOLIDAY" | "LEAVE";
  remarks: string;
}

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "HALF_DAY", "LATE", "HOLIDAY", "LEAVE"] as const;

const STATUS_STYLES: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ABSENT: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  HALF_DAY: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  LATE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  HOLIDAY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  LEAVE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export default function AttendancePage() {
  const service = createCrudService<Attendance>("/hr/attendance");
  const empService = createCrudService<any>("/master-data/employee");

  const [data, setData] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Attendance | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Attendance | null>(null);
  const [saving, setSaving] = useState(false);

  const todayStr = () => new Date().toISOString().split("T")[0];
  const emptyForm = { employeeId: "", date: todayStr(), clockIn: "", clockOut: "", status: "PRESENT" as string, remarks: "" };
  const [form, setForm] = useState<Record<string, string>>(emptyForm);

  const [bulkDate, setBulkDate] = useState("");
  const [bulkStatus, setBulkStatus] = useState("PRESENT");
  const [bulkEntries, setBulkEntries] = useState<{ employeeId: string; clockIn: string; clockOut: string }[]>([]);
  const [bulkQuickAddOpen, setBulkQuickAddOpen] = useState(false);

  useEffect(() => {
    empService.findAll({ limit: 500, status: "ACTIVE" }).then((res) => {
      setEmployees(res.data || []);
    }).catch(() => {});
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

  const toTimeInput = (val: string | null | undefined): string => {
    if (!val) return "";
    if (/^\d{2}:\d{2}/.test(val)) return val.slice(0, 5);
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const toClockIso = (dateStr: string, timeVal: string | undefined): string | undefined => {
    if (!timeVal || !timeVal.trim()) return undefined;
    const t = timeVal.trim();
    if (t.includes("T")) {
      const d = new Date(t);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    const baseDate = dateStr || todayStr();
    const normalized = /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t;
    const d = new Date(`${baseDate}T${normalized}`);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  };

  const columns: ColumnDef<Attendance>[] = [
    {
      header: "Date",
      cell: ({ row }) => <span>{row.original.date ? String(row.original.date).split("T")[0] : "-"}</span>,
    },
    {
      header: "Employee",
      cell: ({ row }) => getEmployeeName(row.original.employeeId),
    },
    {
      header: "Clock In",
      cell: ({ row }) => <span>{toTimeInput(row.original.clockIn) || "-"}</span>,
    },
    {
      header: "Clock Out",
      cell: ({ row }) => <span>{toTimeInput(row.original.clockOut) || "-"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={STATUS_STYLES[row.original.status] || ""}>
          {row.original.status}
        </Badge>
      ),
    },
    { accessorKey: "remarks", header: "Remarks" },
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
                date: row.original.date ? String(row.original.date).split("T")[0] : todayStr(),
                clockIn: toTimeInput(row.original.clockIn),
                clockOut: toTimeInput(row.original.clockOut),
                status: row.original.status,
                remarks: row.original.remarks || "",
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
    if (!form.employeeId || !form.date) {
      toast.error("Employee and Date are required");
      return;
    }
    setSaving(true);
    try {
      const clockInIso = toClockIso(form.date, form.clockIn);
      const clockOutIso = toClockIso(form.date, form.clockOut);
      const payload: Record<string, any> = {
        employeeId: form.employeeId,
        date: new Date(form.date).toISOString(),
        status: (form.status || "PRESENT") as Attendance["status"],
        ...(editing
          ? {
              clockIn: clockInIso ?? null,
              clockOut: clockOutIso ?? null,
              remarks: form.remarks?.trim() || null,
            }
          : {
              ...(clockInIso ? { clockIn: clockInIso } : {}),
              ...(clockOutIso ? { clockOut: clockOutIso } : {}),
              ...(form.remarks?.trim() ? { remarks: form.remarks.trim() } : {}),
            }),
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Attendance updated");
      } else {
        await service.create(payload);
        toast.success("Attendance created");
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
      toast.success("Attendance deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openBulkDialog = () => {
    setBulkDate(new Date().toISOString().split("T")[0]);
    setBulkStatus("PRESENT");
    setBulkEntries(employees.map((e) => ({ employeeId: e.id, clockIn: "", clockOut: "" })));
    setBulkOpen(true);
  };

  const handleBulkCreate = async () => {
    if (!bulkDate) {
      toast.error("Please select a date");
      return;
    }
    const validEntries = bulkEntries.filter((e) => e.employeeId);
    if (validEntries.length === 0) {
      toast.error("No employees available for bulk attendance");
      return;
    }
    setSaving(true);
    try {
      const payload = validEntries.map((e) => {
          const clockInIso = toClockIso(bulkDate, e.clockIn);
          const clockOutIso = toClockIso(bulkDate, e.clockOut);
          return {
            employeeId: e.employeeId,
            date: new Date(bulkDate).toISOString(),
            ...(clockInIso ? { clockIn: clockInIso } : {}),
            ...(clockOutIso ? { clockOut: clockOutIso } : {}),
            status: bulkStatus as Attendance["status"],
          };
        });
      for (const record of payload) {
        await service.create(record);
      }
      toast.success(`Created ${payload.length} attendance records`);
      setBulkOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateBulkEntry = (index: number, field: string, value: string) => {
    const updated = [...bulkEntries];
    updated[index] = { ...updated[index], [field]: value };
    setBulkEntries(updated);
  };

  return (
    <AppShell title="Attendance">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage employee attendance records</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={openBulkDialog}>
              <Upload className="h-4 w-4 mr-2" /> Bulk Entry
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) { setEditing(null); setForm(emptyForm); }
            }}>
              <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
                <Plus className="h-4 w-4 mr-2" /> Add Attendance
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Attendance" : "Add Attendance"}</DialogTitle>
                  <DialogDescription>Fill in the attendance details below.</DialogDescription>
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
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Clock In</Label>
                      <Input type="time" value={form.clockIn} onChange={(e) => setForm({ ...form, clockIn: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Clock Out</Label>
                      <Input type="time" value={form.clockOut} onChange={(e) => setForm({ ...form, clockOut: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v: string | null) => setForm({ ...form, status: v || "PRESENT" })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Input value={form.remarks} placeholder="Optional remarks" onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : editing ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          meta={meta}
          onPageChange={(page) => setQuery({ ...query, page })}
          searchPlaceholder="Search attendance..."
        />

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Attendance</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this attendance record? This action can be undone by restoring from archives.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bulk Attendance Entry</DialogTitle>
              <DialogDescription>Mark attendance for multiple employees at once.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Default Status</Label>
                  <Select value={bulkStatus} onValueChange={(v: string | null) => v && setBulkStatus(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="border rounded-lg">
                <div className="grid grid-cols-12 gap-2 p-3 bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-5">Employee</div>
                  <div className="col-span-3">Clock In</div>
                  <div className="col-span-3">Clock Out</div>
                </div>
                <div className="divide-y max-h-60 overflow-y-auto">
                  {employees.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-6 px-4 text-center">
                      <p className="text-xs text-muted-foreground">No employees added yet</p>
                      <Button type="button" size="sm" onClick={() => setBulkQuickAddOpen(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add your Employee
                      </Button>
                    </div>
                  ) : (
                    employees.map((emp, idx) => (
                      <div key={emp.id} className="grid grid-cols-12 gap-2 p-2 items-center">
                        <div className="col-span-5 text-sm truncate">
                          {emp.firstName} {emp.lastName || ""}
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="time"
                            size={1}
                            className="h-8 text-xs"
                            value={bulkEntries[idx]?.clockIn || ""}
                            onChange={(e) => updateBulkEntry(idx, "clockIn", e.target.value)}
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="time"
                            size={1}
                            className="h-8 text-xs"
                            value={bulkEntries[idx]?.clockOut || ""}
                            onChange={(e) => updateBulkEntry(idx, "clockOut", e.target.value)}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkCreate} disabled={saving || bulkEntries.filter((e) => e.employeeId).length === 0}>
                {saving ? "Saving..." : `Create ${bulkEntries.filter((e) => e.employeeId).length} Records`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <QuickCreateDialog
          open={bulkQuickAddOpen}
          onOpenChange={setBulkQuickAddOpen}
          entityType="employee"
          onCreated={(created) => {
            setEmployees((prev) => [created, ...prev]);
            setBulkEntries((prev) => [{ employeeId: created.id, clockIn: "", clockOut: "" }, ...prev]);
          }}
        />
      </div>
    </AppShell>
  );
}
