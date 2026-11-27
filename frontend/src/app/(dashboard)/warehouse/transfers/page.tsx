"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowRightLeft, Warehouse, Package, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/layouts/app-shell";
import { EntitySelect } from "@/components/shared/entity-select";
import { createCrudService } from "@/lib/api/crud";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

interface Option { id: string; name: string; itemCode?: string; sku?: string; }
interface StockInfo { warehouseStock?: number; totalStock?: number; }

export default function WarehouseTransfersPage() {
  const warehouseService = createCrudService<Option>("/inventory/warehouses");
  const itemService = createCrudService<Option>("/inventory/items");

  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const [items, setItems] = useState<Option[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [available, setAvailable] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchRefs = useCallback(async () => {
    try {
      const [wRes, iRes] = await Promise.all([
        warehouseService.findAll({ limit: 999, isActive: true }),
        itemService.findAll({ limit: 999, status: "ACTIVE" }),
      ]);
      setWarehouses(wRes.data);
      setItems(iRes.data);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, []);

  useEffect(() => { fetchRefs(); }, []);

  useEffect(() => {
    if (!fromId || !itemId) { setAvailable(null); return; }
    let active = true;
    api.get<StockInfo>(`/inventory/stock?itemId=${itemId}&warehouseId=${fromId}`)
      .then((res) => { if (active) setAvailable(res.warehouseStock ?? 0); })
      .catch(() => { if (active) setAvailable(null); });
    return () => { active = false; };
  }, [fromId, itemId]);

  const canSubmit =
    fromId && toId && itemId && quantity && Number(quantity) > 0 && fromId !== toId;

  const handleTransfer = async () => {
    if (!canSubmit) {
      if (fromId === toId) toast.error("Source and destination must be different");
      else toast.error("Fill in all fields with a valid quantity");
      return;
    }
    setSaving(true);
    try {
      await api.post("/inventory/stock/transfer", {
        itemId,
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        quantity: Number(quantity),
      });
      toast.success("Stock transferred");
      setQuantity("");
      setAvailable(null);
      const stillFrom = fromId;
      const stillItem = itemId;
      api.get<StockInfo>(`/inventory/stock?itemId=${stillItem}&warehouseId=${stillFrom}`)
        .then((res) => setAvailable(res.warehouseStock ?? 0))
        .catch(() => setAvailable(null));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Warehouse Transfers">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                <Warehouse className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-sm font-medium mb-1">Source Warehouse</h3>
              <p className="text-xs text-muted-foreground mb-3">Select origin location for the transfer</p>
              <EntitySelect
                value={fromId}
                onValueChange={setFromId}
                entityLabel="Warehouse"
                quickAddType="warehouse"
                placeholder="Select source..."
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                onQuickCreated={(created) => {
                  setWarehouses((prev) => [created, ...prev]);
                  fetchRefs();
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                <Warehouse className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-sm font-medium mb-1">Destination Warehouse</h3>
              <p className="text-xs text-muted-foreground mb-3">Select target location for the transfer</p>
              <EntitySelect
                value={toId}
                onValueChange={setToId}
                entityLabel="Warehouse"
                quickAddType="warehouse"
                placeholder="Select destination..."
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                onQuickCreated={(created) => {
                  setWarehouses((prev) => [created, ...prev]);
                  fetchRefs();
                }}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium">Transfer Items</h3>
                <p className="text-xs text-muted-foreground">Choose an item and quantity to move</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Item</Label>
                <EntitySelect
                  value={itemId}
                  onValueChange={setItemId}
                  entityLabel="Item"
                  quickAddType="item"
                  placeholder="Select item..."
                  options={items.map((it) => ({
                    value: it.id,
                    label: `${it.name}${it.itemCode ? ` (${it.itemCode})` : it.sku ? ` (${it.sku})` : ""}`,
                  }))}
                  onQuickCreated={(created) => {
                    setItems((prev) => [created, ...prev]);
                    fetchRefs();
                  }}
                />
                {available !== null && (
                  <p className="text-xs text-muted-foreground">
                    Available at source: <Badge variant="secondary">{available}</Badge>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  placeholder="e.g. 10"
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleTransfer} disabled={!canSubmit || saving}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {saving ? "Transferring..." : "Transfer Stock"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
