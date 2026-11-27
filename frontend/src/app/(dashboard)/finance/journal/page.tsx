"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, CheckCircle, PlusCircle } from "lucide-react";
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
import { DataTable } from "@/components/shared/data-table/data-table";
import { EntitySelect } from "@/components/shared/entity-select";
import { generateNextCodeFromRows } from "@/lib/code-generator";
import { createCrudService, type QueryParams } from "@/lib/api/crud";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { createdByColumn } from "@/components/shared/columns";
import { AppShell } from "@/components/layouts/app-shell";

interface JournalItem {
  accountId: string;
  accountName?: string;
  debitAmount: number;
  creditAmount: number;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  reference: string;
  description: string;
  isPosted: boolean;
  items: JournalItem[];
}

export default function JournalEntriesPage() {
  const service = createCrudService<JournalEntry>("/finance/journal-entries");
  const acctService = createCrudService<any>("/finance/accounts");

  const [data, setData] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState<JournalEntry | null>(null);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<JournalEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { entryNumber: "", entryDate: new Date().toISOString().split("T")[0], reference: "", description: "" };
  const [form, setForm] = useState<Record<string, string>>(emptyForm);

  const emptyItems = (): JournalItem[] => [
    { accountId: "", debitAmount: 0, creditAmount: 0 },
    { accountId: "", debitAmount: 0, creditAmount: 0 },
  ];

  const [items, setItems] = useState<JournalItem[]>(emptyItems);

  useEffect(() => {
    acctService.findAll({ limit: 1000 }).then((res) => {
      setAccounts(res.data || []);
    }).catch(() => {});
  }, []);

  const getAccountName = (id: string) => {
    const a = accounts.find((ac) => ac.id === id);
    return a ? `${a.accountCode} - ${a.name}` : id;
  };

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

  const handlePost = async (entry: JournalEntry) => {
    try {
      await api.post(`/finance/journal-entries/${entry.id}/post`, {});
      toast.success("Journal entry posted");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const totalDebits = items.reduce((s, i) => s + (parseFloat(String(i.debitAmount)) || 0), 0);
  const totalCredits = items.reduce((s, i) => s + (parseFloat(String(i.creditAmount)) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const columns: ColumnDef<JournalEntry>[] = [
    {
      accessorKey: "entryNumber",
      header: "Entry #",
      cell: ({ row }) => (
        <button
          className="text-primary font-medium hover:underline cursor-pointer"
          onClick={() => setViewDialog(row.original)}
        >
          {row.original.entryNumber}
        </button>
      ),
    },
    {
      accessorKey: "entryDate",
      header: "Date",
      cell: ({ row }) => <span>{row.original.entryDate ? String(row.original.entryDate).split("T")[0] : "-"}</span>,
    },
    { accessorKey: "reference", header: "Reference" },
    { accessorKey: "description", header: "Description" },
    {
      id: "debitTotal",
      header: "Debit",
      cell: ({ row }) => {
        const total = (row.original.items || []).reduce((s: number, i: any) => s + (parseFloat(i.debitAmount) || 0), 0);
        return total.toLocaleString();
      },
    },
    {
      id: "creditTotal",
      header: "Credit",
      cell: ({ row }) => {
        const total = (row.original.items || []).reduce((s: number, i: any) => s + (parseFloat(i.creditAmount) || 0), 0);
        return total.toLocaleString();
      },
    },
    {
      accessorKey: "isPosted",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isPosted ? "secondary" : "outline"}>
          {row.original.isPosted ? "Posted" : "Draft"}
        </Badge>
      ),
    },
    createdByColumn,
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const entry = row.original;
        return (
          <div className="flex items-center gap-1">
            {!entry.isPosted && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Post Journal Entry" onClick={() => handlePost(entry)}>
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setViewDialog(entry)}>
                  <Pencil className="h-4 w-4 mr-2" /> View
                </DropdownMenuItem>
                {!entry.isPosted && (
                  <>
                    <DropdownMenuItem onClick={() => {
                      setEditing(entry);
                      setForm({
                        entryNumber: entry.entryNumber,
                        entryDate: entry.entryDate ? String(entry.entryDate).split("T")[0] : new Date().toISOString().split("T")[0],
                        reference: entry.reference || "",
                        description: entry.description || "",
                      });
                      setItems((entry.items || []).length >= 2 ? entry.items : emptyItems());
                      setDialogOpen(true);
                    }}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(entry)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const addItem = () => {
    setItems([...items, { accountId: "", debitAmount: 0, creditAmount: 0 }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 2) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof JournalItem, value: any) => {
    const updated = items.map((item, i) =>
      i === idx ? { ...item, [field]: field === "accountId" ? value : parseFloat(value) || 0 } : item
    );
    setItems(updated);
  };

  const handleSave = async () => {
    if (items.length < 2) {
      toast.error("At least 2 journal lines are required");
      return;
    }
    if (totalDebits <= 0 && totalCredits <= 0) {
      toast.error("Enter a debit and credit amount greater than 0");
      return;
    }
    if (!isBalanced) {
      toast.error("Debits and credits must balance");
      return;
    }
    if (items.some((i) => !i.accountId)) {
      toast.error("All journal items must have an account selected");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...(form.entryNumber?.trim() ? { entryNumber: form.entryNumber.trim() } : {}),
        entryDate: form.entryDate ? new Date(form.entryDate).toISOString() : new Date().toISOString(),
        ...(editing
          ? {
              reference: form.reference?.trim() ?? "",
              description: form.description?.trim() ?? "",
            }
          : {
              ...(form.reference?.trim() ? { reference: form.reference.trim() } : {}),
              ...(form.description?.trim() ? { description: form.description.trim() } : {}),
            }),
        items: items.map((i) => ({
          accountId: i.accountId,
          debitAmount: parseFloat(String(i.debitAmount)) || 0,
          creditAmount: parseFloat(String(i.creditAmount)) || 0,
        })),
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Journal entry updated");
      } else {
        await service.create(payload);
        toast.success("Journal entry created");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setItems(emptyItems());
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
      toast.success("Journal entry deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openCreate = () => {
    setEditing(null);
    const nextCode = generateNextCodeFromRows("JE", data, (r) => r.entryNumber);
    setForm({ ...emptyForm, entryNumber: nextCode });
    setItems(emptyItems());
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((res) => {
      const freshCode = generateNextCodeFromRows("JE", res.data || [], (r) => r.entryNumber);
      setForm((prev) => (prev.entryNumber === nextCode ? { ...prev, entryNumber: freshCode } : prev));
    }).catch(() => {});
  };

  return (
    <AppShell title="Journal Entries">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage journal entries with debit/credit items</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Entry
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) { setEditing(null); setForm(emptyForm); setItems(emptyItems()); }
            }}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Journal Entry" : "Add Journal Entry"}</DialogTitle>
                  <DialogDescription>
                    {editing ? "Update the journal entry details." : "Fill in the journal entry details below."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Entry Number</Label>
                      <Input value={form.entryNumber} onChange={(e) => setForm({ ...form, entryNumber: e.target.value })} placeholder="JE-001" />
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Reference</Label>
                      <Input value={form.reference} placeholder="e.g. INV-001" onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={form.description} placeholder="Journal entry description" onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Journal Items</Label>
                      <Button variant="outline" size="sm" onClick={addItem}>
                        <PlusCircle className="h-4 w-4 mr-1" /> Add Line
                      </Button>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 p-3 bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <div className="col-span-5">Account</div>
                        <div className="col-span-3">Debit</div>
                        <div className="col-span-3">Credit</div>
                      </div>
                      <div className="divide-y">
                        {items.map((item, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 p-2 items-center">
                            <div className="col-span-5">
                              <EntitySelect
                                value={item.accountId}
                                onValueChange={(v) => updateItem(idx, "accountId", v)}
                                entityLabel="Account"
                                pluralLabel="accounts"
                                quickAddType="account"
                                placeholder="Select account..."
                                className="h-8 text-xs"
                                options={accounts.map((a) => ({
                                  value: a.id,
                                  label: `${a.accountCode} - ${a.name}`,
                                }))}
                                onQuickCreated={(created) => {
                                  setAccounts((prev) => [created, ...prev]);
                                }}
                              />
                            </div>
                            <div className="col-span-3">
                              <Input
                                type="number"
                                className="h-8 text-xs"
                                placeholder="0.00"
                                value={item.debitAmount || ""}
                                onChange={(e) => updateItem(idx, "debitAmount", e.target.value)}
                              />
                            </div>
                            <div className="col-span-3">
                              <Input
                                type="number"
                                className="h-8 text-xs"
                                placeholder="0.00"
                                value={item.creditAmount || ""}
                                onChange={(e) => updateItem(idx, "creditAmount", e.target.value)}
                              />
                            </div>
                            <div className="col-span-1 flex justify-center">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={items.length <= 2} onClick={() => removeItem(idx)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1">
                      <span className={isBalanced ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                        {isBalanced ? "Balanced" : "Unbalanced"}
                      </span>
                      <span className="text-muted-foreground">
                        Debit: {totalDebits.toLocaleString()} | Credit: {totalCredits.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving || !isBalanced}>
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
          searchPlaceholder="Search journal entries..."
        />

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Journal Entry</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this journal entry? This action can be undone by restoring from archives.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Journal Entry {viewDialog?.entryNumber}</DialogTitle>
              <DialogDescription>
                {viewDialog?.entryDate ? String(viewDialog.entryDate).split("T")[0] : ""} {viewDialog?.reference && `| Ref: ${viewDialog.reference}`}
                <Badge variant={viewDialog?.isPosted ? "secondary" : "outline"} className="ml-2">
                  {viewDialog?.isPosted ? "Posted" : "Draft"}
                </Badge>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {viewDialog?.description && (
                <p className="text-sm">{viewDialog.description}</p>
              )}
              <div className="border rounded-lg">
                <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <div>Account</div>
                  <div>Debit</div>
                  <div>Credit</div>
                </div>
                <div className="divide-y">
                  {(viewDialog?.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 p-3 text-sm">
                      <div>{getAccountName(item.accountId)}</div>
                      <div className="font-medium">{parseFloat(item.debitAmount || 0).toLocaleString()}</div>
                      <div className="font-medium">{parseFloat(item.creditAmount || 0).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 p-3 border-t bg-muted/30 text-sm font-medium">
                  <div>Total</div>
                  <div>{(viewDialog?.items || []).reduce((s: number, i: any) => s + (parseFloat(i.debitAmount) || 0), 0).toLocaleString()}</div>
                  <div>{(viewDialog?.items || []).reduce((s: number, i: any) => s + (parseFloat(i.creditAmount) || 0), 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialog(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
