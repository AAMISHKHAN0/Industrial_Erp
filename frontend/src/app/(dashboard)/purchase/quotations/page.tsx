"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, Send, CheckCircle2, XCircle, Ban } from "lucide-react";
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
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { createdByColumn } from "@/components/shared/columns";
import { AppShell } from "@/components/layouts/app-shell";

interface Quotation {
  id: string;
  quotationNumber: string;
  vendorId: string;
  demandNoteId: string;
  quotationDate: string;
  deliveryTime: number;
  warranty: string;
  notes: string;
  totalAmount: number;
  status: string;
  vendor?: { id: string; name: string };
}

interface Vendor { id: string; name: string; vendorCode?: string; }
interface DemandNote { id: string; demandNumber: string; }

const defaultForm: Record<string, string> = {
  quotationNumber: "", vendorId: "", demandNoteId: "", quotationDate: "",
  deliveryTime: "", warranty: "", notes: "", totalAmount: "",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function toDateValue(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try { return new Date(dateStr).toISOString().split("T")[0]; } catch { return ""; }
}

function formatAmount(amount: number | null | undefined): string {
  if (amount == null) return "-";
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 2 }).format(amount);
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline", SUBMITTED: "secondary", APPROVED: "default", REJECTED: "destructive", CANCELLED: "destructive",
};

