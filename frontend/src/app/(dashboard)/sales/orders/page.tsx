"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, CheckCircle2, Truck, Ban } from "lucide-react";
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
import { CreatedByCell } from "@/components/shared/created-by-cell";
import { EntitySelect } from "@/components/shared/entity-select";
import { generateNextCodeFromRows } from "@/lib/code-generator";
import { createCrudService, type QueryParams } from "@/lib/api/crud";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { AppShell } from "@/components/layouts/app-shell";

interface Customer {
  id: string;
  name: string;
  customerCode?: string;
}

interface InventoryItem {
  id: string;
  itemCode: string;
  name: string;
  sellingPrice?: number;
  purchasePrice?: number;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface SoLineInput {
  itemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface SalesOrderLineItem {
  id?: string;
  itemId?: string | null;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
}

interface SalesOrder {
  id: string;
  soNumber: string;
  customerId: string;
  orderDate: string;
  expectedDelivery: string;
  paymentTerms: string;
  shippingCost: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  notes: string;
  status: string;
  customerName?: string;
  items?: SalesOrderLineItem[];
}

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  DRAFT: { variant: "outline", label: "Draft" },
  PENDING: { variant: "outline", label: "Pending" },
  CONFIRMED: { variant: "default", label: "Confirmed" },
  PROCESSING: { variant: "default", label: "Processing" },
  SHIPPED: { variant: "outline", label: "Shipped" },
  DELIVERED: { variant: "secondary", label: "Delivered" },
  COMPLETED: { variant: "secondary", label: "Completed" },
  CANCELLED: { variant: "destructive", label: "Cancelled" },
};

const currencyFmt = (n: number) => "₨ " + (n || 0).toLocaleString("en-PK");

function num(v: string): number { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

export default function SalesOrdersPage() {
  const service = createCrudService<SalesOrder>("/sales/orders");
  const customerService = createCrudService<Customer>("/sales/customers");
  const itemService = createCrudService<InventoryItem>("/inventory/items");
  const warehouseService = createCrudService<Warehouse>("/inventory/warehouses");

  const [data, setData] = useState<SalesOrder[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SalesOrder | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<SalesOrder | null>(null);
  const [deliverDialog, setDeliverDialog] = useState<{ so: SalesOrder; warehouseId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [lineItems, setLineItems] = useState<SoLineInput[]>([
    { itemId: "", description: "", quantity: 1, unitPrice: 0 },
  ]);

  const [form, setForm] = useState({
    soNumber: "",
    customerId: "",
    orderDate: "",
    expectedDelivery: "",
    paymentTerms: "",
    itemsSubtotal: "0",
    shippingCost: "0",
    discountAmount: "0",
    taxAmount: "0",
    grandTotal: "0",
    notes: "",
  });

  const initForm = useCallback(() => ({
    soNumber: "",
    customerId: "",
    orderDate: "",
    expectedDelivery: "",
    paymentTerms: "",
    itemsSubtotal: "0",
    shippingCost: "0",
    discountAmount: "0",
    taxAmount: "0",
    grandTotal: "0",
    notes: "",
  }), []);

  const customersRef = useRef(customers);
  customersRef.current = customers;

  useEffect(() => {
    customerService.findAll({ limit: 200, status: "ACTIVE" }).then((res) => { setCustomers(res.data); }).catch(() => {});
    itemService.findAll({ limit: 9999 }).then((res) => { setInventoryItems(res.data); }).catch(() => {});
    warehouseService.findAll({ limit: 999, isActive: true }).then((res) => { setWarehouses(res.data); }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.findAll(query);
      const enriched = res.data.map((so) => ({
        ...so,
        customerName: customersRef.current.find((c) => c.id === so.customerId)?.name || so.customerId,
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
    const nextCode = generateNextCodeFromRows("SO", data, (r) => r.soNumber);
    setForm({
      ...initForm(),
      soNumber: nextCode,
      orderDate: new Date().toISOString().split("T")[0],
    });
    setLineItems([{ itemId: "", description: "", quantity: 1, unitPrice: 0 }]);
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const fullCode = generateNextCodeFromRows("SO", full.data || [], (r) => r.soNumber);
      setForm((prev) => ({
        ...prev,
        soNumber: prev.soNumber === nextCode ? fullCode : prev.soNumber,
      }));
    }).catch(() => {});
  };

  const updateCost = (key: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      const subtotal = num(next.itemsSubtotal);
      const ship = num(next.shippingCost);
      const disc = num(next.discountAmount);
      const tax = num(next.taxAmount);
      next.grandTotal = String(+(subtotal + ship - disc + tax).toFixed(2));
      return next;
    });
  };

  const syncLineItems = (nextLines: SoLineInput[]) => {
    setLineItems(nextLines);
    const subtotal = nextLines.reduce(
      (s, l) => s + ((l.itemId || l.description.trim()) ? (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) : 0),
      0
    );
    updateCost("itemsSubtotal", String(+subtotal.toFixed(2)));
  };

  const updateLineItem = (idx: number, patch: Partial<SoLineInput>) => {
    const next = lineItems.map((row, i) => {
      if (i !== idx) return row;
      const updated = { ...row, ...patch };
      if (patch.itemId) {
        const inv = inventoryItems.find((x) => x.id === patch.itemId);
        if (inv) {
          if (!row.description || row.itemId !== patch.itemId) {
            updated.description = inv.name;
          }
          if (patch.unitPrice === undefined) {
            updated.unitPrice = inv.sellingPrice ?? inv.purchasePrice ?? 0;
          }
        }
      }
      return updated;
    });
    syncLineItems(next);
  };

  const addLineItem = () => {
    syncLineItems([...lineItems, { itemId: "", description: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeLineItem = (idx: number) => {
    if (lineItems.length <= 1) {
      syncLineItems([{ itemId: "", description: "", quantity: 1, unitPrice: 0 }]);
      return;
    }
    syncLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] || { variant: "outline" as const, label: status };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const handleStatusAction = async (so: SalesOrder, action: string) => {
    if (action === "deliver") {
      setDeliverDialog({ so, warehouseId: warehouses[0]?.id || "" });
      return;
    }
    setActionLoading(so.id);
    try {
      if (action === 'confirm') await api.post(`/sales/orders/${so.id}/confirm`, {});
      else if (action === 'cancel') await service.update(so.id, { status: 'CANCELLED' });
      toast.success(`Order ${action === 'cancel' ? 'cancelled' : action + 'ed'}`);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmDeliver = async () => {
    if (!deliverDialog) return;
    if (!deliverDialog.warehouseId) {
      toast.error("Please select a warehouse for delivery");
      return;
    }
    setActionLoading(deliverDialog.so.id);
    try {
      await api.post(`/sales/orders/${deliverDialog.so.id}/deliver`, {
        warehouseId: deliverDialog.warehouseId,
      });
      toast.success(`Order ${deliverDialog.so.soNumber} delivered`);
      setDeliverDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const columns: ColumnDef<SalesOrder>[] = [
    { accessorKey: "soNumber", header: "SO Number" },
    { accessorKey: "customerName", header: "Customer" },
    { accessorKey: "orderDate", header: "Order Date" },
    {
      accessorKey: "grandTotal",
      header: "Grand Total",
      cell: ({ row }) => <span className="font-medium">{currencyFmt(row.original.grandTotal)}</span>,
    },
    {
      id: "discountAmount",
      header: "Discount",
      cell: ({ row }) => <span className="text-muted-foreground">{currencyFmt(row.original.discountAmount)}</span>,
    },
    {
      header: "Created By",
      cell: ({ row }) => <CreatedByCell creator={(row.original as any).createdByUser} />,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const so = row.original;
        return (
        <DropdownMenu>
          <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer" disabled={actionLoading === so.id}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => {
              setEditing(so);
              const existingLines: SoLineInput[] = (so.items || []).map((li) => ({
                itemId: li.itemId || "",
                description: li.description || "",
                quantity: li.quantity,
                unitPrice: li.unitPrice,
              }));
              setLineItems(existingLines.length > 0 ? existingLines : [{ itemId: "", description: "", quantity: 1, unitPrice: 0 }]);
              const linesSub = existingLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
              setForm({
                soNumber: so.soNumber || "",
                customerId: so.customerId || "",
                orderDate: so.orderDate ? String(so.orderDate).split("T")[0] : "",
                expectedDelivery: so.expectedDelivery ? String(so.expectedDelivery).split("T")[0] : "",
                paymentTerms: so.paymentTerms || "",
                itemsSubtotal: existingLines.length > 0 ? String(+linesSub.toFixed(2)) : "0",
                shippingCost: String(so.shippingCost || "0"),
                discountAmount: String(so.discountAmount || "0"),
                taxAmount: String(so.taxAmount || "0"),
                grandTotal: String(so.grandTotal || "0"),
                notes: so.notes || "",
              });
              setDialogOpen(true);
            }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {so.status !== 'CONFIRMED' && so.status !== 'DELIVERED' && so.status !== 'CANCELLED' && (
              <DropdownMenuItem onClick={() => handleStatusAction(so, 'confirm')}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm
              </DropdownMenuItem>
            )}
            {so.status === 'CONFIRMED' && (
              <DropdownMenuItem onClick={() => handleStatusAction(so, 'deliver')}>
                <Truck className="h-4 w-4 mr-2" /> Deliver
              </DropdownMenuItem>
            )}
            {so.status !== 'CANCELLED' && so.status !== 'DELIVERED' && (
              <DropdownMenuItem onClick={() => handleStatusAction(so, 'cancel')}>
                <Ban className="h-4 w-4 mr-2" /> Cancel
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(so)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        );
      },
    },
  ];

  const handleSave = async () => {
    if (!form.soNumber || !form.customerId) {
      toast.error("SO Number and Customer are required");
      return;
    }
    const validItems = lineItems.filter((l) => l.itemId || l.description.trim());
    if (validItems.some((l) => l.quantity <= 0 || l.unitPrice < 0)) {
      toast.error("Each item must have quantity > 0 and unit price >= 0");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        soNumber: form.soNumber,
        customerId: form.customerId,
        orderDate: form.orderDate ? new Date(form.orderDate).toISOString() : undefined,
        expectedDelivery: form.expectedDelivery ? new Date(form.expectedDelivery).toISOString() : undefined,
        paymentTerms: form.paymentTerms || undefined,
        notes: form.notes || undefined,
        shippingCost: num(form.shippingCost),
        discountAmount: num(form.discountAmount),
        taxAmount: num(form.taxAmount),
        grandTotal: num(form.grandTotal),
        ...(validItems.length > 0
          ? {
              items: validItems.map((i) => ({
                itemId: i.itemId || undefined,
                description: i.description || undefined,
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
                totalPrice: Number((Number(i.quantity) * Number(i.unitPrice)).toFixed(2)),
              })),
            }
          : editing
          ? { items: [] }
          : {}),
      };
      if (editing) {
        await service.update(editing.id, payload);
        toast.success("Sales order updated");
      } else {
        const res = await service.create(payload);
        if ((res as any)?.warning) {
          toast.warning((res as any).warning);
          return;
        }
        toast.success("Sales order created");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(initForm());
      setLineItems([{ itemId: "", description: "", quantity: 1, unitPrice: 0 }]);
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
      toast.success("Sales order deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell title="Sales Orders">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage sales orders and track order fulfillment</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Order
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditing(null);
                setForm(initForm());
                setLineItems([{ itemId: "", description: "", quantity: 1, unitPrice: 0 }]);
              }
            }}>
              <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Sales Order" : "Add Sales Order"}</DialogTitle>
                  <DialogDescription>Enter the sales order details and line items below.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SO Number *</Label>
                      <Input value={form.soNumber} placeholder="e.g. SO-1001" onChange={(e) => setForm({ ...form, soNumber: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Terms</Label>
                      <Input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="e.g. Net 30" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Customer *</Label>
                    <EntitySelect
                      value={form.customerId}
                      onValueChange={(val) => setForm({ ...form, customerId: val })}
                      entityLabel="Customer"
                      quickAddType="customer"
                      placeholder="Select customer..."
                      options={customers.map((c) => ({
                        value: c.id,
                        label: c.customerCode ? `${c.customerCode} — ${c.name}` : c.name,
                      }))}
                      onQuickCreated={(created) => {
                        setCustomers((prev) => [created, ...prev]);
                      }}
                    />
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
                            <th className="text-left p-2 font-medium">Description</th>
                            <th className="text-center p-2 font-medium w-20">Qty</th>
                            <th className="text-center p-2 font-medium w-24">Unit Price</th>
                            <th className="text-right p-2 font-medium w-24">Line Total</th>
                            <th className="p-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((line, idx) => (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="p-2 min-w-[180px]">
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
                                  }}
                                />
                              </td>
                              <td className="p-2 min-w-[140px]">
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="Description"
                                  value={line.description}
                                  onChange={(e) => updateLineItem(idx, { description: e.target.value })}
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
                                {((line.itemId || line.description.trim()) ? line.quantity * line.unitPrice : 0).toFixed(2)}
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
                      readOnly={lineItems.some((l) => Boolean(l.itemId || l.description.trim()))}
                      onChange={(e) => updateCost("itemsSubtotal", e.target.value)}
                      placeholder="Subtotal"
                      className={lineItems.some((l) => Boolean(l.itemId || l.description.trim())) ? "bg-muted font-medium" : ""}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Shipping Cost</Label>
                      <Input type="number" step="0.01" min="0" value={form.shippingCost} onChange={(e) => updateCost("shippingCost", e.target.value)} placeholder="Freight" />
                    </div>
                    <div className="space-y-2">
                      <Label>Discount</Label>
                      <Input type="number" step="0.01" min="0" value={form.discountAmount} onChange={(e) => updateCost("discountAmount", e.target.value)} placeholder="Amount deducted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Tax Amount</Label>
                      <Input type="number" step="0.01" min="0" value={form.taxAmount} onChange={(e) => updateCost("taxAmount", e.target.value)} placeholder="Tax added" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Grand Total (auto-calculated)</Label>
                    <Input type="number" step="0.01" value={form.grandTotal} readOnly disabled className="bg-muted font-medium" />
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
          searchPlaceholder="Search sales orders..."
        />

        <Dialog open={!!deliverDialog} onOpenChange={(o) => { if (!o) setDeliverDialog(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deliver Sales Order</DialogTitle>
              <DialogDescription>
                Select the warehouse to dispatch stock for <strong>{deliverDialog?.so.soNumber}</strong>.
              </DialogDescription>
            </DialogHeader>
            {deliverDialog && (
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label>Dispatch Warehouse *</Label>
                  <EntitySelect
                    value={deliverDialog.warehouseId}
                    onValueChange={(val) =>
                      setDeliverDialog({ ...deliverDialog, warehouseId: val })
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
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeliverDialog(null)}>Cancel</Button>
              <Button onClick={handleConfirmDeliver} disabled={!!actionLoading}>
                {actionLoading ? "Delivering..." : "Confirm Delivery"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Sales Order</DialogTitle>
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
