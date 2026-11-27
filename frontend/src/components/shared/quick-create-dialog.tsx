"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api/client";
import { generateNextCodeFromRows } from "@/lib/code-generator";
import { EntitySelect } from "./entity-select";

export type QuickCreateEntityType =
  | "vendor"
  | "customer"
  | "item"
  | "category"
  | "unit"
  | "warehouse"
  | "branch"
  | "department"
  | "designation"
  | "employee"
  | "account"
  | "bom"
  | "demandNote"
  | "quotation"
  | "purchaseOrder"
  | "productionOrder"
  | "salesOrder"
  | "payrollPeriod"
  | "payhead";

interface EntityConfig {
  title: string;
  description: string;
  endpoint: string;
  codeField?: string;
  codePrefix?: string;
  wide?: boolean;
}

const ENTITY_CONFIG: Record<QuickCreateEntityType, EntityConfig> = {
  vendor: {
    title: "Add Vendor",
    description: "Create a new vendor record and select it automatically.",
    endpoint: "/purchase/vendors",
    codeField: "vendorCode",
    codePrefix: "VND",
    wide: true,
  },
  customer: {
    title: "Add Customer",
    description: "Create a new customer record and select it automatically.",
    endpoint: "/sales/customers",
    codeField: "customerCode",
    codePrefix: "CUST",
    wide: true,
  },
  item: {
    title: "Add Inventory Item",
    description: "Create a catalog item with all inventory details and select it.",
    endpoint: "/inventory/items",
    codeField: "itemCode",
    codePrefix: "ITM",
    wide: true,
  },
  category: {
    title: "Add Category",
    description: "Create a new item category.",
    endpoint: "/inventory/categories",
    codeField: "code",
    codePrefix: "CAT",
  },
  unit: {
    title: "Add Unit of Measure",
    description: "Create a measurement unit (e.g. Kg, Meter, Piece).",
    endpoint: "/inventory/units",
    codeField: "code",
    codePrefix: "UOM",
  },
  warehouse: {
    title: "Add Warehouse",
    description: "Create a new storage warehouse.",
    endpoint: "/inventory/warehouses",
    codeField: "code",
    codePrefix: "WH",
    wide: true,
  },
  branch: {
    title: "Add Branch",
    description: "Create a new company branch location.",
    endpoint: "/master-data/branch",
    codeField: "code",
    codePrefix: "BR",
    wide: true,
  },
  department: {
    title: "Add Department",
    description: "Create a new organizational department.",
    endpoint: "/master-data/department",
    codeField: "code",
    codePrefix: "DEPT",
  },
  designation: {
    title: "Add Designation",
    description: "Create a new employee designation.",
    endpoint: "/master-data/designation",
    codeField: "code",
    codePrefix: "DSG",
  },
  employee: {
    title: "Add Employee",
    description: "Create an employee record and select it immediately.",
    endpoint: "/master-data/employee",
    codeField: "employeeCode",
    codePrefix: "EMP",
    wide: true,
  },
  account: {
    title: "Add Account",
    description: "Create a new Chart of Accounts ledger.",
    endpoint: "/finance/accounts",
    codeField: "accountCode",
    codePrefix: "ACC",
    wide: true,
  },
  bom: {
    title: "Add Bill of Material",
    description: "Define a finished item BOM and raw material formula.",
    endpoint: "/production/bom",
    codeField: "bomNumber",
    codePrefix: "BOM",
    wide: true,
  },
  demandNote: {
    title: "Add Demand Note",
    description: "Create an internal purchase/store demand note.",
    endpoint: "/purchase/demand-notes",
    codeField: "demandNumber",
    codePrefix: "DEM",
    wide: true,
  },
  quotation: {
    title: "Add Vendor Quotation",
    description: "Create a vendor quotation and select it immediately.",
    endpoint: "/purchase/quotations",
    codeField: "quotationNumber",
    codePrefix: "QTN",
    wide: true,
  },
  purchaseOrder: {
    title: "Add Purchase Order",
    description: "Create a purchase order with line items and select it.",
    endpoint: "/purchase/orders",
    codeField: "poNumber",
    codePrefix: "PO",
    wide: true,
  },
  productionOrder: {
    title: "Add Production Order",
    description: "Schedule a production order and select it immediately.",
    endpoint: "/production/orders",
    codeField: "productionNumber",
    codePrefix: "PROD",
    wide: true,
  },
  salesOrder: {
    title: "Add Sales Order",
    description: "Create a sales order with line items and select it.",
    endpoint: "/sales/orders",
    codeField: "soNumber",
    codePrefix: "SO",
    wide: true,
  },
  payrollPeriod: {
    title: "Add Payroll Period",
    description: "Create a payroll cycle period.",
    endpoint: "/hr/payroll/period",
  },
  payhead: {
    title: "Add Payhead",
    description: "Create a salary earning or deduction payhead.",
    endpoint: "/hr/payroll/payhead",
    codeField: "code",
    codePrefix: "PH",
  },
};

export interface QuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: QuickCreateEntityType;
  onCreated?: (record: any) => void;
}

interface LineRow {
  itemId: string;
  quantity: string;
  unitPrice: string;
  unit: string;
}

