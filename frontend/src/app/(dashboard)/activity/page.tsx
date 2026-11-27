"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  Search,
  Filter,
  FileText,
  Package,
  ShoppingCart,
  Factory,
  Users,
  Receipt,
  CircleCheck,
  Pencil,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { userColor, userDisplayName, userInitials } from "@/lib/user-color";

interface AuditEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  newValue: any;
  createdAt: string;
}

const ENTITY_ROUTES: Record<string, (id?: string | null) => string> = {
  PurchaseOrder: (id) => (id ? `/purchase/orders/${id}` : "/purchase/orders"),
  GoodsReceivingNote: (id) => (id ? `/purchase/goods-receiving/${id}` : "/purchase/goods-receiving"),
  SalesOrder: (id) => (id ? `/sales/orders/${id}` : "/sales/orders"),
  ProductionOrder: (id) => (id ? `/production/orders/${id}` : "/production/orders"),
  ProductionBom: (id) => (id ? `/production/bom/${id}` : "/production/bom"),
  PayrollPeriod: () => "/hr/payroll",
  JournalEntry: () => "/finance/journal",
  InventoryItem: (id) => (id ? `/inventory/items/${id}` : "/inventory/items"),
};

const ACTION_META: Record<string, { label: string; icon: any; tone: string }> = {
  CREATED: { label: "Created", icon: CircleCheck, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950" },
  UPDATED: { label: "Updated", icon: Pencil, tone: "text-blue-600 bg-blue-50 dark:bg-blue-950" },
  APPROVED: { label: "Approved", icon: CircleCheck, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950" },
  REJECTED: { label: "Rejected", icon: Trash2, tone: "text-red-600 bg-red-50 dark:bg-red-950" },
  DELETED: { label: "Deleted", icon: Trash2, tone: "text-red-600 bg-red-50 dark:bg-red-950" },
  COMPLETED: { label: "Completed", icon: CircleCheck, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950" },
  POSTED: { label: "Posted", icon: Receipt, tone: "text-violet-600 bg-violet-50 dark:bg-violet-950" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function entityLabel(entity: string): string {
  return entity.replace(/([A-Z])/g, " $1").replace(/^ /, "").trim();
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("limit", "30");
      if (search) qs.set("search", search);
      if (entity) qs.set("entity", entity);
      if (action) qs.set("action", action);
      const { data, meta } = await api.getWithMeta<AuditEntry[]>(`/audit-logs?${qs.toString()}`);
      setEntries(data ?? []);
      setTotal(meta?.total ?? 0);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, entity, action]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [page, search, entity, action]);

  const entities = Array.from(new Set(entries.map((e) => e.entity))).sort();
  const actions = Array.from(new Set(entries.map((e) => e.action))).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ActivityIcon className="h-6 w-6 text-primary" /> Activity Log
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every change is attributed to the user who made it.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">{total} events</Badge>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search user, entity, ID…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-10"
            />
          </div>

          <select
            value={entity}
            onChange={(e) => { setEntity(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All entities</option>
            {entities.map((e) => (
              <option key={e} value={e}>{entityLabel(e)}</option>
            ))}
          </select>

          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{ACTION_META[a]?.label ?? a}</option>
            ))}
          </select>

          {(search || entity || action) && (
            <Button variant="ghost" onClick={() => { setSearch(""); setEntity(""); setAction(""); setPage(1); }}>
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <ActivityIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
              No activity recorded yet.
            </div>
          ) : (
            <ol className="relative">
              {entries.map((e, i) => {
                const meta = ACTION_META[e.action] ?? { label: e.action, icon: Pencil, tone: "text-muted-foreground bg-muted" };
                const Icon = meta.icon;
                const name = userDisplayName(e.userName, e.userEmail, e.userId);
                const color = userColor(e.userEmail || e.userId);
                const route = ENTITY_ROUTES[e.entity]?.(e.entityId);
                const sub =
                  e.newValue && typeof e.newValue === "object"
                    ? Object.entries(e.newValue)
                        .filter(([k]) => !["companyId", "id", "createdAt"].includes(k))
                        .slice(0, 2)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(" · ")
                    : "";
                return (
                  <li key={e.id} className="relative flex gap-4 px-6 py-4 hover:bg-muted/40 transition-colors">
                    {i !== entries.length - 1 && (
                      <span className="absolute left-[43px] top-14 bottom-0 w-px bg-border" />
                    )}
                    <Avatar className="size-10 shrink-0" style={{ backgroundColor: `${color}22`, color }}>
                      <AvatarFallback style={{ backgroundColor: color, color: "#fff" }}>
                        {userInitials(e.userName, e.userEmail)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium" style={{ color }}>{name}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.tone}`}
                        >
                          <Icon className="h-3 w-3" /> {meta.label}
                        </span>
                        <span className="text-muted-foreground text-sm">{entityLabel(e.entity)}</span>
                        {route && (
                          <Link
                            href={route}
                            className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                          >
                            view <ChevronRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                      {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
                      <p className="text-xs text-muted-foreground/70 mt-1">{relativeTime(e.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {total > page * 30 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)}>Load more</Button>
        </div>
      )}
    </div>
  );
}
