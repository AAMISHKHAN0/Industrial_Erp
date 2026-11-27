"use client";

import { useState, useEffect, useCallback, useId } from "react";
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Building2,
  Zap,
  Landmark,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Eye,
  Copy,
  Receipt,
  Droplets,
  Home,
  Check,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EntitySelect } from "@/components/shared/entity-select";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

export type PaymentGroup = "STATUTORY" | "UTILITY" | "VENDOR" | "FIXED_ASSET";

export type StatutoryHead =
  | "SALES_TAX"
  | "INCOME_TAX"
  | "CUSTOMS_DUTY"
  | "PROFESSIONAL_TAX"
  | "PESSI"
  | "LABOUR";

export type UtilityType = "ELECTRICITY" | "WATER" | "RENT";

export type AssetCategory = "MACHINERY" | "VEHICLE" | "IT_EQUIPMENT" | "FURNITURE";

export interface OutgoingPayment {
  id: string;
  voucherNumber: string;
  date: string;
  group: PaymentGroup;
  headOrType: string;
  beneficiary: string;
  referenceNumber: string; // CPR #, Meter #, or Invoice #
  amount: number;
  paymentMethod: "BANK" | "CASH";
  status: "POSTED" | "PENDING_CONFIRMATION" | "REPLAYED";
  idempotencyKey: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

const STATUTORY_HEADS: Record<
  StatutoryHead,
  { label: string; authority: string; requiresOwnerConfirmation?: boolean }
> = {
  SALES_TAX: { label: "Sales Tax", authority: "FBR / PRA" },
  INCOME_TAX: { label: "Income Tax (WHT/Advance)", authority: "FBR" },
  CUSTOMS_DUTY: { label: "Customs Duty", authority: "Customs" },
  PROFESSIONAL_TAX: { label: "Professional Tax", authority: "Punjab Excise" },
  PESSI: { label: "PESSI (Social Security)", authority: "PESSI" },
  LABOUR: {
    label: "Labour (Welfare / Levy)",
    authority: "Labour Dept",
    requiresOwnerConfirmation: true,
  },
};

const UTILITY_TYPES: Record<UtilityType, { label: string; icon: any }> = {
  ELECTRICITY: { label: "Electricity (LESCO/WAPDA)", icon: Zap },
  WATER: { label: "Water & Sanitation (WASA)", icon: Droplets },
  RENT: { label: "Factory / Warehouse Rent", icon: Home },
};

export default function OutgoingPaymentsPage() {
  const [payments, setPayments] = useState<OutgoingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<OutgoingPayment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [recentVoucher, setRecentVoucher] = useState<{
    voucherNumber: string;
    amount: number;
    beneficiary: string;
    isReplayed?: boolean;
  } | null>(null);

  // Form State
  const [group, setGroup] = useState<PaymentGroup>("STATUTORY");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<"BANK" | "CASH">("BANK");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  // Statutory fields
  const [statutoryHead, setStatutoryHead] = useState<StatutoryHead>("SALES_TAX");
  const [authority, setAuthority] = useState("FBR");
  const [taxPeriod, setTaxPeriod] = useState("2026-01");
  const [cprNumber, setCprNumber] = useState("");
  const [psid, setPsid] = useState("");

  // Utility fields
  const [utilityType, setUtilityType] = useState<UtilityType>("ELECTRICITY");
  const [providerName, setProviderName] = useState("");
  const [consumerNumber, setConsumerNumber] = useState("");
  const [billingMonth, setBillingMonth] = useState("January 2026");

  // Fixed Asset fields
  const [assetDescription, setAssetDescription] = useState("");
  const [assetVendor, setAssetVendor] = useState("");
  const [assetCategory, setAssetCategory] = useState<AssetCategory>("MACHINERY");
  const [assetSerial, setAssetSerial] = useState("");

  // Vendor fields
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendorBills, setVendorBills] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [selectedBillId, setSelectedBillId] = useState<string>("");
  const [vendorBillRef, setVendorBillRef] = useState<string>("");