export function QuickCreateDialog({
  open,
  onOpenChange,
  entityType,
  onCreated,
}: QuickCreateDialogProps) {
  const cfg = ENTITY_CONFIG[entityType];
  const [submitting, setSubmitting] = React.useState(false);
  const [showMore, setShowMore] = React.useState(false);

  // Core text fields
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [contactPerson, setContactPerson] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [stateName, setStateName] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("");
  const [taxNumber, setTaxNumber] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [hsnCode, setHsnCode] = React.useState("");
  const [unitText, setUnitText] = React.useState("");
  const [gender, setGender] = React.useState("Male");
  const [bankName, setBankName] = React.useState("");
  const [bankAccount, setBankAccount] = React.useState("");
  const [panNumber, setPanNumber] = React.useState("");
  const [requestedBy, setRequestedBy] = React.useState("");
  const [costCenter, setCostCenter] = React.useState("");
  const [assignedTo, setAssignedTo] = React.useState("");
  const [warranty, setWarranty] = React.useState("");
  const [extraType, setExtraType] = React.useState("");

  // Numeric fields
  const [numVal1, setNumVal1] = React.useState("0");
  const [numVal2, setNumVal2] = React.useState("0");
  const [minStock, setMinStock] = React.useState("");
  const [maxStock, setMaxStock] = React.useState("");
  const [reorderLevel, setReorderLevel] = React.useState("");
  const [rating, setRating] = React.useState("");
  const [creditLimit, setCreditLimit] = React.useState("");
  const [shippingCost, setShippingCost] = React.useState("");
  const [discountAmount, setDiscountAmount] = React.useState("");
  const [taxAmount, setTaxAmount] = React.useState("");

  // Date fields
  const [dateStart, setDateStart] = React.useState("");
  const [dateEnd, setDateEnd] = React.useState("");

  // Dependent option lists
  const [categories, setCategories] = React.useState<any[]>([]);
  const [units, setUnits] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [designations, setDesignations] = React.useState<any[]>([]);
  const [items, setItems] = React.useState<any[]>([]);
  const [vendors, setVendors] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [accounts, setAccounts] = React.useState<any[]>([]);
  const [boms, setBoms] = React.useState<any[]>([]);
  const [demandNotes, setDemandNotes] = React.useState<any[]>([]);
  const [quotations, setQuotations] = React.useState<any[]>([]);

  const [selectedRef1, setSelectedRef1] = React.useState("");
  const [selectedRef2, setSelectedRef2] = React.useState("");
  const [selectedRef3, setSelectedRef3] = React.useState("");

  // Multi-line items for BOM / Demand Note / PO / SO
  const [lineRows, setLineRows] = React.useState<LineRow[]>([]);

  const resetDefaults = React.useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    setCode(cfg.codePrefix ? `${cfg.codePrefix}-0001` : "");
    setName("");
    setLastName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setDescription("");
    setAddress("");
    setCity("");
    setStateName("");
    setCountry("");
    setPaymentTerms("");
    setTaxNumber("");
    setBrand("");
    setHsnCode("");
    setUnitText("");
    setGender("Male");
    setBankName("");
    setBankAccount("");
    setPanNumber("");
    setRequestedBy("");
    setCostCenter("");
    setAssignedTo("");
    setWarranty("");
    setMinStock("");
    setMaxStock("");
    setReorderLevel("");
    setRating("");
    setCreditLimit("");
    setShippingCost("");
    setDiscountAmount("");
    setTaxAmount("");
    setSelectedRef1("");
    setSelectedRef2("");
    setSelectedRef3("");
    setShowMore(false);
    setLineRows([]);

    if (entityType === "item") {
      setExtraType("");
      setNumVal1("");
      setNumVal2("");
    } else if (entityType === "account") {
      setExtraType("EXPENSE");
      setNumVal1("0");
      setNumVal2("0");
    } else if (entityType === "payhead") {
      setExtraType("EARNING");
      setNumVal1("0");
      setNumVal2("0");
    } else if (entityType === "bom") {
      setNumVal1("1");
      setNumVal2("0");
      setExtraType("");
    } else if (entityType === "productionOrder") {
      setNumVal1("1");
      setNumVal2("0");
      setExtraType("MEDIUM");
      setDateStart(today);
      setDateEnd("");
    } else if (entityType === "demandNote") {
      setExtraType("MEDIUM");
      setNumVal1("1");
      setDateStart(today);
      setDateEnd("");
      setLineRows([{ itemId: "", quantity: "1", unitPrice: "0", unit: "Pcs" }]);
    } else if (entityType === "quotation") {
      setNumVal1("");
      setNumVal2("");
      setDateStart(today);
      setDateEnd("");
    } else if (entityType === "purchaseOrder" || entityType === "salesOrder") {
      setDateStart(today);
      setDateEnd("");
      setLineRows([{ itemId: "", quantity: "1", unitPrice: "0", unit: "" }]);
    } else if (entityType === "payrollPeriod") {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      setName(
        now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      );
      setDateStart(new Date(y, m, 1).toISOString().split("T")[0]);
      setDateEnd(new Date(y, m + 1, 0).toISOString().split("T")[0]);
    } else {
      setExtraType("");
      setNumVal1("0");
      setNumVal2("0");
      setDateStart("");
      setDateEnd("");
    }
  }, [cfg.codePrefix, entityType]);

  const toRows = (res: any) => (Array.isArray(res) ? res : res?.data || []);

  const loadExistingAndRefs = React.useCallback(async () => {
    try {
      if (cfg.codeField && cfg.codePrefix) {
        const res = await api
          .get<any>(`${cfg.endpoint}?limit=500`)
          .catch(() => []);
        const rows = toRows(res);
        setCode(
          generateNextCodeFromRows(
            cfg.codePrefix,
            rows,
            (r: any) => r?.[cfg.codeField!],
          ),
        );
      }

      if (entityType === "item") {
        const [cats, uoms] = await Promise.all([
          api.get<any>("/inventory/categories?limit=500").catch(() => []),
          api.get<any>("/inventory/units?limit=500").catch(() => []),
        ]);
        setCategories(toRows(cats));
        setUnits(toRows(uoms));
      } else if (entityType === "warehouse") {
        const brs = await api
          .get<any>("/master-data/branch?limit=500")
          .catch(() => []);
        setBranches(toRows(brs));
      } else if (entityType === "employee") {
        const [depts, dsgs] = await Promise.all([
          api.get<any>("/master-data/department?limit=500").catch(() => []),
          api.get<any>("/master-data/designation?limit=500").catch(() => []),
        ]);
        setDepartments(toRows(depts));
        setDesignations(toRows(dsgs));
      } else if (entityType === "account") {
        const accs = await api
          .get<any>("/finance/accounts?limit=500")
          .catch(() => []);
        setAccounts(toRows(accs));
      } else if (entityType === "bom") {
        const its = await api
          .get<any>("/inventory/items?limit=500")
          .catch(() => []);
        setItems(toRows(its));
      } else if (entityType === "productionOrder") {
        const [its, bms] = await Promise.all([
          api.get<any>("/inventory/items?limit=500").catch(() => []),
          api.get<any>("/production/bom?limit=500").catch(() => []),
        ]);
        setItems(toRows(its));
        setBoms(toRows(bms));
      } else if (entityType === "demandNote") {
        const [depts, its] = await Promise.all([
          api.get<any>("/master-data/department?limit=500").catch(() => []),
          api.get<any>("/inventory/items?limit=500").catch(() => []),
        ]);
        setDepartments(toRows(depts));
        setItems(toRows(its));
      } else if (entityType === "quotation") {
        const [vnds, dns] = await Promise.all([
          api.get<any>("/purchase/vendors?limit=500").catch(() => []),
          api.get<any>("/purchase/demand-notes?limit=500").catch(() => []),
        ]);
        setVendors(toRows(vnds));
        setDemandNotes(toRows(dns));
      } else if (entityType === "purchaseOrder") {
        const [vnds, dns, qts, its] = await Promise.all([
          api.get<any>("/purchase/vendors?limit=500").catch(() => []),
          api.get<any>("/purchase/demand-notes?limit=500").catch(() => []),
          api.get<any>("/purchase/quotations?limit=500").catch(() => []),
          api.get<any>("/inventory/items?limit=500").catch(() => []),
        ]);
        setVendors(toRows(vnds));
        setDemandNotes(toRows(dns));
        setQuotations(toRows(qts));
        setItems(toRows(its));
      } else if (entityType === "salesOrder") {
        const [custs, its] = await Promise.all([
          api.get<any>("/sales/customers?limit=500").catch(() => []),
          api.get<any>("/inventory/items?limit=500").catch(() => []),
        ]);
        setCustomers(toRows(custs));
        setItems(toRows(its));
      }
    } catch {}
  }, [cfg.codeField, cfg.codePrefix, cfg.endpoint, entityType]);

  React.useEffect(() => {
    if (open) {
      resetDefaults();
      loadExistingAndRefs();
    }
  }, [open, resetDefaults, loadExistingAndRefs]);

  const optStr = (v: string) => (v.trim() ? v.trim() : undefined);
  const optNum = (v: string) => {
    if (!v.trim()) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const handleSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      let payload: Record<string, any> = {};

      switch (entityType) {
        case "vendor":
          if (!name.trim()) throw new Error("Vendor name is required");
          payload = {
            vendorCode: optStr(code),
            name: name.trim(),
            contactPerson: optStr(contactPerson),
            phone: optStr(phone),
            email: optStr(email),
            address: optStr(address),
            city: optStr(city),
            state: optStr(stateName),
            country: optStr(country),
            paymentTerms: optStr(paymentTerms),
            taxNumber: optStr(taxNumber),
            rating: optNum(rating),
            status: "ACTIVE",
          };
          break;

        case "customer":
          if (!name.trim()) throw new Error("Customer name is required");
          payload = {
            customerCode: optStr(code),
            name: name.trim(),
            contactPerson: optStr(contactPerson),
            phone: optStr(phone),
            email: optStr(email),
            address: optStr(address),
            city: optStr(city),
            state: optStr(stateName),
            country: optStr(country),
            paymentTerms: optStr(paymentTerms),
            taxNumber: optStr(taxNumber),
            rating: optNum(rating),
            creditLimit: optNum(creditLimit),
            status: "ACTIVE",
          };
          break;

        case "item":
          if (!name.trim()) throw new Error("Item name is required");
          payload = {
            itemCode: optStr(code),
            name: name.trim(),
            description: optStr(description),
            categoryId: selectedRef1 || undefined,
            unitId: selectedRef2 || undefined,
            brand: optStr(brand),
            minStock: optNum(minStock),
            maxStock: optNum(maxStock),
            reorderLevel: optNum(reorderLevel),
            purchasePrice: optNum(numVal1),
            sellingPrice: optNum(numVal2),
            hsnCode: optStr(hsnCode),
            status: "ACTIVE",
          };
          break;

        case "category":
          if (!name.trim()) throw new Error("Category name is required");
          payload = {
            code: optStr(code),
            name: name.trim(),
            description: optStr(description),
            status: "ACTIVE",
          };
          break;

        case "unit":
          if (!name.trim()) throw new Error("Unit name is required");
          payload = {
            code: optStr(code),
            name: name.trim(),
            status: "ACTIVE",
          };
          break;

        case "warehouse":
          if (!name.trim()) throw new Error("Warehouse name is required");
          payload = {
            code: optStr(code),
            name: name.trim(),
            branchId: selectedRef1 || undefined,
            address: optStr(address),
            city: optStr(city),
            state: optStr(stateName),
            country: optStr(country),
            isActive: true,
          };
          break;

        case "branch":
          if (!name.trim()) throw new Error("Branch name is required");
          payload = {
            code: optStr(code),
            name: name.trim(),
            email: optStr(email),
            phone: optStr(phone),
            city: optStr(city),
            state: optStr(stateName),
            country: optStr(country),
            status: "ACTIVE",
          };
          break;

        case "department":
          if (!name.trim()) throw new Error("Department name is required");
          payload = {
            code: optStr(code),
            name: name.trim(),
            description: optStr(description),
            status: "ACTIVE",
          };
          break;

        case "designation":
          if (!name.trim()) throw new Error("Designation name is required");
          payload = {
            code: optStr(code),
            name: name.trim(),
            description: optStr(description),
            grade: optStr(brand),
            status: "ACTIVE",
          };
          break;

        case "employee":
          if (!name.trim()) throw new Error("First name is required");
          if (!lastName.trim()) throw new Error("Last name is required");
          payload = {
            employeeCode: optStr(code),
            firstName: name.trim(),
            lastName: lastName.trim(),
            email:
              email.trim() ||
              `${(code.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]/g, "")).toLowerCase()}@local.erp`,
            phone: optStr(phone),
            gender: gender || "Male",
            departmentId: selectedRef1 || undefined,
            designationId: selectedRef2 || undefined,
            bankName: optStr(bankName),
            bankAccount: optStr(bankAccount),
            panNumber: optStr(panNumber),
            status: "ACTIVE",
          };
          break;

        case "account":
          if (!name.trim()) throw new Error("Account name is required");
          payload = {
            accountCode: optStr(code),
            name: name.trim(),
            type: extraType || "EXPENSE",
            parentId: selectedRef1 || undefined,
            balance: optNum(numVal1) ?? 0,
            description: optStr(description),
          };
          break;

        case "bom": {
          if (!selectedRef1) throw new Error("Please select a finished item");
          const mats = lineRows
            .filter((r) => r.itemId && Number(r.quantity) > 0)
            .map((r) => ({
              itemId: r.itemId,
              quantity: Number(r.quantity),
              unit: r.unit || "Pcs",
            }));
          payload = {
            bomNumber: optStr(code),
            itemId: selectedRef1,
            description: optStr(description),
            quantity: Math.max(0.01, parseFloat(numVal1) || 1),
            unit: optStr(unitText) || "Pcs",
            wastePct: optNum(numVal2) ?? 0,
            materials: mats.length > 0 ? mats : undefined,
            status: "ACTIVE",
          };
          break;
        }

        case "demandNote": {
          const validLines = lineRows
            .filter((r) => r.itemId && Number(r.quantity) > 0)
            .map((r) => ({
              itemId: r.itemId,
              quantity: Math.max(0.0001, Number(r.quantity)),
              unit: r.unit || undefined,
            }));
          payload = {
            demandNumber: optStr(code),
            departmentId: selectedRef1 || undefined,
            requestedBy: optStr(requestedBy),
            costCenter: optStr(costCenter),
            priority: extraType || "MEDIUM",
            requiredDate: optStr(dateStart),
            remarks: optStr(description),
            status: "APPROVED",
            items: validLines.length > 0 ? validLines : undefined,
          };
          break;
        }

        case "quotation":
          if (!selectedRef1) throw new Error("Please select a vendor");
          payload = {
            quotationNumber: optStr(code),
            vendorId: selectedRef1,
            demandNoteId: selectedRef2 || undefined,
            quotationDate: optStr(dateStart),
            deliveryTime: optNum(numVal1),
            warranty: optStr(warranty),
            totalAmount: optNum(numVal2),
            notes: optStr(description),
          };
          break;

        case "purchaseOrder": {
          if (!selectedRef1) throw new Error("Please select a vendor");
          const poLines = lineRows
            .filter((r) => r.itemId && Number(r.quantity) > 0)
            .map((r) => ({
              itemId: r.itemId,
              quantity: Number(r.quantity),
              unitPrice: Number(r.unitPrice) || 0,
            }));
          payload = {
            poNumber: optStr(code),
            vendorId: selectedRef1,
            demandNoteId: selectedRef2 || undefined,
            quotationId: selectedRef3 || undefined,
            orderDate: optStr(dateStart),
            expectedDelivery: optStr(dateEnd),
            paymentTerms: optStr(paymentTerms),
            shippingCost: optNum(shippingCost),
            discountAmount: optNum(discountAmount),
            taxAmount: optNum(taxAmount),
            notes: optStr(description),
            items: poLines.length > 0 ? poLines : undefined,
          };
          break;
        }

        case "productionOrder":
          if (!selectedRef1) throw new Error("Please select a product item");
          payload = {
            productionNumber: optStr(code),
            itemId: selectedRef1,
            bomId: selectedRef2 || undefined,
            quantity: Math.max(0.01, parseFloat(numVal1) || 1),
            priority: extraType || "MEDIUM",
            startDate: optStr(dateStart),
            endDate: optStr(dateEnd),
            assignedTo: optStr(assignedTo),
            notes: optStr(description),
          };
          break;

        case "salesOrder": {
          if (!selectedRef1) throw new Error("Please select a customer");
          const soLines = lineRows
            .filter((r) => r.itemId && Number(r.quantity) > 0)
            .map((r) => {
              const found = items.find((i) => i.id === r.itemId);
              return {
                itemId: r.itemId,
                description: found?.name || undefined,
                quantity: Number(r.quantity),
                unitPrice: Number(r.unitPrice) || 0,
              };
            });
          payload = {
            soNumber: optStr(code),
            customerId: selectedRef1,
            orderDate: optStr(dateStart),
            expectedDelivery: optStr(dateEnd),
            paymentTerms: optStr(paymentTerms),
            shippingCost: optNum(shippingCost),
            discountAmount: optNum(discountAmount),
            taxAmount: optNum(taxAmount),
            notes: optStr(description),
            items: soLines.length > 0 ? soLines : undefined,
          };
          break;
        }

        case "payrollPeriod":
          if (!name.trim() || !dateStart || !dateEnd) {
            throw new Error("Period name, start date, and end date are required");
          }
          payload = {
            name: name.trim(),
            startDate: dateStart,
            endDate: dateEnd,
          };
          break;

        case "payhead":
          if (!name.trim()) throw new Error("Payhead name is required");
          payload = {
            code: optStr(code),
            name: name.trim(),
            type: extraType || "EARNING",
            amount: optNum(numVal1) ?? 0,
            percentage: optNum(numVal2) ?? 0,
            description: optStr(description),
          };
          break;
      }

      // Remove undefined keys cleanly before sending
      const cleanPayload: Record<string, any> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (v !== undefined) cleanPayload[k] = v;
      }

      const created = await api.post<any>(cfg.endpoint, cleanPayload);
      toast.success(`${cfg.title.replace("Add ", "")} added`);
      onOpenChange(false);
      if (onCreated) {
        onCreated(created);
      }
    } catch (err: any) {
      toast.error(err?.message || `Failed to create ${entityType}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      void handleSave();
    }
  };

  const updateLineRow = (idx: number, patch: Partial<LineRow>) => {
    setLineRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    );
  };

  const renderMoreDetailsToggle = () => (
    <button
      type="button"
      onClick={() => setShowMore((p) => !p)}
      className="flex w-full items-center gap-1.5 py-1 text-left text-xs font-medium text-primary hover:underline cursor-pointer"
    >
      {showMore ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
      <span>{showMore ? "Hide extra fields" : "More details (all optional fields)"}</span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          cfg.wide
            ? "sm:max-w-[600px] max-h-[86vh] overflow-y-auto"
            : "sm:max-w-[460px] max-h-[86vh] overflow-y-auto"
        }
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          {cfg.codeField && (
            <div className="space-y-1.5">
              <Label>Code / Number (Auto-generated)</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleFieldKeyDown}
                placeholder={`${cfg.codePrefix || "CODE"}-0001`}
              />
            </div>
          )}

          {/* VENDOR / CUSTOMER — full page parity */}
          {(entityType === "vendor" || entityType === "customer") && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>
                    {entityType === "vendor" ? "Vendor Name *" : "Customer Name *"}
                  </Label>
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder={
                      entityType === "vendor"
                        ? "e.g. XYZ Suppliers"
                        : "e.g. ABC Textiles"
                    }
                  />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>Contact Person</Label>
                  <Input
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="e.g. Mr. Ali"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="+92-300-1234567"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="contact@company.com"
                  />
                </div>
              </div>

              {renderMoreDetailsToggle()}

              {showMore && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <Label>Address</Label>
                    <Textarea
                      rows={2}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Full street address"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>City</Label>
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="e.g. Lahore"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>State</Label>
                      <Input
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="e.g. Punjab"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Country</Label>
                      <Input
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="e.g. Pakistan"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Payment Terms</Label>
                      <Input
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="e.g. Net 30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tax Number (NTN / STRN)</Label>
                      <Input
                        value={taxNumber}
                        onChange={(e) => setTaxNumber(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="e.g. NTN-7654321"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Rating (1-5)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        value={rating}
                        onChange={(e) => setRating(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="e.g. 5"
                      />
                    </div>
                    {entityType === "customer" && (
                      <div className="space-y-1.5">
                        <Label>Credit Limit</Label>
                        <Input
                          type="number"
                          min="0"
                          value={creditLimit}
                          onChange={(e) => setCreditLimit(e.target.value)}
                          onKeyDown={handleFieldKeyDown}
                          placeholder="e.g. 500000"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* INVENTORY ITEM — full page parity */}
          {entityType === "item" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>Item Name *</Label>
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="e.g. Combed Cotton Yarn 40s"
                  />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>Brand</Label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="e.g. Sapphire / Local"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <EntitySelect
                    value={selectedRef1}
                    onValueChange={setSelectedRef1}
                    entityLabel="Category"
                    pluralLabel="Categories"
                    quickAddType="category"
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    onQuickCreated={(c) => setCategories((prev) => [c, ...prev])}
                    allowNone
                    noneLabel="Optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <EntitySelect
                    value={selectedRef2}
                    onValueChange={setSelectedRef2}
                    entityLabel="Unit"
                    quickAddType="unit"
                    options={units.map((u) => ({ value: u.id, label: u.name }))}
                    onQuickCreated={(u) => setUnits((prev) => [u, ...prev])}
                    allowNone
                    noneLabel="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Purchase Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={numVal1}
                    onChange={(e) => setNumVal1(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Selling Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={numVal2}
                    onChange={(e) => setNumVal2(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {renderMoreDetailsToggle()}

              {showMore && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Min Stock</Label>
                      <Input
                        type="number"
                        min="0"
                        value={minStock}
                        onChange={(e) => setMinStock(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Max Stock</Label>
                      <Input
                        type="number"
                        min="0"
                        value={maxStock}
                        onChange={(e) => setMaxStock(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Reorder Level</Label>
                      <Input
                        type="number"
                        min="0"
                        value={reorderLevel}
                        onChange={(e) => setReorderLevel(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>HSN Code</Label>
                    <Input
                      value={hsnCode}
                      onChange={(e) => setHsnCode(e.target.value)}
                      onKeyDown={handleFieldKeyDown}
                      placeholder="e.g. 5205"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Item specifications, counts, blend..."
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* CATEGORY / UNIT / DEPARTMENT / DESIGNATION — full page parity */}
          {(entityType === "category" ||
            entityType === "unit" ||
            entityType === "department" ||
            entityType === "designation") && (
            <>
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleFieldKeyDown}
                  placeholder="Enter name"
                />
              </div>
              {entityType === "designation" && (
                <div className="space-y-1.5">
                  <Label>Grade</Label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="e.g. Grade 1"
                  />
                </div>
              )}
              {entityType !== "unit" && (
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="Optional description"
                  />
                </div>
              )}
            </>
          )}

          {/* WAREHOUSE / BRANCH — full page parity */}
          {(entityType === "warehouse" || entityType === "branch") && (
            <>
              <div className="space-y-1.5">
                <Label>{entityType === "warehouse" ? "Warehouse Name *" : "Branch Name *"}</Label>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleFieldKeyDown}
                  placeholder={
                    entityType === "warehouse" ? "e.g. Main Yarn Store" : "e.g. Lahore Office"
                  }
                />
              </div>

              {entityType === "warehouse" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Branch</Label>
                    <EntitySelect
                      value={selectedRef1}
                      onValueChange={setSelectedRef1}
                      entityLabel="Branch"
                      pluralLabel="Branches"
                      quickAddType="branch"
                      options={branches.map((b) => ({ value: b.id, label: b.name }))}
                      onQuickCreated={(b) => setBranches((prev) => [b, ...prev])}
                      allowNone
                      noneLabel="Optional"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      onKeyDown={handleFieldKeyDown}
                      placeholder="City"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={handleFieldKeyDown}
                      placeholder="branch@company.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onKeyDown={handleFieldKeyDown}
                      placeholder="+92-300-1234567"
                    />
                  </div>
                </div>
              )}

              {renderMoreDetailsToggle()}

              {showMore && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  {entityType === "warehouse" && (
                    <div className="space-y-1.5">
                      <Label>Address</Label>
                      <Textarea
                        rows={2}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Warehouse address"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2.5">
                    {entityType === "branch" && (
                      <div className="space-y-1.5">
                        <Label>City</Label>
                        <Input
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          onKeyDown={handleFieldKeyDown}
                          placeholder="Lahore"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label>State</Label>
                      <Input
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="Punjab"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Country</Label>
                      <Input
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="Pakistan"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* EMPLOYEE — full page parity */}
          {entityType === "employee" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Name *</Label>
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="e.g. Bilal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name *</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="e.g. Ahmed"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="employee@company.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="+92-300-..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender *</Label>
                  <Select value={gender} onValueChange={(v) => setGender(v || "Male")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <EntitySelect
                    value={selectedRef1}
                    onValueChange={setSelectedRef1}
                    entityLabel="Department"
                    quickAddType="department"
                    options={departments.map((d) => ({ value: d.id, label: d.name }))}
                    onQuickCreated={(d) => setDepartments((prev) => [d, ...prev])}
                    allowNone
                    noneLabel="Optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Designation</Label>
                  <EntitySelect
                    value={selectedRef2}
                    onValueChange={setSelectedRef2}
                    entityLabel="Designation"
                    quickAddType="designation"
                    options={designations.map((d) => ({ value: d.id, label: d.name }))}
                    onQuickCreated={(d) => setDesignations((prev) => [d, ...prev])}
                    allowNone
                    noneLabel="Optional"
                  />
                </div>
              </div>

              {renderMoreDetailsToggle()}

              {showMore && (
                <div className="grid grid-cols-3 gap-2.5 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <Label>Bank Name</Label>
                    <Input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      onKeyDown={handleFieldKeyDown}
                      placeholder="e.g. HBL"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bank Account</Label>
                    <Input
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      onKeyDown={handleFieldKeyDown}
                      placeholder="1234-5678-..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CNIC / PAN</Label>
                    <Input
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value)}
                      onKeyDown={handleFieldKeyDown}
                      placeholder="PAN / CNIC"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ACCOUNT — full page parity */}
          {entityType === "account" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Account Name *</Label>
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="e.g. Dyeing Chemicals Expense"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Account Type *</Label>
                  <Select value={extraType} onValueChange={(v) => setExtraType(v || "EXPENSE")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASSET">Asset</SelectItem>
                      <SelectItem value="LIABILITY">Liability</SelectItem>
                      <SelectItem value="EQUITY">Equity</SelectItem>
                      <SelectItem value="INCOME">Income</SelectItem>
                      <SelectItem value="EXPENSE">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Parent Account</Label>
                  <EntitySelect
                    value={selectedRef1}
                    onValueChange={setSelectedRef1}
                    entityLabel="Parent Account"
                    quickAddType="account"
                    options={accounts.map((a) => ({
                      value: a.id,
                      label: `${a.accountCode} — ${a.name}`,
                    }))}
                    onQuickCreated={(a) => setAccounts((prev) => [a, ...prev])}
                    allowNone
                    noneLabel="Top-level (None)"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Opening Balance</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={numVal1}
                    onChange={(e) => setNumVal1(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={handleFieldKeyDown}
                  placeholder="Optional account notes"
                />
              </div>
            </>
          )}

          {/* BOM — full page parity */}
          {entityType === "bom" && (
            <>
              <div className="space-y-1.5">
                <Label>Product Item *</Label>
                <EntitySelect
                  value={selectedRef1}
                  onValueChange={setSelectedRef1}
                  entityLabel="Item"
                  quickAddType="item"
                  options={items.map((i) => ({
                    value: i.id,
                    label: `${i.itemCode} — ${i.name}`,
                  }))}
                  onQuickCreated={(i) => setItems((prev) => [i, ...prev])}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Output Quantity *</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={numVal1}
                    onChange={(e) => setNumVal1(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <Input
                    value={unitText}
                    onChange={(e) => setUnitText(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="Pcs / Kg / Mtr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Waste %</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={numVal2}
                    onChange={(e) => setNumVal2(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Raw Materials (Optional)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      setLineRows((p) => [
                        ...p,
                        { itemId: "", quantity: "1", unitPrice: "0", unit: "Pcs" },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Material
                  </Button>
                </div>
                {lineRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-6">
                      <EntitySelect
                        value={row.itemId}
                        onValueChange={(v) => updateLineRow(idx, { itemId: v })}
                        entityLabel="Material"
                        quickAddType="item"
                        options={items.map((i) => ({
                          value: i.id,
                          label: `${i.itemCode} — ${i.name}`,
                        }))}
                        onQuickCreated={(i) => setItems((prev) => [i, ...prev])}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={row.quantity}
                        onChange={(e) => updateLineRow(idx, { quantity: e.target.value })}
                        placeholder="Qty"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        value={row.unit}
                        onChange={(e) => updateLineRow(idx, { unit: e.target.value })}
                        placeholder="Unit"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() =>
                          setLineRows((p) => p.filter((_, i) => i !== idx))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={handleFieldKeyDown}
                  placeholder="Optional formula description"
                />
              </div>
            </>
          )}

          {/* PRODUCTION ORDER — full page parity */}
          {entityType === "productionOrder" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Product Item *</Label>
                  <EntitySelect
                    value={selectedRef1}
                    onValueChange={setSelectedRef1}
                    entityLabel="Item"
                    quickAddType="item"
                    options={items.map((i) => ({
                      value: i.id,
                      label: `${i.itemCode} — ${i.name}`,
                    }))}
                    onQuickCreated={(i) => setItems((prev) => [i, ...prev])}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>BOM (Optional)</Label>
                  <EntitySelect
                    value={selectedRef2}
                    onValueChange={setSelectedRef2}
                    entityLabel="BOM"
                    quickAddType="bom"
                    options={boms.map((b) => ({
                      value: b.id,
                      label: b.bomNumber,
                    }))}
                    onQuickCreated={(b) => setBoms((prev) => [b, ...prev])}
                    allowNone
                    noneLabel="Optional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={numVal1}
                    onChange={(e) => setNumVal1(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={extraType} onValueChange={(v) => setExtraType(v || "MEDIUM")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">LOW</SelectItem>
                      <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                      <SelectItem value="HIGH">HIGH</SelectItem>
                      <SelectItem value="URGENT">URGENT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {renderMoreDetailsToggle()}

              {showMore && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={dateStart}
                        onChange={(e) => setDateStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={dateEnd}
                        onChange={(e) => setDateEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assigned To</Label>
                    <Input
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      onKeyDown={handleFieldKeyDown}
                      placeholder="Supervisor / shift line"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Production batch instructions"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* DEMAND NOTE — full page parity */}
          {entityType === "demandNote" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <EntitySelect
                    value={selectedRef1}
                    onValueChange={setSelectedRef1}
                    entityLabel="Department"
                    quickAddType="department"
                    options={departments.map((d) => ({ value: d.id, label: d.name }))}
                    onQuickCreated={(d) => setDepartments((prev) => [d, ...prev])}
                    allowNone
                    noneLabel="Optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={extraType} onValueChange={(v) => setExtraType(v || "MEDIUM")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">LOW</SelectItem>
                      <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                      <SelectItem value="HIGH">HIGH</SelectItem>
                      <SelectItem value="URGENT">URGENT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Requested Items</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      setLineRows((p) => [
                        ...p,
                        { itemId: "", quantity: "1", unitPrice: "0", unit: "Pcs" },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Item
                  </Button>
                </div>
                {lineRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-7">
                      <EntitySelect
                        value={row.itemId}
                        onValueChange={(v) => updateLineRow(idx, { itemId: v })}
                        entityLabel="Item"
                        quickAddType="item"
                        options={items.map((i) => ({
                          value: i.id,
                          label: i.itemCode ? `${i.itemCode} — ${i.name}` : i.name,
                        }))}
                        onQuickCreated={(i) => setItems((prev) => [i, ...prev])}
                        allowNone
                        noneLabel="Select item (optional)"
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={row.quantity}
                        onChange={(e) => updateLineRow(idx, { quantity: e.target.value })}
                        placeholder="Qty"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {lineRows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() =>
                            setLineRows((p) => p.filter((_, i) => i !== idx))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {renderMoreDetailsToggle()}

              {showMore && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Requested By</Label>
                      <Input
                        value={requestedBy}
                        onChange={(e) => setRequestedBy(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="Requester"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cost Center</Label>
                      <Input
                        value={costCenter}
                        onChange={(e) => setCostCenter(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="e.g. Weaving"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Required Date</Label>
                      <Input
                        type="date"
                        value={dateStart}
                        onChange={(e) => setDateStart(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Remarks</Label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onKeyDown={handleFieldKeyDown}
                      placeholder="Optional demand notes"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* QUOTATION — full page parity */}
          {entityType === "quotation" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Vendor *</Label>
                  <EntitySelect
                    value={selectedRef1}
                    onValueChange={setSelectedRef1}
                    entityLabel="Vendor"
                    quickAddType="vendor"
                    options={vendors.map((v) => ({
                      value: v.id,
                      label: `${v.vendorCode} — ${v.name}`,
                    }))}
                    onQuickCreated={(v) => setVendors((prev) => [v, ...prev])}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Demand Note</Label>
                  <EntitySelect
                    value={selectedRef2}
                    onValueChange={setSelectedRef2}
                    entityLabel="Demand Note"
                    quickAddType="demandNote"
                    options={demandNotes.map((d) => ({
                      value: d.id,
                      label: d.demandNumber,
                    }))}
                    onQuickCreated={(d) => setDemandNotes((prev) => [d, ...prev])}
                    allowNone
                    noneLabel="Optional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Total Amount (PKR)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={numVal2}
                    onChange={(e) => setNumVal2(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Quotation Date</Label>
                  <Input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                  />
                </div>
              </div>

              {renderMoreDetailsToggle()}

              {showMore && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Delivery Time (Days)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={numVal1}
                        onChange={(e) => setNumVal1(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="e.g. 7"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Warranty</Label>
                      <Input
                        value={warranty}
                        onChange={(e) => setWarranty(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="e.g. 1 Year"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onKeyDown={handleFieldKeyDown}
                      placeholder="Optional terms & conditions"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* PURCHASE ORDER — full page parity */}
          {entityType === "purchaseOrder" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Vendor *</Label>
                  <EntitySelect
                    value={selectedRef1}
                    onValueChange={setSelectedRef1}
                    entityLabel="Vendor"
                    quickAddType="vendor"
                    options={vendors.map((v) => ({
                      value: v.id,
                      label: `${v.vendorCode} — ${v.name}`,
                    }))}
                    onQuickCreated={(v) => setVendors((prev) => [v, ...prev])}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Order Date</Label>
                  <Input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      setLineRows((p) => [
                        ...p,
                        { itemId: "", quantity: "1", unitPrice: "0", unit: "" },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Item
                  </Button>
                </div>
                {lineRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-6">
                      <EntitySelect
                        value={row.itemId}
                        onValueChange={(v) => {
                          const found = items.find((i) => i.id === v);
                          updateLineRow(idx, {
                            itemId: v,
                            unitPrice:
                              found?.purchasePrice != null
                                ? String(found.purchasePrice)
                                : row.unitPrice,
                          });
                        }}
                        entityLabel="Item"
                        quickAddType="item"
                        options={items.map((i) => ({
                          value: i.id,
                          label: `${i.itemCode} — ${i.name}`,
                        }))}
                        onQuickCreated={(i) => setItems((prev) => [i, ...prev])}
                        allowNone
                        noneLabel="Select item (optional)"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={row.quantity}
                        onChange={(e) => updateLineRow(idx, { quantity: e.target.value })}
                        placeholder="Qty"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unitPrice}
                        onChange={(e) => updateLineRow(idx, { unitPrice: e.target.value })}
                        placeholder="Unit Price"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {lineRows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() =>
                            setLineRows((p) => p.filter((_, i) => i !== idx))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {renderMoreDetailsToggle()}

              {showMore && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Demand Note</Label>
                      <EntitySelect
                        value={selectedRef2}
                        onValueChange={setSelectedRef2}
                        entityLabel="Demand Note"
                        quickAddType="demandNote"
                        options={demandNotes.map((d) => ({
                          value: d.id,
                          label: d.demandNumber,
                        }))}
                        onQuickCreated={(d) => setDemandNotes((prev) => [d, ...prev])}
                        allowNone
                        noneLabel="Optional"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Quotation</Label>
                      <EntitySelect
                        value={selectedRef3}
                        onValueChange={setSelectedRef3}
                        entityLabel="Quotation"
                        quickAddType="quotation"
                        options={quotations.map((q) => ({
                          value: q.id,
                          label: q.quotationNumber,
                        }))}
                        onQuickCreated={(q) => setQuotations((prev) => [q, ...prev])}
                        allowNone
                        noneLabel="Optional"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Expected Delivery</Label>
                      <Input
                        type="date"
                        value={dateEnd}
                        onChange={(e) => setDateEnd(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Payment Terms</Label>
                      <Input
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="e.g. Net 30"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Shipping Cost</Label>
                      <Input
                        type="number"
                        min="0"
                        value={shippingCost}
                        onChange={(e) => setShippingCost(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Discount</Label>
                      <Input
                        type="number"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tax Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        value={taxAmount}
                        onChange={(e) => setTaxAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onKeyDown={handleFieldKeyDown}
                      placeholder="Optional PO notes"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* SALES ORDER — full page parity */}
          {entityType === "salesOrder" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Customer *</Label>
                  <EntitySelect
                    value={selectedRef1}
                    onValueChange={setSelectedRef1}
                    entityLabel="Customer"
                    quickAddType="customer"
                    options={customers.map((c) => ({
                      value: c.id,
                      label: `${c.customerCode} — ${c.name}`,
                    }))}
                    onQuickCreated={(c) => setCustomers((prev) => [c, ...prev])}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Order Date</Label>
                  <Input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      setLineRows((p) => [
                        ...p,
                        { itemId: "", quantity: "1", unitPrice: "0", unit: "" },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Item
                  </Button>
                </div>
                {lineRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-6">
                      <EntitySelect
                        value={row.itemId}
                        onValueChange={(v) => {
                          const found = items.find((i) => i.id === v);
                          updateLineRow(idx, {
                            itemId: v,
                            unitPrice:
                              found?.sellingPrice != null
                                ? String(found.sellingPrice)
                                : row.unitPrice,
                          });
                        }}
                        entityLabel="Item"
                        quickAddType="item"
                        options={items.map((i) => ({
                          value: i.id,
                          label: `${i.itemCode} — ${i.name}`,
                        }))}
                        onQuickCreated={(i) => setItems((prev) => [i, ...prev])}
                        allowNone
                        noneLabel="Select item (optional)"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={row.quantity}
                        onChange={(e) => updateLineRow(idx, { quantity: e.target.value })}
                        placeholder="Qty"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unitPrice}
                        onChange={(e) => updateLineRow(idx, { unitPrice: e.target.value })}
                        placeholder="Unit Price"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {lineRows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() =>
                            setLineRows((p) => p.filter((_, i) => i !== idx))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {renderMoreDetailsToggle()}

              {showMore && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Expected Delivery</Label>
                      <Input
                        type="date"
                        value={dateEnd}
                        onChange={(e) => setDateEnd(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Payment Terms</Label>
                      <Input
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        placeholder="e.g. Net 30"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1.5">
                      <Label>Shipping Cost</Label>
                      <Input
                        type="number"
                        min="0"
                        value={shippingCost}
                        onChange={(e) => setShippingCost(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Discount</Label>
                      <Input
                        type="number"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tax Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        value={taxAmount}
                        onChange={(e) => setTaxAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onKeyDown={handleFieldKeyDown}
                      placeholder="Optional SO notes"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* PAYROLL PERIOD — full page parity */}
          {entityType === "payrollPeriod" && (
            <>
              <div className="space-y-1.5">
                <Label>Period Name *</Label>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleFieldKeyDown}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* PAYHEAD — full page parity */}
          {entityType === "payhead" && (
            <>
              <div className="space-y-1.5">
                <Label>Payhead Name *</Label>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleFieldKeyDown}
                  placeholder="e.g. Basic Salary"
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={extraType} onValueChange={(v) => setExtraType(v || "EARNING")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EARNING">Earning</SelectItem>
                      <SelectItem value="DEDUCTION">Deduction</SelectItem>
                      <SelectItem value="STATUTORY">Statutory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Default Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    value={numVal1}
                    onChange={(e) => setNumVal1(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Percentage (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={numVal2}
                    onChange={(e) => setNumVal2(e.target.value)}
                    onKeyDown={handleFieldKeyDown}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={handleFieldKeyDown}
                  placeholder="Optional payhead description"
                />
              </div>
            </>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={submitting}
              className="gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Save &amp; Select
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
