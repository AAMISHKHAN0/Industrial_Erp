"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, MoreHorizontal, RefreshCw, Undo2, Package, X, ArrowLeftRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
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
import { AppShell } from "@/components/layouts/app-shell";

interface PurchaseReturn {
  id: string;
  returnNumber: string;
  vendorId: string;
  warehouseId: string;
  grnId: string | null;
  gatePassNumber: string | null;
  reason: string | null;
  totalAmount: number;
  returnDate: string;
  status: string;
  vendor?: { id: string; name: string };
  warehouse?: { id: string; name: string };
  grn?: { id: string; grnNumber: string };
  items?: PurchaseReturnItem[];
}

interface PurchaseReturnItem {
  id?: string;
  itemId: string;
  quantity: number;
  unitCost: number;
  reason?: string | null;
  item?: { id: string; itemCode: string; name: string };
}

interface Vendor { id: string; name: string; vendorCode?: string; }
interface Warehouse { id: string; name: string; code: string; }
interface GRN {
  id: string;
  grnNumber: string;
  vendorId: string;
  warehouseId: string;
  items?: Array<{
    id: string;
    itemId: string;
    acceptedQty: number;
    unitCost: number;
    item?: { id: string; itemCode: string; name: string };
  }>;
}

interface ReturnLineInput {
  itemId: string;
  itemCode: string;
  itemName: string;
  maxReturnable?: number;
  quantity: number;
  unitCost: number;
  reason: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmt(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "0.00";
  return Number(val).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchaseReturnsPage() {
  const service = createCrudService<PurchaseReturn>("/purchase/returns");
  const vendorService = createCrudService<Vendor>("/purchase/vendors");
  const warehouseService = createCrudService<Warehouse>("/inventory/warehouses");
  const grnService = createCrudService<GRN>("/purchase/goods-receiving");
  const itemService = createCrudService<any>("/inventory/items");

  const [data, setData] = useState<PurchaseReturn[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [items, setItems] = useState<any[]>([]);

  // Form State
  const [returnNumber, setReturnNumber] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedGrnId, setSelectedGrnId] = useState("");
  const [gatePassNumber, setGatePassNumber] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<ReturnLineInput[]>([]);

  const fetchRefs = useCallback(async () => {
    try {
      const [vRes, wRes, gRes, iRes] = await Promise.all([
        vendorService.findAll({ limit: 999, status: "ACTIVE" }),
        warehouseService.findAll({ limit: 999, isActive: true }),
        grnService.findAll({ limit: 999 }),
        itemService.findAll({ limit: 500, status: "ACTIVE" }),
      ]);
      setVendors(vRes.data);
      setWarehouses(wRes.data);
      setGrns(gRes.data);
      setItems(iRes.data);
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
    const nextCode = generateNextCodeFromRows("RET", data, (r) => r.returnNumber);
    const nextGp = generateNextCodeFromRows("GP-OUT", data, (r) => r.gatePassNumber);
    setReturnNumber(nextCode);
    setSelectedVendorId("");
    setSelectedWarehouseId(warehouses[0]?.id || "");
    setSelectedGrnId("");
    setGatePassNumber(nextGp);
    setReason("");
    setLines([]);
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const rows = full.data || [];
      const fullCode = generateNextCodeFromRows("RET", rows, (r) => r.returnNumber);
      const fullGp = generateNextCodeFromRows("GP-OUT", rows, (r) => r.gatePassNumber);
      setReturnNumber((prev) => (prev === nextCode ? fullCode : prev));
      setGatePassNumber((prev) => (prev === nextGp ? fullGp : prev));
    }).catch(() => {});
  };

  const handleGrnSelect = async (grnId: string) => {
    setSelectedGrnId(grnId);
    if (!grnId) return;

    try {
      const fullGrn = await grnService.findOne(grnId);
      if (fullGrn) {
        if (fullGrn.vendorId) setSelectedVendorId(fullGrn.vendorId);
        if (fullGrn.warehouseId) setSelectedWarehouseId(fullGrn.warehouseId);

        const returnLines: ReturnLineInput[] = (fullGrn.items || []).map((i: any) => ({
          itemId: i.itemId,
          itemCode: i.item?.itemCode || "",
          itemName: i.item?.name || "",
          maxReturnable: i.acceptedQty || i.receivedQty || 0,
          quantity: 0,
          unitCost: i.unitCost || 0,
          reason: "Defective / Rejection",
        }));
        setLines(returnLines);
        toast.info(`Loaded ${returnLines.length} items from ${fullGrn.grnNumber}`);
      }
    } catch (err: any) {
      toast.error(`Error loading GRN items: ${err.message}`);
    }
  };

  const addManualLine = () => {
    setLines((prev) => [
      ...prev,
      {
        itemId: "",
        itemCode: "",
        itemName: "",
        quantity: 1,
        unitCost: 0,
        reason: "Defective / Rejection",
      },
    ]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof ReturnLineInput, val: any) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleSave = async () => {
    if (!returnNumber || !selectedVendorId || !selectedWarehouseId) {
      toast.error("Return #, Vendor, and Warehouse are required");
      return;
    }
    const itemsToReturn = lines.filter((l) => l.itemId && l.quantity > 0);
    if (itemsToReturn.length === 0) {
      toast.error("Please select an item and enter a return quantity greater than 0");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        returnNumber,
        vendorId: selectedVendorId,
        warehouseId: selectedWarehouseId,
        grnId: selectedGrnId || undefined,
        gatePassNumber: gatePassNumber || undefined,
        reason: reason || undefined,
        items: itemsToReturn.map((i) => ({
          itemId: i.itemId,
          quantity: i.quantity,
          unitCost: i.unitCost,
          reason: i.reason || undefined,
        })),
      };

      await service.create(payload);
      toast.success("Vendor return created & Dr GRNI/AP / Cr INVENTORY posted");
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<PurchaseReturn>[] = [
    {
      accessorKey: "returnNumber",
      header: "Return #",
      cell: ({ row }) => <span className="font-semibold text-primary">{row.original.returnNumber}</span>,
    },
    {
      header: "Vendor",
      cell: ({ row }) => <span>{row.original.vendor?.name || "-"}</span>,
    },
    {
      header: "GRN Reference",
      cell: ({ row }) => <span>{row.original.grn?.grnNumber || "-"}</span>,
    },
    {
      header: "Gate Pass #",
      cell: ({ row }) => <span>{row.original.gatePassNumber || "-"}</span>,
    },
    {
      header: "Warehouse",
      cell: ({ row }) => <span>{row.original.warehouse?.name || "-"}</span>,
    },
    {
      header: "Total Credit",
      cell: ({ row }) => <span className="font-semibold text-amber-700">PKR {fmt(row.original.totalAmount)}</span>,
    },
    {
      header: "Return Date",
      cell: ({ row }) => <span>{formatDate(row.original.returnDate)}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="default" className="bg-slate-700">
          {row.original.status || "POSTED"}
        </Badge>
      ),
    },
  ];

  return (
    <AppShell title="Vendor Returns">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Purchase Returns & Debit Slips</h2>
            <p className="text-sm text-muted-foreground">
              Return non-conforming goods to vendors with downstream consumption verification
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> New Vendor Return
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          meta={meta}
          onPageChange={(page) => setQuery({ ...query, page })}
          searchPlaceholder="Search Return #, vendor, GRN..."
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent size="wide">
            <DialogHeader className="px-6 pt-5 pb-2 border-b">
              <DialogTitle className="text-lg">Create Vendor Purchase Return</DialogTitle>
              <DialogDescription>
                Select GRN to auto-load inward items and reduce active FIFO layers.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-6 py-4 overflow-y-auto min-h-0">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Return # *</Label>
                  <Input value={returnNumber} onChange={(e) => setReturnNumber(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>GRN Source (Optional)</Label>
                  <EntitySelect
                    value={selectedGrnId}
                    onValueChange={(v) => handleGrnSelect(v)}
                    entityLabel="GRN"
                    placeholder="Select GRN..."
                    allowNone
                    noneLabel="None (Optional)"
                    options={grns.map((g) => ({ value: g.id, label: g.grnNumber }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Vendor *</Label>
                  <EntitySelect
                    value={selectedVendorId}
                    onValueChange={setSelectedVendorId}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Warehouse *</Label>
                  <EntitySelect
                    value={selectedWarehouseId}
                    onValueChange={setSelectedWarehouseId}
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
                <div className="space-y-1.5">
                  <Label>Outward Gate Pass #</Label>
                  <Input value={gatePassNumber} onChange={(e) => setGatePassNumber(e.target.value)} />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Return Line Items</span>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addManualLine}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                  </Button>
                </div>

                {lines.length > 0 ? (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/60 border-b">
                          <th className="text-left p-2 font-medium">Item</th>
                          <th className="text-center p-2 font-medium">Max Returnable</th>
                          <th className="text-center p-2 font-medium">Return Qty</th>
                          <th className="text-center p-2 font-medium">Unit Cost</th>
                          <th className="text-left p-2 font-medium">Defect / Reason</th>
                          <th className="w-8 p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((item, idx) => (
                          <tr key={`${item.itemId}-${idx}`} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-2 min-w-[200px]">
                              {selectedGrnId && item.itemName ? (
                                <>
                                  <div className="font-medium text-foreground">{item.itemName}</div>
                                  <div className="text-[10px] text-muted-foreground">{item.itemCode}</div>
                                </>
                              ) : (
                                <EntitySelect
                                  value={item.itemId}
                                  onValueChange={(val) => {
                                    const found = items.find((i) => i.id === val);
                                    setLines((prev) => {
                                      const next = [...prev];
                                      next[idx] = {
                                        ...next[idx],
                                        itemId: val,
                                        itemCode: found?.itemCode || "",
                                        itemName: found?.name || "",
                                        unitCost: Number(found?.purchasePrice) || next[idx].unitCost || 0,
                                      };
                                      return next;
                                    });
                                  }}
                                  entityLabel="Item"
                                  quickAddType="item"
                                  placeholder="Select item..."
                                  options={items.map((i) => ({
                                    value: i.id,
                                    label: i.itemCode ? `${i.itemCode} — ${i.name}` : i.name,
                                  }))}
                                  onQuickCreated={(created) => {
                                    setItems((prev) => [created, ...prev]);
                                    setLines((prev) => {
                                      const next = [...prev];
                                      next[idx] = {
                                        ...next[idx],
                                        itemId: created.id,
                                        itemCode: created.itemCode || "",
                                        itemName: created.name || "",
                                        unitCost: Number(created.purchasePrice) || 0,
                                      };
                                      return next;
                                    });
                                  }}
                                />
                              )}
                            </td>
                            <td className="p-2 text-center font-mono text-muted-foreground">
                              {item.maxReturnable ?? "-"}
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={0}
                                max={item.maxReturnable}
                                className="h-7 w-20 text-center text-xs mx-auto"
                                value={item.quantity}
                                onChange={(e) => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                className="h-7 w-20 text-center text-xs mx-auto"
                                value={item.unitCost}
                                onChange={(e) => updateLine(idx, "unitCost", parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                className="h-7 text-xs"
                                value={item.reason}
                                onChange={(e) => updateLine(idx, "reason", e.target.value)}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => removeLine(idx)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic border rounded p-3">
                    Select a GRN above or click <strong>Add Item</strong> to specify items to return.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Return Reason & Defect Report</Label>
                <Textarea
                  value={reason}
                  rows={2}
                  placeholder="Detailed explanation of reason for return to vendor"
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="px-6 py-3 border-t bg-muted/10">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || lines.length === 0}>
                {saving ? "Posting..." : "Confirm & Post Return"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