  // Idempotency state
  const [requestId, setRequestId] = useState<string>(() =>
    `IDEM-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  );

  const resetForm = () => {
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("BANK");
    setAmount("");
    setNotes("");
    setStatutoryHead("SALES_TAX");
    setAuthority("FBR");
    setTaxPeriod("2026-01");
    setCprNumber("");
    setPsid("");
    setUtilityType("ELECTRICITY");
    setProviderName("");
    setConsumerNumber("");
    setBillingMonth("January 2026");
    setAssetDescription("");
    setAssetVendor("");
    setAssetCategory("MACHINERY");
    setAssetSerial("");
    setSelectedVendorId("");
    setSelectedBillId("");
    setVendorBillRef("");
    setRequestId(
      `IDEM-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    );
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const [payRes, statRes] = await Promise.all([
        api.get<any>("/finance/payments?limit=500"),
        api.get<any[]>("/finance/statutory/register"),
      ]);

      const allDisbursements: OutgoingPayment[] = [];
      const seenVouchers = new Set<string>();

      const payRows = Array.isArray(payRes) ? payRes : payRes?.data || [];
      payRows.forEach((p: any) => {
        const mappedGroup: PaymentGroup =
          p.group === "VENDOR_PAYMENT" || p.group === "VENDOR"
            ? "VENDOR"
            : p.group === "UTILITY"
            ? "UTILITY"
            : p.group === "FIXED_ASSET"
            ? "FIXED_ASSET"
            : "STATUTORY";
        const vNum = p.voucherNumber || p.id;
        seenVouchers.add(vNum);
        allDisbursements.push({
          id: p.id,
          voucherNumber: vNum,
          date: p.date ? String(p.date).split("T")[0] : "",
          group: mappedGroup,
          headOrType: p.headOrType || mappedGroup,
          beneficiary: p.beneficiary || "Beneficiary",
          referenceNumber: p.referenceNumber || p.entryReference || vNum,
          amount: Number(p.amount || 0),
          paymentMethod: p.paymentMethod === "CASH" ? "CASH" : "BANK",
          status: p.status === "REPLAYED" ? "REPLAYED" : "POSTED",
          idempotencyKey: p.id,
          notes: p.notes || "",
          metadata: p.metadata || {},
          createdAt: p.createdAt,
        });
      });

      const obligations = Array.isArray(statRes) ? statRes : (statRes as any)?.data || [];
      obligations.forEach((ob: any) => {
        if (ob.payments && Array.isArray(ob.payments)) {
          ob.payments.forEach((p: any) => {
            const vNum = p.voucherNumber || p.paymentNumber || `STAT-${p.id.slice(0, 6)}`;
            const existing = allDisbursements.find((d) => d.voucherNumber === vNum || d.id === p.voucherId);
            if (existing) {
              existing.headOrType = ob.head;
              existing.beneficiary = ob.authority;
              existing.referenceNumber = p.cprNumber || p.psid || ob.challanNumber || existing.referenceNumber;
              existing.status = ob.head === "LABOUR" ? "PENDING_CONFIRMATION" : existing.status;
              existing.metadata = {
                ...existing.metadata,
                head: ob.head,
                authority: ob.authority,
                taxPeriod: ob.taxPeriod,
                cprNumber: p.cprNumber,
              };
            } else if (!seenVouchers.has(vNum)) {
              seenVouchers.add(vNum);
              allDisbursements.push({
                id: p.id,
                voucherNumber: vNum,
                date: p.paymentDate?.split("T")[0] || ob.createdAt?.split("T")[0] || "",
                group: "STATUTORY",
                headOrType: ob.head,
                beneficiary: ob.authority,
                referenceNumber: p.cprNumber || p.psid || ob.challanNumber || "N/A",
                amount: Number(p.amount),
                paymentMethod: p.paymentMethod === "CASH" ? "CASH" : "BANK",
                status: ob.head === "LABOUR" ? "PENDING_CONFIRMATION" : "POSTED",
                idempotencyKey: p.requestKey || `STAT-${p.id}`,
                notes: p.notes || ob.notes || "",
                metadata: {
                  head: ob.head,
                  authority: ob.authority,
                  taxPeriod: ob.taxPeriod,
                  cprNumber: p.cprNumber,
                },
                createdAt: p.createdAt || ob.createdAt,
              });
            }
          });
        }
      });

