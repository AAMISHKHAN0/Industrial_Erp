"use client";

import { useState, useEffect } from "react";
import { Warehouse, CheckCircle, XCircle, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { createCrudService } from "@/lib/api/crud";
import { AppShell } from "@/components/layouts/app-shell";

const cards = [
  { key: "total", label: "Total Warehouses", icon: Warehouse, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30" },
  { key: "active", label: "Active Warehouses", icon: CheckCircle, color: "bg-green-100 text-green-600 dark:bg-green-900/30" },
  { key: "inactive", label: "Inactive Warehouses", icon: XCircle, color: "bg-red-100 text-red-600 dark:bg-red-900/30" },
  { key: "itemsInStock", label: "Items in Stock", icon: Package, color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30" },
];

export default function WarehousePage() {
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, itemsInStock: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const whService = createCrudService<any>("/inventory/warehouses");
        const whRes = await whService.findAll({ limit: 100 });
        const whData = whRes.data || [];
        const active = whData.filter((w: any) => w.isActive !== false).length;
        setStats({
          total: whRes.meta?.total || whData.length,
          active,
          inactive: whData.length - active,
          itemsInStock: 0,
        });
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AppShell title="Warehouse">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Overview of warehouse locations and stock</p>
          <Badge variant="secondary" className="text-xs">
            {loading ? "Loading..." : "Live"}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, index) => {
            const Icon = card.icon;
            const val = stats[card.key as keyof typeof stats];
            return (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.label}
                    </CardTitle>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${card.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {loading ? (
                        <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                      ) : (
                        val.toLocaleString()
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
