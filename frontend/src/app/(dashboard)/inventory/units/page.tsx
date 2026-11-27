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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table/data-table";
import { generateNextCodeFromRows } from "@/lib/code-generator";
import { createCrudService, type QueryParams } from "@/lib/api/crud";
import { AppShell } from "@/components/layouts/app-shell";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { createdByColumn } from "@/components/shared/columns";

interface Unit { id: string; name: string; code: string; status: string; }

export default function InventoryUnitsPage() {
  const service = createCrudService<Unit>("/inventory/units");
  const [data, setData] = useState<Unit[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Unit | null>(null);
  const [form, setForm] = useState({ name: "", code: "", status: "ACTIVE" });
  const [saving, setSaving] = useState(false);

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
    const nextCode = generateNextCodeFromRows("UOM", data, (r) => r.code);
    setForm({ name: "", code: nextCode, status: "ACTIVE" });
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const fullCode = generateNextCodeFromRows("UOM", full.data || [], (r) => r.code);
      setForm((prev) => ({
        ...prev,
        code: prev.code === nextCode ? fullCode : prev.code,
      }));
    }).catch(() => {});
  };

  const columns: ColumnDef<Unit>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "code", header: "Code" },
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
                name: row.original.name || "",
                code: row.original.code || "",
                status: row.original.status || "ACTIVE",
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
    if (!form.name || !form.code) { toast.error("Name and Code are required"); return; }
    setSaving(true);
    try {
      if (editing) {
        await service.update(editing.id, { name: form.name, code: form.code, status: form.status });
        toast.success("Unit updated");
      } else {
        await service.create({ name: form.name, code: form.code, status: form.status });
        toast.success("Unit created");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm({ name: "", code: "", status: "ACTIVE" });
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: { id: string; status: string }) => {
    try {
      await service.update(u.id, { status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      toast.success(u.status === "ACTIVE" ? "Unit deactivated" : "Unit activated");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await service.remove(deleteDialog.id);
      toast.success("Unit deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell title="Units">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage inventory units of measurement</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Unit
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) { setEditing(null); setForm({ name: "", code: "", status: "ACTIVE" }); }
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Unit" : "Add Unit"}</DialogTitle>
                  <DialogDescription>Fill in the unit details below.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={form.name} placeholder="e.g. Kilogram" onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Code *</Label>
                    <Input value={form.code} placeholder="e.g. KG" onChange={(e) => setForm({ ...form, code: e.target.value })} required />
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
          searchPlaceholder="Search units..."
        />

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Unit</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this unit? This action can be undone by restoring from archives.
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
