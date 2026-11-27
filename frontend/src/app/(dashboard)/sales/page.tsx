"use client";

import { useState, useEffect } from "react";
import { LineChart, ClipboardList, Clock, CheckCircle2, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { createCrudService } from "@/lib/api/crud";
import { AppShell } from "@/components/layouts/app-shell";
import Link from "next/link";
import { toast } from "sonner";

interface SalesOrder {
  id: string;
  soNumber: string;
  customerId: string;
  grandTotal: number;
  status: string;
  orderDate?: string;
}

export default function SalesPage() {
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });
  const [recentOrders, setRecentOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const service = createCrudService<SalesOrder>("/sales/orders");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await service.findAll({ limit: 50 });
      const orders = res.data;
      setStats({
        total: res.meta.total,
        pending: orders.filter((o) => o.status === "PENDING" || o.status === "CONFIRMED").length,
        completed: orders.filter((o) => o.status === "COMPLETED" || o.status === "DELIVERED").length,
      });
      setRecentOrders(orders.slice(0, 5));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const fmt = (n: number) => "₨ " + (n || 0).toLocaleString("en-PK");

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      PENDING: { variant: "outline", label: "Pending" },
      CONFIRMED: { variant: "default", label: "Confirmed" },
      PROCESSING: { variant: "default", label: "Processing" },
      SHIPPED: { variant: "outline", label: "Shipped" },
      DELIVERED: { variant: "secondary", label: "Delivered" },
      COMPLETED: { variant: "secondary", label: "Completed" },
      CANCELLED: { variant: "destructive", label: "Cancelled" },
    };
    const s = map[status] || { variant: "outline" as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const statCards = [
    { title: "Total Orders", value: stats.total, icon: ClipboardList, href: "/sales/orders" },
    { title: "Pending Orders", value: stats.pending, icon: Clock },
    { title: "Completed", value: stats.completed, icon: CheckCircle2 },
    { title: "Revenue", value: recentOrders.reduce((s, o) => s + (o.grandTotal || 0), 0), icon: DollarSign, isCurrency: true },
  ];

  return (
    <AppShell title="Sales">
      <div className="space-y-6 animate-in">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            const content = (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {loading ? "..." : stat.isCurrency ? fmt(stat.value as number) : stat.value}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
            return stat.href ? <Link key={stat.title} href={stat.href}>{content}</Link> : <div key={stat.title}>{content}</div>;
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link href="/sales/orders">
                    <Button variant="outline" className="w-full justify-start"><ClipboardList className="h-4 w-4 mr-2" /> Sales Orders</Button>
                  </Link>
                  <Link href="/customers">
                    <Button variant="outline" className="w-full justify-start"><LineChart className="h-4 w-4 mr-2" /> Customers</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Orders</CardTitle>
                <Link href="/sales/orders" className="text-xs text-primary hover:underline">View All</Link>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
                  </div>
                ) : recentOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No sales orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{order.soNumber}</p>
                          <p className="text-xs text-muted-foreground">{fmt(order.grandTotal)}</p>
                        </div>
                        {statusBadge(order.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