      // Sort newest first
      allDisbursements.sort(
        (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
      );
      setPayments(allDisbursements);
    } catch (err: any) {
      toast.error(err.message || "Failed to load outgoing payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    api.get<any>("/purchase/vendors?limit=200").then((res) => {
      const list = res?.data || (Array.isArray(res) ? res : []);
      setVendors(list);
    }).catch(() => {});
    api.get<any>("/purchase/bills?limit=200").then((res) => {
      const list = res?.data || (Array.isArray(res) ? res : []);
      setVendorBills(list);
    }).catch(() => {});
  }, [fetchPayments]);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check Labour requirement:
    if (group === "STATUTORY" && statutoryHead === "LABOUR") {
      toast.error(
        "Labour statutory payments are pending owner classification and account mapping approval."
      );
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid payment amount greater than zero");
      return;
    }

    if (group === "VENDOR" && !selectedVendorId) {
      toast.error("Please select a vendor");
      return;
    }
    if (group === "FIXED_ASSET" && !assetDescription.trim()) {
      toast.error("Please enter an asset description");
      return;
    }

    setSubmitting(true);
    try {
      let postedVoucherNumber = "";
      let isReplayed = false;
      let beneficiaryName = "";

      if (group === "STATUTORY") {
        beneficiaryName = authority;
        const headTitle = STATUTORY_HEADS[statutoryHead]?.label || statutoryHead;
        const referenceCode = cprNumber.trim() || psid.trim() || `CPR-${Date.now().toString().slice(-6)}`;

        const obResult = await api.post<any>("/finance/statutory/obligations", {
          head: statutoryHead,
          authority: authority.toUpperCase(),
          registrationNumber: `REG-${Date.now().toString().slice(-4)}`,
          taxPeriod,
          dueAmount: numAmount,
          challanNumber: referenceCode,
          psid: psid.trim() || undefined,
          notes: notes.trim() || `Statutory obligation for ${statutoryHead} (${taxPeriod})`,
        });

        const payResult = await api.post<any>("/finance/statutory/payments", {
          obligationId: obResult.id,
          amount: numAmount,
          paymentMethod,
          paymentDate: new Date(paymentDate).toISOString(),
          cprNumber: referenceCode,
          psid: psid.trim() || undefined,
          requestKey: requestId,
          notes: notes.trim() || `Paid ${headTitle} via ${paymentMethod}`,
        });

        postedVoucherNumber = payResult?.voucherNumber || "";
        isReplayed = Boolean(payResult?.replayed);
      } else if (group === "UTILITY") {
        beneficiaryName = providerName.trim() || UTILITY_TYPES[utilityType].label;
        const payResult = await api.post<any>("/finance/payments/utility", {
          utilityType,
          providerName: providerName.trim() || undefined,
          consumerNumber: consumerNumber.trim() || undefined,
          billingMonth: billingMonth.trim() || undefined,
          amount: numAmount,
          paymentMethod,
          paymentDate: new Date(paymentDate).toISOString(),
          notes: notes.trim() || undefined,
          requestKey: requestId,
        });
        postedVoucherNumber = payResult?.voucherNumber || payResult?.entryReference || "";
        isReplayed = Boolean(payResult?.replayed);
      } else if (group === "VENDOR") {
        const v = vendors.find((x) => x.id === selectedVendorId);
        beneficiaryName = v ? v.name : "Vendor";
        const payResult = await api.post<any>("/finance/payments/vendor", {
          vendorId: selectedVendorId,
          amount: numAmount,
          paymentMethod,
          paymentDate: new Date(paymentDate).toISOString(),
          supplierBillId: selectedBillId || undefined,
          reference: vendorBillRef.trim() || undefined,
          notes: notes.trim() || undefined,
          requestKey: requestId,
        });
        postedVoucherNumber = payResult?.voucherNumber || "";
        isReplayed = Boolean(payResult?.replayed);
      } else {
        beneficiaryName = assetVendor.trim() || "Asset Vendor";
        const payResult = await api.post<any>("/finance/payments/fixed-asset", {
          assetDescription: assetDescription.trim(),
          assetCategory,
          vendorName: assetVendor.trim() || undefined,
          serialOrInvoice: assetSerial.trim() || undefined,
          amount: numAmount,
          paymentMethod,
          paymentDate: new Date(paymentDate).toISOString(),
          notes: notes.trim() || undefined,
          requestKey: requestId,
        });
        postedVoucherNumber = payResult?.voucherNumber || payResult?.entryReference || "";
        isReplayed = Boolean(payResult?.replayed);
      }

      setRecentVoucher({
        voucherNumber: postedVoucherNumber,
        amount: numAmount,
        beneficiary: beneficiaryName,
        isReplayed,
      });

      if (isReplayed) {
        toast.info(
          `Duplicate request detected. Existing voucher ${postedVoucherNumber} returned (idempotency verified).`
        );
      } else {
        toast.success(
          `Payment posted successfully! Voucher Number: ${postedVoucherNumber}`
        );
      }

      setDialogOpen(false);
      resetForm();
      await fetchPayments();
    } catch (err: any) {
      toast.error(err.message || "Failed to process outgoing payment");
    } finally {
      setSubmitting(false);
    }
  };

  // Calculations & Filtering
  const filtered = payments.filter((p) => {
    const matchesGroup = activeTab === "ALL" || p.group === activeTab;
    const matchesSearch =
      p.beneficiary.toLowerCase().includes(search.toLowerCase()) ||
      p.voucherNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.headOrType.toLowerCase().includes(search.toLowerCase()) ||
      p.referenceNumber.toLowerCase().includes(search.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  const totalDisbursed = payments.reduce((sum, p) => sum + p.amount, 0);
  const statutoryTotal = payments
    .filter((p) => p.group === "STATUTORY")
    .reduce((sum, p) => sum + p.amount, 0);
  const utilitiesTotal = payments
    .filter((p) => p.group === "UTILITY")
    .reduce((sum, p) => sum + p.amount, 0);
  const fixedAssetsTotal = payments
    .filter((p) => p.group === "FIXED_ASSET")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Outgoing Payments
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Grouped outgoing disbursements for Statutory Obligations, Monthly Utilities, and Fixed Asset Purchases with idempotency protection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPayments}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Success / Recent Voucher Alert */}
      {recentVoucher && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Posted Voucher Number:{" "}
                <span className="font-mono text-primary font-bold">
                  {recentVoucher.voucherNumber}
                </span>{" "}
                {recentVoucher.isReplayed && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    Replayed (Idempotent)
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Disbursement of PKR {recentVoucher.amount.toLocaleString()} to {recentVoucher.beneficiary} committed to General Ledger.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRecentVoucher(null)}
            className="text-xs"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Group KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Total Outgoing Payments
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              PKR {totalDisbursed.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {payments.length} disbursement{payments.length === 1 ? "" : "s"} processed
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider flex items-center justify-between">
              <span>Statutory Taxes & Levies</span>
              <Landmark className="h-4 w-4 text-blue-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              PKR {statutoryTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Sales tax, income tax, PESSI, excise
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider flex items-center justify-between">
              <span>Monthly Utilities</span>
              <Zap className="h-4 w-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              PKR {utilitiesTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Electricity, water, factory rent
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider flex items-center justify-between">
              <span>Fixed Asset Purchases</span>
              <Building2 className="h-4 w-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              PKR {fixedAssetsTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Machinery, plant, vehicles, equipment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full sm:w-[620px]">
            <TabsTrigger value="ALL">All ({payments.length})</TabsTrigger>
            <TabsTrigger value="STATUTORY">
              Statutory ({payments.filter((p) => p.group === "STATUTORY").length})
            </TabsTrigger>
            <TabsTrigger value="UTILITY">
              Utilities ({payments.filter((p) => p.group === "UTILITY").length})
            </TabsTrigger>
            <TabsTrigger value="VENDOR">
              Vendor ({payments.filter((p) => p.group === "VENDOR").length})
            </TabsTrigger>
            <TabsTrigger value="FIXED_ASSET">
              Fixed Assets ({payments.filter((p) => p.group === "FIXED_ASSET").length})
            </TabsTrigger>
          </TabsList>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search beneficiary, voucher #, CPR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-0">
          <Card className="shadow-xs">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[140px] text-xs font-semibold">Voucher #</TableHead>
                    <TableHead className="w-[100px] text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Payment Type</TableHead>
                    <TableHead className="text-xs font-semibold">Beneficiary / Authority</TableHead>
                    <TableHead className="text-xs font-semibold">Reference / CPR</TableHead>
                    <TableHead className="text-xs font-semibold">Mode</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Amount (PKR)</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Status / Flags</TableHead>
                    <TableHead className="w-[60px] text-center text-xs font-semibold">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Loading outgoing disbursements...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <FileText className="h-6 w-6 text-muted-foreground/60" />
                          <p className="text-sm font-medium">No outgoing payments found</p>
                          <p className="text-xs text-muted-foreground">
                            Click "Record Payment" to process a new disbursement.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => {
                      const isLabour =
                        item.headOrType?.toUpperCase().includes("LABOUR") ||
                        item.metadata?.head === "LABOUR";

                      return (
                        <TableRow key={item.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs font-medium text-foreground">
                            {item.voucherNumber}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.date}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-medium ${
                                  item.group === "STATUTORY"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : item.group === "UTILITY"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : item.group === "VENDOR"
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}
                              >
                                {item.group}
                              </Badge>
                              <span className="text-xs font-medium text-foreground">
                                {item.headOrType}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground">
                            {item.beneficiary}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {item.referenceNumber}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {item.paymentMethod}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-xs text-foreground">
                            {item.amount.toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            {isLabour ? (
                              <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] whitespace-nowrap">
                                Pending Owner/Accountant Confirmation
                              </Badge>
                            ) : item.status === "REPLAYED" ? (
                              <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-[10px]">
                                REPLAYED
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                POSTED
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => setSelectedPayment(item)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="wide">
          <form onSubmit={handleCreatePayment} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0 bg-background">
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Record Outgoing Payment
              </DialogTitle>
              <DialogDescription>
                Process statutory, utility, or fixed asset payments with idempotency check and automatic General Ledger posting.
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto min-h-0 flex-1 px-6 py-4 space-y-4">
              {/* Payment Type Group Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Group *</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Button
                    type="button"
                    variant={group === "STATUTORY" ? "default" : "outline"}
                    className="h-9 text-xs justify-start px-2.5"
                    onClick={() => setGroup("STATUTORY")}
                  >
                    <Landmark className="h-3.5 w-3.5 mr-1.5" />
                    Statutory
                  </Button>
                  <Button
                    type="button"
                    variant={group === "UTILITY" ? "default" : "outline"}
                    className="h-9 text-xs justify-start px-2.5"
                    onClick={() => setGroup("UTILITY")}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                    Utilities
                  </Button>
                  <Button
                    type="button"
                    variant={group === "VENDOR" ? "default" : "outline"}
                    className="h-9 text-xs justify-start px-2.5"
                    onClick={() => setGroup("VENDOR")}
                  >
                    <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
                    Vendor Payment
                  </Button>
                  <Button
                    type="button"
                    variant={group === "FIXED_ASSET" ? "default" : "outline"}
                    className="h-9 text-xs justify-start px-2.5"
                    onClick={() => setGroup("FIXED_ASSET")}
                  >
                    <Building2 className="h-3.5 w-3.5 mr-1.5" />
                    Fixed Asset
                  </Button>
                </div>
              </div>

              {/* Vendor payment fields */}
              {group === "VENDOR" && (
                <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Vendor Payment & Bill Settlement
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="v-select" className="text-xs font-semibold">
                        Vendor / Supplier *
                      </Label>
                      <EntitySelect
                        id="v-select"
                        value={selectedVendorId}
                        onValueChange={(val) => {
                          setSelectedVendorId(val);
                          setSelectedBillId("");
                        }}
                        entityLabel="Vendor"
                        pluralLabel="vendors"
                        quickAddType="vendor"
                        placeholder="Select Vendor..."
                        className="h-9 text-xs bg-background"
                        options={vendors.map((v) => ({
                          value: v.id,
                          label: v.name,
                          subLabel: v.vendorCode || undefined,
                        }))}
                        onQuickCreated={(created) => {
                          setVendors((prev) => [created, ...prev]);
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="v-bill" className="text-xs font-semibold">
                        Settle Open Supplier Bill (Optional)
                      </Label>
                      <Select
                        value={selectedBillId}
                        onValueChange={(val) => setSelectedBillId(val === "AUTO" ? "" : val || "")}
                      >
                        <SelectTrigger id="v-bill" className="h-9 text-xs bg-background">
                          <SelectValue placeholder="Auto-settle oldest bills (FIFO)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AUTO">Auto-settle oldest bills (FIFO)</SelectItem>
                          {vendorBills
                            .filter(
                              (b) =>
                                (!selectedVendorId || b.vendorId === selectedVendorId) &&
                                b.status !== "PAID"
                            )
                            .map((b) => {
                              const openAmt = Math.max(0, Number(b.totalAmount || 0) - Number(b.paidAmount || 0));
                              return (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.billNumber} (Open: PKR {openAmt.toLocaleString("en-PK")})
                                </SelectItem>
                              );
                            })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="v-ref" className="text-xs font-semibold">
                      Payment Reference / PO #
                    </Label>
                    <Input
                      id="v-ref"
                      placeholder="e.g. CHQ-1122 / BILL-9921 / PO-88"
                      value={vendorBillRef}
                      onChange={(e) => setVendorBillRef(e.target.value)}
                      className="h-9 text-xs bg-background"
                    />
                  </div>
                </div>
              )}

              {/* Group-specific fields */}
              {group === "STATUTORY" && (
                <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Statutory Head & Details
                    </span>
                    {statutoryHead === "LABOUR" && (
                      <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                        Pending Owner/Accountant Confirmation
                      </Badge>
                    )}
                  </div>

                  {statutoryHead === "LABOUR" && (
                    <div className="p-2.5 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Owner Confirmation Required</p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Labour statutory payments cannot post automatically until the business owner or lead accountant approves the statutory wage classification and account mapping.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="stat-head" className="text-xs">
                        Statutory Head *
                      </Label>
                      <Select
                        value={statutoryHead}
                        onValueChange={(val) => {
                          if (val) {
                            const h = val as StatutoryHead;
                            setStatutoryHead(h);
                            setAuthority(STATUTORY_HEADS[h]?.authority || "FBR");
                          }
                        }}
                      >
                        <SelectTrigger id="stat-head" className="h-9 text-xs">
                          <SelectValue placeholder="Select Head" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SALES_TAX">Sales Tax (FBR / PRA)</SelectItem>
                          <SelectItem value="INCOME_TAX">Income Tax (FBR)</SelectItem>
                          <SelectItem value="CUSTOMS_DUTY">Customs Duty</SelectItem>
                          <SelectItem value="PROFESSIONAL_TAX">Professional Tax (Punjab Excise)</SelectItem>
                          <SelectItem value="PESSI">PESSI (Social Security)</SelectItem>
                          <SelectItem value="LABOUR">
                            Labour (Welfare / Levy) [Requires Confirmation]
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="stat-authority" className="text-xs">
                        Tax Authority / Agency *
                      </Label>
                      <Input
                        id="stat-authority"
                        value={authority}
                        onChange={(e) => setAuthority(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="tax-period" className="text-xs">
                        Tax Period *
                      </Label>
                      <Input
                        id="tax-period"
                        placeholder="e.g. 2026-01"
                        value={taxPeriod}
                        onChange={(e) => setTaxPeriod(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cpr" className="text-xs">
                        CPR / Challan Number
                      </Label>
                      <Input
                        id="cpr"
                        placeholder="CPR-2026-..."
                        value={cprNumber}
                        onChange={(e) => setCprNumber(e.target.value)}
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="psid" className="text-xs">
                        PSID (1-Bill / e-Payment)
                      </Label>
                      <Input
                        id="psid"
                        placeholder="e.g. 9900012345"
                        value={psid}
                        onChange={(e) => setPsid(e.target.value)}
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {group === "UTILITY" && (
                <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
                  <div className="text-xs font-semibold text-foreground">
                    Utility Details
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="util-type" className="text-xs">
                        Utility Type *
                      </Label>
                      <Select
                        value={utilityType}
                        onValueChange={(val) => {
                          if (val) setUtilityType(val as UtilityType);
                        }}
                      >
                        <SelectTrigger id="util-type" className="h-9 text-xs">
                          <SelectValue placeholder="Select Utility" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ELECTRICITY">Electricity (LESCO / WAPDA)</SelectItem>
                          <SelectItem value="WATER">Water & Sanitation (WASA)</SelectItem>
                          <SelectItem value="RENT">Factory / Office Rent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="provider" className="text-xs">
                        Service Provider / Landlord *
                      </Label>
                      <Input
                        id="provider"
                        placeholder="e.g. LESCO, WASA, Estate Owner"
                        value={providerName}
                        onChange={(e) => setProviderName(e.target.value)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="consumer" className="text-xs">
                        Consumer / Reference # *
                      </Label>
                      <Input
                        id="consumer"
                        placeholder="e.g. 24 11234 5678900 U"
                        value={consumerNumber}
                        onChange={(e) => setConsumerNumber(e.target.value)}
                        className="h-9 text-xs font-mono"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bill-month" className="text-xs">
                        Billing Month / Period *
                      </Label>
                      <Input
                        id="bill-month"
                        placeholder="e.g. Jan 2026"
                        value={billingMonth}
                        onChange={(e) => setBillingMonth(e.target.value)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {group === "FIXED_ASSET" && (
                <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
                  <div className="text-xs font-semibold text-foreground">
                    Fixed Asset Acquisition
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="asset-desc" className="text-xs">
                      Asset Description *
                    </Label>
                    <Input
                      id="asset-desc"
                      placeholder="e.g. 50kVA Perkins Diesel Generator, High-speed Loom"
                      value={assetDescription}
                      onChange={(e) => setAssetDescription(e.target.value)}
                      className="h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="asset-vendor" className="text-xs">
                        Vendor / Seller *
                      </Label>
                      <Input
                        id="asset-vendor"
                        placeholder="e.g. Power Gen Ltd"
                        value={assetVendor}
                        onChange={(e) => setAssetVendor(e.target.value)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="asset-cat" className="text-xs">
                        Category *
                      </Label>
                      <Select
                        value={assetCategory}
                        onValueChange={(val) => {
                          if (val) setAssetCategory(val as AssetCategory);
                        }}
                      >
                        <SelectTrigger id="asset-cat" className="h-9 text-xs">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MACHINERY">Plant & Machinery</SelectItem>
                          <SelectItem value="VEHICLE">Vehicles</SelectItem>
                          <SelectItem value="IT_EQUIPMENT">IT Equipment & Hardware</SelectItem>
                          <SelectItem value="FURNITURE">Furniture & Fixtures</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="asset-serial" className="text-xs">
                        Invoice / Serial #
                      </Label>
                      <Input
                        id="asset-serial"
                        placeholder="SN-9821 / INV-44"
                        value={assetSerial}
                        onChange={(e) => setAssetSerial(e.target.value)}
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Common Payment Fields */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-date" className="text-xs">
                    Disbursement Date *
                  </Label>
                  <Input
                    id="p-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="p-amount" className="text-xs">
                    Amount (PKR) *
                  </Label>
                  <Input
                    id="p-amount"
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="p-mode" className="text-xs">
                    Payment Method *
                  </Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(val) => {
                      if (val) setPaymentMethod(val as "BANK" | "CASH");
                    }}
                  >
                    <SelectTrigger id="p-mode" className="h-9 text-xs">
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BANK">Bank Transfer / Online</SelectItem>
                      <SelectItem value="CASH">Cash Disbursement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-notes" className="text-xs">
                  Notes & Audit Remarks
                </Label>
                <Textarea
                  id="p-notes"
                  placeholder="Optional notes or cheque numbers..."
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-xs resize-none"
                />
              </div>

              {/* Idempotency Protection Indicator */}
              <div className="rounded-md border bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Posting Idempotency Key:</span>
                <span className="font-mono text-[10px] text-foreground">{requestId}</span>
              </div>
            </div>

            <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || (group === "STATUTORY" && statutoryHead === "LABOUR")}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Posting Payment...
                  </>
                ) : (
                  "Post Payment Voucher"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Details Dialog */}
      <Dialog
        open={Boolean(selectedPayment)}
        onOpenChange={(open) => !open && setSelectedPayment(null)}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Outgoing Payment Voucher
            </DialogTitle>
            <DialogDescription>
              Voucher #{selectedPayment?.voucherNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3 border rounded-lg p-3 bg-muted/20">
                <div>
                  <div className="text-xs text-muted-foreground">Beneficiary</div>
                  <div className="font-semibold text-foreground">
                    {selectedPayment.beneficiary}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Date</div>
                  <div className="font-mono text-foreground">{selectedPayment.date}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Type</div>
                  <Badge variant="outline" className="mt-0.5 text-xs">
                    {selectedPayment.group}: {selectedPayment.headOrType}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Amount</div>
                  <div className="font-mono font-bold text-foreground">
                    PKR{" "}
                    {selectedPayment.amount.toLocaleString("en-PK", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Payment Mode</div>
                  <div className="font-mono text-foreground">{selectedPayment.paymentMethod}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Reference / CPR</div>
                  <div className="font-mono text-foreground">
                    {selectedPayment.referenceNumber}
                  </div>
                </div>
              </div>

              {selectedPayment.notes && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Notes</div>
                  <div className="p-2.5 rounded-md border bg-card text-xs">
                    {selectedPayment.notes}
                  </div>
                </div>
              )}

              <div className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-1 font-mono">
                <div className="text-muted-foreground font-sans text-[11px] font-medium">
                  Posting Status & Verification:
                </div>
                <div className="flex justify-between text-xs">
                  <span>General Ledger Voucher:</span>
                  <span className="font-bold">{selectedPayment.voucherNumber}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Idempotency Key:</span>
                  <span className="text-[10px]">{selectedPayment.idempotencyKey}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedPayment(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
