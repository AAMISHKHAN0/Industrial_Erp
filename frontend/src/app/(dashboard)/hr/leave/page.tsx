"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, Check, X } from "lucide-react";
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
import { createCrudService, type QueryParams } from "@/lib/api/crud";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { createdByColumn } from "@/components/shared/columns";
import { AppShell } from "@/components/layouts/app-shell";

interface LeaveRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  remarks: string;
}

const LEAVE_TYPES = ["CASUAL", "SICK", "ANNUAL", "MATERNITY", "PATERNITY", "UNPAID", "OTHER"] as const;

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function LeaveManagementPage() {
  const service = createCrudService<LeaveRecord>("/hr/leaves");
  const empService = createCrudService<any>("/master-data/employee");

  const [data, setData] = useState<LeaveRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRecord | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<LeaveRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const todayStr = () => new Date().toISOString().split("T")[0];
  const emptyForm = { employeeId: "", leaveType: "CASUAL", startDate: todayStr(), endDate: todayStr(), reason: "", status: "PENDING", remarks: "" };
  const [form, setForm] = useState<Record<string, string>>(emptyForm);

  useEffect(() => {
    empService.findAll({ limit: 500 }).then((res) => {
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

  const handleStatusChange = async (record: LeaveRecord, newStatus: "APPROVED" | "REJECTED") => {
    try {
      await service.update(record.id, {
        status: newStatus,
        ...(record.remarks ? { remarks: record.remarks } : {}),
      });
      toast.success(`Leave ${newStatus.toLowerCase()}`);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const columns: ColumnDef<LeaveRecord>[] = [
    {
      header: "Employee",
      cell: ({ row }) => getEmployeeName(row.original.employeeId),
    },
    { accessorKey: "leaveType", header: "Type" },
    {
      accessorKey: "startDate",
      header: "Start Date",
      cell: ({ row }) => <span>{row.original.startDate ? String(row.original.startDate).split("T")[0] : "-"}</span>,
    },
    {
      accessorKey: "endDate",
      header: "End Date",
      cell: ({ row }) => <span>{row.original.endDate ? String(row.original.endDate).split("T")[0] : "-"}</span>,
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
    { accessorKey: "reason", header: "Reason" },
    createdByColumn,
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex items-center gap-1">
            {record.status === "PENDING" && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleStatusChange(record, "APPROVED")}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleStatusChange(record, "REJECTED")}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => {
                  setEditing(record);
                  setForm({
                    employeeId: record.employeeId,
                    leaveType: record.leaveType,
                    startDate: record.startDate ? String(record.startDate).split("T")[0] : todayStr(),
                    endDate: record.endDate ? String(record.endDate).split("T")[0] : todayStr(),
                    reason: record.reason || "",
                    status: record.status,
                    remarks: record.remarks || "",
                  });
                  setDialogOpen(true);
                }}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(record)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const handleSave = async () => {
    if (!form.employeeId || !form.startDate || !form.endDate) {
      toast.error("Employee, Start Date, and End Date are required");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("End Date cannot be earlier than Start Date");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<LeaveRecord> = {
        employeeId: form.employeeId,
        leaveType: form.leaveType || "CASUAL",
        startDate: form.startDate,
        endDate: form.endDate,
        status: (form.status || "PENDING") as LeaveRecord["status"],
        ...(editing
          ? {
              reason: form.reason?.trim() ?? "",
              remarks: form.remarks?.trim() ?? "",
            }
          : {
              ...(form.reason?.trim() ? { reason: form.reason.trim() } : {}),
              ...(form.remarks?.trim() ? { remarks: form.remarks.trim() } : {}),
            }),
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Leave updated");
      } else {
        await service.create(payload);
        toast.success("Leave created");
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
      toast.success("Leave deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell title="Leave Management">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage employee leave requests</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) { setEditing(null); setForm(emptyForm); }
            }}>
              <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
                <Plus className="h-4 w-4 mr-2" /> Add Leave
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Leave" : "Add Leave"}</DialogTitle>
                  <DialogDescription>Fill in the leave details below.</DialogDescription>
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
                    <Label>Leave Type</Label>
                    <Select value={form.leaveType} onValueChange={(v: string | null) => setForm({ ...form, leaveType: v || "CASUAL" })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAVE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea value={form.reason} placeholder="Reason for leave" onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v: string | null) => setForm({ ...form, status: v || "PENDING" })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">PENDING</SelectItem>
                        <SelectItem value="APPROVED">APPROVED</SelectItem>
                        <SelectItem value="REJECTED">REJECTED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Input value={form.remarks} placeholder="Any additional remarks" onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
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
          searchPlaceholder="Search leave records..."
        />

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Leave</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this leave record? This action can be undone by restoring from archives.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
