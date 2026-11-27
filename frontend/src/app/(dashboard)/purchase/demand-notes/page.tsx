"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, Send,
  CheckCircle2, XCircle, Ban, Printer, Package, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table/data-table";
import { EntitySelect } from "@/components/shared/entity-select";
import { generateNextCodeFromRows } from "@/lib/code-generator";
import { createCrudService, type QueryParams } from "@/lib/api/crud";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { CreatedByCell } from "@/components/shared/created-by-cell";
import { AppShell } from "@/components/layouts/app-shell";
import { generateDemandNoteSlip } from "@/lib/reports/stores-reports";

interface DemandNote {
  id: string;
  demandNumber: string;
  departmentId: string;
  requestedBy: string;
  costCenter?: string | null;
  priority: string;
  requiredDate: string;
  remarks: string;
  status: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  department?: { id: string; name: string };
  items?: DemandNoteItem[];
}

interface DemandNoteItem {
  id?: string;
  itemId: string;
  quantity: number;
  issuedQty?: number;
  unit?: string;
  remarks?: string;
  item?: { id: string; itemCode: string; name: string; unit?: { code: string; name: string } };
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface InventoryItem {
  id: string;
  itemCode: string;
  name: string;
  unit?: { code: string; name: string };
}

const defaultForm: Record<string, string> = {
  demandNumber: "",
  departmentId: "",
  requestedBy: "",
  costCenter: "",
  priority: "MEDIUM",
  requiredDate: "",
  remarks: "",
};

const priorityOptions = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function toDateValue(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try { return new Date(dateStr).toISOString().split("T")[0]; } catch { return ""; }
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "destructive",
};

export default function DemandNotesPage() {
  const service = createCrudService<DemandNote>("/purchase/demand-notes");
  const departmentService = createCrudService<Department>("/master-data/department");
  const itemService = createCrudService<InventoryItem>("/inventory/items");

  const [data, setData] = useState<DemandNote[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DemandNote | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DemandNote | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [lineItems, setLineItems] = useState<DemandNoteItem[]>([]);
  const [newItemId, setNewItemId] = useState("");

  const fetchRefs = useCallback(async () => {
    try {
      const [dRes, iRes] = await Promise.all([
        departmentService.findAll({ limit: 999 }),
        itemService.findAll({ limit: 9999 }),
      ]);
      setDepartments(dRes.data);
      setInventoryItems(iRes.data);
    } catch { /* non-critical */ }
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
  useEffect(() => { fetchRefs(); }, []);

  const openCreate = () => {
    setEditing(null);
    const nextCode = generateNextCodeFromRows("DEM", data, (r) => r.demandNumber);
    setForm({
      ...defaultForm,
      demandNumber: nextCode,
      requiredDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    });
    setLineItems([]);
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const fullCode = generateNextCodeFromRows("DEM", full.data || [], (r) => r.demandNumber);
      setForm((prev) => ({
        ...prev,
        demandNumber: prev.demandNumber === nextCode ? fullCode : prev.demandNumber,
      }));
    }).catch(() => {});
  };

  const openEdit = (item: DemandNote) => {
    setEditing(item);
    setForm({
      demandNumber: item.demandNumber || "",
      departmentId: item.departmentId || "",
      requestedBy: item.requestedBy || "",
      costCenter: item.costCenter || "",
      priority: item.priority || "MEDIUM",
      requiredDate: toDateValue(item.requiredDate),
      remarks: item.remarks || "",
    });
    const items: DemandNoteItem[] = (item.items || []).map((i) => ({
      id: i.id,
      itemId: i.itemId,
      quantity: i.quantity,
      issuedQty: i.issuedQty || 0,
      unit: i.unit || i.item?.unit?.code || "Unit",
      remarks: i.remarks || "",
      item: i.item,
    }));
    setLineItems(items);
    setDialogOpen(true);
  };

  const addLineItem = () => {
    const inv = inventoryItems.find((i) => i.id === newItemId);
    if (!inv) return;
    setLineItems((prev) => [
      ...prev,
      {
        itemId: inv.id,
        quantity: 1,
        issuedQty: 0,
        unit: inv.unit?.code || "Unit",
        remarks: "",
        item: inv,
      },
    ]);
    setNewItemId("");
  };

  const updateLineItem = (index: number, field: keyof DemandNoteItem, value: any) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePrint = (item: DemandNote) => {
    try {
      generateDemandNoteSlip(item);
      toast.success(`Requisition slip generated for ${item.demandNumber}`);
    } catch (err: any) {
      toast.error(`Print error: ${err.message}`);
    }
  };

  const handleAction = async (id: string, action: "submit" | "approve" | "reject") => {
    try {
      await api.post(`/purchase/demand-notes/${id}/${action}`, {});
      toast.success(`Demand note ${action}ed successfully`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const columns: ColumnDef<DemandNote>[] = [
    {
      accessorKey: "demandNumber",
      header: "Demand #",
      cell: ({ row }) => (
        <span className="font-semibold text-primary">{row.original.demandNumber}</span>
      ),
    },
    {
      header: "Department",
      cell: ({ row }) => <span>{row.original.department?.name || row.original.departmentId || "-"}</span>,
    },
    { accessorKey: "requestedBy", header: "Requested By" },
    {
      header: "Cost Center",
      cell: ({ row }) => <span>{row.original.costCenter || "-"}</span>,
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => {
        const p = row.original.priority;
        const color = p === "URGENT" ? "text-destructive font-bold" : p === "HIGH" ? "text-amber-600 font-semibold" : "";
        return <span className={color}>{p}</span>;
      },
    },
    {
      header: "Items",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          {row.original.items?.length || 0} items
        </Badge>
      ),
    },
    {
      header: "Required Date",
      cell: ({ row }) => <span>{formatDate(row.original.requiredDate)}</span>,
    },
    {
      header: "Created By",
      cell: ({ row }) => <CreatedByCell creator={(row.original as any).createdByUser} />,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.status] || "outline"}>{row.original.status}</Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handlePrint(row.original)}>
              <Printer className="h-4 w-4 mr-2" /> Print Requisition Slip
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.original.status === "DRAFT" && (
              <DropdownMenuItem onClick={() => handleAction(row.original.id, "submit")}>
                <Send className="h-4 w-4 mr-2" /> Submit for Approval
              </DropdownMenuItem>
            )}
            {(row.original.status === "SUBMITTED" || row.original.status === "PENDING") && (
              <>
                <DropdownMenuItem onClick={() => handleAction(row.original.id, "approve")}>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> Approve Requisition
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction(row.original.id, "reject")}>
                  <XCircle className="h-4 w-4 mr-2 text-destructive" /> Reject Requisition
                </DropdownMenuItem>
              </>
            )}
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
    if (!form.demandNumber || !form.departmentId) {
      toast.error("Demand Number and Department are required");
      return;
    }
    if (lineItems.length === 0) {
      toast.error("At least one item is required on requisition");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        demandNumber: form.demandNumber,
        departmentId: form.departmentId,
        requestedBy: form.requestedBy || undefined,
        costCenter: form.costCenter || undefined,
        priority: form.priority,
        requiredDate: form.requiredDate ? new Date(form.requiredDate).toISOString() : new Date().toISOString(),
        remarks: form.remarks || undefined,
        items: lineItems.map((i) => ({
          itemId: i.itemId,
          quantity: Number(i.quantity) || 1,
          unit: i.unit || "Unit",
          remarks: i.remarks || undefined,
        })),
      };

      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Demand note updated");
      } else {
        await service.create(payload);
        toast.success("Demand note created in Draft status");
      }
      setDialogOpen(false);
      setEditing(null);
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
      toast.success("Demand note deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell title="Material Demands">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Material Demands & Requisitions</h2>
            <p className="text-sm text-muted-foreground">
              Departmental stock requests with approval controls and multi-line item specification
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Create Demand Note
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          meta={meta}
          onPageChange={(page) => setQuery({ ...query, page })}
          searchPlaceholder="Search Demand #, department, requester..."
        />

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
          <DialogContent size="wide">
            <DialogHeader className="px-6 pt-5 pb-2 border-b">
              <DialogTitle className="text-lg">
                {editing ? `Edit Demand Note: ${form.demandNumber}` : "New Material Demand Note"}
              </DialogTitle>
              <DialogDescription>
                Specify department, required dates, and line items needed from stores.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-6 py-4 overflow-y-auto min-h-0">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Demand # *</Label>
                  <Input
                    value={form.demandNumber}
                    onChange={(e) => setForm({ ...form, demandNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Department *</Label>
                  <EntitySelect
                    value={form.departmentId}
                    onValueChange={(v) => setForm({ ...form, departmentId: v })}
                    entityLabel="Department"
                    quickAddType="department"
                    placeholder="Select department..."
                    options={departments.map((d) => ({
                      value: d.id,
                      label: d.code ? `${d.code} — ${d.name}` : d.name,
                    }))}
                    onQuickCreated={(created) => {
                      setDepartments((prev) => [created, ...prev]);
                      fetchRefs();
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cost Center</Label>
                  <Input
                    value={form.costCenter}
                    placeholder="CC-WEAVING-01"
                    onChange={(e) => setForm({ ...form, costCenter: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Requested By</Label>
                  <Input
                    value={form.requestedBy}
                    placeholder="Requester name"
                    onChange={(e) => setForm({ ...form, requestedBy: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v: string | null) => setForm({ ...form, priority: v ?? "MEDIUM" })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Required Date</Label>
                  <Input
                    type="date"
                    value={form.requiredDate}
                    onChange={(e) => setForm({ ...form, requiredDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Requested Items</span>
                </div>

                {lineItems.length > 0 && (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/60 border-b">
                          <th className="text-left p-2 font-medium">Item</th>
                          <th className="text-center p-2 font-medium">Req Qty</th>
                          <th className="text-center p-2 font-medium">Unit</th>
                          <th className="text-left p-2 font-medium">Remarks / Purpose</th>
                          <th className="text-center p-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item, idx) => (
                          <tr key={item.id || `item-${idx}`} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-2 min-w-[200px]">
                              <div className="font-medium text-foreground">{item.item?.name || item.itemId}</div>
                              <div className="text-[10px] text-muted-foreground">{item.item?.itemCode}</div>
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={1}
                                className="h-7 w-20 text-center text-xs mx-auto"
                                value={item.quantity}
                                onChange={(e) => updateLineItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="p-2 text-center font-mono text-muted-foreground">
                              {item.unit || item.item?.unit?.code || "Unit"}
                            </td>
                            <td className="p-2">
                              <Input
                                className="h-7 text-xs"
                                placeholder="Purpose (e.g. Urgent loom maintenance)"
                                value={item.remarks}
                                onChange={(e) => updateLineItem(idx, "remarks", e.target.value)}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeLineItem(idx)}
                                className="text-muted-foreground hover:text-destructive cursor-pointer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add Line Item */}
                <div className="flex items-center gap-2 p-2 border border-dashed rounded-lg bg-muted/20">
                  <div className="w-[320px]">
                    <EntitySelect
                      value={newItemId}
                      onValueChange={(v) => setNewItemId(v)}
                      entityLabel="Item"
                      quickAddType="item"
                      placeholder="Select inventory item to add..."
                      className="h-8 text-xs"
                      options={inventoryItems.map((i) => ({
                        value: i.id,
                        label: `${i.itemCode} — ${i.name}`,
                      }))}
                      onQuickCreated={(created) => {
                        setInventoryItems((prev) => [created, ...prev]);
                        fetchRefs();
                      }}
                    />
                  </div>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={addLineItem} disabled={!newItemId}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes & General Remarks</Label>
                <Textarea
                  value={form.remarks}
                  rows={2}
                  placeholder="Justification or extra information"
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="px-6 py-3 border-t bg-muted/10">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editing ? "Update Demand Note" : "Create Demand Note"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Demand Note</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete Demand Note <strong>{deleteDialog?.demandNumber}</strong>?
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
