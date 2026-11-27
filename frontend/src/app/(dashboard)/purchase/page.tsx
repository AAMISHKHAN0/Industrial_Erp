"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, FileText, ScrollText, ClipboardList, Truck, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { createCrudService } from "@/lib/api/crud";
import { AppShell } from "@/components/layouts/app-shell";

interface ModuleCard {
  title: string;
  href: string;
  icon: React.ElementType;
  color: string;
  countKey: string;
}

const modules: ModuleCard[] = [
  { title: "Demand Notes", href: "/purchase/demand-notes", icon: ClipboardList, color: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30", countKey: "demandNotes" },
  { title: "Vendor Quotations", href: "/purchase/quotations", icon: FileText, color: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30", countKey: "quotations" },
  { title: "Purchase Orders", href: "/purchase/orders", icon: ScrollText, color: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30", countKey: "orders" },
  { title: "Goods Receiving", href: "/purchase/goods-receiving", icon: ShoppingCart, color: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30", countKey: "grns" },
  { title: "Vendors", href: "/purchase/vendors", icon: Truck, color: "text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/30", countKey: "vendors" },
];

const paths: Record<string, string> = {
  demandNotes: "/purchase/demand-notes",
  quotations: "/purchase/quotations",
  orders: "/purchase/orders",
  grns: "/purchase/goods-receiving",
  vendors: "/purchase/vendors",
};

export default function PurchaseDashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const results = await Promise.allSettled(
          Object.entries(paths).map(async ([key, path]) => {
            const service = createCrudService(path);
            const { meta } = await service.findAll({ limit: 1, page: 1 });
            return { key, total: meta.total };
          })
        );
        const c: Record<string, number> = {};
        results.forEach((r) => {
          if (r.status === "fulfilled") c[r.value.key] = r.value.total;
        });
        setCounts(c);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, []);

  return (
    <AppShell title="Purchase">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
            Manage procurement lifecycle — from demand notes to goods receiving
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className="group block">
              <Card className="transition-all hover:shadow-md hover:ring-2 hover:ring-primary/20 h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{m.title}</CardTitle>
                  <div className={`rounded-lg p-2 ${m.color}`}>
                    <m.icon className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {loading ? (
                      <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                    ) : (
                      counts[m.countKey] ?? 0
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                    View details <ArrowRight className="h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href="/purchase/demand-notes"
                className="inline-flex items-center justify-start gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted hover:text-foreground transition-all"
              >
                <ClipboardList className="h-4 w-4 shrink-0" /> Create Demand Note
              </Link>
              <Link
                href="/purchase/orders"
                className="inline-flex items-center justify-start gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted hover:text-foreground transition-all"
              >
                <ScrollText className="h-4 w-4 shrink-0" /> Create Purchase Order
              </Link>
              <Link
                href="/purchase/goods-receiving"
                className="inline-flex items-center justify-start gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted hover:text-foreground transition-all"
              >
                <ShoppingCart className="h-4 w-4 shrink-0" /> Record Goods Receiving
              </Link>
              <Link
                href="/purchase/vendors"
                className="inline-flex items-center justify-start gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted hover:text-foreground transition-all"
              >
                <Truck className="h-4 w-4 shrink-0" /> Manage Vendors
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                Select a module above to view and manage records
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
