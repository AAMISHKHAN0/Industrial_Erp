"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, CheckCircle, XCircle } from "lucide-react";
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
import { AppShell } from "@/components/layouts/app-shell";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { createdByColumn } from "@/components/shared/columns";

interface Item {
  id: string; itemCode: string; name: string; description?: string;
  categoryId?: string; unitId?: string; brand?: string;
  minStock?: number; maxStock?: number; reorderLevel?: number;
  purchasePrice?: number; sellingPrice?: number; hsnCode?: string;
  status: string;
  category?: { id: string; name: string };
  unit?: { id: string; name: string };
}

interface Category { id: string; name: string; }
interface Unit { id: string; name: string; }

interface ItemForm {
  itemCode: string; name: string; description: string; categoryId: string;
  unitId: string; brand: string; minStock: string; maxStock: string;
  reorderLevel: string; purchasePrice: string; sellingPrice: string;
  hsnCode: string; status: string;
}

function initForm(): ItemForm {
  return {
    itemCode: "", name: "", description: "", categoryId: "", unitId: "",
    brand: "", minStock: "", maxStock: "", reorderLevel: "",
    purchasePrice: "", sellingPrice: "", hsnCode: "", status: "ACTIVE",
  };
}


function getStockBadgeVariant(item: Item): "default" | "secondary" | "destructive" | "outline" {
  const min = item.minStock ?? 0;
  const reorder = item.reorderLevel;
  if (min <= 0) return "destructive";
  if (reorder != null && min <= reorder) return "outline";
  return "secondary";
}

