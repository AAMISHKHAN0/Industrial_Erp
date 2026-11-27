"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, CheckCircle, XCircle, X, Search, ChevronDown } from "lucide-react";
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
import { DataTable } from "@/components/shared/data-table/data-table";
import { QuickCreateDialog } from "@/components/shared/quick-create-dialog";
import { generateNextCodeFromRows } from "@/lib/code-generator";
import { createCrudService, type QueryParams } from "@/lib/api/crud";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { AppShell } from "@/components/layouts/app-shell";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  paymentTerms: string;
  taxNumber: string;
  rating: number;
  status: string;
  suppliedItems?: VendorItem[];
}

interface VendorItem {
  id: string;
  itemId: string;
  preferredSupplier: boolean;
  leadTimeDays: number | null;
  minimumOrderQuantity: number | null;
  unitPrice: number | null;
  item: {
    id: string;
    itemCode: string;
    name: string;
    category: { name: string } | null;
    unit: { name: string } | null;
  };
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
  category?: { name: string };
  unit?: { name: string };
  categoryId?: string;
  unitId?: string;
}

const defaultForm: Record<string, string> = {
  vendorCode: "", name: "", contactPerson: "", email: "", phone: "",
  address: "", city: "", state: "", country: "",
  bankName: "", bankAccount: "", bankIfsc: "", paymentTerms: "", taxNumber: "", rating: "",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  INACTIVE: "secondary",
  SUSPENDED: "destructive",
};

