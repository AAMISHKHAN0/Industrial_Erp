"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, MoreHorizontal, RefreshCw, Printer, Package, Layers, CheckCircle2, AlertCircle
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
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { AppShell } from "@/components/layouts/app-shell";
import { generateMaterialIssueSlip } from "@/lib/reports/stores-reports";

interface MaterialIssue {
  id: string;
  issueNumber: string;
  demandNoteId: string | null;
  warehouseId: string;
  departmentId: string | null;
  costCenter: string | null;
  issuedTo: string | null;
  totalCost?: number;
  totalAmount?: number;
  issueDate: string;
  status: string;
  notes: string | null;
  demandNote?: { id: string; demandNumber: string; department?: { name: string } };
  warehouse?: { id: string; name: string };
  items?: MaterialIssueItem[];
}

interface MaterialIssueItem {
  id: string;
  itemId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  fifoLayerId?: string | null;
  item?: { id: string; itemCode: string; name: string; unit?: { code: string } };
}

interface DemandNote {
  id: string;
  demandNumber: string;
  departmentId?: string;
  costCenter?: string;
  requestedBy?: string;
  status: string;
  department?: { id: string; name: string };
  items?: Array<{
    id: string;
    itemId: string;
    quantity: number;
    issuedQty: number;
    item?: { id: string; itemCode: string; name: string; unit?: { code: string } };
  }>;
}

interface Warehouse { id: string; name: string; code: string; }

interface FifoLayer {
  id: string;
  receiptDate: string;
  sequence: number;
  remainingQty: number;
  unitCost: number;
  trackedValue: number;
}

