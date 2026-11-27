"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntitySelect } from "@/components/shared/entity-select";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createCrudService } from "@/lib/api/crud";
import { toast } from "sonner";
import { AppShell } from "@/components/layouts/app-shell";

interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export default function GeneralLedgerPage() {
  const acctService = createCrudService<any>("/finance/accounts");
  const journalService = createCrudService<any>("/finance/journal-entries");

  const [accounts, setAccounts] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [accountBals, setAccountBals] = useState<AccountBalance[]>([]);
  const [filteredBals, setFilteredBals] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const ACCOUNT_TYPES = ["ALL", "ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [acctRes, jnlRes] = await Promise.all([
        acctService.findAll({ limit: 1000 }),
        journalService.findAll({ limit: 1000 }),
      ]);

      setAccounts(acctRes.data || []);
      setEntries(jnlRes.data || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const balanceMap: Record<string, AccountBalance> = {};
    accounts.forEach((a: any) => {
      balanceMap[a.id] = {
        accountId: a.id,
        accountCode: a.accountCode,
        accountName: a.name,
        type: a.type,
        totalDebit: 0,
        totalCredit: 0,
        balance: 0,
      };
    });

    entries.forEach((entry: any) => {
      if (!entry.isPosted) return;
      const rawDate = entry.entryDate || entry.createdAt;
      if (dateFrom || dateTo) {
        if (!rawDate) return;
        const dStr = new Date(rawDate).toISOString().split("T")[0];
        if (dateFrom && dStr < dateFrom) return;
        if (dateTo && dStr > dateTo) return;
      }
      if (entry.items && Array.isArray(entry.items)) {
        entry.items.forEach((item: any) => {
          if (balanceMap[item.accountId]) {
            balanceMap[item.accountId].totalDebit += parseFloat(item.debitAmount) || 0;
            balanceMap[item.accountId].totalCredit += parseFloat(item.creditAmount) || 0;
          }
        });
      }
    });

    Object.values(balanceMap).forEach((bal) => {
      const isDebitNormal = bal.type === "ASSET" || bal.type === "EXPENSE";
      bal.balance = isDebitNormal
        ? bal.totalDebit - bal.totalCredit
        : bal.totalCredit - bal.totalDebit;
    });

    setAccountBals(Object.values(balanceMap));
  }, [accounts, entries, dateFrom, dateTo]);

  useEffect(() => {
    let result = [...accountBals];
    if (selectedAccount !== "all") {
      result = result.filter((b) => b.accountId === selectedAccount);
    }
    if (typeFilter !== "ALL") {
      result = result.filter((b) => b.type === typeFilter);
    }
    setFilteredBals(result);
  }, [selectedAccount, typeFilter, accountBals]);

  const handleExport = () => {
    if (filteredBals.length === 0) {
      toast.info("No ledger rows to export");
      return;
    }
    const headers = ["Account", "Code", "Type", "Total Debit", "Total Credit", "Balance"];
    const rows = filteredBals.map((b) => [
      `"${(b.accountName || "").replace(/"/g, '""')}"`,
      b.accountCode,
      b.type,
      b.totalDebit.toFixed(2),
      b.totalCredit.toFixed(2),
      b.balance.toFixed(2),
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(",")), "", '"Powered by Digitalerena","https://digitalerena.com"'].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `general_ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("General ledger exported to CSV");
  };

  const totalDebit = filteredBals.reduce((s, b) => s + b.totalDebit, 0);
  const totalCredit = filteredBals.reduce((s, b) => s + b.totalCredit, 0);
  const totalBalance = filteredBals.reduce((s, b) => s + b.balance, 0);

  const TYPE_STYLES: Record<string, string> = {
    ASSET: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    LIABILITY: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    EQUITY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    INCOME: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    EXPENSE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };

  return (
    <AppShell title="General Ledger">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">View account balances and transactions</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredBals.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter the ledger by account and type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Account</Label>
                <EntitySelect
                  value={selectedAccount === "all" ? "" : selectedAccount}
                  onValueChange={(v) => setSelectedAccount(v || "all")}
                  entityLabel="Account"
                  pluralLabel="accounts"
                  quickAddType="account"
                  allowNone
                  noneLabel="All Accounts"
                  placeholder="All Accounts"
                  options={accounts.map((a) => ({
                    value: a.id,
                    label: `${a.accountCode} - ${a.name}`,
                  }))}
                  onQuickCreated={(created) => {
                    setAccounts((prev) => [created, ...prev]);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={typeFilter} onValueChange={(v: string | null) => v && setTypeFilter(v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t === "ALL" ? "All Types" : t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Debit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{totalDebit.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Credit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{totalCredit.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Net Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${totalBalance < 0 ? "text-destructive" : ""}`}>
                {totalBalance.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Account", "Code", "Type", "Debit", "Credit", "Balance"].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, ci) => (
                      <TableCell key={ci}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : filteredBals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search className="h-12 w-12 mb-2 opacity-40" />
            <p className="font-medium">No accounts found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total Debit</TableHead>
                  <TableHead className="text-right">Total Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBals.map((bal) => (
                  <TableRow key={bal.accountId}>
                    <TableCell className="font-medium">{bal.accountName}</TableCell>
                    <TableCell>{bal.accountCode}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TYPE_STYLES[bal.type] || ""}>
                        {bal.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{bal.totalDebit.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{bal.totalCredit.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-medium ${bal.balance < 0 ? "text-destructive" : ""}`}>
                      {bal.balance.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
