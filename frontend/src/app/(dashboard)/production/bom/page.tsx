"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, PlusCircle, X, CheckCircle, XCircle } from "lucide-react";
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
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { createdByColumn } from "@/components/shared/columns";
import { AppShell } from "@/components/layouts/app-shell";

interface Item {
  id: string;
  name: string;
  itemCode?: string;
}

interface BomMaterial {
  itemId: string;
  quantity: number;
  unit: string;
}

interface Bom {
  id: string;
  bomNumber: string;
  itemId: string;
  description: string;
  quantity: number;
  unit: string;
  wastePct: number;
  status: string;
  itemName?: string;
  materials?: BomMaterial[];
}

export default function BillofMaterialsPage() {
  const service = createCrudService<Bom>("/production/bom");
  const itemsService = createCrudService<Item>("/inventory/items");

  const [data, setData] = useState<Bom[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Bom | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Bom | null>(null);
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState({
    bomNumber: "",
    itemId: "",
    description: "",
    quantity: "",
    unit: "",
    wastePct: "",
    status: "ACTIVE",
  });
  const [materials, setMaterials] = useState<BomMaterial[]>([]);

  const initForm = useCallback(() => ({
    bomNumber: "",
    itemId: "",
    description: "",
    quantity: "",
    unit: "",
    wastePct: "0",
    status: "ACTIVE",
  }), []);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    itemsService.findAll({ limit: 200, status: "ACTIVE" }).then((res) => { setItems(res.data); }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.findAll(query);
      const enriched = res.data.map((bom) => ({
        ...bom,
        itemName: itemsRef.current.find((i) => i.id === bom.itemId)?.name || bom.itemId,
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
    const nextCode = generateNextCodeFromRows("BOM", data, (r) => r.bomNumber);
    setForm({ ...initForm(), bomNumber: nextCode });
    setMaterials([]);
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const fullCode = generateNextCodeFromRows("BOM", full.data || [], (r) => r.bomNumber);
      setForm((prev) => ({
        ...prev,
        bomNumber: prev.bomNumber === nextCode ? fullCode : prev.bomNumber,
      }));
    }).catch(() => {});
  };

  const columns: ColumnDef<Bom>[] = [
    { accessorKey: "bomNumber", header: "BOM Number" },
    { accessorKey: "itemName", header: "Item" },
    { accessorKey: "description", header: "Description" },
    { accessorKey: "quantity", header: "Quantity" },
    { accessorKey: "unit", header: "Unit" },
    { accessorKey: "wastePct", header: "Waste %" },
    {
      id: "materialsCount",
      header: "Materials",
      cell: ({ row }) => <span className="text-sm">{row.original.materials?.length || 0} items</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "ACTIVE" ? "secondary" : "outline"}>
          {row.original.status}
        </Badge>
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
                bomNumber: row.original.bomNumber || "",
                itemId: row.original.itemId || "",
                description: row.original.description || "",
                quantity: String(row.original.quantity || ""),
                unit: row.original.unit || "",
                wastePct: String(row.original.wastePct || "0"),
                status: row.original.status || "ACTIVE",
              });
              setMaterials(row.original.materials || []);
              setDialogOpen(true);
            }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleToggleActive(row.original)}>
              {row.original.status === "ACTIVE" ? <XCircle className="h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {row.original.status === "ACTIVE" ? "Deactivate" : "Activate"}
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
    if (!form.itemId) {
      toast.error("Please select an Item");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity) || 1,
        wastePct: Number(form.wastePct) || 0,
        materials,
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("BOM updated");
      } else {
        await service.create(payload);
        toast.success("BOM created");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(initForm());
      setMaterials([]);
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
      toast.success("BOM deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleActive = async (bom: Bom) => {
    try {
      const newStatus = bom.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await service.update(bom.id, { status: newStatus });
      toast.success(`BOM ${newStatus === "ACTIVE" ? "activated" : "deactivated"}`);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const addMaterial = () => {
    setMaterials([...materials, { itemId: "", quantity: 0, unit: "" }]);
  };

  const updateMaterial = (index: number, field: keyof BomMaterial, value: string | number) => {
    const updated = [...materials];
    (updated[index] as any)[field] = value;
    setMaterials(updated);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  return (
    <AppShell title="Bill of Materials">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage bill of materials for production</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add BOM
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) { setEditing(null); setForm(initForm()); setMaterials([]); }
            }}>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit BOM" : "Add BOM"}</DialogTitle>
                  <DialogDescription>Fill in the bill of materials details below.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>BOM Number</Label>
                      <Input value={form.bomNumber} placeholder="e.g. BOM-001" onChange={(e) => setForm({ ...form, bomNumber: e.target.value })} required />
                    </div>
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
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={form.description} placeholder="BOM description" onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input type="number" placeholder="e.g. 100" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Input value={form.unit} placeholder="e.g. Meters" onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Waste %</Label>
                      <Input type="number" placeholder="e.g. 2.5" value={form.wastePct} onChange={(e) => setForm({ ...form, wastePct: e.target.value })} />
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Materials</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addMaterial}>
                        <PlusCircle className="h-4 w-4 mr-1" /> Add Material
                      </Button>
                    </div>
                    {materials.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No materials added yet.</p>
                    )}
                    {materials.map((mat, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Item</Label>
                          <EntitySelect
                            value={mat.itemId}
                            onValueChange={(val) => updateMaterial(i, "itemId", val)}
                            entityLabel="Item"
                            quickAddType="item"
                            placeholder="Select..."
                            options={items.map((item) => ({
                              value: item.id,
                              label: item.itemCode ? `${item.itemCode} — ${item.name}` : item.name,
                            }))}
                            onQuickCreated={(created) => {
                              setItems((prev) => [created, ...prev]);
                            }}
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input type="number" placeholder="Qty" value={mat.quantity} onChange={(e) => updateMaterial(i, "quantity", Number(e.target.value))} />
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Unit</Label>
                          <Input value={mat.unit} placeholder="e.g. kg" onChange={(e) => updateMaterial(i, "unit", e.target.value)} />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="mt-5 h-8 w-8" onClick={() => removeMaterial(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
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
          searchPlaceholder="Search BOMs..."
        />

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete BOM</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this BOM? This action can be undone by restoring from archives.
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