interface IssueLineInput {
  demandNoteItemId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  authorizedQty: number;
  alreadyIssued: number;
  issueQty: number;
  availableStock: number;
  layers: FifoLayer[];
  remarks: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmt(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "0.00";
  return Number(val).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MaterialIssuePage() {
  const service = createCrudService<MaterialIssue>("/inventory/material-issue");
  const demandService = createCrudService<DemandNote>("/purchase/demand-notes");
  const warehouseService = createCrudService<Warehouse>("/inventory/warehouses");
  const itemService = createCrudService<any>("/inventory/items");

  const [data, setData] = useState<MaterialIssue[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [approvedDemands, setApprovedDemands] = useState<DemandNote[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<any[]>([]);

  // Form State
  const [issueNumber, setIssueNumber] = useState("");
  const [selectedDemandId, setSelectedDemandId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<IssueLineInput[]>([]);

  const fetchRefs = useCallback(async () => {
    try {
      const [dRes, wRes, iRes] = await Promise.all([
        demandService.findAll({ limit: 999 }),
        warehouseService.findAll({ limit: 999, isActive: true }),
        itemService.findAll({ limit: 500, status: "ACTIVE" }),
      ]);
      // Filter for approved / partially issued demand notes
      setApprovedDemands(
        dRes.data.filter((d) => d.status === "APPROVED" || d.status === "PARTIALLY_ISSUED")
      );
      setWarehouses(wRes.data);
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
    const nextCode = generateNextCodeFromRows("ISS", data, (r) => r.issueNumber);
    setIssueNumber(nextCode);
    setSelectedDemandId("");
    setSelectedWarehouseId(warehouses[0]?.id || "");
    setIssuedTo("");
    setCostCenter("");
    setNotes("");
    setLines([]);
    setDialogOpen(true);
    service.findAll({ limit: 500 }).then((full) => {
      const fullCode = generateNextCodeFromRows("ISS", full.data || [], (r) => r.issueNumber);
      setIssueNumber((prev) => (prev === nextCode ? fullCode : prev));
    }).catch(() => {});
  };

  // When Demand Note or Warehouse changes, load items and query live FIFO layers
  const handleDemandChange = async (demandId: string, warehouseId: string) => {
    setSelectedDemandId(demandId);
    if (!demandId) {
      setLines([]);
      return;
    }

    try {
      const dn = await demandService.findOne(demandId);
      if (!dn) return;

      setIssuedTo(dn.requestedBy || "");
      setCostCenter(dn.costCenter || "");

      const wId = warehouseId || selectedWarehouseId;
      const initialLines: IssueLineInput[] = [];

      for (const item of dn.items || []) {
        const pending = Math.max(0, item.quantity - (item.issuedQty || 0));
        let layers: FifoLayer[] = [];
        let availableStock = 0;

        if (wId) {
          try {
            const fifoData = await api.get<any[]>(
              `/inventory/stock/fifo-layers?itemId=${item.itemId}&warehouseId=${wId}`
            );
            layers = fifoData || [];
            availableStock = layers.reduce((s, l) => s + Number(l.remainingQty), 0);
          } catch (err) {
            console.warn("Could not fetch FIFO preview:", err);
          }
        }

        initialLines.push({
          demandNoteItemId: item.id,
          itemId: item.itemId,
          itemCode: item.item?.itemCode || "",
          itemName: item.item?.name || "",
          unit: item.item?.unit?.code || "Unit",
          authorizedQty: item.quantity,
          alreadyIssued: item.issuedQty || 0,
          issueQty: Math.min(pending, availableStock),
          availableStock,
          layers,
          remarks: "",
        });
      }

      setLines(initialLines);
    } catch (err: any) {
      toast.error(`Error loading demand note: ${err.message}`);
    }
  };

  const handleWarehouseChange = async (wId: string) => {
    setSelectedWarehouseId(wId);
    if (selectedDemandId) {
      handleDemandChange(selectedDemandId, wId);
    } else if (lines.length > 0 && wId) {
      const updated = await Promise.all(
        lines.map(async (line) => {
          if (!line.itemId) return line;
          try {
            const fifoData = await api.get<any[]>(
              `/inventory/stock/fifo-layers?itemId=${line.itemId}&warehouseId=${wId}`
            );
            const layers = fifoData || [];
            const availableStock = layers.reduce((s, l) => s + Number(l.remainingQty), 0);
            return { ...line, layers, availableStock };
          } catch {
            return line;
          }
        })
      );
      setLines(updated);
    }
  };

  const addManualLine = () => {
    setLines((prev) => [
      ...prev,
      {
        itemId: "",
        itemCode: "",
        itemName: "",
        unit: "Unit",
        authorizedQty: 0,
        alreadyIssued: 0,
        issueQty: 1,
        availableStock: 0,
        layers: [],
        remarks: "",
      },
    ]);
  };

  const updateManualLineItem = async (idx: number, itemId: string, createdItem?: any) => {
    const found = createdItem || items.find((i) => i.id === itemId);
    let layers: FifoLayer[] = [];
    let availableStock = 0;
    if (itemId && selectedWarehouseId) {
      try {
        const fifoData = await api.get<any[]>(
          `/inventory/stock/fifo-layers?itemId=${itemId}&warehouseId=${selectedWarehouseId}`
        );
        layers = fifoData || [];
        availableStock = layers.reduce((s, l) => s + Number(l.remainingQty), 0);
      } catch {}
    }
    setLines((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        itemId,
        itemCode: found?.itemCode || "",
        itemName: found?.name || "",
        availableStock,
        layers,
        issueQty: availableStock > 0 ? Math.min(next[idx].issueQty || 1, availableStock) : next[idx].issueQty || 1,
      };
      return next;
    });
  };

  const updateLineQty = (idx: number, qty: number) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], issueQty: qty };
      return next;
    });
  };

  const handlePrint = (item: MaterialIssue) => {
    try {
      generateMaterialIssueSlip(item);
      toast.success(`Material issue slip generated for ${item.issueNumber}`);
    } catch (err: any) {
      toast.error(`Print error: ${err.message}`);
    }
  };

  const handleSave = async () => {
    if (!issueNumber) {
      toast.error("Issue Number is required");
      return;
    }
    if (!selectedWarehouseId) {
      toast.error("Please select an issuing Warehouse");
      return;
    }

    const itemsToIssue = lines.filter((l) => l.itemId && l.issueQty > 0);
    if (itemsToIssue.length === 0) {
      toast.error("Please add at least one item with issue quantity greater than 0");
      return;
    }

    for (const item of itemsToIssue) {
      if (item.demandNoteItemId) {
        const maxAllowed = item.authorizedQty - item.alreadyIssued;
        if (item.issueQty > maxAllowed) {
          toast.error(`Cannot issue ${item.issueQty} of ${item.itemName}; maximum remaining authorized is ${maxAllowed}`);
          return;
        }
      }
      if (item.issueQty > item.availableStock) {
        toast.error(`Insufficient stock for ${item.itemName || "selected item"} in selected warehouse (available: ${item.availableStock})`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        issueNumber,
        demandNoteId: selectedDemandId || undefined,
        warehouseId: selectedWarehouseId,
        issuedTo: issuedTo || undefined,
        costCenter: costCenter || undefined,
        notes: notes || undefined,
        items: itemsToIssue.map((i) => ({
          demandNoteItemId: i.demandNoteItemId || undefined,
          itemId: i.itemId,
          quantity: i.issueQty,
          remarks: i.remarks || undefined,
        })),
      };

      await api.post("/inventory/material-issue", payload);

      toast.success("Material issued successfully & FIFO layers consumed");
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<MaterialIssue>[] = [
    {
      accessorKey: "issueNumber",
      header: "Issue #",
      cell: ({ row }) => (
        <span className="font-semibold text-primary">{row.original.issueNumber}</span>
      ),
    },
    {
      header: "Demand Note",
      cell: ({ row }) => <span>{row.original.demandNote?.demandNumber || "-"}</span>,
    },
    {
      header: "Warehouse",
      cell: ({ row }) => <span>{row.original.warehouse?.name || row.original.warehouseId}</span>,
    },
    {
      header: "Issued To / Cost Center",
      cell: ({ row }) => (
        <div className="text-xs">
          <div>{row.original.issuedTo || "-"}</div>
          {row.original.costCenter && (
            <div className="text-muted-foreground">{row.original.costCenter}</div>
          )}
        </div>
      ),
    },
    {
      header: "Items",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          {row.original.items?.length || 0} items
        </Badge>
      ),
    },
    {
      header: "Total Cost",
      cell: ({ row }) => (
        <span className="font-semibold text-foreground">
          PKR {fmt(row.original.totalCost ?? row.original.totalAmount)}
        </span>
      ),
    },
    {
      header: "Issue Date",
      cell: ({ row }) => <span>{formatDate(row.original.issueDate)}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="default" className="bg-emerald-600">
          {row.original.status || "POSTED"}
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
            <DropdownMenuItem onClick={() => handlePrint(row.original)}>
              <Printer className="h-4 w-4 mr-2" /> Print Issue Slip
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <AppShell title="Material Issue">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Material Issues & Stock Dispatch</h2>
            <p className="text-sm text-muted-foreground">
              Issue raw materials against approved demand notes with atomic FIFO layer consumption
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Issue Material
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          meta={meta}
          onPageChange={(page) => setQuery({ ...query, page })}
          searchPlaceholder="Search Issue #, Demand #, Warehouse..."
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent size="wide">
            <DialogHeader className="px-6 pt-5 pb-2 border-b">
              <DialogTitle className="text-lg">Issue Materials from Warehouse</DialogTitle>
              <DialogDescription>
                Select an approved Demand Note to auto-load requested items and preview oldest FIFO layers.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-6 py-4 overflow-y-auto min-h-0">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Issue # *</Label>
                  <Input value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Approved Demand Note (Optional)</Label>
                  <EntitySelect
                    value={selectedDemandId}
                    onValueChange={(v) => handleDemandChange(v, selectedWarehouseId)}
                    entityLabel="Demand Note"
                    quickAddType="demandNote"
                    allowNone
                    noneLabel="Direct Issue (No Demand Note)"
                    placeholder="Select demand note..."
                    options={approvedDemands.map((d) => ({
                      value: d.id,
                      label: `${d.demandNumber} — ${d.department?.name || "Dept"} (${d.items?.length || 0} items)`,
                    }))}
                    onQuickCreated={(created) => {
                      setApprovedDemands((prev) => [created, ...prev]);
                      fetchRefs();
                      if (created?.id) handleDemandChange(created.id, selectedWarehouseId);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Issuing Warehouse *</Label>
                  <EntitySelect
                    value={selectedWarehouseId}
                    onValueChange={(v) => handleWarehouseChange(v)}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Issued To / Recipient</Label>
                  <Input
                    value={issuedTo}
                    placeholder="e.g. Production Supervisor"
                    onChange={(e) => setIssuedTo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cost Center</Label>
                  <Input
                    value={costCenter}
                    placeholder="CC-WEAVING-01"
                    onChange={(e) => setCostCenter(e.target.value)}
                  />
                </div>
              </div>

              {/* Items & FIFO Layer Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Demand Items & FIFO Allocation Preview</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Oldest FIFO layers are consumed first</span>
                    <Button type="button" variant="outline" size="sm" onClick={addManualLine}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                    </Button>
                  </div>
                </div>

                {lines.length > 0 ? (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/60 border-b">
                          <th className="text-left p-2 font-medium">Item</th>
                          <th className="text-center p-2 font-medium">Authorized</th>
                          <th className="text-center p-2 font-medium">Prev Issued</th>
                          <th className="text-center p-2 font-medium">Avail Stock</th>
                          <th className="text-center p-2 font-medium">Issue Qty</th>
                          <th className="text-left p-2 font-medium">Live FIFO Layer Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, idx) => {
                          const maxRemaining = line.demandNoteItemId
                            ? line.authorizedQty - line.alreadyIssued
                            : Math.max(line.availableStock, 0);
                          const hasStock = line.availableStock >= line.issueQty;

                          return (
                            <tr key={line.demandNoteItemId || `manual-${idx}`} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="p-2 min-w-[200px]">
                                {line.demandNoteItemId ? (
                                  <>
                                    <div className="font-medium text-foreground">{line.itemName}</div>
                                    <div className="text-[10px] text-muted-foreground">{line.itemCode}</div>
                                  </>
                                ) : (
                                  <EntitySelect
                                    value={line.itemId}
                                    onValueChange={(v) => updateManualLineItem(idx, v)}
                                    entityLabel="Item"
                                    quickAddType="item"
                                    placeholder="Select item..."
                                    options={items.map((it) => ({
                                      value: it.id,
                                      label: it.itemCode ? `${it.itemCode} — ${it.name}` : it.name,
                                    }))}
                                    onQuickCreated={(created) => {
                                      setItems((prev) => [created, ...prev]);
                                      updateManualLineItem(idx, created.id, created);
                                    }}
                                  />
                                )}
                              </td>
                              <td className="p-2 text-center font-mono">{line.demandNoteItemId ? line.authorizedQty : "-"}</td>
                              <td className="p-2 text-center font-mono text-muted-foreground">{line.demandNoteItemId ? line.alreadyIssued : "-"}</td>
                              <td className="p-2 text-center font-mono">
                                <span className={line.availableStock > 0 ? "text-emerald-700 font-semibold" : "text-destructive font-semibold"}>
                                  {line.availableStock}
                                </span>
                              </td>
                              <td className="p-2 text-center">
                                <Input
                                  type="number"
                                  min={0}
                                  max={line.demandNoteItemId ? maxRemaining : undefined}
                                  className={`h-7 w-20 text-center text-xs mx-auto ${
                                    !hasStock || (line.demandNoteItemId && line.issueQty > maxRemaining)
                                      ? "border-destructive text-destructive font-bold"
                                      : "font-semibold"
                                  }`}
                                  value={line.issueQty}
                                  onChange={(e) => updateLineQty(idx, parseFloat(e.target.value) || 0)}
                                />
                              </td>
                              <td className="p-2 min-w-[260px]">
                                {line.layers.length > 0 ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                      <Layers className="h-3 w-3" />
                                      <span>{line.layers.length} active layer(s) found</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {line.layers.map((l) => (
                                        <Badge
                                          key={l.id}
                                          variant="outline"
                                          className="text-[10px] bg-slate-50 border-slate-200 text-slate-700"
                                        >
                                          {l.remainingQty} @ PKR {l.unitCost}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-destructive text-[11px]">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    <span>No open FIFO layers in this warehouse</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed rounded-lg text-sm text-muted-foreground space-y-2">
                    <p>Select an approved demand note above or click <strong>Add Item</strong> for direct warehouse issue.</p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Notes & Issue Remarks</Label>
                <Textarea
                  value={notes}
                  rows={2}
                  placeholder="Additional notes for production dispatch"
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="px-6 py-3 border-t bg-muted/10">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || lines.length === 0}>
                {saving ? "Posting..." : "Confirm & Post Issue"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
