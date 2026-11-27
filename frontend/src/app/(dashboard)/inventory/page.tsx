"use client";

import { useState, useEffect } from "react";
import { Package, Tags, Ruler, Warehouse, AlertTriangle, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { createCrudService } from "@/lib/api/crud";
import { AppShell } from "@/components/layouts/app-shell";

interface Summary {
  totalItems: number;
  totalCategories: number;
  totalUnits: number;
  totalWarehouses: number;
  lowStockItems: number;
  outOfStockItems: number;
}

const defaultSummary: Summary = {
  totalItems: 0, totalCategories: 0, totalUnits: 0,
  totalWarehouses: 0, lowStockItems: 0, outOfStockItems: 0,
};

const cards = [
  { key: "totalItems", label: "Total Items", icon: Package, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30" },
  { key: "totalCategories", label: "Categories", icon: Tags, color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30" },
  { key: "totalUnits", label: "Units", icon: Ruler, color: "bg-green-100 text-green-600 dark:bg-green-900/30" },
  { key: "totalWarehouses", label: "Warehouses", icon: Warehouse, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30" },
  { key: "lowStockItems", label: "Low Stock Items", icon: AlertTriangle, color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30" },
  { key: "outOfStockItems", label: "Out of Stock", icon: Ban, color: "bg-red-100 text-red-600 dark:bg-red-900/30" },
];

export default function InventoryPage() {
  const [summary, setSummary] = useState<Summary>(defaultSummary);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const itemService = createCrudService<any>("/inventory/items");
        const catService = createCrudService<any>("/inventory/categories");
        const unitService = createCrudService<any>("/inventory/units");
        const whService = createCrudService<any>("/inventory/warehouses");

        const [items, cats, units, whs] = await Promise.allSettled([
          itemService.findAll({ limit: 1 }),
          catService.findAll({ limit: 1 }),
          unitService.findAll({ limit: 1 }),
          whService.findAll({ limit: 1 }),
        ]);

        const totalItems = items.status === "fulfilled" ? items.value.meta.total : 0;
        const totalCategories = cats.status === "fulfilled" ? cats.value.meta.total : 0;
        const totalUnits = units.status === "fulfilled" ? units.value.meta.total : 0;
        const totalWarehouses = whs.status === "fulfilled" ? whs.value.meta.total : 0;

        setSummary({
          totalItems,
          totalCategories,
          totalUnits,
          totalWarehouses,
          lowStockItems: 0,
          outOfStockItems: 0,
        });
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AppShell title="Inventory">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Overview of inventory metrics and stock status</p>
          <Badge variant="secondary" className="text-xs">
            {loading ? "Loading..." : "Live"}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map((card, index) => {
            const Icon = card.icon;
            const val = summary[card.key as keyof Summary];
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
