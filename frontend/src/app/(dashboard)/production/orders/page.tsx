"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, Play, Pause, RotateCcw, CheckCircle2 } from "lucide-react";
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
import { createdByColumn } from "@/components/shared/columns";
import { EntitySelect } from "@/components/shared/entity-select";
import { generateNextCodeFromRows } from "@/lib/code-generator";
import { createCrudService, type QueryParams } from "@/lib/api/crud";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { AppShell } from "@/components/layouts/app-shell";

interface Item {
  id: string;
  name: string;
  itemCode?: string;
}

interface Bom {
  id: string;
  bomNumber: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface ProductionOrder {
  id: string;
  productionNumber: string;
  itemId: string;
  bomId: string;
  quantity: number;
  producedQty: number;
  rejectedQty: number;
  startDate: string;
  endDate: string;
  assignedTo: string;
  priority: string;
  notes: string;
  status: string;
  itemName?: string;
  bomName?: string;
}

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  PLANNED: { variant: "default", label: "Planned" },
  IN_PROGRESS: { variant: "outline", label: "In Progress" },
  COMPLETED: { variant: "secondary", label: "Completed" },
  CANCELLED: { variant: "destructive", label: "Cancelled" },
  ON_HOLD: { variant: "secondary", label: "On Hold" },
};

