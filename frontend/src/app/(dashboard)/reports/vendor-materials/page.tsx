"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/layouts/app-shell";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

interface VendorItemRel {
  id: string;
  preferredSupplier: boolean;
  leadTimeDays: number | null;
  minimumOrderQuantity: number | null;
  unitPrice: number | null;
  vendor: { id: string; vendorCode: string; name: string; city: string; status: string };
  item: { id: string; itemCode: string; name: string; category: { name: string } | null; unit: { name: string } | null };
}

export default function VendorMaterialReportPage() {
  const [items, setItems] = useState<VendorItemRel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getWithMeta<any[]>("/purchase/vendors?limit=999");
      const vendors = res.data || [];
      const allItems: VendorItemRel[] = [];
      for (const v of vendors) {
        if (v.suppliedItems) {
          for (const si of v.suppliedItems) {
            allItems.push({
              id: si.id,
              preferredSupplier: si.preferredSupplier,
              leadTimeDays: si.leadTimeDays,
              minimumOrderQuantity: si.minimumOrderQuantity,
              unitPrice: si.unitPrice,
              vendor: { id: v.id, vendorCode: v.vendorCode, name: v.name, city: v.city, status: v.status },
              item: si.item,
            });
          }
        }
      }
      setItems(allItems);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((vi) => {
    const q = search.toLowerCase();
    return (
      !q ||
      vi.vendor.name.toLowerCase().includes(q) ||
      vi.vendor.vendorCode.toLowerCase().includes(q) ||
      vi.item.name.toLowerCase().includes(q) ||
      vi.item.itemCode.toLowerCase().includes(q) ||
      (vi.item.category?.name || "").toLowerCase().includes(q)
    );
  });

  return (
    <AppShell title="Vendor Material Report">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {items.length} vendor-item relationship{items.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-8 w-64"
                placeholder="Search vendor or item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <Download className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            <p>No vendor-item relationships found.</p>
            <p className="text-sm">Link items to vendors in the vendor management page.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">Vendor</th>
                  <th className="text-left px-3 py-2 font-medium">Code</th>
                  <th className="text-left px-3 py-2 font-medium">Item</th>
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-left px-3 py-2 font-medium">Lead Time</th>
                  <th className="text-left px-3 py-2 font-medium">Preferred</th>
                  <th className="text-left px-3 py-2 font-medium">Vendor Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((vi) => (
                  <tr key={vi.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{vi.vendor.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{vi.vendor.vendorCode}</td>
                    <td className="px-3 py-2">{vi.item.itemCode} - {vi.item.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{vi.item.category?.name || "-"}</td>
                    <td className="px-3 py-2">{vi.leadTimeDays != null ? `${vi.leadTimeDays}d` : "-"}</td>
                    <td className="px-3 py-2">
                      {vi.preferredSupplier ? <Badge variant="default" className="text-xs">Yes</Badge> : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={vi.vendor.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">
                        {vi.vendor.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
