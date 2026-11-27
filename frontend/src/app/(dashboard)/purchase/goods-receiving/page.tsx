"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, Send,
  CheckCircle2, Ban, Package, X, Printer, Truck, FileText, ShieldCheck
} from "lucide-react";
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
import { generateGrnSlip } from "@/lib/reports/stores-reports";

interface GRN {
  id: string;
  grnNumber: string;
  poId: string | null;
  vendorId: string;
  warehouseId: string;
  receivedDate: string;
  receivedBy: string;
  notes: string;
  status: string;
  deliveryChallanNumber?: string | null;
  deliveryChallanDate?: string | null;
  supplierInvoiceNumber?: string | null;
  supplierInvoiceDate?: string | null;
  supplierInvoiceAmount?: number | null;
  gatePassNumber?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  departmentId?: string | null;
  costCenter?: string | null;
  inspectionStatus?: string | null;
  inspectionNotes?: string | null;
  inspectedBy?: string | null;
  inspectedAt?: string | null;
  vendor?: { id: string; name: string };
  po?: { id: string; poNumber: string };
  warehouse?: { id: string; name: string };
  items?: GRNItem[];
}

interface GRNItem {
  id: string;
  poItemId: string | null;
  itemId: string | null;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  rejectionReason: string | null;
  unitCost: number;
  lotNumber?: string | null;
  remarks?: string | null;
  item?: { id: string; itemCode: string; name: string };
}

interface Vendor { id: string; name: string; vendorCode?: string; }
interface PO {
  id: string;
  poNumber: string;
  vendorId?: string;
  items?: Array<{
    id: string;
    itemId: string;
    quantity: number;
    unitPrice: number;
    receivedQty?: number;
    item?: { id: string; itemCode: string; name: string };
  }>;
}
interface Warehouse { id: string; name: string; code: string; }
interface InventoryItem { id: string; itemCode: string; name: string; purchasePrice?: number; unit?: { name: string }; category?: { name: string }; }

interface GrnLineItem {
  poItemId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  orderedQty: number;
  alreadyReceived: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  rejectionReason: string;
  unitCost: number;
  lotNumber: string;
  remarks: string;
}

