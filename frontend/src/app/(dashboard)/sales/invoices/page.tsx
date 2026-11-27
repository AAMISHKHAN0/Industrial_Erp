"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  FileText,
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
  Trash2,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { generateSalesInvoicePdf } from "@/lib/reports/sales-reports";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

interface Customer {
  id: string;
  name: string;
  customerCode?: string;
  taxNumber?: string;
  address?: string;
  city?: string;
  phone?: string;
}

interface InventoryItem {
  id: string;
  itemCode?: string;
  name: string;
  sellingPrice?: number;
  unitPrice?: number;
}

export type TaxTreatment = "STANDARD" | "ZERO_RATED" | "EXEMPT" | "CUSTOM";

interface LineItem {
  id: string;
  itemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxTreatment?: TaxTreatment;
  taxPct: number;
  taxAmount: number;
  lineTotal: number;
}

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  soId?: string;
  invoiceDate: string;
  dueDate?: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  withheldAmount: number;
  outstandingAmount: number;
  customerTaxId?: string;
  billingAddress?: string;
  notes?: string;
  voucherId?: string;
  voucherNumber?: string;
  customer?: Customer;
  items?: LineItem[];
  allocations?: any[];
  createdAt: string;
}

const statusBadgeConfig: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }
> = {
  POSTED: { variant: "outline", label: "Posted (Open)", className: "border-blue-500 text-blue-600 dark:text-blue-400" },
  PARTIALLY_PAID: { variant: "secondary", label: "Partially Paid", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300" },
  PAID: { variant: "default", label: "Paid", className: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  CANCELLED: { variant: "destructive", label: "Cancelled", className: "" },
  REVERSED: { variant: "destructive", label: "Reversed", className: "" },
};

const currencyFmt = (n: number | null | undefined) =>
  "₨ " + Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (v: any): number => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [customerFilter, setCustomerFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Create Dialog State
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState<string>("");
  const [customerTaxId, setCustomerTaxId] = useState<string>("");
  const [customerNTN, setCustomerNTN] = useState<string>("");
  const [customerSTRN, setCustomerSTRN] = useState<string>("");
  const [rawAmbiguousTaxId, setRawAmbiguousTaxId] = useState<string>("");
  const [showMoreDetails, setShowMoreDetails] = useState<boolean>(false);
  const [billingAddress, setBillingAddress] = useState<string>("");
  const [customerPoRef, setCustomerPoRef] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: "line-1",
      itemId: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxTreatment: "STANDARD",
      taxPct: 18,
      taxAmount: 0,
      lineTotal: 0,
    },
  ]);

  // Post-Posting Result Dialog State
  const [postedResult, setPostedResult] = useState<{
    invoice: SalesInvoice;
    voucherNumber: string;
  } | null>(null);

  // View Details Dialog State
  const [viewInvoice, setViewInvoice] = useState<SalesInvoice | null>(null);

  // Reverse Dialog State
  const [reverseTarget, setReverseTarget] = useState<SalesInvoice | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);

  // Load Customers & Invoices
  const loadCustomers = useCallback(async () => {
    try {
      const res = await api.get<any>("/sales/customers?limit=200");
      const list = Array.isArray(res) ? res : res?.data || [];
      setCustomers(list);
    } catch {
      // Fallback if endpoint fails
    }
  }, []);

  const loadInventoryItems = useCallback(async () => {
    try {
      const res = await api.get<any>("/inventory/items?limit=200");
      const list = Array.isArray(res) ? res : res?.data || [];
      setInventoryItems(list);
    } catch {
      // Items are optional
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      let queryPath = "/sales/invoices";
      const params = new URLSearchParams();
      if (customerFilter !== "ALL") params.append("customerId", customerFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (params.toString()) queryPath += `?${params.toString()}`;

      const res = await api.get<any>(queryPath);
      const list = Array.isArray(res) ? res : res?.data || [];
      setInvoices(list);
    } catch (e: any) {
      toast.error(e.message || "Failed to load sales invoices");
    } finally {
      setLoading(false);
    }
  }, [customerFilter, statusFilter]);

  useEffect(() => {
    loadCustomers();
    loadInventoryItems();
  }, [loadCustomers, loadInventoryItems]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Auto-fill customer details when selection changes
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const found = customers.find((c) => c.id === customerId);
    if (found) {
      setCustomerName(found.name);
      const raw = (found.taxNumber || "").trim();
      setCustomerTaxId(raw);
      setRawAmbiguousTaxId("");

      // Try structured parsing:
      // Format: "NTN: 1234567-8 | STRN: 1234567890123"
      const combinedMatch = raw.match(/NTN[:\s]*([^\s|]+).*?STRN[:\s]*([^\s|]+)/i) ||
        raw.match(/STRN[:\s]*([^\s|]+).*?NTN[:\s]*([^\s|]+)/i);

      if (combinedMatch) {
        if (raw.toLowerCase().indexOf("ntn") < raw.toLowerCase().indexOf("strn")) {
          setCustomerNTN(combinedMatch[1]);
          setCustomerSTRN(combinedMatch[2]);
        } else {
          setCustomerSTRN(combinedMatch[1]);
          setCustomerNTN(combinedMatch[2]);
        }
      } else {
        const ntnMatch = raw.match(/NTN[:\s-]*([0-9]{7}-?[0-9])/i) || raw.match(/\b([0-9]{7}-[0-9])\b/);
        const strnMatch = raw.match(/(?:STRN|STN)[:\s-]*([0-9]{13})/i) || raw.match(/\b([0-9]{13})\b/);

        if (ntnMatch || strnMatch) {
          setCustomerNTN(ntnMatch ? ntnMatch[1] : "");
          setCustomerSTRN(strnMatch ? strnMatch[1] : "");
        } else if (raw) {
          // Ambiguous or legacy custom format - preserve exactly
          setCustomerNTN(raw);
          setCustomerSTRN("");
          setRawAmbiguousTaxId(raw);
        } else {
          setCustomerNTN("");
          setCustomerSTRN("");
        }
      }

      setBillingAddress(found.address ? `${found.address}${found.city ? ", " + found.city : ""}` : "");
    } else {
      setCustomerTaxId("");
      setCustomerNTN("");
      setCustomerSTRN("");
      setRawAmbiguousTaxId("");
      setBillingAddress("");
    }
  };

  // Line Items calculations with distinct tax treatment
  const calculateLine = (qty: number, price: number, taxRate: number) => {
    const sub = Math.round(qty * price * 100) / 100;
    const tax = Math.round((sub * (taxRate / 100)) * 100) / 100;
    const total = Math.round((sub + tax) * 100) / 100;
    return { sub, tax, total };
  };

  const updateLineItem = (id: string, field: keyof LineItem | "taxTreatment", val: any) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item };

        if (field === "taxTreatment") {
          const treatment = val as TaxTreatment;
          updated.taxTreatment = treatment;
          if (treatment === "STANDARD") {
            updated.taxPct = 18;
          } else if (treatment === "ZERO_RATED" || treatment === "EXEMPT") {
            updated.taxPct = 0;
            updated.taxAmount = 0;
          }
        } else if (field === "taxAmount") {
          // Custom tax amount entered directly by user!
          const amt = Math.max(0, num(val));
          updated.taxAmount = amt;
          const sub = Math.round(item.quantity * item.unitPrice * 100) / 100;
          updated.taxPct = sub > 0 ? Math.round((amt / sub) * 10000) / 100 : 0;
          updated.taxTreatment = updated.taxPct === 18 ? "STANDARD" : updated.taxPct === 0 ? "ZERO_RATED" : "CUSTOM";
          updated.lineTotal = Math.round((sub + amt) * 100) / 100;
          return updated;
        } else {
          (updated as any)[field] = val;
        }

        // If user picked an inventory item
        if (field === "itemId" && val) {
          const matchedItem = inventoryItems.find((i) => i.id === val);
          if (matchedItem) {
            updated.description = matchedItem.name;
            if (matchedItem.sellingPrice || matchedItem.unitPrice) {
              updated.unitPrice = matchedItem.sellingPrice || matchedItem.unitPrice || 0;
            }
          }
        }

        const qty = field === "quantity" ? num(val) : updated.quantity;
        const price = field === "unitPrice" ? num(val) : updated.unitPrice;
        let taxRate = field === "taxPct" ? Math.max(0, num(val)) : updated.taxPct;
        if (field === "taxPct") {
          updated.taxPct = taxRate;
          updated.taxTreatment = taxRate === 18 ? "STANDARD" : taxRate === 0 ? "ZERO_RATED" : "CUSTOM";
        }

        const { tax, total } = calculateLine(qty, price, taxRate);
        updated.taxAmount = tax;
        updated.lineTotal = total;
        return updated;
      })
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        itemId: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        taxTreatment: "STANDARD",
        taxPct: 18,
        taxAmount: 0,
        lineTotal: 0,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      toast.warning("At least one line item is required.");
      return;
    }
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Dynamic Totals Calculation with applied tax breakdown
  const totals = useMemo(() => {
    let subtotal = 0;
    let standardSubtotal = 0;
    let zeroRatedSubtotal = 0;
    let exemptSubtotal = 0;
    let totalTax = 0;

    for (const item of lineItems) {
      const lineSub = Math.round(item.quantity * item.unitPrice * 100) / 100;
      subtotal += lineSub;
      totalTax += item.taxAmount;

      if (item.taxTreatment === "ZERO_RATED") {
        zeroRatedSubtotal += lineSub;
      } else if (item.taxTreatment === "EXEMPT") {
        exemptSubtotal += lineSub;
      } else {
        standardSubtotal += lineSub;
      }
    }

    subtotal = Math.round(subtotal * 100) / 100;
    standardSubtotal = Math.round(standardSubtotal * 100) / 100;
    zeroRatedSubtotal = Math.round(zeroRatedSubtotal * 100) / 100;
    exemptSubtotal = Math.round(exemptSubtotal * 100) / 100;
    totalTax = Math.round(totalTax * 100) / 100;
    const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;
    const effectiveTaxPct = subtotal > 0 ? Math.round((totalTax / subtotal) * 1000) / 10 : 0;

    return { subtotal, standardSubtotal, zeroRatedSubtotal, exemptSubtotal, totalTax, grandTotal, effectiveTaxPct };
  }, [lineItems]);

  const resetCreateForm = () => {
    setSelectedCustomerId("");
    setCustomerName("");
    setCustomInvoiceNumber("");
    setCustomerTaxId("");
    setCustomerNTN("");
    setCustomerSTRN("");
    setRawAmbiguousTaxId("");
    setShowMoreDetails(false);
    setBillingAddress("");
    setCustomerPoRef("");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().slice(0, 10));
    setNotes("");
    setLineItems([
      {
        id: "line-1",
        itemId: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        taxTreatment: "STANDARD",
        taxPct: 18,
        taxAmount: 0,
        lineTotal: 0,
      },
    ]);
  };

  // Create & Post Invoice
  const handlePostInvoice = async () => {
    if (!customerName.trim()) {
      toast.error("Please enter or select a customer name.");
      return;
    }
    for (const item of lineItems) {
      if (!item.description.trim()) {
        toast.error("Every line item must have a description.");
        return;
      }
      if (item.quantity <= 0) {
        toast.error("Item quantity must be greater than zero.");
        return;
      }
      if (item.unitPrice < 0) {
        toast.error("Unit price cannot be negative.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payloadNotes = [
        customerPoRef ? `Customer PO: ${customerPoRef}` : null,
        notes ? notes.trim() : null,
      ]
        .filter(Boolean)
        .join(" | ");

      let effectiveTaxId = "";
      if (customerNTN.trim() && customerSTRN.trim()) {
        effectiveTaxId = `NTN: ${customerNTN.trim()} | STRN: ${customerSTRN.trim()}`;
      } else if (customerNTN.trim()) {
        effectiveTaxId = customerNTN.trim();
      } else if (customerSTRN.trim()) {
        effectiveTaxId = `STRN: ${customerSTRN.trim()}`;
      } else {
        effectiveTaxId = rawAmbiguousTaxId || customerTaxId.trim();
      }

      const payload = {
        customerId: selectedCustomerId && selectedCustomerId !== "custom" ? selectedCustomerId : undefined,
        customerName: customerName.trim(),
        invoiceNumber: customInvoiceNumber.trim() || undefined,
        invoiceDate,
        dueDate: dueDate || undefined,
        customerTaxId: effectiveTaxId || undefined,
        billingAddress: billingAddress.trim() || undefined,
        notes: payloadNotes || undefined,
        items: lineItems.map((item) => ({
          itemId: item.itemId ? item.itemId : undefined,
          description: item.description.trim(),
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          taxPct: Number(item.taxPct) || 0,
          taxAmount: Number(item.taxAmount) || 0,
        })),
      };

      const res = await api.post<SalesInvoice>("/sales/invoices", payload);
      toast.success("Sales Invoice posted and GL voucher generated!");

      setCreateOpen(false);
      resetCreateForm();
      fetchInvoices();

      // Show prominent success notification dialog with Voucher Number & Invoice Number
      setPostedResult({
        invoice: res,
        voucherNumber: (res as any).voucherNumber || res.voucherId || "Posted to GL",
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to post sales invoice");
    } finally {
      setSubmitting(false);
    }
  };

  // PDF Print / Export
  const handlePrintPdf = (invoice: SalesInvoice) => {
    try {
      const doc = generateSalesInvoicePdf(invoice);
      doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
      toast.success(`PDF exported for invoice ${invoice.invoiceNumber}`);
    } catch (err: any) {
      toast.error("Error generating PDF: " + err.message);
    }
  };

  // Reverse Invoice
  const handleReverse = async () => {
    if (!reverseTarget) return;
    if (!reverseReason.trim()) {
      toast.error("Please enter a cancellation reason.");
      return;
    }
    setReversing(true);
    try {
      await api.post(`/sales/invoices/${reverseTarget.id}/reverse`, {
        reason: reverseReason.trim(),
      });
      toast.success(`Invoice ${reverseTarget.invoiceNumber} reversed successfully.`);
      setReverseTarget(null);
      setReverseReason("");
      fetchInvoices();
    } catch (e: any) {
      toast.error(e.message || "Failed to reverse invoice");
    } finally {
      setReversing(false);
    }
  };

  // Aggregate KPI metrics
  const stats = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, i) => sum + (i.status !== "CANCELLED" ? i.totalAmount : 0), 0);
    const totalOutstanding = invoices.reduce(
      (sum, i) => sum + (i.status !== "CANCELLED" ? i.outstandingAmount : 0),
      0
    );
    const totalCollected = invoices.reduce((sum, i) => sum + (i.status !== "CANCELLED" ? i.paidAmount : 0), 0);
    const unpaidCount = invoices.filter(
      (i) => i.status !== "CANCELLED" && i.outstandingAmount > 0
    ).length;

    return { totalInvoiced, totalOutstanding, totalCollected, unpaidCount };
  }, [invoices]);

  // Table Columns
  const columns: ColumnDef<SalesInvoice>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-primary hover:underline cursor-pointer" onClick={() => setViewInvoice(inv)}>
              {inv.invoiceNumber}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3 inline" />
              {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("en-PK") : "-"}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "customer.name",
      header: "Customer",
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <div className="flex flex-col max-w-[200px]">
            <span className="font-medium truncate">{inv.customer?.name || "Customer #" + inv.customerId.slice(0, 8)}</span>
            <span className="text-xs text-muted-foreground">
              NTN/STN: {inv.customerTaxId || inv.customer?.taxNumber || "Unregistered"}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "totalAmount",
      header: "Invoice Total",
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <div className="flex flex-col">
            <span className="font-semibold">{currencyFmt(inv.totalAmount)}</span>
            <span className="text-[11px] text-muted-foreground">
              Tax: {currencyFmt(inv.taxAmount)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "outstandingAmount",
      header: "Outstanding",
      cell: ({ row }) => {
        const inv = row.original;
        if (inv.status === "CANCELLED") {
          return <span className="text-xs text-muted-foreground italic">Cancelled</span>;
        }
        const isPaid = inv.outstandingAmount <= 0.01;
        return (
          <div className="flex flex-col">
            <span className={`font-semibold ${isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              {currencyFmt(inv.outstandingAmount)}
            </span>
            {inv.paidAmount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                Paid: {currencyFmt(inv.paidAmount)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "voucherId",
      header: "GL Voucher",
      cell: ({ row }) => {
        const inv = row.original;
        const vRef = inv.voucherNumber || inv.voucherId;
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
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const inv = row.original;
        const cfg = statusBadgeConfig[inv.status] || { variant: "outline", label: inv.status };
        return <Badge variant={cfg.variant} className={cfg.className}>{cfg.label}</Badge>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => handlePrintPdf(inv)}
              title="Export / Print PDF"
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
                <DropdownMenuItem onClick={() => setViewInvoice(inv)}>
                  <Eye className="h-4 w-4 mr-2" /> View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrintPdf(inv)}>
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </DropdownMenuItem>
                {inv.status !== "CANCELLED" && inv.paidAmount === 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        setReverseTarget(inv);
                        setReverseReason("");
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" /> Reverse / Cancel
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
    <AppShell title="Sales Invoices">
      <div className="space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sales Invoices</h1>
            <p className="text-sm text-muted-foreground">
              Official sales tax invoices, automatic GL voucher generation, and receivable tracking.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              onClick={() => {
                resetCreateForm();
                const nextInv = generateNextCodeFromRows("INV", invoices, (i) => i.invoiceNumber);
                setCustomInvoiceNumber(nextInv);
                setCreateOpen(true);
                api.get<SalesInvoice[]>("/sales/invoices?limit=500").then((res) => {
                  const rows: SalesInvoice[] = Array.isArray(res) ? res : (res as any)?.data || [];
                  const fullInv = generateNextCodeFromRows("INV", rows, (i) => i.invoiceNumber);
                  setCustomInvoiceNumber((prev) => (prev === nextInv ? fullInv : prev));
                }).catch(() => {});
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> New Sales Invoice
            </Button>
          </div>
        </div>

        {/* Executive Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Invoiced
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currencyFmt(stats.totalInvoiced)}</div>
              <p className="text-xs text-muted-foreground mt-1">{invoices.length} total invoices issued</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Open Receivables
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {currencyFmt(stats.totalOutstanding)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stats.unpaidCount} unpaid / partial invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Collected Amount
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {currencyFmt(stats.totalCollected)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Settled via customer receipts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Active Customers
              </CardTitle>
              <Building2 className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customers.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered clients in database</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter bar */}
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
            <Label className="text-xs font-medium text-muted-foreground">Status:</Label>
            <Select value={statusFilter} onValueChange={(val: string | null) => val && setStatusFilter(val)}>
              <SelectTrigger className="w-[150px] h-8 text-xs bg-background">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="POSTED">Posted (Open)</SelectItem>
                <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(customerFilter !== "ALL" || statusFilter !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setCustomerFilter("ALL");
                setStatusFilter("ALL");
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>

        {/* Invoices Data Table */}
        <DataTable
          columns={columns}
          data={invoices}
          loading={loading}
          searchPlaceholder="Search invoices by number, customer, tax ID..."
        />

        {/* ----------------- CREATE SALES INVOICE DIALOG ----------------- */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent size="wide">
            <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0 bg-background">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                New Official Sales Invoice
              </DialogTitle>
              <DialogDescription>
                Issue a sales tax invoice with automatic accounts receivable and tax ledger posting.
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto min-h-0 flex-1 px-6 py-4 space-y-4">
              {/* 1. Everyday Core Fields: Customer, Invoice # & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 rounded-lg bg-card border shadow-xs">
                {/* Pick saved customer */}
                <div className="sm:col-span-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Select Saved Customer</Label>
                    <span className="text-[10px] text-muted-foreground">Pick or add new</span>
                  </div>
                  <EntitySelect
                    value={selectedCustomerId === "custom" ? "" : selectedCustomerId}
                    onValueChange={(val) => {
                      if (!val) {
                        setSelectedCustomerId("custom");
                        handleCustomerChange("");
                      } else {
                        handleCustomerChange(val);
                      }
                    }}
                    entityLabel="Customer"
                    quickAddType="customer"
                    placeholder="Select Customer..."
                    allowNone
                    noneLabel="+ Custom / Walk-in Customer"
                    className="bg-background h-9 text-xs"
                    options={customers.map((c) => ({
                      value: c.id,
                      label: `${c.name}${c.customerCode ? ` (${c.customerCode})` : ""}`,
                    }))}
                    onQuickCreated={(created) => {
                      setCustomers((prev) => [created, ...prev]);
                      if (created?.id) {
                        setSelectedCustomerId(created.id);
                        setCustomerName(created.name || "");
                        setBillingAddress(created.address || "");
                      }
                    }}
                  />
                </div>

                {/* Customer Name - Always editable! */}
                <div className="sm:col-span-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Customer Name *</Label>
                    {(!selectedCustomerId || selectedCustomerId === "custom") && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                        Custom
                      </span>
                    )}
                  </div>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Type customer name..."
                    className="bg-background h-9 text-xs font-medium"
                    required
                  />
                </div>

                {/* Invoice # (Auto-generated, editable) */}
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Invoice #</Label>
                  <Input
                    value={customInvoiceNumber}
                    onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                    placeholder="INV-0001"
                    className="bg-background h-9 text-xs font-mono"
                  />
                </div>

                {/* Invoice Date */}
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Invoice Date *</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="bg-background h-9 text-xs"
                  />
                </div>
              </div>

              {/* 2. Customer Tax Details Group (NTN and STRN/STN) */}
              <div className="p-3.5 rounded-lg border bg-muted/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <Label className="text-xs font-semibold text-foreground">Customer Tax Details</Label>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Pre-filled or enter custom tax numbers</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">National Tax Number (NTN)</Label>
                    <Input
                      value={customerNTN}
                      onChange={(e) => setCustomerNTN(e.target.value)}
                      placeholder="e.g. 1234567-8"
                      className="bg-background h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">Sales Tax Registration (STRN / STN)</Label>
                    <Input
                      value={customerSTRN}
                      onChange={(e) => setCustomerSTRN(e.target.value)}
                      placeholder="e.g. 1234567890123"
                      className="bg-background h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Collapsible More Details */}
              <div className="border rounded-lg bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMoreDetails((prev) => !prev)}
                  className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-semibold text-primary hover:bg-muted/40 transition-colors"
                >
                  <span>{showMoreDetails ? "− Hide More Details" : "+ More details (PO Reference, Billing Address, Due Date, Remarks)"}</span>
                  {showMoreDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showMoreDetails && (
                  <div className="p-4 border-t space-y-3.5 bg-muted/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Customer PO Reference</Label>
                        <Input
                          value={customerPoRef}
                          onChange={(e) => setCustomerPoRef(e.target.value)}
                          placeholder="e.g. PO-8921 / Contract #12"
                          className="bg-background h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Payment Due Date</Label>
                        <Input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="bg-background h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Billing Address</Label>
                      <Input
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                        placeholder="Factory / Office street address"
                        className="bg-background h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Invoice Remarks / Delivery Notes</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Payment terms, bank details, delivery challan reference..."
                        rows={2}
                        className="text-xs bg-background resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Line Items Table & Stacked Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Invoice Items & Taxes</Label>
                    <p className="text-xs text-muted-foreground">Enter items and apply taxes freely (type Tax % or Tax Amount directly).</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLineItem}
                    className="h-8 text-xs border-dashed"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Line Item
                  </Button>
                </div>

                {/* Desktop / Tablet View (>= 640px) */}
                <div className="hidden sm:block border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-muted-foreground border-b select-none">
                      <tr>
                        <th className="py-2.5 px-3 text-left w-[30%]">Item / Description *</th>
                        <th className="py-2.5 px-2 text-right w-[8%]">Qty *</th>
                        <th className="py-2.5 px-2 text-right w-[14%]">Unit Price (PKR) *</th>
                        <th className="py-2.5 px-2 text-center w-[15%]">Tax Rate (%)</th>
                        <th className="py-2.5 px-2 text-right w-[15%]">Tax Amount (PKR)</th>
                        <th className="py-2.5 px-3 text-right w-[14%]">Line Total</th>
                        <th className="py-2.5 px-2 text-center w-[4%]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lineItems.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-2 space-y-1">
                            <EntitySelect
                              value={item.itemId || ""}
                              onValueChange={(val) => updateLineItem(item.id, "itemId", val)}
                              entityLabel="Item"
                              quickAddType="item"
                              placeholder="Pick stock item (optional)..."
                              allowNone
                              noneLabel="Custom / Non-stock item"
                              className="h-7 text-[11px] bg-background"
                              options={inventoryItems.map((it) => ({
                                value: it.id,
                                label: `${it.name}${it.itemCode ? ` (${it.itemCode})` : ""}`,
                              }))}
                              onQuickCreated={(created) => {
                                setInventoryItems((prev) => [created, ...prev]);
                                if (created?.id) {
                                  updateLineItem(item.id, "description", created.name || "");
                                  if (created.sellingPrice != null) {
                                    updateLineItem(item.id, "unitPrice", created.sellingPrice);
                                  }
                                }
                              }}
                            />
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                              placeholder="Description / Product details"
                              className="h-7 text-xs bg-background"
                              required
                            />
                          </td>

                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0.001"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, "quantity", e.target.value)}
                              className="h-7 text-xs text-right font-mono tabular-nums bg-background"
                            />
                          </td>

                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(item.id, "unitPrice", e.target.value)}
                              className="h-7 text-xs text-right font-mono tabular-nums bg-background"
                            />
                          </td>

                          <td className="p-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 justify-center">
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  value={item.taxPct}
                                  onChange={(e) => updateLineItem(item.id, "taxPct", e.target.value)}
                                  className="h-7 text-xs text-center font-mono w-16 bg-background"
                                  placeholder="0"
                                />
                                <span className="text-[11px] text-muted-foreground">%</span>
                              </div>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateLineItem(item.id, "taxPct", 18)}
                                  className={`text-[9px] px-1 py-0.5 rounded border transition-colors cursor-pointer ${item.taxPct === 18 ? "bg-primary text-primary-foreground font-semibold" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
                                  title="Apply 18% Standard GST"
                                >
                                  18%
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateLineItem(item.id, "taxPct", 0)}
                                  className={`text-[9px] px-1 py-0.5 rounded border transition-colors cursor-pointer ${item.taxPct === 0 ? "bg-emerald-600 text-white font-semibold" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
                                  title="Apply 0% Tax (Exempt / Zero)"
                                >
                                  0%
                                </button>
                              </div>
                            </div>
                          </td>

                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.taxAmount}
                              onChange={(e) => updateLineItem(item.id, "taxAmount", e.target.value)}
                              className="h-7 text-xs text-right font-mono tabular-nums bg-background"
                              placeholder="0.00"
                            />
                          </td>

                          <td className="p-2 text-right font-mono tabular-nums font-semibold">
                            {currencyFmt(item.lineTotal)}
                          </td>

                          <td className="p-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                              onClick={() => removeLineItem(item.id)}
                              disabled={lineItems.length <= 1}
                              title="Remove item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile / Narrow Stacked Cards (< 640px) */}
                <div className="sm:hidden space-y-3">
                  {lineItems.map((item, idx) => (
                    <div key={item.id} className="border rounded-lg p-3 bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Line #{idx + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:bg-destructive/10 px-2 cursor-pointer"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length <= 1}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Item / Description *</Label>
                        <EntitySelect
                          value={item.itemId || ""}
                          onValueChange={(val) => updateLineItem(item.id, "itemId", val)}
                          entityLabel="Item"
                          quickAddType="item"
                          placeholder="Pick stock item (optional)..."
                          allowNone
                          noneLabel="Custom / Non-stock item"
                          className="h-8 text-xs bg-background"
                          options={inventoryItems.map((it) => ({
                            value: it.id,
                            label: `${it.name}${it.itemCode ? ` (${it.itemCode})` : ""}`,
                          }))}
                          onQuickCreated={(created) => {
                            setInventoryItems((prev) => [created, ...prev]);
                          }}
                        />
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                          placeholder="Product / service description"
                          className="h-8 text-xs bg-background"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Qty *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.001"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, "quantity", e.target.value)}
                            className="h-8 text-xs text-right font-mono tabular-nums bg-background"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Price (PKR) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(item.id, "unitPrice", e.target.value)}
                            className="h-8 text-xs text-right font-mono tabular-nums bg-background"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Tax Rate (%)</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={item.taxPct}
                              onChange={(e) => updateLineItem(item.id, "taxPct", e.target.value)}
                              className="h-8 text-xs text-center font-mono bg-background"
                            />
                            <span className="text-[10px] text-muted-foreground">%</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Tax Amt (PKR)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.taxAmount}
                            onChange={(e) => updateLineItem(item.id, "taxAmount", e.target.value)}
                            className="h-8 text-xs text-right font-mono tabular-nums bg-background"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t text-xs">
                        <span className="text-muted-foreground">
                          Tax: <span className="font-mono tabular-nums">{currencyFmt(item.taxAmount)}</span>
                        </span>
                        <span className="font-semibold">
                          Total: <span className="font-mono tabular-nums text-primary">{currencyFmt(item.lineTotal)}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Summary & Tax Breakdown */}
              <div className="bg-muted/40 p-4 rounded-lg border space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Taxable Supplies (Net Subtotal):</span>
                  <span className="font-mono font-medium tabular-nums">{currencyFmt(totals.subtotal)}</span>
                </div>
                {totals.zeroRatedSubtotal > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Zero-Rated Supplies (0%):</span>
                    <span className="font-mono font-medium tabular-nums text-emerald-600">{currencyFmt(totals.zeroRatedSubtotal)}</span>
                  </div>
                )}
                {totals.exemptSubtotal > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Exempt Supplies (0%):</span>
                    <span className="font-mono font-medium tabular-nums text-emerald-600">{currencyFmt(totals.exemptSubtotal)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">
                    Sales Tax Output {totals.effectiveTaxPct > 0 ? `(${totals.effectiveTaxPct}%)` : "(0%)"}:
                  </span>
                  <span className="font-mono font-medium tabular-nums text-blue-600 dark:text-blue-400">
                    + {currencyFmt(totals.totalTax)}
                  </span>
                </div>
                <div className="border-t pt-2.5 flex justify-between items-center text-sm font-bold">
                  <span>Total Invoice Amount:</span>
                  <span className="font-mono text-primary text-base tabular-nums">
                    {currencyFmt(totals.grandTotal)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground text-right italic leading-relaxed">
                  Posting debits Accounts Receivable and credits Sales Revenue & Sales Tax Output.
                </p>
              </div>
            </div>

            <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handlePostInvoice} disabled={submitting}>
                {submitting ? "Posting to GL..." : "Post Sales Invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ----------------- POSTED SUCCESS MODAL WITH VOUCHER ----------------- */}
        <Dialog open={!!postedResult} onOpenChange={() => setPostedResult(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mb-2">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center text-xl">Sales Invoice Posted!</DialogTitle>
              <DialogDescription className="text-center text-xs">
                The invoice has been registered and posted directly to the General Ledger.
              </DialogDescription>
            </DialogHeader>

            {postedResult && (
              <div className="space-y-4 py-2">
                <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Invoice Number:</span>
                    <span className="font-mono font-bold text-primary">
                      {postedResult.invoice.invoiceNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">GL Voucher Reference:</span>
                    <Badge variant="outline" className="font-mono font-semibold bg-background border-emerald-500 text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="h-3 w-3 mr-1 inline" />
                      {postedResult.voucherNumber}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Gross Invoiced Total:</span>
                    <span className="font-mono font-bold">
                      {currencyFmt(postedResult.invoice.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Initial Receivable:</span>
                    <span className="font-mono text-amber-600 font-semibold">
                      {currencyFmt(postedResult.invoice.outstandingAmount)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handlePrintPdf(postedResult.invoice)}
                  >
                    <Printer className="h-4 w-4 mr-2" /> Print / Export PDF
                  </Button>
                  <Button className="flex-1" onClick={() => setPostedResult(null)}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ----------------- VIEW INVOICE DETAILS MODAL ----------------- */}
        <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
          <DialogContent size="wide">
            <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0 bg-background">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Invoice {viewInvoice?.invoiceNumber}
                </DialogTitle>
                {viewInvoice && (
                  <Badge
                    variant={statusBadgeConfig[viewInvoice.status]?.variant || "outline"}
                    className={statusBadgeConfig[viewInvoice.status]?.className}
                  >
                    {statusBadgeConfig[viewInvoice.status]?.label || viewInvoice.status}
                  </Badge>
                )}
              </div>
              <DialogDescription>
                Full invoice breakdown and ledger voucher references.
              </DialogDescription>
            </DialogHeader>

            {viewInvoice && (
              <div className="overflow-y-auto min-h-0 flex-1 px-6 py-4 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg border text-xs">
                  <div>
                    <span className="text-muted-foreground block">Customer:</span>
                    <span className="font-semibold">{viewInvoice.customer?.name || "Client"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">NTN / STRN:</span>
                    <span className="font-mono">{viewInvoice.customerTaxId || viewInvoice.customer?.taxNumber || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Invoice Date:</span>
                    <span>{new Date(viewInvoice.invoiceDate).toLocaleDateString("en-PK")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">GL Voucher:</span>
                    <span className="font-mono text-emerald-600 font-medium">
                      {viewInvoice.voucherNumber || viewInvoice.voucherId || "VOUCHER-POSTED"}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-muted-foreground border-b select-none">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Description</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-center">Tax %</th>
                        <th className="py-2.5 px-3 text-right">Tax Amt</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(viewInvoice.items || []).map((it: any, i: number) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="p-2.5 font-medium">{it.description || it.item?.name || "Item"}</td>
                          <td className="p-2.5 text-right font-mono tabular-nums">{it.quantity}</td>
                          <td className="p-2.5 text-right font-mono tabular-nums">{currencyFmt(it.unitPrice)}</td>
                          <td className="p-2.5 text-center font-mono tabular-nums">{it.taxPct || 0}%</td>
                          <td className="p-2.5 text-right font-mono tabular-nums">{currencyFmt(it.taxAmount || 0)}</td>
                          <td className="p-2.5 text-right font-mono font-semibold tabular-nums">{currencyFmt(it.lineTotal || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex flex-col sm:flex-row justify-between gap-4 bg-muted/30 p-4 rounded-lg border text-xs">
                  <div className="space-y-1">
                    <span className="text-muted-foreground block">Notes & Terms:</span>
                    <p className="italic text-foreground">{viewInvoice.notes || "None specified"}</p>
                    {viewInvoice.billingAddress && (
                      <p className="text-muted-foreground">Address: {viewInvoice.billingAddress}</p>
                    )}
                  </div>
                  <div className="sm:w-64 space-y-1.5 font-mono tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>{currencyFmt(viewInvoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sales Tax Output:</span>
                      <span className="text-blue-600 dark:text-blue-400">+{currencyFmt(viewInvoice.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-1 text-sm">
                      <span>Total Amount:</span>
                      <span>{currencyFmt(viewInvoice.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Paid / Settled:</span>
                      <span>{currencyFmt(viewInvoice.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-amber-600 font-bold border-t pt-1">
                      <span>Outstanding Balance:</span>
                      <span>{currencyFmt(viewInvoice.outstandingAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0 gap-2 sm:gap-0">
              {viewInvoice && (
                <Button variant="outline" onClick={() => handlePrintPdf(viewInvoice)}>
                  <Printer className="h-4 w-4 mr-2" /> Print / Export PDF
                </Button>
              )}
              <Button onClick={() => setViewInvoice(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ----------------- REVERSE INVOICE CONFIRMATION DIALOG ----------------- */}
        <Dialog open={!!reverseTarget} onOpenChange={() => setReverseTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5" /> Reverse Sales Invoice
              </DialogTitle>
              <DialogDescription>
                Reversing this invoice ({reverseTarget?.invoiceNumber}) will post a contra-voucher in the
                General Ledger and cancel the accounts receivable balance. This cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Label className="text-xs font-semibold">Reason for Cancellation / Reversal *</Label>
              <Textarea
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="e.g. Invoiced in error, customer order revised, returned goods..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReverseTarget(null)} disabled={reversing}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReverse} disabled={reversing}>
                {reversing ? "Reversing..." : "Confirm Reversal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
