"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Receipt,
  Printer,
  Download,
  Eye,
  RotateCcw,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  CreditCard,
  Landmark,
  Banknote,
  FileCheck,
  Ban,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PoweredByFooter } from "@/components/shared/powered-by-footer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table/data-table";
import { EntitySelect } from "@/components/shared/entity-select";
import { generateNextCodeFromRows } from "@/lib/code-generator";
import { AppShell } from "@/components/layouts/app-shell";
import { api } from "@/lib/api/client";
import { generateCustomerReceiptPdf } from "@/lib/reports/sales-reports";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

interface Customer {
  id: string;
  name: string;
  customerCode?: string;
  taxNumber?: string;
}

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  paidAmount: number;
  withheldAmount: number;
  outstandingAmount: number;
  status: string;
}

interface AllocationRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  currentOutstanding: number;
  allocatedAmount: number;
  allocatedWithholding: number;
}

interface CustomerReceipt {
  id: string;
  receiptNumber: string;
  customerId: string;
  receiptDate: string;
  paymentMethod: "CASH" | "BANK" | "CHEQUE";
  amountReceived: number;
  taxWithheld: number;
  totalSettled: number;
  withholdingCertificate?: string;
  withholdingSection?: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeDate?: string;
  chequeStatus: "NONE" | "PENDING_CLEARANCE" | "CLEARED" | "RETURNED";
  clearedDate?: string;
  returnReason?: string;
  status: string;
  voucherId?: string;
  voucherNumber?: string;
  notes?: string;
  customer?: Customer;
  allocations?: {
    id?: string;
    invoiceId: string;
    allocatedAmount: number;
    allocatedWithholding: number;
    totalAllocated: number;
    invoice?: SalesInvoice;
  }[];
}

const chequeStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  PENDING_CLEARANCE: {
    label: "Cheque in Clearing",
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300",
  },
  CLEARED: {
    label: "Cheque Cleared",
    variant: "default",
    className: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  RETURNED: {
    label: "Bounced / Returned",
    variant: "destructive",
    className: "bg-rose-600 hover:bg-rose-700 text-white",
  },
  NONE: {
    label: "Direct Settlement",
    variant: "outline",
    className: "border-slate-300 dark:border-slate-700",
  },
};

const currencyFmt = (n: number | null | undefined) =>
  "₨ " + Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (v: any): number => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

