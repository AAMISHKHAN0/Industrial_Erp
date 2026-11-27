"use client";

import { useState, useEffect } from "react";
import { Factory, ClipboardList, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { createCrudService } from "@/lib/api/crud";
import { AppShell } from "@/components/layouts/app-shell";
import Link from "next/link";
import { toast } from "sonner";

interface ProductionOrder {
  id: string;
  productionNumber: string;
  quantity: number;
  status: string;
  assignedTo?: string;
  startDate?: string;
}

export default function ProductionPage() {
  const [stats, setStats] = useState({ total: 0, planned: 0, inProgress: 0, completed: 0 });
  const [recentOrders, setRecentOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const service = createCrudService<ProductionOrder>("/production/orders");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await service.findAll({ limit: 50 });
      const orders = res.data;
      setStats({
        total: res.meta.total,
        planned: orders.filter((o) => o.status === "PLANNED").length,
        inProgress: orders.filter((o) => o.status === "IN_PROGRESS").length,
        completed: orders.filter((o) => o.status === "COMPLETED").length,
      });
      setRecentOrders(orders.slice(0, 5));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const statCards = [
    { title: "Total Orders", value: stats.total, icon: ClipboardList, href: "/production/orders" },
    { title: "Planned", value: stats.planned, icon: Clock },
    { title: "In Progress", value: stats.inProgress, icon: Factory },
    { title: "Completed", value: stats.completed, icon: CheckCircle2 },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      PLANNED: { variant: "default", label: "Planned" },
      IN_PROGRESS: { variant: "outline", label: "In Progress" },
      COMPLETED: { variant: "secondary", label: "Completed" },
      CANCELLED: { variant: "destructive", label: "Cancelled" },
    };
    const s = map[status] || { variant: "outline" as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  return (
    <AppShell title="Production">
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
                    <div className="text-2xl font-bold">{loading ? "..." : stat.value}</div>
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
                  <Link href="/production/orders">
                    <Button variant="outline" className="w-full justify-start"><Factory className="h-4 w-4 mr-2" /> Manage Production Orders</Button>
                  </Link>
                  <Link href="/production/bom">
                    <Button variant="outline" className="w-full justify-start"><ClipboardList className="h-4 w-4 mr-2" /> Bill of Materials</Button>
                  </Link>
                  <Link href="/production/quality">
                    <Button variant="outline" className="w-full justify-start"><AlertTriangle className="h-4 w-4 mr-2" /> Quality Control</Button>
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
                <Link href="/production/orders" className="text-xs text-primary hover:underline">View All</Link>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
                  </div>
                ) : recentOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No production orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{order.productionNumber}</p>
                          <p className="text-xs text-muted-foreground">Qty: {order.quantity}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground hidden sm:inline">{order.assignedTo || "Unassigned"}</span>
                          {statusBadge(order.status)}
                        </div>
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