export default function VendorsPage() {
  const service = createCrudService<Vendor>("/purchase/vendors");

  const [data, setData] = useState<Vendor[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Vendor | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  const [allItems, setAllItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [quickAddItemOpen, setQuickAddItemOpen] = useState(false);
  const itemDropdownRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.getWithMeta<any[]>("/inventory/items?limit=999&status=ACTIVE");
      setAllItems(res.data || []);
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
  useEffect(() => { fetchItems(); }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(e.target as Node)) {
        setItemDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openCreate = () => {
    setEditing(null);
    const nextCode = generateNextCodeFromRows("VND", data, (v) => v.vendorCode);
    setForm({ ...defaultForm, vendorCode: nextCode });
    setSelectedItems([]);
    setItemSearch("");
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const fullCode = generateNextCodeFromRows("VND", full.data || [], (v) => v.vendorCode);
      setForm((prev) => ({ ...prev, vendorCode: prev.vendorCode === nextCode ? fullCode : prev.vendorCode }));
    }).catch(() => {});
  };

  const openEdit = (item: Vendor) => {
    setEditing(item);
    setForm({
      vendorCode: item.vendorCode || "",
      name: item.name || "",
      contactPerson: item.contactPerson || "",
      email: item.email || "",
      phone: item.phone || "",
      address: item.address || "",
      city: item.city || "",
      state: item.state || "",
      country: item.country || "",
      bankName: item.bankName || "",
      bankAccount: item.bankAccount || "",
      bankIfsc: item.bankIfsc || "",
      paymentTerms: item.paymentTerms || "",
      taxNumber: item.taxNumber || "",
      rating: item.rating != null ? String(item.rating) : "",
    });
    const preSelected = (item.suppliedItems || [])
      .map((vi) => allItems.find((i) => i.id === vi.itemId))
      .filter((i): i is Item => !!i);
    setSelectedItems(preSelected);
    setItemSearch("");
    setDialogOpen(true);
  };

  const toggleItem = (item: Item) => {
    setSelectedItems((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item]
    );
  };

  const removeSelectedItem = (id: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const filteredItems = allItems.filter((item) => {
    const q = itemSearch.toLowerCase();
    return (
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.itemCode.toLowerCase().includes(q) ||
      (item.category?.name || "").toLowerCase().includes(q)
    );
  });

  const columns: ColumnDef<Vendor>[] = [
    { accessorKey: "vendorCode", header: "Code" },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Link href={`/purchase/vendors/${row.original.id}`} className="font-medium hover:text-primary hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: "contactPerson", header: "Contact" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "city", header: "City" },
    {
      accessorKey: "rating",
      header: "Rating",
      cell: ({ row }) => (
        <span>{row.original.rating != null ? row.original.rating.toFixed(1) : "-"}</span>
      ),
    },
    {
      id: "itemsCount",
      header: "Materials",
      cell: ({ row }) => (
        <span>{row.original.suppliedItems?.length || 0}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.status] || "outline"}>
          {row.original.status}
        </Badge>
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
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
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
    if (!form.vendorCode || !form.name) {
      toast.error("Vendor Code and Name are required");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = { ...form };
      if (payload.rating === "") payload.rating = null;
      else payload.rating = parseFloat(payload.rating);
      payload.materialsSupplied = selectedItems.map((i) => i.id);

      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Vendor updated");
      } else {
        await service.create(payload);
        toast.success("Vendor created");
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

  const handleToggleActive = async (v: Vendor) => {
    try {
      await service.update(v.id, { status: v.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      toast.success(v.status === "ACTIVE" ? "Vendor deactivated" : "Vendor activated");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await service.remove(deleteDialog.id);
      toast.success("Vendor deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell title="Vendors">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage vendor master data</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Vendor
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          meta={meta}
          onPageChange={(page) => setQuery({ ...query, page })}
          searchPlaceholder="Search vendors..."
        />

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
          <DialogContent className="max-h-[90vh] grid grid-rows-[auto_1fr_auto] p-0 sm:max-w-2xl">
            <DialogHeader className="px-4 pt-4">
              <DialogTitle>{editing ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
              <DialogDescription>Fill in the vendor details below.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 px-4 py-2 overflow-y-auto min-h-0">
              <div className="space-y-2">
                <Label>Vendor Code *</Label>
                <Input value={form.vendorCode} onChange={(e) => setForm({ ...form, vendorCode: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tax Number</Label>
                <Input value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Rating</Label>
                <Input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bank Account</Label>
                <Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bank IFSC</Label>
                <Input value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Address</Label>
                <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>

              {/* Materials Supplied */}
              <div className="col-span-2 space-y-2">
                <Label>Materials Supplied</Label>
                <div className="relative" ref={itemDropdownRef}>
                  <div
                    className={cn(
                      "flex flex-wrap gap-1.5 min-h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm cursor-pointer",
                      "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
                    )}
                    onClick={() => setItemDropdownOpen((prev) => !prev)}
                  >
                    {selectedItems.length === 0 && (
                      <span className="text-muted-foreground py-0.5">Search and select items...</span>
                    )}
                    {selectedItems.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium"
                      >
                        {item.itemCode} - {item.name}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); removeSelectedItem(item.id); }}
                        />
                      </span>
                    ))}
                    <ChevronDown className="h-4 w-4 ml-auto self-center text-muted-foreground shrink-0" />
                  </div>

                  {itemDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover text-popover-foreground shadow-md">
                      <div className="flex items-center gap-2 border-b px-2.5 py-1.5">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <input
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          placeholder="Search by code, name, category..."
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto py-1">
                        {filteredItems.length === 0 ? (
                          <div className="px-3 py-4 text-center space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {allItems.length === 0 ? "No items added yet" : "No matching items found"}
                            </p>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setItemDropdownOpen(false); setQuickAddItemOpen(true); }}
                              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add your Item
                            </button>
                          </div>
                        ) : (
                          filteredItems.map((item) => {
                            const isSelected = selectedItems.some((i) => i.id === item.id);
                            return (
                              <div
                                key={item.id}
                                className={cn(
                                  "flex items-center gap-2.5 px-2.5 py-1.5 text-sm cursor-pointer hover:bg-muted",
                                  isSelected && "bg-primary/5"
                                )}
                                onClick={() => toggleItem(item)}
                              >
                                <div className={cn(
                                  "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                                  isSelected ? "bg-primary border-primary" : "border-input"
                                )}>
                                  {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{item.itemCode} - {item.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {item.category?.name || "No category"} {item.unit?.name ? `· ${item.unit.name}` : ""}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {allItems.length > 0 && (
                        <div className="border-t p-1">
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setItemDropdownOpen(false); setQuickAddItemOpen(true); }}
                            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-primary hover:bg-accent cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Item
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="px-4 pb-4 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Vendor</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete vendor <strong>{deleteDialog?.name}</strong>? This action can be undone by restoring from archives.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <QuickCreateDialog
          open={quickAddItemOpen}
          onOpenChange={setQuickAddItemOpen}
          entityType="item"
          onCreated={(created) => {
            setAllItems((prev) => [created, ...prev]);
            setSelectedItems((prev) => (prev.some((i) => i.id === created.id) ? prev : [...prev, created]));
            fetchItems();
          }}
        />
      </div>
    </AppShell>
  );
}