const defaultForm: Record<string, string> = {
  grnNumber: "",
  poId: "",
  vendorId: "",
  warehouseId: "",
  receivedDate: "",
  receivedBy: "",
  notes: "",
  deliveryChallanNumber: "",
  deliveryChallanDate: "",
  supplierInvoiceNumber: "",
  supplierInvoiceDate: "",
  supplierInvoiceAmount: "",
  gatePassNumber: "",
  vehicleNumber: "",
  driverName: "",
  driverPhone: "",
  departmentId: "",
  costCenter: "",
  inspectionStatus: "PASSED",
  inspectionNotes: "",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function toDateValue(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try { return new Date(dateStr).toISOString().split("T")[0]; } catch { return ""; }
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline", PENDING: "secondary", RECEIVED: "default", PARTIALLY_RECEIVED: "secondary", COMPLETED: "default", CANCELLED: "destructive",
};

export default function GoodsReceivingPage() {
  const service = createCrudService<GRN>("/purchase/goods-receiving");
  const poService = createCrudService<PO>("/purchase/orders");
  const vendorService = createCrudService<Vendor>("/purchase/vendors");
  const warehouseService = createCrudService<Warehouse>("/inventory/warehouses");
  const itemService = createCrudService<InventoryItem>("/inventory/items");

  const [data, setData] = useState<GRN[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GRN | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<GRN | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [isDirectGrn, setIsDirectGrn] = useState(false);
  const [pos, setPOs] = useState<PO[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [lineItems, setLineItems] = useState<GrnLineItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [newItemId, setNewItemId] = useState("");

  const fetchRefs = useCallback(async () => {
    try {
      const [pRes, vRes, wRes, iRes] = await Promise.all([
        poService.findAll({ limit: 999 }),
        vendorService.findAll({ limit: 999, status: "ACTIVE" }),
        warehouseService.findAll({ limit: 999, isActive: true }),
        itemService.findAll({ limit: 9999 }),
      ]);
      setPOs(pRes.data);
      setVendors(vRes.data);
      setWarehouses(wRes.data);
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
    setIsDirectGrn(false);
    const nextCode = generateNextCodeFromRows("GRN", data, (r) => r.grnNumber);
    setForm({
      ...defaultForm,
      grnNumber: nextCode,
      receivedDate: new Date().toISOString().split("T")[0],
    });
    setLineItems([]);
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const fullCode = generateNextCodeFromRows("GRN", full.data || [], (r) => r.grnNumber);
      setForm((prev) => ({
        ...prev,
        grnNumber: prev.grnNumber === nextCode ? fullCode : prev.grnNumber,
      }));
    }).catch(() => {});
  };

  const openEdit = (item: GRN) => {
    setEditing(item);
    setIsDirectGrn(!item.poId);
    setForm({
      grnNumber: item.grnNumber || "",
      poId: item.poId || "",
      vendorId: item.vendorId || "",
      warehouseId: item.warehouseId || "",
      receivedDate: toDateValue(item.receivedDate),
      receivedBy: item.receivedBy || "",
      notes: item.notes || "",
      deliveryChallanNumber: item.deliveryChallanNumber || "",
      deliveryChallanDate: toDateValue(item.deliveryChallanDate),
      supplierInvoiceNumber: item.supplierInvoiceNumber || "",
      supplierInvoiceDate: toDateValue(item.supplierInvoiceDate),
      supplierInvoiceAmount: item.supplierInvoiceAmount ? String(item.supplierInvoiceAmount) : "",
      gatePassNumber: item.gatePassNumber || "",
      vehicleNumber: item.vehicleNumber || "",
      driverName: item.driverName || "",
      driverPhone: item.driverPhone || "",
      departmentId: item.departmentId || "",
      costCenter: item.costCenter || "",
      inspectionStatus: item.inspectionStatus || "PASSED",
      inspectionNotes: item.inspectionNotes || "",
    });
    if (item.po && !pos.find((p) => p.id === item.poId)) setPOs((prev) => [...prev, item.po as PO]);
    if (item.vendor && !vendors.find((v) => v.id === item.vendorId)) setVendors((prev) => [...prev, item.vendor as Vendor]);

    const items: GrnLineItem[] = (item.items || []).map((i) => ({
      poItemId: i.poItemId || "",
      itemId: i.itemId || "",
      itemCode: i.item?.itemCode || "",
      itemName: i.item?.name || "",
      orderedQty: i.orderedQty,
      alreadyReceived: 0,
      receivedQty: i.receivedQty,
      acceptedQty: i.acceptedQty,
      rejectedQty: i.rejectedQty,
      rejectionReason: i.rejectionReason || "",
      unitCost: i.unitCost,
      lotNumber: i.lotNumber || "",
      remarks: i.remarks || "",
    }));
    setLineItems(items);
    setDialogOpen(true);
  };

  // Auto-populate line items when PO is selected
  const handlePoSelect = async (selectedPoId: string) => {
    setForm((prev) => ({ ...prev, poId: selectedPoId }));
    if (!selectedPoId) return;

    try {
      const fullPo = await poService.findOne(selectedPoId);
      if (fullPo) {
        if (fullPo.vendorId) {
          setForm((prev) => ({ ...prev, vendorId: fullPo.vendorId || prev.vendorId }));
        }
        if (fullPo.items && fullPo.items.length > 0) {
          const newLines: GrnLineItem[] = fullPo.items.map((pi: any) => {
            const pendingQty = Math.max(0, pi.quantity - (pi.receivedQty || 0));
            return {
              poItemId: pi.id,
              itemId: pi.itemId,
              itemCode: pi.item?.itemCode || "",
              itemName: pi.item?.name || "",
              orderedQty: pi.quantity,
              alreadyReceived: pi.receivedQty || 0,
              receivedQty: pendingQty,
              acceptedQty: pendingQty,
              rejectedQty: 0,
              rejectionReason: "",
              unitCost: pi.unitPrice || 0,
              lotNumber: "",
              remarks: "",
            };
          });
          setLineItems(newLines);
          toast.info(`Auto-populated ${newLines.length} items from PO`);
        }
      }
    } catch (err: any) {
      console.warn("Could not load PO details:", err);
    }
  };

  const updateLineItem = (index: number, field: keyof GrnLineItem, value: any) => {
    setLineItems((prev) => {
      const next = [...prev];
      const cur = { ...next[index], [field]: value };

      // Auto-balance received vs accepted + rejected if receivedQty changes
      if (field === "receivedQty") {
        const rQty = Number(value) || 0;
        cur.acceptedQty = Math.max(0, rQty - (cur.rejectedQty || 0));
      } else if (field === "acceptedQty") {
        const aQty = Number(value) || 0;
        if (aQty + cur.rejectedQty > cur.receivedQty) {
          cur.rejectedQty = Math.max(0, cur.receivedQty - aQty);
        }
      } else if (field === "rejectedQty") {
        const rejQty = Number(value) || 0;
        if (cur.acceptedQty + rejQty > cur.receivedQty) {
          cur.acceptedQty = Math.max(0, cur.receivedQty - rejQty);
        }
      }

      next[index] = cur;
      return next;
    });
  };

  const parseNumber = (raw: string, fallback: number = 0): number => {
    if (raw === "" || raw === ".") return 0;
    const n = parseFloat(raw);
    return isNaN(n) ? fallback : n;
  };

  const addLineItem = () => {
    const invItem = inventoryItems.find((i) => i.id === newItemId);
    if (!invItem) return;
    setLineItems((prev) => [
      ...prev,
      {
        poItemId: "",
        itemId: invItem.id,
        itemCode: invItem.itemCode,
        itemName: invItem.name,
        orderedQty: 0,
        alreadyReceived: 0,
        receivedQty: 0,
        acceptedQty: 0,
        rejectedQty: 0,
        rejectionReason: "",
        unitCost: invItem.purchasePrice ?? 0,
        lotNumber: "",
        remarks: "",
      },
    ]);
    setNewItemId("");
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePrint = (item: GRN) => {
    try {
      generateGrnSlip(item);
      toast.success(`GRN slip generated for ${item.grnNumber}`);
    } catch (err: any) {
      toast.error(`Failed to generate slip: ${err.message}`);
    }
  };

  const columns: ColumnDef<GRN>[] = [
    {
      accessorKey: "grnNumber",
      header: "GRN #",
      cell: ({ row }) => (
        <span className="font-semibold text-primary">{row.original.grnNumber}</span>
      ),
    },
    {
      header: "Procurement Type",
      cell: ({ row }) =>
        row.original.po?.poNumber ? (
          <div className="flex flex-col">
            <span className="font-medium text-xs text-foreground">{row.original.po.poNumber}</span>
            <span className="text-[10px] text-muted-foreground">PO-Linked</span>
          </div>
        ) : (
          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-300">
            Direct GRN
          </Badge>
        ),
    },
    {
      header: "Vendor",
      cell: ({ row }) => <span>{row.original.vendor?.name || row.original.vendorId || "-"}</span>,
    },
    {
      header: "Logistics",
      cell: ({ row }) => (
        <div className="text-xs space-y-0.5">
          {row.original.deliveryChallanNumber && (
            <div><span className="text-muted-foreground">DC:</span> {row.original.deliveryChallanNumber}</div>
          )}
          {row.original.gatePassNumber && (
            <div><span className="text-muted-foreground">GP:</span> {row.original.gatePassNumber}</div>
          )}
          {row.original.vehicleNumber && (
            <div><span className="text-muted-foreground">Veh:</span> {row.original.vehicleNumber}</div>
          )}
          {!row.original.deliveryChallanNumber && !row.original.gatePassNumber && !row.original.vehicleNumber && (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      header: "Items",
      cell: ({ row }) => <span>{row.original.items?.length || 0}</span>,
    },
    {
      header: "Received Date",
      cell: ({ row }) => <span>{formatDate(row.original.receivedDate)}</span>,
    },
    { accessorKey: "receivedBy", header: "Received By" },
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
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handlePrint(row.original)}>
              <Printer className="h-4 w-4 mr-2" /> Print GRN Slip
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.original.status === "DRAFT" && (
              <DropdownMenuItem onClick={() => handleStatusUpdate(row.original, "RECEIVED")}>
                <Send className="h-4 w-4 mr-2" /> Receive & Post
              </DropdownMenuItem>
            )}
            {row.original.status !== "COMPLETED" && row.original.status !== "CANCELLED" && (
              <DropdownMenuItem onClick={() => handleStatusUpdate(row.original, "COMPLETED")}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Complete
              </DropdownMenuItem>
            )}
            {row.original.status !== "CANCELLED" && (
              <DropdownMenuItem onClick={() => handleStatusUpdate(row.original, "CANCELLED")}>
                <Ban className="h-4 w-4 mr-2 text-destructive" /> Cancel & Reverse
              </DropdownMenuItem>
            )}
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
    if (!form.grnNumber) {
      toast.error("GRN Number is required");
      return;
    }
    if (!isDirectGrn && !form.poId) {
      toast.error("Please select a Purchase Order, or toggle to Direct GRN");
      return;
    }
    if (!form.vendorId) {
      toast.error("Vendor is required");
      return;
    }
    if (lineItems.length === 0) {
      toast.error("At least one item is required");
      return;
    }

    const invalidZeroOrNeg = lineItems.find((i) => i.receivedQty <= 0 || i.acceptedQty < 0 || i.rejectedQty < 0);
    if (invalidZeroOrNeg) {
      toast.error("Received quantity must be greater than 0, and accepted/rejected cannot be negative");
      return;
    }

    const overAccepted = lineItems.find((i) => i.acceptedQty + i.rejectedQty > i.receivedQty);
    if (overAccepted) {
      toast.error(`For ${overAccepted.itemName || "an item"}, Accepted + Rejected exceeds Received quantity`);
      return;
    }

    const missingReason = lineItems.find((i) => i.rejectedQty > 0 && !i.rejectionReason?.trim());
    if (missingReason) {
      toast.error(`Please provide a rejection reason for ${missingReason.itemName || "rejected items"}`);
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        grnNumber: form.grnNumber,
        poId: isDirectGrn ? undefined : form.poId || undefined,
        vendorId: form.vendorId,
        warehouseId: form.warehouseId || undefined,
        receivedDate: form.receivedDate ? new Date(form.receivedDate).toISOString() : new Date().toISOString(),
        receivedBy: form.receivedBy || undefined,
        notes: form.notes || undefined,
        status: editing ? undefined : "RECEIVED",
        deliveryChallanNumber: form.deliveryChallanNumber || undefined,
        deliveryChallanDate: form.deliveryChallanDate ? new Date(form.deliveryChallanDate).toISOString() : undefined,
        supplierInvoiceNumber: form.supplierInvoiceNumber || undefined,
        supplierInvoiceDate: form.supplierInvoiceDate ? new Date(form.supplierInvoiceDate).toISOString() : undefined,
        supplierInvoiceAmount: form.supplierInvoiceAmount ? parseFloat(form.supplierInvoiceAmount) : undefined,
        gatePassNumber: form.gatePassNumber || undefined,
        vehicleNumber: form.vehicleNumber || undefined,
        driverName: form.driverName || undefined,
        driverPhone: form.driverPhone || undefined,
        departmentId: form.departmentId || undefined,
        costCenter: form.costCenter || undefined,
        inspectionStatus: form.inspectionStatus || "PASSED",
        inspectionNotes: form.inspectionNotes || undefined,
        items: lineItems.map((i) => ({
          poItemId: isDirectGrn ? undefined : i.poItemId || undefined,
          itemId: i.itemId,
          orderedQty: i.orderedQty,
          receivedQty: i.receivedQty,
          acceptedQty: i.acceptedQty,
          rejectedQty: i.rejectedQty,
          rejectionReason: i.rejectedQty > 0 ? i.rejectionReason : undefined,
          unitCost: i.unitCost,
          lotNumber: i.lotNumber || undefined,
          remarks: i.remarks || undefined,
        })),
      };

      if (editing) {
        await service.update(editing.id, payload);
        toast.success("GRN updated");
      } else {
        await service.create(payload);
        toast.success("GRN created & stock posted to FIFO ledger");
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

  const handleStatusUpdate = async (item: GRN, status: string) => {
    try {
      await service.update(item.id, { status });
      toast.success(`GRN status changed to ${status}`);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await service.remove(deleteDialog.id);
      toast.success("GRN deleted");
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AppShell title="Goods Receiving">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Goods Receiving Notes (GRN)</h2>
            <p className="text-sm text-muted-foreground">
              Direct receiving, PO-linked receipts, paper trail documentation & FIFO stock intake
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add GRN
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          meta={meta}
          onPageChange={(page) => setQuery({ ...query, page })}
          searchPlaceholder="Search GRN, PO, vendor, challan..."
        />

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
          <DialogContent size="wide">
            <DialogHeader className="px-6 pt-5 pb-2 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg">
                    {editing ? `Edit GRN: ${form.grnNumber}` : "New Goods Receiving Note"}
                  </DialogTitle>
                  <DialogDescription>
                    Record physical stock arrival with complete delivery paperwork and multi-item inspection.
                  </DialogDescription>
                </div>
                {/* Receiving Mode Toggle */}
                {!editing && (
                  <div className="flex items-center bg-muted p-1 rounded-md text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => { setIsDirectGrn(false); }}
                      className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
                        !isDirectGrn ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      PO-Linked
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsDirectGrn(true); setForm((f) => ({ ...f, poId: "" })); }}
                      className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
                        isDirectGrn ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Direct GRN (Non-PO)
                    </button>
                  </div>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-5 px-6 py-4 overflow-y-auto min-h-0">
              {/* Primary Header Fields */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>GRN Number *</Label>
                  <Input
                    value={form.grnNumber}
                    placeholder="e.g. GRN-001"
                    onChange={(e) => setForm({ ...form, grnNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Received Date *</Label>
                  <Input
                    type="date"
                    value={form.receivedDate}
                    onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Warehouse *</Label>
                  <EntitySelect
                    value={form.warehouseId}
                    onValueChange={(v) => setForm({ ...form, warehouseId: v })}
                    entityLabel="Warehouse"
                    quickAddType="warehouse"
                    placeholder="Select warehouse..."
                    options={warehouses.map((w) => ({
                      value: w.id,
                      label: `${w.name} (${w.code})`,
                    }))}
                    onQuickCreated={(created) => {
                      setWarehouses((prev) => [created, ...prev]);
                      fetchRefs();
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {!isDirectGrn ? (
                  <div className="space-y-1.5">
                    <Label>Purchase Order *</Label>
                    <EntitySelect
                      value={form.poId}
                      onValueChange={(v) => handlePoSelect(v)}
                      entityLabel="Purchase Order"
                      quickAddType="purchaseOrder"
                      placeholder="Select PO..."
                      options={pos.map((p) => ({ value: p.id, label: p.poNumber }))}
                      onQuickCreated={(created) => {
                        setPOs((prev) => [created, ...prev]);
                        fetchRefs();
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Procurement Mode</Label>
                    <Input disabled value="Direct Receiving (No PO)" className="bg-muted text-muted-foreground" />
                  </div>
                )}

                <div className="space-y-1.5">
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

                <div className="space-y-1.5">
                  <Label>Received By</Label>
                  <Input
                    value={form.receivedBy}
                    placeholder="e.g. Storekeeper name"
                    onChange={(e) => setForm({ ...form, receivedBy: e.target.value })}
                  />
                </div>
              </div>

              {/* Logistics & Paperwork Collapsible Block */}
              <div className="border rounded-lg p-3 bg-slate-50/70 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <Truck className="h-4 w-4" />
                  <span>Logistics & Paperwork Tracking</span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-xs">Delivery Challan #</Label>
                    <Input
                      className="h-8 text-xs bg-white"
                      value={form.deliveryChallanNumber}
                      placeholder="DC-10928"
                      onChange={(e) => setForm({ ...form, deliveryChallanNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Challan Date</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs bg-white"
                      value={form.deliveryChallanDate}
                      onChange={(e) => setForm({ ...form, deliveryChallanDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gate Pass #</Label>
                    <Input
                      className="h-8 text-xs bg-white"
                      value={form.gatePassNumber}
                      placeholder="GP-IN-9921"
                      onChange={(e) => setForm({ ...form, gatePassNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vehicle #</Label>
                    <Input
                      className="h-8 text-xs bg-white"
                      value={form.vehicleNumber}
                      placeholder="LES-1234"
                      onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-xs">Driver Name</Label>
                    <Input
                      className="h-8 text-xs bg-white"
                      value={form.driverName}
                      placeholder="Driver Name"
                      onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Driver Phone</Label>
                    <Input
                      className="h-8 text-xs bg-white"
                      value={form.driverPhone}
                      placeholder="0300-1234567"
                      onChange={(e) => setForm({ ...form, driverPhone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Supplier Inv #</Label>
                    <Input
                      className="h-8 text-xs bg-white"
                      value={form.supplierInvoiceNumber}
                      placeholder="INV-551"
                      onChange={(e) => setForm({ ...form, supplierInvoiceNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cost Center / Dept</Label>
                    <Input
                      className="h-8 text-xs bg-white"
                      value={form.costCenter}
                      placeholder="CC-STORES-01"
                      onChange={(e) => setForm({ ...form, costCenter: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Quality Inspection Details */}
              <div className="border rounded-lg p-3 bg-emerald-50/40 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <ShieldCheck className="h-4 w-4" />
                  <span>QC & Quality Inspection</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Inspection Status</Label>
                    <Select
                      value={form.inspectionStatus}
                      onValueChange={(v: string | null) => setForm({ ...form, inspectionStatus: v ?? "PASSED" })}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PASSED">PASSED - Full Compliance</SelectItem>
                        <SelectItem value="PARTIAL_ACCEPTANCE">PARTIAL ACCEPTANCE - Deviations noted</SelectItem>
                        <SelectItem value="REJECTED">REJECTED - Non-conforming</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Inspection Notes</Label>
                    <Input
                      className="h-8 text-xs bg-white"
                      value={form.inspectionNotes}
                      placeholder="Verified yarn count, packaging seals, moisture percentage"
                      onChange={(e) => setForm({ ...form, inspectionNotes: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Received Line Items</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Accepted stock enters FIFO layers at designated Unit Cost
                  </span>
                </div>

                {lineItems.length > 0 && (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/60 border-b">
                          <th className="text-left p-2 font-medium">Item Details</th>
                          <th className="text-center p-2 font-medium">Ordered</th>
                          <th className="text-center p-2 font-medium">Received</th>
                          <th className="text-center p-2 font-medium">Accepted</th>
                          <th className="text-center p-2 font-medium">Rejected</th>
                          <th className="text-center p-2 font-medium">Unit Cost</th>
                          <th className="text-left p-2 font-medium">Rejection Reason / Remarks</th>
                          <th className="text-center p-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item, idx) => (
                          <tr key={item.poItemId || `item-${idx}`} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-2 min-w-[170px]">
                              <div className="font-medium text-foreground">{item.itemName || item.itemId}</div>
                              <div className="text-[10px] text-muted-foreground">{item.itemCode}</div>
                            </td>
                            <td className="p-2 text-center text-muted-foreground font-mono">
                              {item.orderedQty || "-"}
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={0}
                                className="h-7 w-16 text-center text-xs mx-auto"
                                value={item.receivedQty}
                                onChange={(e) => updateLineItem(idx, "receivedQty", parseNumber(e.target.value))}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={0}
                                className="h-7 w-16 text-center text-xs mx-auto text-emerald-700 font-semibold"
                                value={item.acceptedQty}
                                onChange={(e) => updateLineItem(idx, "acceptedQty", parseNumber(e.target.value))}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={0}
                                className={`h-7 w-16 text-center text-xs mx-auto ${item.rejectedQty > 0 ? "text-destructive font-semibold" : ""}`}
                                value={item.rejectedQty}
                                onChange={(e) => updateLineItem(idx, "rejectedQty", parseNumber(e.target.value))}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                className="h-7 w-20 text-center text-xs mx-auto"
                                value={item.unitCost}
                                onChange={(e) => updateLineItem(idx, "unitCost", parseNumber(e.target.value))}
                              />
                            </td>
                            <td className="p-2 min-w-[200px]">
                              {item.rejectedQty > 0 ? (
                                <Input
                                  className="h-7 text-xs border-destructive/50"
                                  placeholder="Reason for rejection (required)..."
                                  value={item.rejectionReason}
                                  onChange={(e) => updateLineItem(idx, "rejectionReason", e.target.value)}
                                />
                              ) : (
                                <Input
                                  className="h-7 text-xs"
                                  placeholder="Lot # / Remarks"
                                  value={item.lotNumber ? `Lot: ${item.lotNumber}` : item.remarks}
                                  onChange={(e) => updateLineItem(idx, "remarks", e.target.value)}
                                />
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeLineItem(idx)}
                                className="text-muted-foreground hover:text-destructive cursor-pointer"
                                title="Remove item"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add Item Row */}
                <div className="flex items-center gap-2 p-2 border border-dashed rounded-lg bg-muted/20">
                  <div className="w-[320px]">
                    <EntitySelect
                      value={newItemId}
                      onValueChange={(v) => setNewItemId(v)}
                      entityLabel="Item"
                      quickAddType="item"
                      placeholder="Add inventory item..."
                      className="h-8 text-xs"
                      options={inventoryItems.map((i) => ({
                        value: i.id,
                        label: `${i.itemCode} — ${i.name}`,
                      }))}
                      onQuickCreated={(created) => {
                        setInventoryItems((prev) => [created, ...prev]);
                        fetchRefs();
                      }}
                    />
                  </div>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={addLineItem} disabled={!newItemId}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Line Item
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes & Remarks</Label>
                <Textarea
                  value={form.notes}
                  rows={2}
                  placeholder="Additional delivery remarks or notes"
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="px-6 py-3 border-t bg-muted/10">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Posting..." : editing ? "Update GRN" : "Post GRN to Stock"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete GRN</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete GRN <strong>{deleteDialog?.grnNumber}</strong>?
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
