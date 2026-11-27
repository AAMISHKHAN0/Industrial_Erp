"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, Send, CheckCircle2, XCircle, Ban, CheckCheck } from "lucide-react";
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
import { CreatedByCell } from "@/components/shared/created-by-cell";
import { EntitySelect } from "@/components/shared/entity-select";
import { generateNextCodeFromRows } from "@/lib/code-generator";
import { createCrudService, type QueryParams } from "@/lib/api/crud";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { AppShell } from "@/components/layouts/app-shell";

interface PurchaseOrderLineItem {
  id?: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxPct?: number;
  totalPrice?: number;
  item?: { id: string; itemCode: string; name: string };
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  demandNoteId: string;
  quotationId: string;
  orderDate: string;
  expectedDelivery: string;
  paymentTerms: string;
  shippingCost: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  notes: string;
  status: string;
  vendor?: { id: string; name: string };
  items?: PurchaseOrderLineItem[];
}

interface Vendor { id: string; name: string; vendorCode?: string; }
interface DemandNote { id: string; demandNumber: string; }
interface Quotation { id: string; quotationNumber: string; }
interface InventoryItem { id: string; itemCode: string; name: string; purchasePrice?: number; unit?: { code?: string; name?: string }; }
interface PoLineInput { itemId: string; quantity: number; unitPrice: number; }

const defaultForm: Record<string, string> = {
  poNumber: "", vendorId: "", demandNoteId: "", quotationId: "",
  orderDate: "", expectedDelivery: "", paymentTerms: "",
  itemsSubtotal: "", shippingCost: "", discountAmount: "", taxAmount: "", grandTotal: "",
  notes: "",
};

function numOr0(v: string | undefined): number {
  const n = parseFloat(v || "");
  return isNaN(n) ? 0 : n;
}

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
  DRAFT: "outline", PENDING: "secondary", APPROVED: "default",
  REJECTED: "destructive", CANCELLED: "destructive", COMPLETED: "default",
};

