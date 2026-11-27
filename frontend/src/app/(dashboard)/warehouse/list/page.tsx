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
import type { ColumnDef } from "@tanstack/react-table";
import { createdByColumn } from "@/components/shared/columns";

interface Warehouse {
  id: string; name: string; code: string; branchId?: string;
  address?: string; city?: string; state?: string; country?: string;
  isActive: boolean;
  branch?: { id: string; name: string };
}

interface Branch { id: string; name: string; }

interface WarehouseForm {
  name: string; code: string; branchId: string;
  address: string; city: string; state: string; country: string;
  isActive: boolean;
}

function initForm(): WarehouseForm {
  return { name: "", code: "", branchId: "", address: "", city: "", state: "", country: "", isActive: true };
}

export default function WarehousesPage() {
  const service = createCrudService<Warehouse>("/inventory/warehouses");
  const branchService = createCrudService<Branch>("/master-data/branch");

  const [data, setData] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Warehouse | null>(null);
  const [form, setForm] = useState<WarehouseForm>(initForm());
  const [saving, setSaving] = useState(false);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await branchService.findAll({ limit: 100, status: "ACTIVE" });
      setBranches(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchBranches(); }, []);

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

  useEffect(() => { fetchData();   }, [query]);

  const openCreate = () => {
    setEditing(null);
    const nextCode = generateNextCodeFromRows("WH", data, (r) => r.code);
    setForm({ ...initForm(), code: nextCode });
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const fullCode = generateNextCodeFromRows("WH", full.data || [], (r) => r.code);
      setForm((prev) => ({
        ...prev,
        code: prev.code === nextCode ? fullCode : prev.code,
      }));
    }).catch(() => {});
  };

  const branchMap: Record<string, string> = branches.length
    ? Object.fromEntries(branches.map((b) => [b.id, b.name]))
    : {};

  const columns: ColumnDef<Warehouse>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "code", header: "Code" },
    {
      id: "branch",
      header: "Branch",
      cell: ({ row }) => branchMap[row.original.branchId || ""] || row.original.branchId || "-",
    },
    { accessorKey: "city", header: "City" },
    { accessorKey: "state", header: "State" },
    {
      id: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "secondary" : "outline"}>
          {row.original.isActive ? "Active" : "Inactive"}
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
              const wh = row.original;
              setEditing(wh);
              setForm({
                name: wh.name || "",
                code: wh.code || "",
                branchId: wh.branchId || "",
                address: wh.address || "",
                city: wh.city || "",
                state: wh.state || "",
                country: wh.country || "",
                isActive: wh.isActive ?? true,
              });
              setDialogOpen(true);
            }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleToggleActive(row.original)}>
              {row.original.isActive
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
    if (!form.name || !form.code) { toast.error("Name and Code are required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        branchId: form.branchId || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        isActive: form.isActive,
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Warehouse updated");
      } else {
        await service.create(payload);
        toast.success("Warehouse created");
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

  const handleToggleActive = async (wh: Warehouse) => {
    try {
      await service.update(wh.id, { isActive: !wh.isActive });
      toast.success(wh.isActive ? "Warehouse deactivated" : "Warehouse activated");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await service.remove(deleteDialog.id);
      toast.success("Warehouse deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell title="Warehouses">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage warehouse locations</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Warehouse
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) { setEditing(null); setForm(initForm()); }
            }}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Warehouse" : "Add Warehouse"}</DialogTitle>
                  <DialogDescription>Fill in the warehouse details below.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={form.name} placeholder="e.g. Main Warehouse" onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Code *</Label>
                    <Input value={form.code} placeholder="e.g. WH-MAIN" onChange={(e) => setForm({ ...form, code: e.target.value })} required />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Branch</Label>
                    <EntitySelect
                      value={form.branchId}
                      onValueChange={(v) => setForm({ ...form, branchId: v })}
                      entityLabel="Branch"
                      pluralLabel="Branches"
                      quickAddType="branch"
                      placeholder="Select branch"
                      allowNone
                      noneLabel="None (Optional)"
                      options={branches.map((b) => ({ value: b.id, label: b.name }))}
                      onQuickCreated={(created) => {
                        setBranches((prev) => [created, ...prev]);
                        fetchBranches();
                      }}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Address</Label>
                    <Textarea value={form.address} placeholder="Full warehouse address" onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={form.city} placeholder="e.g. Lahore" onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input value={form.state} placeholder="e.g. Punjab" onChange={(e) => setForm({ ...form, state: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input value={form.country} placeholder="e.g. Pakistan" onChange={(e) => setForm({ ...form, country: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.isActive ? "true" : "false"}
                      onValueChange={(v: string | null) => setForm({ ...form, isActive: v === "true" })}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
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
          searchPlaceholder="Search warehouses..."
        />

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Warehouse</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this warehouse? This action can be undone by restoring from archives.
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
