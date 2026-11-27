"use client";

import { useState, useEffect, useCallback } from "react";
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
import { generateNextCodeFromRows } from "@/lib/code-generator";
import { createCrudService, type QueryParams } from "@/lib/api/crud";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { createdByColumn } from "@/components/shared/columns";
import { AppShell } from "@/components/layouts/app-shell";

interface Account {
  id: string;
  accountCode: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  parentId: string;
  parentName?: string;
  description: string;
  balance: number;
}

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;

const TYPE_STYLES: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  LIABILITY: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  EQUITY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  INCOME: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  EXPENSE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

export default function ChartofAccountsPage() {
  const service = createCrudService<Account>("/finance/accounts");

  const [data, setData] = useState<Account[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { accountCode: "", name: "", type: "ASSET", parentId: "", description: "", balance: "0" };
  const [form, setForm] = useState<Record<string, string>>(emptyForm);

  useEffect(() => {
    service.findAll({ limit: 1000 }).then((res) => {
      setAllAccounts(res.data || []);
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

  const columns: ColumnDef<Account>[] = [
    { accessorKey: "accountCode", header: "Code" },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className={TYPE_STYLES[row.original.type] || ""}>
          {row.original.type}
        </Badge>
      ),
    },
    {
      header: "Parent",
      cell: ({ row }) => {
        const parent = allAccounts.find((a) => a.id === row.original.parentId);
        return parent?.name || row.original.parentName || "--";
      },
    },
    {
      accessorKey: "balance",
      header: "Balance",
      cell: ({ row }) => {
        const val = row.original.balance || 0;
        return <span className={val < 0 ? "text-destructive font-medium" : ""}>{Number(val).toLocaleString()}</span>;
      },
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
                accountCode: row.original.accountCode,
                name: row.original.name,
                type: row.original.type,
                parentId: row.original.parentId || "",
                description: row.original.description || "",
                balance: String(row.original.balance || 0),
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
    setSaving(true);
    try {
      const payload = {
        ...form,
        balance: parseFloat(form.balance) || 0,
        parentId: form.parentId || undefined,
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Account updated");
      } else {
        await service.create(payload);
        toast.success("Account created");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      fetchData();
      // Refresh parent list
      service.findAll({ limit: 1000 }).then((res) => setAllAccounts(res.data || [])).catch(() => {});
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
      toast.success("Account deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openCreate = () => {
    setEditing(null);
    const sourceRows = allAccounts.length ? allAccounts : data;
    const nextCode = generateNextCodeFromRows("ACC", sourceRows, (r) => r.accountCode);
    setForm({ ...emptyForm, accountCode: nextCode });
    setDialogOpen(true);
    service.findAll({ limit: 1000 }).then((res) => {
      const rows = res.data || [];
      setAllAccounts(rows);
      const freshCode = generateNextCodeFromRows("ACC", rows, (r) => r.accountCode);
      setForm((prev) => (prev.accountCode === nextCode ? { ...prev, accountCode: freshCode } : prev));
    }).catch(() => {});
  };

  return (
    <AppShell title="Chart of Accounts">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage the chart of accounts</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Account
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) { setEditing(null); setForm(emptyForm); }
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Account" : "Add Account"}</DialogTitle>
                  <DialogDescription>Fill in the account details below.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Account Code</Label>
                      <Input value={form.accountCode} placeholder="e.g. 1001" onChange={(e) => setForm({ ...form, accountCode: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={form.name} placeholder="e.g. Cash Account" onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v: string | null) => setForm({ ...form, type: v || "ASSET" })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Parent Account</Label>
                    <EntitySelect
                      value={form.parentId}
                      onValueChange={(v) => setForm({ ...form, parentId: v })}
                      entityLabel="Parent Account"
                      pluralLabel="accounts"
                      quickAddType="account"
                      allowNone
                      noneLabel="None (top-level)"
                      placeholder="None (top-level)"
                      options={allAccounts
                        .filter((a) => a.id !== editing?.id)
                        .map((a) => ({
                          value: a.id,
                          label: `${a.accountCode} - ${a.name}`,
                        }))}
                      onQuickCreated={(created) => {
                        setAllAccounts((prev) => [created, ...prev]);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={form.description} placeholder="Optional description" onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Opening Balance</Label>
                    <Input type="number" placeholder="e.g. 0" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
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
          searchPlaceholder="Search accounts..."
        />

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this account? This action can be undone by restoring from archives.
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