export default function CustomerReceiptsPage() {
  const [receipts, setReceipts] = useState<CustomerReceipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [customerFilter, setCustomerFilter] = useState<string>("ALL");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");

  // Create Form Dialog State
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [receiptNumber, setReceiptNumber] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerInvoices, setCustomerInvoices] = useState<SalesInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [poReference, setPoReference] = useState<string>("");
  const [receiptDate, setReceiptDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK" | "CHEQUE">("BANK");

  // Cheque Fields
  const [chequeNumber, setChequeNumber] = useState<string>("");
  const [chequeBank, setChequeBank] = useState<string>("");
  const [chequeDate, setChequeDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // WHT Fields
  const [withholdingCertificate, setWithholdingCertificate] = useState<string>("");
  const [withholdingSection, setWithholdingSection] = useState<string>("153(1)(b)");
  const [notes, setNotes] = useState<string>("");
  const [showWhtSection, setShowWhtSection] = useState<boolean>(false);
  const [showMoreDetails, setShowMoreDetails] = useState<boolean>(false);

  // Invoice Allocations Table State
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);

  // Post Result Dialog State (Shows generated voucher & updated invoice balances)
  const [postResult, setPostResult] = useState<{
    receipt: CustomerReceipt;
    voucherNumber: string;
    allocatedInvoices: {
      invoiceNumber: string;
      originalOutstanding: number;
      settledAmount: number;
      remainingOutstanding: number;
    }[];
  } | null>(null);

  // View Details Modal State
  const [viewReceipt, setViewReceipt] = useState<CustomerReceipt | null>(null);

  // Cheque Actions Modal State
  const [actionTarget, setActionTarget] = useState<CustomerReceipt | null>(null);
  const [actionType, setActionType] = useState<"clear" | "return" | "reverse" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionDate, setActionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [actionLoading, setActionLoading] = useState(false);

  // Load Customers
  const loadCustomers = useCallback(async () => {
    try {
      const res = await api.get<any>("/sales/customers?limit=200");
      const list = Array.isArray(res) ? res : res?.data || [];
      setCustomers(list);
    } catch {
      // Ignored
    }
  }, []);

  // Fetch Receipts List
  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      let queryPath = "/sales/receipts";
      const params = new URLSearchParams();
      if (customerFilter !== "ALL") params.append("customerId", customerFilter);
      if (methodFilter !== "ALL") params.append("paymentMethod", methodFilter);
      if (params.toString()) queryPath += `?${params.toString()}`;

      const res = await api.get<any>(queryPath);
      const list = Array.isArray(res) ? res : res?.data || [];
      setReceipts(list);
    } catch (e: any) {
      toast.error(e.message || "Failed to load customer receipts");
    } finally {
      setLoading(false);
    }
  }, [customerFilter, methodFilter]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // When customer changes in creation dialog, fetch unpaid invoices for allocation
  const handleCustomerChange = async (custId: string) => {
    setSelectedCustomerId(custId);
    setAllocations([]);
    setCustomerInvoices([]);
    if (!custId) return;

    setLoadingInvoices(true);
    try {
      const res = await api.get<any>(`/sales/invoices?customerId=${custId}`);
      const list: SalesInvoice[] = Array.isArray(res) ? res : res?.data || [];
      // Only unpaid or partially paid active invoices
      const unpaid = list.filter(
        (inv) => inv.status !== "CANCELLED" && inv.outstandingAmount > 0.001
      );
      setCustomerInvoices(unpaid);

      // Prepopulate allocation rows
      const initialAllocations: AllocationRow[] = unpaid.map((inv) => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        totalAmount: inv.totalAmount,
        currentOutstanding: inv.outstandingAmount,
        allocatedAmount: 0,
        allocatedWithholding: 0,
      }));
      setAllocations(initialAllocations);
    } catch (err: any) {
      toast.error("Error loading customer invoices: " + err.message);
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Modify allocation row
  const updateAllocation = (
    invoiceId: string,
    field: "allocatedAmount" | "allocatedWithholding",
    val: string
  ) => {
    const parsed = num(val);
    setAllocations((prev) =>
      prev.map((row) => {
        if (row.invoiceId !== invoiceId) return row;
        const newAlloc = { ...row, [field]: parsed };
        return newAlloc;
      })
    );
  };

  // 1-Click Pay Full Outstanding Balance on an Invoice
  const handleAllocateFull = (invoiceId: string) => {
    setAllocations((prev) =>
      prev.map((row) => {
        if (row.invoiceId !== invoiceId) return row;
        return {
          ...row,
          allocatedAmount: row.currentOutstanding,
          allocatedWithholding: 0,
        };
      })
    );
  };

  // Clear Allocation
  const handleClearAllocation = (invoiceId: string) => {
    setAllocations((prev) =>
      prev.map((row) => {
        if (row.invoiceId !== invoiceId) return row;
        return {
          ...row,
          allocatedAmount: 0,
          allocatedWithholding: 0,
        };
      })
    );
  };

  // Calculate live settlement totals
  const totalReceived = useMemo(() => {
    return Math.round(allocations.reduce((sum, r) => sum + r.allocatedAmount, 0) * 100) / 100;
  }, [allocations]);

  const totalWithheld = useMemo(() => {
    return Math.round(allocations.reduce((sum, r) => sum + r.allocatedWithholding, 0) * 100) / 100;
  }, [allocations]);

  const totalSettled = useMemo(() => {
    return Math.round((totalReceived + totalWithheld) * 100) / 100;
  }, [totalReceived, totalWithheld]);

  // Reset form
  const resetForm = () => {
    setReceiptNumber(generateNextCodeFromRows("REC", receipts, (r) => r.receiptNumber));
    setSelectedCustomerId("");
    setCustomerInvoices([]);
    setAllocations([]);
    setPoReference("");
    setReceiptDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("BANK");
    setChequeNumber("");
    setChequeBank("");
    setChequeDate(new Date().toISOString().slice(0, 10));
    setWithholdingCertificate("");
    setWithholdingSection("153(1)(b)");
    setNotes("");
  };

  // Post Customer Receipt to Backend API
  const handlePostReceipt = async () => {
    if (!selectedCustomerId) {
      toast.error("Please select a customer.");
      return;
    }

    if (totalSettled <= 0) {
      toast.error("Please allocate a payment amount or withholding tax to at least one invoice.");
      return;
    }

    // Cheque validations
    if (paymentMethod === "CHEQUE") {
      if (!chequeNumber.trim()) {
        toast.error("Cheque Number is required for Cheque payments.");
        return;
      }
      if (!chequeBank.trim()) {
        toast.error("Bank Name is required for Cheque payments.");
        return;
      }
    }

    // Verify allocations do not exceed outstanding balances
    for (const alloc of allocations) {
      const lineSettled = alloc.allocatedAmount + alloc.allocatedWithholding;
      if (lineSettled > alloc.currentOutstanding + 0.01) {
        toast.error(
          `Allocation on ${alloc.invoiceNumber} (${currencyFmt(lineSettled)}) exceeds balance (${currencyFmt(alloc.currentOutstanding)})`
        );
        return;
      }
    }

    // Filter non-zero allocations
    const activeAllocations = allocations
      .filter((r) => r.allocatedAmount > 0 || r.allocatedWithholding > 0)
      .map((r) => ({
        invoiceId: r.invoiceId,
        amount: r.allocatedAmount,
        withholding: r.allocatedWithholding,
      }));

    setSubmitting(true);
    try {
      const payloadNotes = [
        poReference ? `PO Ref: ${poReference}` : null,
        notes ? notes.trim() : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const payload = {
        receiptNumber: receiptNumber.trim() || undefined,
        customerId: selectedCustomerId,
        receiptDate,
        paymentMethod,
        amountReceived: totalReceived,
        taxWithheld: totalWithheld,
        withholdingCertificate: withholdingCertificate.trim() || undefined,
        withholdingSection: withholdingCertificate.trim() ? withholdingSection : undefined,
        chequeNumber: paymentMethod === "CHEQUE" ? chequeNumber.trim() : undefined,
        chequeBank: paymentMethod === "CHEQUE" ? chequeBank.trim() : undefined,
        chequeDate: paymentMethod === "CHEQUE" ? chequeDate : undefined,
        notes: payloadNotes || undefined,
        allocations: activeAllocations,
      };

      const res = await api.post<CustomerReceipt>("/sales/receipts", payload);
      toast.success("Customer receipt posted and GL voucher generated!");

      // Prepare updated invoice balance details for post-submission feedback
      const updatedBalanceList = activeAllocations.map((alloc) => {
        const found = allocations.find((r) => r.invoiceId === alloc.invoiceId);
        const originalOutstanding = found ? found.currentOutstanding : 0;
        const settledAmount = alloc.amount + (alloc.withholding || 0);
        const remainingOutstanding = Math.max(0, Math.round((originalOutstanding - settledAmount) * 100) / 100);
        return {
          invoiceNumber: found ? found.invoiceNumber : alloc.invoiceId,
          originalOutstanding,
          settledAmount,
          remainingOutstanding,
        };
      });

      setCreateOpen(false);
      resetForm();
      fetchReceipts();

      // Show result dialog with voucher reference and remaining balances
      setPostResult({
        receipt: res,
        voucherNumber: (res as any).voucherNumber || res.voucherId || "Posted to GL",
        allocatedInvoices: updatedBalanceList,
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to post customer receipt");
    } finally {
      setSubmitting(false);
    }
  };

  // Print/Export PDF
  const handlePrintPdf = (receipt: CustomerReceipt) => {
    try {
      const doc = generateCustomerReceiptPdf(receipt);
      doc.save(`Receipt-${receipt.receiptNumber}.pdf`);
      toast.success(`Receipt voucher PDF downloaded (${receipt.receiptNumber})`);
    } catch (err: any) {
      toast.error("Error generating PDF: " + err.message);
    }
  };

  // Perform Cheque Action or Reversal
  const handleExecuteAction = async () => {
    if (!actionTarget || !actionType) return;
    setActionLoading(true);
    try {
      if (actionType === "clear") {
        await api.post(`/sales/receipts/${actionTarget.id}/clear-cheque`, {
          clearanceDate: actionDate,
        });
        toast.success(`Cheque for receipt ${actionTarget.receiptNumber} marked as CLEARED.`);
      } else if (actionType === "return") {
        if (!actionReason.trim()) {
          toast.error("Please enter a bounce / return reason.");
          setActionLoading(false);
          return;
        }
        await api.post(`/sales/receipts/${actionTarget.id}/return-cheque`, {
          reason: actionReason.trim(),
          returnDate: actionDate,
        });
        toast.success(`Cheque marked RETURNED and invoice balance restored.`);
      } else if (actionType === "reverse") {
        if (!actionReason.trim()) {
          toast.error("Please enter a reversal reason.");
          setActionLoading(false);
          return;
        }
        await api.post(`/sales/receipts/${actionTarget.id}/reverse`, {
          reason: actionReason.trim(),
          reversalDate: actionDate,
        });
        toast.success(`Customer receipt reversed and invoice balance reopened.`);
      }

      setActionTarget(null);
      setActionType(null);
      setActionReason("");
      fetchReceipts();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  // Aggregate KPI metrics
  const stats = useMemo(() => {
    const totalCollected = receipts.reduce(
      (sum, r) => sum + (r.status !== "REVERSED" ? r.amountReceived : 0),
      0
    );
    const totalWht = receipts.reduce(
      (sum, r) => sum + (r.status !== "REVERSED" ? r.taxWithheld : 0),
      0
    );
    const totalSettledVal = receipts.reduce(
      (sum, r) => sum + (r.status !== "REVERSED" ? r.totalSettled : 0),
      0
    );
    const unclearedCheques = receipts.filter(
      (r) => r.paymentMethod === "CHEQUE" && r.chequeStatus === "PENDING_CLEARANCE"
    );
    const unclearedVal = unclearedCheques.reduce((sum, r) => sum + r.amountReceived, 0);

    return { totalCollected, totalWht, totalSettledVal, unclearedCount: unclearedCheques.length, unclearedVal };
  }, [receipts]);

  // Table Columns
  const columns: ColumnDef<CustomerReceipt>[] = [
    {
      accessorKey: "receiptNumber",
      header: "Receipt #",
      cell: ({ row }) => {
        const rec = row.original;
        return (
          <div className="flex flex-col">
            <span
              className="font-semibold text-primary hover:underline cursor-pointer"
              onClick={() => setViewReceipt(rec)}
            >
              {rec.receiptNumber}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3 inline" />
              {rec.receiptDate ? new Date(rec.receiptDate).toLocaleDateString("en-PK") : "-"}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "customer.name",
      header: "Customer",
      cell: ({ row }) => {
        const rec = row.original;
        return (
          <div className="flex flex-col max-w-[200px]">
            <span className="font-medium truncate">
              {rec.customer?.name || "Customer #" + rec.customerId.slice(0, 8)}
            </span>
            <span className="text-xs text-muted-foreground">
              Code: {rec.customer?.customerCode || "-"}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "paymentMethod",
      header: "Method",
      cell: ({ row }) => {
        const rec = row.original;
        if (rec.paymentMethod === "CASH") {
          return (
            <Badge variant="outline" className="gap-1 border-emerald-400 text-emerald-700 dark:text-emerald-300">
              <Banknote className="h-3 w-3" /> Cash
            </Badge>
          );
        }
        if (rec.paymentMethod === "BANK") {
          return (
            <Badge variant="outline" className="gap-1 border-blue-400 text-blue-700 dark:text-blue-300">
              <Landmark className="h-3 w-3" /> Bank
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="gap-1 border-purple-400 text-purple-700 dark:text-purple-300">
            <CreditCard className="h-3 w-3" /> Cheque
          </Badge>
        );
      },
    },
    {
      accessorKey: "amountReceived",
      header: "Amount Received",
      cell: ({ row }) => {
        const rec = row.original;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {currencyFmt(rec.amountReceived)}
            </span>
            {rec.taxWithheld > 0 && (
              <span className="text-[11px] text-muted-foreground">
                WHT: {currencyFmt(rec.taxWithheld)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "totalSettled",
      header: "Total Settled",
      cell: ({ row }) => {
        const rec = row.original;
        return (
          <span className="font-bold font-mono">
            {currencyFmt(rec.totalSettled)}
          </span>
        );
      },
    },
    {
      accessorKey: "chequeStatus",
      header: "Status / Cheque",
      cell: ({ row }) => {
        const rec = row.original;
        if (rec.status === "REVERSED") {
          return <Badge variant="destructive">Reversed</Badge>;
        }
        if (rec.paymentMethod === "CHEQUE") {
          const cfg = chequeStatusConfig[rec.chequeStatus] || {
            label: rec.chequeStatus,
            variant: "outline",
          };
          return (
            <div className="flex flex-col gap-1 items-start">
              <Badge variant={cfg.variant} className={cfg.className}>
                {cfg.label}
              </Badge>
              {rec.chequeNumber && (
                <span className="text-[11px] font-mono text-muted-foreground">
                  #{rec.chequeNumber} ({rec.chequeBank || "Bank"})
                </span>
              )}
            </div>
          );
        }
        return (
          <Badge variant="default" className="bg-emerald-600 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Posted
          </Badge>
        );
      },
    },
    {
      accessorKey: "voucherId",
      header: "GL Voucher",
      cell: ({ row }) => {
        const rec = row.original;
        const vRef = rec.voucherNumber || rec.voucherId;
        if (!vRef) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <Badge variant="outline" className="font-mono text-xs font-normal border-slate-300 dark:border-slate-700">
            <ShieldCheck className="h-3 w-3 mr-1 text-emerald-600" />
            {vRef.length > 14 ? vRef.slice(0, 14) + "..." : vRef}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const rec = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => handlePrintPdf(rec)}
              title="Print Receipt Voucher PDF"
            >
              <Printer className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-muted text-muted-foreground">
                <span className="sr-only">Open menu</span>
                •••
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setViewReceipt(rec)}>
                  <Eye className="h-4 w-4 mr-2" /> View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrintPdf(rec)}>
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </DropdownMenuItem>

                {/* Cheque Clearance & Bounce actions */}
                {rec.paymentMethod === "CHEQUE" && rec.chequeStatus === "PENDING_CLEARANCE" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setActionTarget(rec);
                        setActionType("clear");
                        setActionReason("");
                      }}
                      className="text-emerald-600 font-medium"
                    >
                      <FileCheck className="h-4 w-4 mr-2" /> Mark Cheque Cleared
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setActionTarget(rec);
                        setActionType("return");
                        setActionReason("");
                      }}
                      className="text-destructive"
                    >
                      <Ban className="h-4 w-4 mr-2" /> Cheque Bounced / Return
                    </DropdownMenuItem>
                  </>
                )}

                {/* General Reversal */}
                {rec.status !== "REVERSED" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        setActionTarget(rec);
                        setActionType("reverse");
                        setActionReason("");
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" /> Reverse Receipt
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <AppShell title="Customer Receipts">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customer Receipts & Collections</h1>
            <p className="text-sm text-muted-foreground">
              Record payments against open sales invoices with withholding tax (WHT) and cheque tracking.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchReceipts} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              onClick={() => {
                resetForm();
                const localNext = generateNextCodeFromRows("REC", receipts, (r) => r.receiptNumber);
                setCreateOpen(true);
                api.get<CustomerReceipt[]>("/sales/receipts?limit=500").then((res) => {
                  const rows: CustomerReceipt[] = Array.isArray(res) ? res : (res as any)?.data || [];
                  const fullNext = generateNextCodeFromRows("REC", rows, (r) => r.receiptNumber);
                  setReceiptNumber((prev) => (prev === localNext ? fullNext : prev));
                }).catch(() => {});
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> Record Customer Receipt
            </Button>
          </div>
        </div>

        {/* Executive Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Collections
              </CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {currencyFmt(stats.totalCollected)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Cash & bank deposits received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tax Withheld (WHT)
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {currencyFmt(stats.totalWht)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Advance income tax (Sec 153)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Settled
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currencyFmt(stats.totalSettledVal)}</div>
              <p className="text-xs text-muted-foreground mt-1">Total AR credits applied</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Cheques in Clearing
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {currencyFmt(stats.unclearedVal)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stats.unclearedCount} pending cheques</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-muted/40 p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-muted-foreground">Customer:</Label>
            <Select value={customerFilter} onValueChange={(val: string | null) => val && setCustomerFilter(val)}>
              <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Customers</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-muted-foreground">Method:</Label>
            <Select value={methodFilter} onValueChange={(val: string | null) => val && setMethodFilter(val)}>
              <SelectTrigger className="w-[140px] h-8 text-xs bg-background">
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Methods</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BANK">Bank Transfer</SelectItem>
                <SelectItem value="CHEQUE">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(customerFilter !== "ALL" || methodFilter !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setCustomerFilter("ALL");
                setMethodFilter("ALL");
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>

        {/* Receipts Data Table */}
        <DataTable
          columns={columns}
          data={receipts}
          loading={loading}
          searchPlaceholder="Search receipts by number, customer, cheque #..."
        />

        {/* ----------------- RECORD CUSTOMER RECEIPT DIALOG ----------------- */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent size="wide">
            <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0 bg-background">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Record Customer Receipt
              </DialogTitle>
              <DialogDescription>
                Allocate customer collection to open sales invoices and generate official receipt voucher.
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto min-h-0 flex-1 px-6 py-4 space-y-5">
              {/* Customer Selector & Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-card border shadow-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Customer *</Label>
                  <EntitySelect
                    value={selectedCustomerId}
                    onValueChange={(val) => handleCustomerChange(val)}
                    entityLabel="Customer"
                    quickAddType="customer"
                    placeholder="Select Customer..."
                    className="bg-background h-9 text-xs"
                    options={customers.map((c) => ({
                      value: c.id,
                      label: `${c.name}${c.customerCode ? ` (${c.customerCode})` : ""}`,
                    }))}
                    onQuickCreated={(created) => {
                      setCustomers((prev) => [created, ...prev]);
                      if (created?.id) handleCustomerChange(created.id);
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Receipt # (Auto)</Label>
                  <Input
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    placeholder="REC-0001"
                    className="bg-background h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Receipt Date *</Label>
                  <Input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="bg-background h-9 text-xs"
                  />
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1.5 sm:col-span-3">
                  <Label className="text-xs font-semibold text-foreground">Payment Method *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={paymentMethod === "CASH" ? "default" : "outline"}
                      className="justify-center h-9 text-xs"
                      onClick={() => setPaymentMethod("CASH")}
                    >
                      <Banknote className="h-4 w-4 mr-2" /> Cash
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "BANK" ? "default" : "outline"}
                      className="justify-center h-9 text-xs"
                      onClick={() => setPaymentMethod("BANK")}
                    >
                      <Landmark className="h-4 w-4 mr-2" /> Bank Transfer
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "CHEQUE" ? "default" : "outline"}
                      className="justify-center h-9 text-xs"
                      onClick={() => setPaymentMethod("CHEQUE")}
                    >
                      <CreditCard className="h-4 w-4 mr-2" /> Cheque
                    </Button>
                  </div>
                </div>
              </div>

              {/* Conditionally Revealed Cheque Fields */}
              {paymentMethod === "CHEQUE" && (
                <div className="p-4 rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 space-y-3">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold text-xs">
                    <CreditCard className="h-4 w-4" /> Cheque Instrument Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Cheque Number *</Label>
                      <Input
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        placeholder="e.g. 00481923"
                        className="bg-background font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Bank Name *</Label>
                      <Input
                        value={chequeBank}
                        onChange={(e) => setChequeBank(e.target.value)}
                        placeholder="e.g. Meezan Bank, HBL, MCB"
                        className="bg-background"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Cheque Date / Clearance Due</Label>
                      <Input
                        type="date"
                        value={chequeDate}
                        onChange={(e) => setChequeDate(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">
                    Note: Cheque receipts are marked PENDING_CLEARANCE until cleared via the Cheque Clearing workflow.
                  </p>
                </div>
              )}

              {/* Invoice Allocation Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Invoice Allocations</Label>
                    <p className="text-xs text-muted-foreground">
                      Allocate received payment and withholding tax to open customer invoices.
                    </p>
                  </div>
                  {loadingInvoices && <span className="text-xs text-muted-foreground animate-pulse">Loading open invoices...</span>}
                </div>

                {!selectedCustomerId ? (
                  <div className="text-center py-8 border rounded-lg bg-muted/20 text-muted-foreground text-xs">
                    Select a customer above to view their unpaid invoices.
                  </div>
                ) : customerInvoices.length === 0 && !loadingInvoices ? (
                  <div className="text-center py-8 border rounded-lg bg-muted/20 text-muted-foreground text-xs">
                    No open or unpaid invoices found for this customer.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted text-muted-foreground border-b">
                        <tr>
                          <th className="py-2.5 px-3 text-left w-[20%]">Invoice #</th>
                          <th className="py-2.5 px-3 text-left w-[12%]">Date</th>
                          <th className="py-2.5 px-3 text-right w-[16%]">Total Amount</th>
                          <th className="py-2.5 px-3 text-right w-[16%]">Outstanding</th>
                          <th className="py-2.5 px-3 text-right w-[16%]">Allocate Amount *</th>
                          <th className="py-2.5 px-3 text-right w-[14%]">Tax Deducted (WHT)</th>
                          <th className="py-2.5 px-3 text-center w-[6%]">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {allocations.map((row) => {
                          const rowSettled = row.allocatedAmount + row.allocatedWithholding;
                          const remaining = Math.max(0, Math.round((row.currentOutstanding - rowSettled) * 100) / 100);
                          const isFullyAllocated = rowSettled >= row.currentOutstanding - 0.01 && rowSettled > 0;

                          return (
                            <tr key={row.invoiceId} className="hover:bg-muted/30">
                              <td className="p-2.5 font-semibold font-mono text-primary">
                                {row.invoiceNumber}
                              </td>
                              <td className="p-2.5 text-muted-foreground">
                                {row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString("en-PK") : "-"}
                              </td>
                              <td className="p-2.5 text-right font-mono text-muted-foreground">
                                {currencyFmt(row.totalAmount)}
                              </td>
                              <td className="p-2.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                                {currencyFmt(row.currentOutstanding)}
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={row.currentOutstanding}
                                  value={row.allocatedAmount || ""}
                                  onChange={(e) =>
                                    updateAllocation(row.invoiceId, "allocatedAmount", e.target.value)
                                  }
                                  placeholder="0.00"
                                  className="h-7 text-xs text-right font-mono"
                                />
                                {remaining > 0 && rowSettled > 0 && (
                                  <span className="text-[10px] text-muted-foreground text-right block mt-0.5">
                                    Bal: {currencyFmt(remaining)}
                                  </span>
                                )}
                                {isFullyAllocated && (
                                  <span className="text-[10px] text-emerald-600 font-medium text-right block mt-0.5">
                                    Fully Paid
                                  </span>
                                )}
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={row.allocatedWithholding || ""}
                                  onChange={(e) =>
                                    updateAllocation(row.invoiceId, "allocatedWithholding", e.target.value)
                                  }
                                  placeholder="WHT (PKR)"
                                  className="h-7 text-xs text-right font-mono"
                                />
                              </td>
                              <td className="p-2 text-center">
                                {rowSettled > 0 ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                                    onClick={() => handleClearAllocation(row.invoiceId)}
                                  >
                                    Clear
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => handleAllocateFull(row.invoiceId)}
                                  >
                                    Pay Full
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Optional: Tax Deducted at Source */}
              <div className="border rounded-lg bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowWhtSection((prev) => !prev)}
                  className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-semibold text-primary hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    <span>
                      {showWhtSection || totalWithheld > 0
                        ? "− Hide Tax Deducted at Source"
                        : "+ Tax Deducted at Source / Withholding Tax (Optional)"}
                    </span>
                  </div>
                  {showWhtSection || totalWithheld > 0 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {(showWhtSection || totalWithheld > 0) && (
                  <div className="p-4 border-t space-y-3 bg-muted/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">WHT Certificate # / CPR #</Label>
                        <Input
                          value={withholdingCertificate}
                          onChange={(e) => setWithholdingCertificate(e.target.value)}
                          placeholder="e.g. CPR-2026-99"
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Tax Ordinance Section</Label>
                        <Input
                          value={withholdingSection}
                          onChange={(e) => setWithholdingSection(e.target.value)}
                          placeholder="e.g. Sec 153(1)(b)"
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Enter withholding tax amount in the allocations table above. Deductions record Dr Withholding Income Tax Receivable and Cr Customer AR.
                    </p>
                  </div>
                )}
              </div>

              {/* Collapsible More Details: PO Ref & Notes */}
              <div className="border rounded-lg bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMoreDetails((prev) => !prev)}
                  className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-semibold text-primary hover:bg-muted/40 transition-colors"
                >
                  <span>{showMoreDetails ? "− Hide More Details" : "+ More details (PO Reference, Advice Ref, Notes)"}</span>
                  {showMoreDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showMoreDetails && (
                  <div className="p-4 border-t space-y-3 bg-muted/10">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Customer PO Reference / Payment Advice Ref</Label>
                      <Input
                        value={poReference}
                        onChange={(e) => setPoReference(e.target.value)}
                        placeholder="e.g. PO-8812 / Adv-01"
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Remarks / Notes</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Transaction reference, customer contact remarks..."
                        rows={2}
                        className="text-xs bg-background"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Live Settlement Total Card */}
              <div className="bg-muted/60 p-4 rounded-lg border space-y-2.5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Settlement Summary (Cash Received Separated from Withholding)
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Actual Cash / Bank Received:</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {currencyFmt(totalReceived)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tax Deducted at Source (WHT):</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                    + {currencyFmt(totalWithheld)}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm font-bold">
                  <span>Total Invoice Amount Settled:</span>
                  <span className="font-mono text-primary text-base">
                    {currencyFmt(totalSettled)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground italic">
                  Posting increases total settled, reduces outstanding AR balance, and reports actual cash received separately from tax withheld. Reversal or cheque bounce restores the original balance.
                </p>
              </div>
            </div>

            <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handlePostReceipt} disabled={submitting}>
                {submitting ? "Posting Voucher..." : "Post Customer Receipt"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ----------------- POSTED SUCCESS MODAL WITH UPDATED INVOICE BALANCES ----------------- */}
        <Dialog open={!!postResult} onOpenChange={() => setPostResult(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mb-2">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center text-xl">Customer Receipt Recorded!</DialogTitle>
              <DialogDescription className="text-center text-xs">
                Voucher posted to General Ledger and invoice balances updated.
              </DialogDescription>
            </DialogHeader>

            {postResult && (
              <div className="space-y-4 py-2">
                {/* Voucher Meta */}
                <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Receipt Number:</span>
                    <span className="font-mono font-bold text-primary">
                      {postResult.receipt.receiptNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">GL Voucher Reference:</span>
                    <Badge variant="outline" className="font-mono font-semibold bg-background border-emerald-500 text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="h-3 w-3 mr-1 inline" />
                      {postResult.voucherNumber}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Payment Mode:</span>
                    <span className="font-medium">{postResult.receipt.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Settled:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {currencyFmt(postResult.receipt.totalSettled)}
                    </span>
                  </div>
                </div>

                {/* Updated Remaining Balances */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Updated Remaining Invoice Balances</Label>
                  <div className="border rounded-lg overflow-hidden text-xs">
                    <table className="w-full">
                      <thead className="bg-muted text-muted-foreground">
                        <tr>
                          <th className="py-2 px-3 text-left">Invoice #</th>
                          <th className="py-2 px-3 text-right">Settled</th>
                          <th className="py-2 px-3 text-right">Remaining Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-mono">
                        {postResult.allocatedInvoices.map((inv, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-medium text-foreground">{inv.invoiceNumber}</td>
                            <td className="p-2.5 text-right text-emerald-600">
                              {currencyFmt(inv.settledAmount)}
                            </td>
                            <td className="p-2.5 text-right font-bold">
                              {inv.remainingOutstanding <= 0.01 ? (
                                <span className="text-emerald-600">₨ 0.00 (Cleared)</span>
                              ) : (
                                <span className="text-amber-600">
                                  {currencyFmt(inv.remainingOutstanding)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handlePrintPdf(postResult.receipt)}
                  >
                    <Printer className="h-4 w-4 mr-2" /> Print / Export PDF
                  </Button>
                  <Button className="flex-1" onClick={() => setPostResult(null)}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ----------------- VIEW RECEIPT DETAILS MODAL ----------------- */}
        <Dialog open={!!viewReceipt} onOpenChange={() => setViewReceipt(null)}>
          <DialogContent size="wide">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Customer Receipt {viewReceipt?.receiptNumber}
                </DialogTitle>
                {viewReceipt && (
                  <Badge variant="outline" className="font-mono">
                    {viewReceipt.paymentMethod}
                  </Badge>
                )}
              </div>
              <DialogDescription>
                Settlement breakdown, withholding certificate, and GL journal links.
              </DialogDescription>
            </DialogHeader>

            {viewReceipt && (
              <div className="space-y-5 py-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg border text-xs">
                  <div>
                    <span className="text-muted-foreground block">Customer:</span>
                    <span className="font-semibold">{viewReceipt.customer?.name || "Client"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Receipt Date:</span>
                    <span>{new Date(viewReceipt.receiptDate).toLocaleDateString("en-PK")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">GL Voucher:</span>
                    <span className="font-mono text-emerald-600 font-medium">
                      {viewReceipt.voucherNumber || viewReceipt.voucherId || "VOUCHER-POSTED"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Cheque Status:</span>
                    <span className="font-medium">{viewReceipt.chequeStatus}</span>
                  </div>
                </div>

                {viewReceipt.paymentMethod === "CHEQUE" && (
                  <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3 rounded-lg text-xs space-y-1">
                    <span className="font-semibold text-purple-700 dark:text-purple-300">
                      Cheque Instrument:
                    </span>
                    <p className="font-mono">
                      Cheque #{viewReceipt.chequeNumber} — {viewReceipt.chequeBank} (Dated:{" "}
                      {viewReceipt.chequeDate
                        ? new Date(viewReceipt.chequeDate).toLocaleDateString("en-PK")
                        : "-"}
                      )
                    </p>
                    {viewReceipt.returnReason && (
                      <p className="text-destructive font-medium">
                        Return Reason: {viewReceipt.returnReason}
                      </p>
                    )}
                  </div>
                )}

                {/* Allocations Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-muted-foreground border-b">
                      <tr>
                        <th className="py-2 px-3 text-left">Invoice #</th>
                        <th className="py-2 px-3 text-right">Cash / Bank Settled</th>
                        <th className="py-2 px-3 text-right">Tax Withheld</th>
                        <th className="py-2 px-3 text-right">Total Allocated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {(viewReceipt.allocations || []).map((alloc: any, i: number) => (
                        <tr key={i}>
                          <td className="p-2.5 font-medium text-foreground">
                            {alloc.invoice?.invoiceNumber || alloc.invoiceId}
                          </td>
                          <td className="p-2.5 text-right text-emerald-600">
                            {currencyFmt(alloc.allocatedAmount)}
                          </td>
                          <td className="p-2.5 text-right text-blue-600">
                            {currencyFmt(alloc.allocatedWithholding || 0)}
                          </td>
                          <td className="p-2.5 text-right font-bold">
                            {currencyFmt(alloc.totalAllocated)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="flex flex-col sm:flex-row justify-between gap-4 bg-muted/30 p-4 rounded-lg border text-xs">
                  <div className="space-y-1">
                    <span className="text-muted-foreground block">Notes & Certificate:</span>
                    <p className="italic text-foreground">{viewReceipt.notes || "None"}</p>
                    {viewReceipt.withholdingCertificate && (
                      <p className="text-blue-600 font-mono">
                        WHT Cert: {viewReceipt.withholdingCertificate} (
                        {viewReceipt.withholdingSection || "Sec 153"})
                      </p>
                    )}
                  </div>
                  <div className="sm:w-64 space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount Received:</span>
                      <span className="text-emerald-600 font-semibold">
                        {currencyFmt(viewReceipt.amountReceived)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Withholding Tax:</span>
                      <span className="text-blue-600 font-semibold">
                        {currencyFmt(viewReceipt.taxWithheld)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-1 text-sm">
                      <span>Total Settled:</span>
                      <span>{currencyFmt(viewReceipt.totalSettled)}</span>
                    </div>
                  </div>
                </div>
                <PoweredByFooter compact className="pt-1" />
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              {viewReceipt && (
                <Button variant="outline" onClick={() => handlePrintPdf(viewReceipt)}>
                  <Printer className="h-4 w-4 mr-2" /> Print / Export PDF
                </Button>
              )}
              <Button onClick={() => setViewReceipt(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ----------------- CHEQUE ACTION / REVERSAL DIALOG ----------------- */}
        <Dialog open={!!actionTarget} onOpenChange={() => setActionTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {actionType === "clear" && <FileCheck className="h-5 w-5 text-emerald-600" />}
                {actionType === "return" && <Ban className="h-5 w-5 text-destructive" />}
                {actionType === "reverse" && <RotateCcw className="h-5 w-5 text-destructive" />}
                {actionType === "clear" && "Clear Cheque Deposit"}
                {actionType === "return" && "Record Cheque Return / Bounce"}
                {actionType === "reverse" && "Reverse Customer Receipt"}
              </DialogTitle>
              <DialogDescription>
                {actionType === "clear" &&
                  `Confirm that cheque #${actionTarget?.chequeNumber} has been cleared by the bank and funds moved to main bank account.`}
                {actionType === "return" &&
                  `Marking cheque #${actionTarget?.chequeNumber} as bounced will reverse the GL voucher and restore unpaid balances on original invoices.`}
                {actionType === "reverse" &&
                  `Reversing receipt ${actionTarget?.receiptNumber} will post a contra-voucher and re-open unpaid invoice balances.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Action Date</Label>
                <Input
                  type="date"
                  value={actionDate}
                  onChange={(e) => setActionDate(e.target.value)}
                />
              </div>

              {(actionType === "return" || actionType === "reverse") && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Reason *</Label>
                  <Textarea
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="e.g. Insufficient funds, signature mismatch, payment disputed..."
                    rows={3}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setActionTarget(null)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant={actionType === "clear" ? "default" : "destructive"}
                onClick={handleExecuteAction}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Confirm Action"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
