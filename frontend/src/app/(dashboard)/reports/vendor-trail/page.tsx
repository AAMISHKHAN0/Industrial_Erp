"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, RefreshCw, FileText, Package, Receipt, CreditCard,
  Undo2, ShieldCheck, AlertCircle, Clock, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EntitySelect } from "@/components/shared/entity-select";
import { createCrudService } from "@/lib/api/crud";
import { api } from "@/lib/api/client";
import { AppShell } from "@/components/layouts/app-shell";
import { toast } from "sonner";

interface Vendor { id: string; name: string; vendorCode?: string; code?: string; }

interface VendorTrailResponse {
  vendor: {
    id: string;
    name: string;
    vendorCode?: string;
    code?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
  };
  summary: {
    totalPoValue: number;
    totalGrnValue: number;
    totalBilledValue: number;
    totalPaidValue: number;
    outstandingAp?: number;
    outstandingPayable?: number;
    openGrniBalance?: number;
    unbilledGrnValue?: number;
  };
  timeline: Array<{
    type: "PO" | "GRN" | "BILL" | "PAYMENT" | "RETURN";
    id: string;
    date: string;
    docNumber?: string;
    number?: string;
    status: string;
    amount: number;
    reference?: string;
    details?: string;
    metadata?: any;
  }>;
}