export default function PurchaseOrdersPage() {
  const service = createCrudService<PurchaseOrder>("/purchase/orders");
  const vendorService = createCrudService<Vendor>("/purchase/vendors");
  const demandNoteService = createCrudService<DemandNote>("/purchase/demand-notes");
  const quotationService = createCrudService<Quotation>("/purchase/quotations");
  const itemService = createCrudService<InventoryItem>("/inventory/items");

  const [data, setData] = useState<PurchaseOrder[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...defaultForm });
  const [lineItems, setLineItems] = useState<PoLineInput[]>([{ itemId: "", quantity: 1, unitPrice: 0 }]);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [demandNotes, setDemandNotes] = useState<DemandNote[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const fetchRefs = useCallback(async () => {
    try {
      const [vRes, dRes, qRes, iRes] = await Promise.all([
        vendorService.findAll({ limit: 999, status: "ACTIVE" }),
        demandNoteService.findAll({ limit: 999 }),
        quotationService.findAll({ limit: 999 }),
        itemService.findAll({ limit: 9999 }),
      ]);
      setVendors(vRes.data);
      setDemandNotes(dRes.data);
      setQuotations(qRes.data);
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
    const nextPo = generateNextCodeFromRows("PO", data, (r) => r.poNumber);
    setForm({ ...defaultForm, poNumber: nextPo });
    setLineItems([{ itemId: "", quantity: 1, unitPrice: 0 }]);
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const fullCode = generateNextCodeFromRows("PO", full.data || [], (r) => r.poNumber);
      setForm((prev) => ({ ...prev, poNumber: prev.poNumber === nextPo ? fullCode : prev.poNumber }));
    }).catch(() => {});
  };

  const openEdit = (item: PurchaseOrder) => {
    setEditing(item);
    const existingLines: PoLineInput[] = (item.items || []).map((li) => ({
      itemId: li.itemId,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
    }));
    setLineItems(existingLines.length > 0 ? existingLines : [{ itemId: "", quantity: 1, unitPrice: 0 }]);
    const linesSub = existingLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    setForm({
      poNumber: item.poNumber || "",
      vendorId: item.vendorId || "",
      demandNoteId: item.demandNoteId || "",
      quotationId: item.quotationId || "",
      orderDate: toDateValue(item.orderDate),
      expectedDelivery: toDateValue(item.expectedDelivery),
      paymentTerms: item.paymentTerms || "",
      shippingCost: item.shippingCost != null ? String(item.shippingCost) : "",
      discountAmount: item.discountAmount != null ? String(item.discountAmount) : "",
      taxAmount: item.taxAmount != null ? String(item.taxAmount) : "",
      grandTotal: item.grandTotal != null ? String(item.grandTotal) : "",
      itemsSubtotal:
        existingLines.length > 0
          ? String(+linesSub.toFixed(2))
          : String(
              +(numOr0(item.grandTotal != null ? String(item.grandTotal) : "0")
                - numOr0(item.shippingCost != null ? String(item.shippingCost) : "0")
                + numOr0(item.discountAmount != null ? String(item.discountAmount) : "0")
                - numOr0(item.taxAmount != null ? String(item.taxAmount) : "0")).toFixed(2)
            ),
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const syncLineItems = (nextLines: PoLineInput[]) => {
    setLineItems(nextLines);
    const subtotal = nextLines.reduce(
      (s, l) => s + (l.itemId ? (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) : 0),
      0
    );
    updateCost("itemsSubtotal", String(+subtotal.toFixed(2)));
  };

  const updateLineItem = (idx: number, patch: Partial<PoLineInput>) => {
    const next = lineItems.map((row, i) => {
      if (i !== idx) return row;
      const updated = { ...row, ...patch };
      if (patch.itemId && patch.unitPrice === undefined) {
        const inv = inventoryItems.find((x) => x.id === patch.itemId);
        if (inv && inv.purchasePrice != null) {
          updated.unitPrice = inv.purchasePrice;
        }
      }
      return updated;
    });
    syncLineItems(next);
  };

  const addLineItem = () => {
    syncLineItems([...lineItems, { itemId: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeLineItem = (idx: number) => {
    if (lineItems.length <= 1) {
      syncLineItems([{ itemId: "", quantity: 1, unitPrice: 0 }]);
      return;
    }
    syncLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const updateCost = (key: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      const subtotal = numOr0(next.itemsSubtotal);
      const ship = numOr0(next.shippingCost);
      const disc = numOr0(next.discountAmount);
      const tax = numOr0(next.taxAmount);
      next.grandTotal = String(+(subtotal + ship - disc + tax).toFixed(2));
      return next;
    });
  };

  const columns: ColumnDef<PurchaseOrder>[] = [
    { accessorKey: "poNumber", header: "PO #" },
    {
      header: "Vendor",
      cell: ({ row }) => <span>{row.original.vendor?.name || row.original.vendorId || "-"}</span>,
    },
    {
      header: "Order Date",
      cell: ({ row }) => <span>{formatDate(row.original.orderDate)}</span>,
    },
    {
      header: "Expected Delivery",
      cell: ({ row }) => <span>{formatDate(row.original.expectedDelivery)}</span>,
    },
    {
      header: "Grand Total",
      cell: ({ row }) => <span className="font-medium">{formatAmount(row.original.grandTotal)}</span>,
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
              <DropdownMenuItem onClick={() => handleStatusUpdate(item, "PENDING")}>
                <Send className="h-4 w-4 mr-2" /> Submit
              </DropdownMenuItem>
            )}
            {item.status === "PENDING" && (
              <>
                <DropdownMenuItem onClick={() => handleStatusUpdate(item, "APPROVED")}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusUpdate(item, "REJECTED")}>
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </DropdownMenuItem>
              </>
            )}
            {item.status === "APPROVED" && (
              <DropdownMenuItem onClick={() => handleStatusUpdate(item, "COMPLETED")}>
                <CheckCheck className="h-4 w-4 mr-2" /> Mark Complete
              </DropdownMenuItem>
            )}
            {item.status !== "CANCELLED" && item.status !== "COMPLETED" && (
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
    if (!form.poNumber || !form.vendorId) {
      toast.error("PO Number and Vendor are required");
      return;
    }
    const validItems = lineItems.filter((l) => l.itemId);
    if (validItems.some((l) => l.quantity <= 0 || l.unitPrice < 0)) {
      toast.error("Each selected item must have quantity > 0 and unit price >= 0");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        poNumber: form.poNumber,
        vendorId: form.vendorId,
        demandNoteId: form.demandNoteId || undefined,
        quotationId: form.quotationId || undefined,
        orderDate: form.orderDate ? new Date(form.orderDate).toISOString() : undefined,
        expectedDelivery: form.expectedDelivery ? new Date(form.expectedDelivery).toISOString() : undefined,
        paymentTerms: form.paymentTerms || undefined,
        notes: form.notes || undefined,
        shippingCost: form.shippingCost ? parseFloat(form.shippingCost) : 0,
        discountAmount: form.discountAmount ? parseFloat(form.discountAmount) : 0,
        taxAmount: form.taxAmount ? parseFloat(form.taxAmount) : 0,
        grandTotal: form.grandTotal ? parseFloat(form.grandTotal) : 0,
        ...(validItems.length > 0
          ? {
              items: validItems.map((i) => ({
                itemId: i.itemId,
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
                totalPrice: Number((Number(i.quantity) * Number(i.unitPrice)).toFixed(2)),
              })),
            }
          : editing
          ? { items: [] }
          : {}),
        ...(editing ? { status: "DRAFT" } : {}),
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Purchase order updated");
      } else {
        await service.create(payload);
        toast.success("Purchase order created");
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

  const handleStatusUpdate = async (item: PurchaseOrder, status: string) => {
    try {
      await service.update(item.id, { status });
      toast.success(`Purchase order ${status.toLowerCase()}`);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await service.remove(deleteDialog.id);
      toast.success("Purchase order deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell title="Purchase Orders">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage purchase orders to vendors</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Purchase Order
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          meta={meta}
          onPageChange={(page) => setQuery({ ...query, page })}
          searchPlaceholder="Search purchase orders..."
        />

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Purchase Order" : "Add Purchase Order"}</DialogTitle>
              <DialogDescription>Fill in the purchase order details and line items below.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>PO Number *</Label>
                  <Input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} placeholder="e.g. PO-1001" required />
                </div>
                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="e.g. Net 30, Advance 50%" />
                </div>
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
              <div className="grid grid-cols-2 gap-4">
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
                  <Label>Quotation</Label>
                  <EntitySelect
                    value={form.quotationId}
                    onValueChange={(v) => setForm({ ...form, quotationId: v })}
                    entityLabel="Quotation"
                    quickAddType="quotation"
                    placeholder="Select quotation..."
                    allowNone
                    noneLabel="None (Optional)"
                    options={quotations.map((q) => ({ value: q.id, label: q.quotationNumber }))}
                    onQuickCreated={(created) => {
                      setQuotations((prev) => [created, ...prev]);
                      fetchRefs();
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Order Date</Label>
                  <Input type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Expected Delivery</Label>
                  <Input type="date" value={form.expectedDelivery} onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left p-2 font-medium">Item</th>
                        <th className="text-center p-2 font-medium w-24">Qty</th>
                        <th className="text-center p-2 font-medium w-28">Unit Price</th>
                        <th className="text-right p-2 font-medium w-28">Line Total</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((line, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="p-2 min-w-[200px]">
                            <EntitySelect
                              value={line.itemId}
                              onValueChange={(v) => updateLineItem(idx, { itemId: v })}
                              entityLabel="Item"
                              quickAddType="item"
                              placeholder="Select item..."
                              className="h-8 text-xs"
                              options={inventoryItems.map((it) => ({
                                value: it.id,
                                label: `${it.itemCode} — ${it.name}`,
                              }))}
                              onQuickCreated={(created) => {
                                setInventoryItems((prev) => [created, ...prev]);
                                fetchRefs();
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0.01"
                              step="any"
                              className="h-8 text-xs text-center"
                              value={line.quantity}
                              onChange={(e) => updateLineItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-8 text-xs text-center"
                              value={line.unitPrice}
                              onChange={(e) => updateLineItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-medium">
                            {(line.itemId ? line.quantity * line.unitPrice : 0).toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeLineItem(idx)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-2">
                  <Label>Items Subtotal</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.itemsSubtotal}
                    readOnly={lineItems.some((l) => Boolean(l.itemId))}
                    onChange={(e) => updateCost("itemsSubtotal", e.target.value)}
                    placeholder="Total of all item costs"
                    className={lineItems.some((l) => Boolean(l.itemId)) ? "bg-muted font-medium" : ""}
                  />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Shipping Cost</Label>
                  <Input type="number" step="0.01" min="0" value={form.shippingCost} onChange={(e) => updateCost("shippingCost", e.target.value)} placeholder="Freight / transport" />
                </div>
                <div className="space-y-2">
                  <Label>Discount</Label>
                  <Input type="number" step="0.01" min="0" value={form.discountAmount} onChange={(e) => updateCost("discountAmount", e.target.value)} placeholder="Amount deducted" />
                </div>
                <div className="space-y-2">
                  <Label>Tax Amount</Label>
                  <Input type="number" step="0.01" min="0" value={form.taxAmount} onChange={(e) => updateCost("taxAmount", e.target.value)} placeholder="Tax added on top" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Grand Total (auto)</Label>
                <Input type="number" step="0.01" value={form.grandTotal} readOnly disabled className="bg-muted font-medium" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any extra info (optional)" />
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
              <DialogTitle>Delete Purchase Order</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete PO <strong>{deleteDialog?.poNumber}</strong>? This action can be undone by restoring from archives.
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