const priorityOptions = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export default function ProductionOrdersPage() {
  const service = createCrudService<ProductionOrder>("/production/orders");
  const itemsService = createCrudService<Item>("/inventory/items");
  const bomService = createCrudService<Bom>("/production/bom");
  const warehouseService = createCrudService<Warehouse>("/inventory/warehouses");

  const [data, setData] = useState<ProductionOrder[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionOrder | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<ProductionOrder | null>(null);
  const [completeDialog, setCompleteDialog] = useState<{
    order: ProductionOrder;
    warehouseId: string;
    producedQty: string;
    rejectedQty: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [form, setForm] = useState({
    productionNumber: "",
    itemId: "",
    bomId: "",
    quantity: "",
    producedQty: "0",
    rejectedQty: "0",
    startDate: "",
    endDate: "",
    assignedTo: "",
    priority: "MEDIUM",
    notes: "",
    status: "PLANNED",
  });

  const initForm = useCallback(() => ({
    productionNumber: "",
    itemId: "",
    bomId: "",
    quantity: "1",
    producedQty: "0",
    rejectedQty: "0",
    startDate: "",
    endDate: "",
    assignedTo: "",
    priority: "MEDIUM",
    notes: "",
    status: "PLANNED",
  }), []);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const bomsRef = useRef(boms);
  bomsRef.current = boms;

  useEffect(() => {
    itemsService.findAll({ limit: 200, status: "ACTIVE" }).then((res) => { setItems(res.data); }).catch(() => {});
    bomService.findAll({ limit: 200, status: "ACTIVE" }).then((res) => { setBoms(res.data); }).catch(() => {});
    warehouseService.findAll({ limit: 999, isActive: true }).then((res) => { setWarehouses(res.data); }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.findAll(query);
      const enriched = res.data.map((o) => ({
        ...o,
        itemName: itemsRef.current.find((i) => i.id === o.itemId)?.name || o.itemId,
        bomName: bomsRef.current.find((b) => b.id === o.bomId)?.bomNumber || o.bomId,
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

  const openCreate = () => {
    setEditing(null);
    const nextCode = generateNextCodeFromRows("PROD", data, (r) => r.productionNumber);
    setForm({
      ...initForm(),
      productionNumber: nextCode,
      startDate: new Date().toISOString().split("T")[0],
    });
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const fullCode = generateNextCodeFromRows("PROD", full.data || [], (r) => r.productionNumber);
      setForm((prev) => ({
        ...prev,
        productionNumber: prev.productionNumber === nextCode ? fullCode : prev.productionNumber,
      }));
    }).catch(() => {});
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] || { variant: "outline" as const, label: status };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const columns: ColumnDef<ProductionOrder>[] = [
    { accessorKey: "productionNumber", header: "Production #" },
    { accessorKey: "itemName", header: "Item" },
    { accessorKey: "quantity", header: "Qty" },
    { accessorKey: "producedQty", header: "Produced" },
    { accessorKey: "rejectedQty", header: "Rejected" },
    { accessorKey: "assignedTo", header: "Assigned To" },
    { accessorKey: "priority", header: "Priority" },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    createdByColumn,
    {
      id: "actions",
      cell: ({ row }) => {
        const o = row.original;
        const handleAction = async (action: string) => {
          try {
            await api.post(`/production/orders/${o.id}/${action}`, {});
            toast.success(`Order ${action === 'start' ? 'started' : action === 'hold' ? 'on hold' : 'resumed'}`);
            fetchData();
          } catch (e: any) { toast.error(e.message); }
        };
        return (
          <DropdownMenu>
            <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              {o.status === 'PLANNED' && (
                <DropdownMenuItem onClick={() => handleAction('start')}>
                  <Play className="h-4 w-4 mr-2" /> Start Production
                </DropdownMenuItem>
              )}
              {o.status === 'IN_PROGRESS' && (
                <DropdownMenuItem onClick={() => handleAction('hold')}>
                  <Pause className="h-4 w-4 mr-2" /> Hold
                </DropdownMenuItem>
              )}
              {o.status === 'ON_HOLD' && (
                <DropdownMenuItem onClick={() => handleAction('resume')}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Resume
                </DropdownMenuItem>
              )}
              {!['COMPLETED', 'CANCELLED'].includes(o.status) && (
                <DropdownMenuItem onClick={() => setCompleteDialog({
                  order: o,
                  warehouseId: warehouses[0]?.id || "",
                  producedQty: String(o.producedQty > 0 ? o.producedQty : o.quantity),
                  rejectedQty: String(o.rejectedQty || 0),
                })}>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> Complete Order
                </DropdownMenuItem>
              )}

              {!['COMPLETED', 'CANCELLED'].includes(o.status) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    setEditing(o);
                    setForm({
                      productionNumber: o.productionNumber || "",
                      itemId: o.itemId || "",
                      bomId: o.bomId || "",
                      quantity: String(o.quantity || ""),
                      producedQty: String(o.producedQty || "0"),
                      rejectedQty: String(o.rejectedQty || "0"),
                      startDate: o.startDate ? String(o.startDate).split("T")[0] : "",
                      endDate: o.endDate ? String(o.endDate).split("T")[0] : "",
                      assignedTo: o.assignedTo || "",
                      priority: o.priority || "MEDIUM",
                      notes: o.notes || "",
                      status: o.status || "PLANNED",
                    });
                    setDialogOpen(true);
                  }}>
                    <Pencil className="h-4 w-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(o)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const handleSave = async () => {
    if (!form.itemId) {
      toast.error("Please select an Item");
      return;
    }
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        bomId: form.bomId || undefined,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        assignedTo: form.assignedTo || undefined,
        notes: form.notes || undefined,
        quantity: qty,
        producedQty: Number(form.producedQty) || 0,
        rejectedQty: Number(form.rejectedQty) || 0,
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Production order updated");
      } else {
        await service.create(payload);
        toast.success("Production order created");
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

  const handleCompleteOrder = async () => {
    if (!completeDialog) return;
    if (!completeDialog.warehouseId) {
      toast.error("Please select a warehouse for material issue & finished goods receipt");
      return;
    }
    const producedQty = Number(completeDialog.producedQty);
    const rejectedQty = Number(completeDialog.rejectedQty) || 0;
    if (isNaN(producedQty) || producedQty <= 0) {
      toast.error("Produced quantity must be greater than 0");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/production/orders/${completeDialog.order.id}/complete`, {
        producedQty,
        rejectedQty,
        warehouseId: completeDialog.warehouseId,
      });
      toast.success(`Production order ${completeDialog.order.productionNumber} completed`);
      setCompleteDialog(null);
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
      toast.success("Production order deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell title="Production Orders">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage production orders and track manufacturing progress</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Order
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) { setEditing(null); setForm(initForm()); }
            }}>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Production Order" : "Add Production Order"}</DialogTitle>
                  <DialogDescription>Fill in the production order details below.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Production Number</Label>
                      <Input value={form.productionNumber} placeholder="e.g. PROD-001" onChange={(e) => setForm({ ...form, productionNumber: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(val: string | null) => val && setForm({ ...form, status: val })}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusConfig).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Item</Label>
                      <EntitySelect
                        value={form.itemId}
                        onValueChange={(val) => setForm({ ...form, itemId: val })}
                        entityLabel="Item"
                        quickAddType="item"
                        placeholder="Select item..."
                        options={items.map((item) => ({
                          value: item.id,
                          label: item.itemCode ? `${item.itemCode} — ${item.name}` : item.name,
                        }))}
                        onQuickCreated={(created) => {
                          setItems((prev) => [created, ...prev]);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>BOM</Label>
                      <EntitySelect
                        value={form.bomId}
                        onValueChange={(val) => setForm({ ...form, bomId: val })}
                        entityLabel="BOM"
                        quickAddType="bom"
                        placeholder="Select BOM..."
                        allowNone
                        noneLabel="None (Optional)"
                        options={boms.map((bom) => ({ value: bom.id, label: bom.bomNumber }))}
                        onQuickCreated={(created) => {
                          setBoms((prev) => [created, ...prev]);
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input type="number" placeholder="e.g. 1000" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Produced Qty</Label>
                      <Input type="number" placeholder="e.g. 950" value={form.producedQty} onChange={(e) => setForm({ ...form, producedQty: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Rejected Qty</Label>
                      <Input type="number" placeholder="e.g. 10" value={form.rejectedQty} onChange={(e) => setForm({ ...form, rejectedQty: e.target.value })} />
                    </div>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Assigned To</Label>
                      <Input value={form.assignedTo} placeholder="e.g. Supervisor name" onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={form.priority} onValueChange={(val: string | null) => val && setForm({ ...form, priority: val })}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {priorityOptions.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
          searchPlaceholder="Search orders..."
        />

        <Dialog open={!!completeDialog} onOpenChange={(o) => { if (!o) setCompleteDialog(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Production Order</DialogTitle>
              <DialogDescription>
                Finalize <strong>{completeDialog?.order.productionNumber}</strong>, consume BOM materials, and receive finished goods into stock.
              </DialogDescription>
            </DialogHeader>
            {completeDialog && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Warehouse *</Label>
                  <EntitySelect
                    value={completeDialog.warehouseId}
                    onValueChange={(val) =>
                      setCompleteDialog({ ...completeDialog, warehouseId: val })
                    }
                    entityLabel="Warehouse"
                    quickAddType="warehouse"
                    placeholder="Select warehouse..."
                    options={warehouses.map((w) => ({
                      value: w.id,
                      label: `${w.name} (${w.code})`,
                    }))}
                    onQuickCreated={(created) => {
                      setWarehouses((prev) => [created, ...prev]);
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Produced Qty *</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="any"
                      value={completeDialog.producedQty}
                      onChange={(e) =>
                        setCompleteDialog({ ...completeDialog, producedQty: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rejected Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={completeDialog.rejectedQty}
                      onChange={(e) =>
                        setCompleteDialog({ ...completeDialog, rejectedQty: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCompleteDialog(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleCompleteOrder} disabled={saving}>
                {saving ? "Completing..." : "Complete Order"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Production Order</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this order? This action can be undone by restoring from archives.
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
