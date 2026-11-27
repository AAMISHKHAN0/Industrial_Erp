"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw } from "lucide-react";
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

interface ProductionOrder {
  id: string;
  productionNumber: string;
}

interface QualityCheck {
  id: string;
  productionOrderId: string;
  checkedBy: string;
  checkDate: string;
  parameter: string;
  specification: string;
  result: string;
  status: string;
  notes: string;
  productionNumber?: string;
}

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  PASS: { variant: "secondary", label: "Pass" },
  FAIL: { variant: "destructive", label: "Fail" },
  REWORK: { variant: "outline", label: "Rework" },
  PENDING: { variant: "default", label: "Pending" },
};

const resultStatuses = ["PASS", "FAIL", "REWORK", "PENDING"];

export default function QualityControlPage() {
  const service = createCrudService<QualityCheck>("/production/quality");
  const poService = createCrudService<ProductionOrder>("/production/orders");

  const [data, setData] = useState<QualityCheck[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QualityCheck | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<QualityCheck | null>(null);
  const [saving, setSaving] = useState(false);

  const [prodOrders, setProdOrders] = useState<ProductionOrder[]>([]);

  const todayStr = () => new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    productionOrderId: "",
    checkedBy: "",
    checkDate: todayStr(),
    parameter: "",
    specification: "",
    result: "",
    status: "PENDING",
    notes: "",
  });

  const initForm = useCallback(() => ({
    productionOrderId: "",
    checkedBy: "",
    checkDate: todayStr(),
    parameter: "",
    specification: "",
    result: "",
    status: "PENDING",
    notes: "",
  }), []);

  const prodOrdersRef = useRef(prodOrders);
  prodOrdersRef.current = prodOrders;

  useEffect(() => {
    poService.findAll({ limit: 200 }).then((res) => { setProdOrders(res.data); }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.findAll(query);
      const enriched = res.data.map((qc: any) => ({
        ...qc,
        productionNumber:
          qc.productionOrder?.productionNumber ||
          prodOrdersRef.current.find((p) => p.id === qc.productionOrderId)?.productionNumber ||
          qc.productionOrderId,
      }));
      setData(enriched);
      setMeta(res.meta);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchData(); }, [query]);

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] || { variant: "outline" as const, label: status };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const columns: ColumnDef<QualityCheck>[] = [
    {
      id: "productionNumber",
      header: "Production Order",
      accessorKey: "productionNumber",
    },
    { accessorKey: "parameter", header: "Parameter" },
    { accessorKey: "specification", header: "Specification" },
    { accessorKey: "result", header: "Result" },
    { accessorKey: "checkedBy", header: "Checked By" },
    {
      header: "Check Date",
      cell: ({ row }) => (
        <span>
          {row.original.checkDate ? String(row.original.checkDate).split("T")[0] : "-"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
              const qc = row.original;
              setEditing(qc);
              setForm({
                productionOrderId: qc.productionOrderId || "",
                checkedBy: qc.checkedBy || "",
                checkDate: qc.checkDate ? String(qc.checkDate).split("T")[0] : todayStr(),
                parameter: qc.parameter || "",
                specification: qc.specification || "",
                result: qc.result || "",
                status: qc.status || "PENDING",
                notes: qc.notes || "",
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
    if (!form.productionOrderId || !form.parameter.trim()) {
      toast.error("Production Order and Parameter are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        productionOrderId: form.productionOrderId,
        parameter: form.parameter.trim(),
        status: form.status || "PENDING",
        checkDate: form.checkDate
          ? new Date(form.checkDate).toISOString()
          : new Date().toISOString(),
        ...(form.checkedBy.trim() ? { checkedBy: form.checkedBy.trim() } : {}),
        ...(form.specification.trim() ? { specification: form.specification.trim() } : {}),
        ...(form.result.trim() ? { result: form.result.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Quality check updated");
      } else {
        await service.create(payload);
        toast.success("Quality check created");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(initForm());
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
      toast.success("Quality check deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell title="Quality Control">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Track quality checks for production orders</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) { setEditing(null); setForm(initForm()); }
            }}>
              <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
                <Plus className="h-4 w-4 mr-2" /> Add Check
              </DialogTrigger>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Quality Check" : "Add Quality Check"}</DialogTitle>
                  <DialogDescription>Record quality inspection results.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Production Order</Label>
                      <EntitySelect
                        value={form.productionOrderId}
                        onValueChange={(val) => setForm({ ...form, productionOrderId: val })}
                        entityLabel="Production Order"
                        quickAddType="productionOrder"
                        placeholder="Select order..."
                        options={prodOrders.map((po) => ({ value: po.id, label: po.productionNumber }))}
                        onQuickCreated={(created) => {
                          setProdOrders((prev) => [created, ...prev]);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Checked By</Label>
                      <Input value={form.checkedBy} placeholder="e.g. Inspector name" onChange={(e) => setForm({ ...form, checkedBy: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Check Date</Label>
                      <Input type="date" value={form.checkDate} onChange={(e) => setForm({ ...form, checkDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(val: string | null) => val && setForm({ ...form, status: val })}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {resultStatuses.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Parameter</Label>
                      <Input value={form.parameter} placeholder="e.g. Tensile Strength" onChange={(e) => setForm({ ...form, parameter: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Specification</Label>
                      <Input value={form.specification} placeholder="e.g. ISO 13934-1" onChange={(e) => setForm({ ...form, specification: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Result</Label>
                    <Input value={form.result} placeholder="e.g. Pass / Fail / Value" onChange={(e) => setForm({ ...form, result: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} placeholder="Optional notes" onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
          searchPlaceholder="Search quality checks..."
        />

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Quality Check</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this record? This action can be undone by restoring from archives.
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
