"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package, Plus, Trash2, Pencil, CheckCircle, XCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppShell } from "@/components/layouts/app-shell";
import { createCrudService } from "@/lib/api/crud";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  paymentTerms: string;
  taxNumber: string;
  rating: number;
  status: string;
  suppliedItems?: VendorItemRel[];
}

interface VendorItemRel {
  id: string;
  itemId: string;
  preferredSupplier: boolean;
  leadTimeDays: number | null;
  minimumOrderQuantity: number | null;
  unitPrice: number | null;
  remarks: string | null;
  item: {
    id: string;
    itemCode: string;
    name: string;
    category: { name: string } | null;
    unit: { name: string } | null;
  };
}

interface Item {
  id: string;
  itemCode: string;
  name: string;
  category?: { name: string };
  unit?: { name: string };
}

type Tab = "details" | "materials";

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const service = createCrudService<Vendor>("/purchase/vendors");

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("materials");
  const [vendorItems, setVendorItems] = useState<VendorItemRel[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedNewItems, setSelectedNewItems] = useState<string[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    preferredSupplier: false,
    leadTimeDays: "",
    minimumOrderQuantity: "",
    unitPrice: "",
    remarks: "",
  });

  const fetchVendor = useCallback(async () => {
    try {
      const v = await api.get<Vendor>("/purchase/vendors/" + id);
      setVendor(v);
      setVendorItems(v.suppliedItems || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.getWithMeta<any[]>("/inventory/items?limit=999&status=ACTIVE");
      setAllItems(res.data || []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchVendor(); }, [id]);
  useEffect(() => { fetchItems(); }, []);

  const handleAddItems = async () => {
    if (selectedNewItems.length === 0) return;
    try {
      await api.post("/purchase/vendors/" + id + "/items", { itemIds: selectedNewItems });
      toast.success("Items added");
      setShowAddPanel(false);
      setSelectedNewItems([]);
      setItemSearch("");
      fetchVendor();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await api.delete("/purchase/vendors/" + id + "/items/" + itemId);
      toast.success("Item removed");
      fetchVendor();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const startEdit = (vi: VendorItemRel) => {
    setEditingItem(vi.itemId);
    setEditForm({
      preferredSupplier: vi.preferredSupplier,
      leadTimeDays: vi.leadTimeDays != null ? String(vi.leadTimeDays) : "",
      minimumOrderQuantity: vi.minimumOrderQuantity != null ? String(vi.minimumOrderQuantity) : "",
      unitPrice: vi.unitPrice != null ? String(vi.unitPrice) : "",
      remarks: vi.remarks || "",
    });
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const saveEdit = async (itemId: string) => {
    try {
      const payload: Record<string, any> = {
        preferredSupplier: editForm.preferredSupplier,
      };
      if (editForm.leadTimeDays) payload.leadTimeDays = parseInt(editForm.leadTimeDays);
      if (editForm.minimumOrderQuantity) payload.minimumOrderQuantity = parseFloat(editForm.minimumOrderQuantity);
      if (editForm.unitPrice) payload.unitPrice = parseFloat(editForm.unitPrice);
      if (editForm.remarks) payload.remarks = editForm.remarks;

      await api.patch("/purchase/vendors/" + id + "/items/" + itemId, payload);
      toast.success("Item updated");
      setEditingItem(null);
      fetchVendor();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleNewItem = (itemId: string) => {
    setSelectedNewItems((prev) =>
      prev.includes(itemId) ? prev.filter((i) => i !== itemId) : [...prev, itemId]
    );
  };

  const availableItems = allItems.filter(
    (item) => !vendorItems.some((vi) => vi.itemId === item.id)
  );

  const filteredAvailable = availableItems.filter((item) => {
    const q = itemSearch.toLowerCase();
    return (
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.itemCode.toLowerCase().includes(q) ||
      (item.category?.name || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <AppShell title="Vendor Details">
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
      </AppShell>
    );
  }

  if (!vendor) {
    return (
      <AppShell title="Vendor Details">
        <div className="flex items-center justify-center h-64 text-muted-foreground">Vendor not found</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={vendor.name}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{vendor.name}</h1>
              <p className="text-sm text-muted-foreground">{vendor.vendorCode} · {vendor.city || "N/A"}</p>
            </div>
          </div>
          <Badge variant={vendor.status === "ACTIVE" ? "default" : "secondary"}>{vendor.status}</Badge>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "materials" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("materials")}
          >
            <Package className="h-4 w-4 inline mr-1.5" />Materials Supplied
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "details" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("details")}
          >
            Vendor Details
          </button>
        </div>

        {/* Materials Supplied Tab */}
        {activeTab === "materials" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {vendorItems.length} item{vendorItems.length !== 1 ? "s" : ""} supplied
              </p>
              <Button size="sm" onClick={() => setShowAddPanel(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Items
              </Button>
            </div>

            {/* Add Items Panel */}
            {showAddPanel && (
              <div className="rounded-lg border p-4 space-y-3">
                <Label>Search and select items to add</Label>
                <Input
                  placeholder="Search by code, name, category..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                />
                <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                  {filteredAvailable.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">No items available</div>
                  ) : (
                    filteredAvailable.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedNewItems.includes(item.id)}
                          onChange={() => toggleNewItem(item.id)}
                          className="h-4 w-4"
                        />
                        <span className="font-medium">{item.itemCode}</span>
                        <span>{item.name}</span>
                        <span className="text-muted-foreground text-xs ml-auto">
                          {item.category?.name || ""} {item.unit?.name ? `· ${item.unit.name}` : ""}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setShowAddPanel(false); setSelectedNewItems([]); }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddItems} disabled={selectedNewItems.length === 0}>
                    Add {selectedNewItems.length > 0 ? `(${selectedNewItems.length})` : ""}
                  </Button>
                </div>
              </div>
            )}

            {/* Items Table */}
            {vendorItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No items associated with this vendor.</p>
                <p className="text-sm">Use "Add Items" to link inventory items.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium">Item Code</th>
                      <th className="text-left px-3 py-2 font-medium">Item Name</th>
                      <th className="text-left px-3 py-2 font-medium">Category</th>
                      <th className="text-left px-3 py-2 font-medium">Unit</th>
                      <th className="text-left px-3 py-2 font-medium">Preferred</th>
                      <th className="text-left px-3 py-2 font-medium">Lead Time</th>
                      <th className="text-left px-3 py-2 font-medium">Min Qty</th>
                      <th className="text-left px-3 py-2 font-medium">Unit Price</th>
                      <th className="text-left px-3 py-2 font-medium w-[120px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vendorItems.map((vi) => (
                      <tr key={vi.id} className="hover:bg-muted/30">
                        {editingItem === vi.itemId ? (
                          <>
                            <td className="px-3 py-2" colSpan={3}>
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id="pref"
                                  checked={editForm.preferredSupplier}
                                  onChange={(e) => setEditForm({ ...editForm, preferredSupplier: e.target.checked })}
                                  className="h-4 w-4"
                                />
                                <Label htmlFor="pref" className="text-xs cursor-pointer">Preferred Supplier</Label>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Input type="number" size={1} className="h-7 w-16 text-xs" value={editForm.leadTimeDays}
                                onChange={(e) => setEditForm({ ...editForm, leadTimeDays: e.target.value })} placeholder="Days" />
                            </td>
                            <td className="px-3 py-2">
                              <Input type="number" size={1} className="h-7 w-20 text-xs" value={editForm.minimumOrderQuantity}
                                onChange={(e) => setEditForm({ ...editForm, minimumOrderQuantity: e.target.value })} placeholder="Min" />
                            </td>
                            <td className="px-3 py-2">
                              <Input type="number" size={1} className="h-7 w-20 text-xs" value={editForm.unitPrice}
                                onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })} placeholder="Price" />
                            </td>
                            <td className="px-3 py-2" colSpan={2}>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveEdit(vi.itemId)}>
                                  <Save className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}>
                                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 font-medium">{vi.item.itemCode}</td>
                            <td className="px-3 py-2">{vi.item.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{vi.item.category?.name || "-"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{vi.item.unit?.name || "-"}</td>
                            <td className="px-3 py-2">
                              {vi.preferredSupplier ? (
                                <Badge variant="default" className="text-xs">Preferred</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2">{vi.leadTimeDays != null ? `${vi.leadTimeDays}d` : "-"}</td>
                            <td className="px-3 py-2">{vi.minimumOrderQuantity != null ? vi.minimumOrderQuantity : "-"}</td>
                            <td className="px-3 py-2">{vi.unitPrice != null ? `PKR ${vi.unitPrice}` : "-"}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(vi)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleRemoveItem(vi.itemId)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Vendor Details Tab */}
        {activeTab === "details" && (
          <div className="grid grid-cols-2 gap-4 max-w-2xl">
            {[
              { label: "Vendor Code", value: vendor.vendorCode },
              { label: "Name", value: vendor.name },
              { label: "Contact Person", value: vendor.contactPerson || "-" },
              { label: "Email", value: vendor.email || "-" },
              { label: "Phone", value: vendor.phone || "-" },
              { label: "City", value: vendor.city || "-" },
              { label: "State", value: vendor.state || "-" },
              { label: "Country", value: vendor.country || "-" },
              { label: "Tax Number", value: vendor.taxNumber || "-" },
              { label: "Payment Terms", value: vendor.paymentTerms || "-" },
              { label: "Rating", value: vendor.rating != null ? vendor.rating.toFixed(1) : "-" },
              { label: "Bank", value: vendor.bankName || "-" },
              { label: "Bank Account", value: vendor.bankAccount || "-" },
              { label: "IFSC", value: vendor.bankIfsc || "-" },
            ].map((f) => (
              <div key={f.label}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <p className="text-sm font-medium">{f.value}</p>
              </div>
            ))}
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Address</Label>
              <p className="text-sm">{vendor.address || "-"}</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