function fmt(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "0.00";
  return Number(val).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const typeIconMap = {
  PO: <FileText className="h-4 w-4 text-blue-600" />,
  GRN: <Package className="h-4 w-4 text-emerald-600" />,
  BILL: <Receipt className="h-4 w-4 text-purple-600" />,
  PAYMENT: <CreditCard className="h-4 w-4 text-amber-600" />,
  RETURN: <Undo2 className="h-4 w-4 text-rose-600" />,
};

const typeBadgeMap = {
  PO: "bg-blue-50 text-blue-700 border-blue-200",
  GRN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  BILL: "bg-purple-50 text-purple-700 border-purple-200",
  PAYMENT: "bg-amber-50 text-amber-700 border-amber-200",
  RETURN: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function VendorTrailReportPage() {
  const vendorService = createCrudService<Vendor>("/purchase/vendors");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [trail, setTrail] = useState<VendorTrailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [unbilledGrns, setUnbilledGrns] = useState<any[]>([]);

  const fetchVendors = useCallback(async () => {
    try {
      const res = await vendorService.findAll({ limit: 999, status: "ACTIVE" });
      setVendors(res.data);
      if (res.data.length > 0 && !selectedVendorId) {
        setSelectedVendorId(res.data[0].id);
      }
    } catch { /* ignore */ }
  }, [selectedVendorId]);

  const fetchTrail = useCallback(async (vendorId: string) => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const json = await api.get<VendorTrailResponse>(`/purchase/vendors/${vendorId}/trail`);
      setTrail(json);

      // Also fetch unbilled GRNs
      try {
        const uList = await api.get<any[]>("/purchase/goods-receiving/unbilled");
        setUnbilledGrns((uList || []).filter((g: any) => g.vendorId === vendorId));
      } catch {
        setUnbilledGrns([]);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);
  useEffect(() => {
    if (selectedVendorId) fetchTrail(selectedVendorId);
  }, [selectedVendorId, fetchTrail]);

  const summary = trail?.summary;

  return (
    <AppShell title="Vendor Audit Trail">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Procurement & 3-Way Match Audit Trail</h2>
            <p className="text-sm text-muted-foreground">
              End-to-end timeline tracing Purchase Orders, GRNs, Invoices, and Payments with tolerance checks
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-64">
              <EntitySelect
                value={selectedVendorId}
                onValueChange={(v) => v && setSelectedVendorId(v)}
                entityLabel="Vendor"
                pluralLabel="vendors"
                quickAddType="vendor"
                placeholder="Select a vendor..."
                className="h-9"
                options={vendors.map((v) => ({
                  value: v.id,
                  label: v.name,
                  subLabel: v.vendorCode || v.code || undefined,
                }))}
                onQuickCreated={(created) => {
                  setVendors((prev) => [created, ...prev]);
                }}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchTrail(selectedVendorId)}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        {/* Procurement KPI Summary */}
        {summary && (
          <div className="grid grid-cols-6 gap-3">
            <Card className="p-3 bg-blue-50/50 border-blue-200">
              <span className="text-[11px] font-medium text-blue-800 uppercase">Total PO Value</span>
              <div className="text-base font-bold text-blue-700">PKR {fmt(summary.totalPoValue)}</div>
              <span className="text-[10px] text-muted-foreground">Ordered commitments</span>
            </Card>

            <Card className="p-3 bg-emerald-50/50 border-emerald-200">
              <span className="text-[11px] font-medium text-emerald-800 uppercase">Total Received (GRN)</span>
              <div className="text-base font-bold text-emerald-700">PKR {fmt(summary.totalGrnValue)}</div>
              <span className="text-[10px] text-muted-foreground">Accepted into stock</span>
            </Card>

            <Card className="p-3 bg-purple-50/50 border-purple-200">
              <span className="text-[11px] font-medium text-purple-800 uppercase">Total Billed</span>
              <div className="text-base font-bold text-purple-700">PKR {fmt(summary.totalBilledValue)}</div>
              <span className="text-[10px] text-muted-foreground">3-Way matched bills</span>
            </Card>

            <Card className="p-3 bg-amber-50/50 border-amber-200">
              <span className="text-[11px] font-medium text-amber-800 uppercase">Total Paid</span>
              <div className="text-base font-bold text-amber-700">PKR {fmt(summary.totalPaidValue)}</div>
              <span className="text-[10px] text-muted-foreground">Bank & Cash disbursements</span>
            </Card>

            <Card className="p-3 bg-slate-50 border-slate-300">
              <span className="text-[11px] font-medium text-slate-700 uppercase">Unbilled GRN</span>
              <div className="text-base font-bold text-slate-800">PKR {fmt(summary.openGrniBalance ?? summary.unbilledGrnValue)}</div>
              <span className="text-[10px] text-muted-foreground">GRNI clearing pending</span>
            </Card>

            <Card className="p-3 bg-rose-50/50 border-rose-200">
              <span className="text-[11px] font-medium text-rose-800 uppercase">Outstanding AP</span>
              <div className="text-base font-bold text-rose-700">PKR {fmt(summary.outstandingAp ?? summary.outstandingPayable)}</div>
              <span className="text-[10px] text-muted-foreground">Net payable to vendor</span>
            </Card>
          </div>
        )}

        {/* Unbilled GRN Notice Banner */}
        {unbilledGrns.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-amber-800 font-medium">
              <Clock className="h-4 w-4" />
              <span>{unbilledGrns.length} Goods Receiving Note(s) are awaiting Supplier Bill entry.</span>
            </div>
            <div className="flex gap-2">
              {unbilledGrns.map((g) => (
                <Badge key={g.id} variant="outline" className="bg-white text-amber-900 border-amber-300 font-mono">
                  {g.grnNumber}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Chronological Timeline */}
        <Card>
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Chronological Procurement Lifecycle
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground text-xs">
                Loading audit trail records...
              </div>
            ) : !trail || trail.timeline.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs">
                No procurement transactions recorded for this vendor.
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-muted-foreground/20">
                {trail.timeline.map((entry, idx) => (
                  <div key={entry.id || idx} className="relative flex items-start gap-4">
                    {/* Timeline Node Icon */}
                    <div className="absolute -left-6 mt-0.5 bg-background p-1 rounded-full border border-border shadow-sm">
                      {typeIconMap[entry.type] || <FileText className="h-4 w-4" />}
                    </div>

                    {/* Timeline Event Content */}
                    <div className="flex-1 bg-muted/20 border rounded-lg p-3.5 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs font-bold ${typeBadgeMap[entry.type] || ""}`}>
                            {entry.type}
                          </Badge>
                          <span className="font-semibold text-sm text-foreground">{entry.docNumber || entry.number || "-"}</span>
                          {entry.reference && (
                            <span className="text-xs text-muted-foreground font-mono">
                              (Ref: {entry.reference})
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs mt-2">
                        <div className="text-muted-foreground">
                          {entry.details || "Procurement lifecycle event"}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-foreground">
                            PKR {fmt(entry.amount)}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {entry.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
