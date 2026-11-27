"use client";

import { useState, useEffect } from "react";
import { BarChart3, BookOpen, FileText, TrendingUp, DollarSign, ArrowUpRight, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layouts/app-shell";
import { createCrudService } from "@/lib/api/crud";

export default function FinancePage() {
  const [accountCount, setAccountCount] = useState(0);
  const [journalCount, setJournalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const acctService = createCrudService<any>("/finance/accounts");
        const jnlService = createCrudService<any>("/finance/journal-entries");

        const [acctRes, jnlRes] = await Promise.allSettled([
          acctService.findAll({ limit: 1 }),
          jnlService.findAll({ limit: 1 }),
        ]);

        if (acctRes.status === "fulfilled") setAccountCount(acctRes.value.meta?.total || 0);
        if (jnlRes.status === "fulfilled") setJournalCount(jnlRes.value.meta?.total || 0);
      } catch {
        // API not available - show zero
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const stats = [
    {
      title: "Chart of Accounts",
      value: loading ? "..." : String(accountCount),
      icon: BookOpen,
      color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30",
      description: "Total accounts in chart",
    },
    {
      title: "Journal Entries",
      value: loading ? "..." : String(journalCount),
      icon: FileText,
      color: "bg-green-100 text-green-600 dark:bg-green-900/30",
      description: "Total entries recorded",
    },
    {
      title: "Unposted Entries",
      value: loading ? "..." : "--",
      icon: BarChart3,
      color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30",
      description: "Awaiting posting",
    },
    {
      title: "Total Balance",
      value: loading ? "..." : "--",
      icon: Wallet,
      color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30",
      description: "Sum of all account balances",
    },
  ];

  return (
    <AppShell title="Finance">
      <div className="space-y-6 animate-in">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Financial management and accounting overview
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            <BarChart3 className="h-3 w-3 mr-1" /> Finance Module
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stat.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common finance operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Chart of Accounts", href: "/finance/accounts", icon: BookOpen, desc: "Manage accounts" },
                  { label: "Journal Entries", href: "/finance/journal", icon: FileText, desc: "Record transactions" },
                  { label: "General Ledger", href: "/finance/ledger", icon: BarChart3, desc: "View account balances" },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <a
                      key={action.label}
                      href={action.href}
                      className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted transition-colors group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{action.label}</p>
                        <p className="text-xs text-muted-foreground">{action.desc}</p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground" />
                    </a>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Account Types</CardTitle>
                <CardDescription>Distribution by account classification</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: "Assets", color: "bg-blue-500", pct: 0 },
                    { label: "Liabilities", color: "bg-red-500", pct: 0 },
                    { label: "Equity", color: "bg-green-500", pct: 0 },
                    { label: "Income", color: "bg-yellow-500", pct: 0 },
                    { label: "Expenses", color: "bg-orange-500", pct: 0 },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-2">
                    Add accounts to see distribution
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