export default function QuotationsPage() {
  const service = createCrudService<Quotation>("/purchase/quotations");
  const vendorService = createCrudService<Vendor>("/purchase/vendors");
  const demandNoteService = createCrudService<DemandNote>("/purchase/demand-notes");

  const [data, setData] = useState<Quotation[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Quotation | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [demandNotes, setDemandNotes] = useState<DemandNote[]>([]);

  const fetchRefs = useCallback(async () => {
    try {
      const [vRes, dRes] = await Promise.all([
        vendorService.findAll({ limit: 999, status: "ACTIVE" }),
        demandNoteService.findAll({ limit: 999 }),
      ]);
      setVendors(vRes.data);
      setDemandNotes(dRes.data);
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
    const nextCode = generateNextCodeFromRows("QTN", data, (r) => r.quotationNumber);
    setForm({
      ...defaultForm,
      quotationNumber: nextCode,
      quotationDate: new Date().toISOString().split("T")[0],
    });
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const fullCode = generateNextCodeFromRows("QTN", full.data || [], (r) => r.quotationNumber);
      setForm((prev) => ({
        ...prev,
        quotationNumber: prev.quotationNumber === nextCode ? fullCode : prev.quotationNumber,
      }));
    }).catch(() => {});
  };

  const openEdit = (item: Quotation) => {
    setEditing(item);
    setForm({
      quotationNumber: item.quotationNumber || "",
      vendorId: item.vendorId || "",
      demandNoteId: item.demandNoteId || "",
      quotationDate: toDateValue(item.quotationDate),
      deliveryTime: item.deliveryTime != null ? String(item.deliveryTime) : "",
      warranty: item.warranty || "",
      notes: item.notes || "",
      totalAmount: item.totalAmount != null ? String(item.totalAmount) : "",
    });
    setDialogOpen(true);
  };

  const columns: ColumnDef<Quotation>[] = [
    { accessorKey: "quotationNumber", header: "Quotation #" },
    {
      header: "Vendor",
      cell: ({ row }) => <span>{row.original.vendor?.name || row.original.vendorId || "-"}</span>,
    },
    {
      header: "Date",
      cell: ({ row }) => <span>{formatDate(row.original.quotationDate)}</span>,
    },
    {
      accessorKey: "deliveryTime",
      header: "Delivery (days)",
      cell: ({ row }) => <span>{row.original.deliveryTime ?? "-"}</span>,
    },
    {
      header: "Total Amount",
      cell: ({ row }) => <span>{formatAmount(row.original.totalAmount)}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.status] || "outline"}>{row.original.status}</Badge>
      ),
    },
    createdByColumn,
    {
      id: "actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
        <DropdownMenu>
          <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => openEdit(item)}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {item.status === "DRAFT" && (
              <DropdownMenuItem onClick={() => handleStatusUpdate(item, "SUBMITTED")}>
                <Send className="h-4 w-4 mr-2" /> Submit
              </DropdownMenuItem>
            )}
            {item.status === "SUBMITTED" && (
              <>
                <DropdownMenuItem onClick={() => handleStatusUpdate(item, "APPROVED")}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusUpdate(item, "REJECTED")}>
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </DropdownMenuItem>
              </>
            )}
            {item.status !== "CANCELLED" && item.status !== "APPROVED" && (
              <DropdownMenuItem onClick={() => handleStatusUpdate(item, "CANCELLED")}>
                <Ban className="h-4 w-4 mr-2" /> Cancel
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(item)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        );
      },
    },
  ];

  const handleSave = async () => {
    if (!form.quotationNumber || !form.vendorId) {
      toast.error("Quotation Number and Vendor are required");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        ...form,
        demandNoteId: form.demandNoteId || undefined,
        quotationDate: form.quotationDate ? new Date(form.quotationDate).toISOString() : undefined,
        deliveryTime: form.deliveryTime ? parseInt(form.deliveryTime) : undefined,
        warranty: form.warranty || undefined,
        notes: form.notes || undefined,
        totalAmount: form.totalAmount ? parseFloat(form.totalAmount) : 0,
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Quotation updated");
      } else {
        await service.create(payload);
        toast.success("Quotation created");
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

  const handleStatusUpdate = async (item: Quotation, status: string) => {
    try {
      await service.update(item.id, { status });
      toast.success(`Quotation ${status.toLowerCase()}`);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await service.remove(deleteDialog.id);
      toast.success("Quotation deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell title="Vendor Quotations">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage vendor quotations and price comparisons</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Quotation
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          meta={meta}
          onPageChange={(page) => setQuery({ ...query, page })}
          searchPlaceholder="Search quotations..."
        />

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Quotation" : "Add Quotation"}</DialogTitle>
              <DialogDescription>Fill in the quotation details below.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Quotation Number *</Label>
                <Input value={form.quotationNumber} placeholder="e.g. QTN-001" onChange={(e) => setForm({ ...form, quotationNumber: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Vendor *</Label>
                <EntitySelect
                  value={form.vendorId}
                  onValueChange={(v) => setForm({ ...form, vendorId: v })}
                  entityLabel="Vendor"
                  quickAddType="vendor"
                  placeholder="Select vendor..."
                  options={vendors.map((v) => ({
                    value: v.id,
                    label: v.vendorCode ? `${v.vendorCode} — ${v.name}` : v.name,
                  }))}
                  onQuickCreated={(created) => {
                    setVendors((prev) => [created, ...prev]);
                    fetchRefs();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Demand Note</Label>
                <EntitySelect
                  value={form.demandNoteId}
                  onValueChange={(v) => setForm({ ...form, demandNoteId: v })}
                  entityLabel="Demand Note"
                  quickAddType="demandNote"
                  placeholder="Select demand note..."
                  allowNone
                  noneLabel="None (Optional)"
                  options={demandNotes.map((d) => ({ value: d.id, label: d.demandNumber }))}
                  onQuickCreated={(created) => {
                    setDemandNotes((prev) => [created, ...prev]);
                    fetchRefs();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Quotation Date</Label>
                <Input type="date" value={form.quotationDate} onChange={(e) => setForm({ ...form, quotationDate: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Delivery Time (days)</Label>
                  <Input type="number" min="0" placeholder="e.g. 15" value={form.deliveryTime} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <Input type="number" step="0.01" min="0" placeholder="e.g. 5000.00" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Warranty</Label>
                <Input value={form.warranty} placeholder="e.g. 1 year" onChange={(e) => setForm({ ...form, warranty: e.target.value })} />
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

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Quotation</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete quotation <strong>{deleteDialog?.quotationNumber}</strong>? This action can be undone by restoring from archives.
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