export default function InventoryItemsPage() {
  const service = createCrudService<Item>("/inventory/items");
  const categoryService = createCrudService<Category>("/inventory/categories");
  const unitService = createCrudService<Unit>("/inventory/units");

  const [data, setData] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Item | null>(null);
  const [form, setForm] = useState<ItemForm>(initForm());
  const [saving, setSaving] = useState(false);

  const fetchLookups = useCallback(async () => {
    try {
      const [catRes, unitRes] = await Promise.allSettled([
        categoryService.findAll({ limit: 100, status: "ACTIVE" }),
        unitService.findAll({ limit: 100, status: "ACTIVE" }),
      ]);
      if (catRes.status === "fulfilled") setCategories(catRes.value.data);
      if (unitRes.status === "fulfilled") setUnits(unitRes.value.data);
    } catch {}
  }, []);

  useEffect(() => { fetchLookups(); }, []);

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

  const openCreate = () => {
    setEditing(null);
    const nextCode = generateNextCodeFromRows("ITM", data, (r) => r.itemCode);
    setForm({ ...initForm(), itemCode: nextCode });
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const fullCode = generateNextCodeFromRows("ITM", full.data || [], (r) => r.itemCode);
      setForm((prev) => ({
        ...prev,
        itemCode: prev.itemCode === nextCode ? fullCode : prev.itemCode,
      }));
    }).catch(() => {});
  };

  const columns: ColumnDef<Item>[] = [
    { accessorKey: "itemCode", header: "Code" },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          {row.original.brand && <span className="text-xs text-muted-foreground">{row.original.brand}</span>}
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      cell: ({ row }) => {
        const cat = categories.find((c) => c.id === row.original.categoryId);
        return cat?.name || row.original.categoryId || "-";
      },
    },
    {
      id: "unit",
      header: "Unit",
      cell: ({ row }) => {
        const u = units.find((u) => u.id === row.original.unitId);
        return u?.name || row.original.unitId || "-";
      },
    },
    {
      accessorKey: "purchasePrice",
      header: "Purchase Price",
      cell: ({ row }) => formatCurrency(row.original.purchasePrice),
    },
    {
      accessorKey: "sellingPrice",
      header: "Selling Price",
      cell: ({ row }) => formatCurrency(row.original.sellingPrice),
    },
    {
      id: "stock",
      header: "Stock Levels",
      cell: ({ row }) => {
        const item = row.original;
        const min = item.minStock ?? 0;
        const max = item.maxStock;
        const reorder = item.reorderLevel;
        return (
          <div className="flex items-center gap-2">
            <Badge variant={getStockBadgeVariant(item)}>
              Min: {min}
            </Badge>
            {max != null && <span className="text-xs text-muted-foreground">Max: {max}</span>}
            {reorder != null && (
              <span className="text-xs text-muted-foreground">
                Reorder: {reorder}
              </span>
            )}
          </div>
        );
      },
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
              const item = row.original;
              setEditing(item);
              setForm({
                itemCode: item.itemCode || "",
                name: item.name || "",
                description: item.description || "",
                categoryId: item.categoryId || "",
                unitId: item.unitId || "",
                brand: item.brand || "",
                minStock: item.minStock != null ? String(item.minStock) : "",
                maxStock: item.maxStock != null ? String(item.maxStock) : "",
                reorderLevel: item.reorderLevel != null ? String(item.reorderLevel) : "",
                purchasePrice: item.purchasePrice != null ? String(item.purchasePrice) : "",
                sellingPrice: item.sellingPrice != null ? String(item.sellingPrice) : "",
                hsnCode: item.hsnCode || "",
                status: item.status || "ACTIVE",
              });
              setDialogOpen(true);
            }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleToggleActive(row.original)}>
              {row.original.status === "ACTIVE"
                ? <><XCircle className="h-4 w-4 mr-2" /> Deactivate</>
                : <><CheckCircle className="h-4 w-4 mr-2" /> Activate</>}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(row.original)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleSave = async () => {
    if (!form.itemCode || !form.name) { toast.error("Item Code and Name are required"); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        itemCode: form.itemCode,
        name: form.name,
        description: form.description || undefined,
        categoryId: form.categoryId || undefined,
        unitId: form.unitId || undefined,
        brand: form.brand || undefined,
        minStock: form.minStock ? Number(form.minStock) : undefined,
        maxStock: form.maxStock ? Number(form.maxStock) : undefined,
        reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : undefined,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
        sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : undefined,
        hsnCode: form.hsnCode || undefined,
        status: form.status,
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Item updated");
      } else {
        await service.create(payload);
        toast.success("Item created");
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

  const handleToggleActive = async (it: { id: string; status: string }) => {
    try {
      await service.update(it.id, { status: it.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      toast.success(it.status === "ACTIVE" ? "Item deactivated" : "Item activated");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await service.remove(deleteDialog.id);
      toast.success("Item deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell title="Item Master">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage inventory items and products</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) { setEditing(null); setForm(initForm()); }
            }}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Item" : "Add Item"}</DialogTitle>
                  <DialogDescription>Fill in the item details below.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Item Code *</Label>
                    <Input
                      value={form.itemCode}
                      placeholder="e.g. ITM-1001"
                      onChange={(e) => setForm({ ...form, itemCode: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={form.name}
                      placeholder="e.g. Cotton Fabric"
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={form.description}
                      placeholder="Optional item description"
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <EntitySelect
                      value={form.categoryId}
                      onValueChange={(v) => setForm({ ...form, categoryId: v })}
                      entityLabel="Category"
                      pluralLabel="Categories"
                      quickAddType="category"
                      placeholder="Select category"
                      allowNone
                      noneLabel="None (Optional)"
                      options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
                      onQuickCreated={(created) => {
                        setCategories((prev) => [created, ...prev]);
                        fetchLookups();
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <EntitySelect
                      value={form.unitId}
                      onValueChange={(v) => setForm({ ...form, unitId: v })}
                      entityLabel="Unit"
                      quickAddType="unit"
                      placeholder="Select unit"
                      allowNone
                      noneLabel="None (Optional)"
                      options={units.map((u) => ({ value: u.id, label: u.name }))}
                      onQuickCreated={(created) => {
                        setUnits((prev) => [created, ...prev]);
                        fetchLookups();
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <Input
                      value={form.brand}
                      placeholder="e.g. Brand name"
                      onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>HSN Code</Label>
                    <Input
                      value={form.hsnCode}
                      placeholder="e.g. 5208"
                      onChange={(e) => setForm({ ...form, hsnCode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Stock</Label>
                    <Input
                      type="number" min="0"
                      value={form.minStock}
                      placeholder="e.g. 10"
                      onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Stock</Label>
                    <Input
                      type="number" min="0"
                      value={form.maxStock}
                      placeholder="e.g. 500"
                      onChange={(e) => setForm({ ...form, maxStock: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reorder Level</Label>
                    <Input
                      type="number" min="0"
                      value={form.reorderLevel}
                      placeholder="e.g. 50"
                      onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Purchase Price (PKR)</Label>
                    <Input
                      type="number" min="0" step="0.01"
                      value={form.purchasePrice}
                      placeholder="e.g. 100.00"
                      onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Selling Price (PKR)</Label>
                    <Input
                      type="number" min="0" step="0.01"
                      value={form.sellingPrice}
                      placeholder="e.g. 150.00"
                      onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v: string | null) => setForm({ ...form, status: v || '' })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
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
          searchPlaceholder="Search items..."
        />

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Item</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this item? This action can be undone by restoring from archives.
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
