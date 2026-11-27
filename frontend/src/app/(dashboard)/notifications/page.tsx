"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  Info,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return "Just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString("en-PK", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterTab, setFilterTab] = useState<"ALL" | "UNREAD" | "READ">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async (isRefresh = false, pageNum = 1) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [listRes, countRes] = await Promise.all([
        api.getWithMeta<Notification[]>(`/notifications?page=${pageNum}&limit=20`),
        api.get<{ count: number }>("/notifications/unread-count"),
      ]);

      const items = Array.isArray(listRes)
        ? listRes
        : Array.isArray(listRes?.data)
        ? listRes.data
        : [];
      setNotifications(items);
      if (listRes?.meta) {
        setMeta(listRes.meta);
      }
      const rawCount =
        typeof countRes?.count === "number"
          ? countRes.count
          : (countRes as any)?.data?.count;
      setUnreadCount(typeof rawCount === "number" ? rawCount : 0);
    } catch (err: any) {
      console.error("Failed to load notifications:", err);
      setError(err?.message || "Failed to load notifications from server.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(false, 1);
    const handler = () => {
      fetchNotifications(true, 1);
    };
    window.addEventListener("notifications-updated", handler);
    return () => {
      window.removeEventListener("notifications-updated", handler);
    };
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      window.dispatchEvent(new Event("notifications-updated"));
      toast.success("Notification marked as read");
    } catch (err: any) {
      console.error("Error marking notification read:", err);
      toast.error("Failed to mark notification as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await api.patch("/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      window.dispatchEvent(new Event("notifications-updated"));
      toast.success("All notifications marked as read");
    } catch (err: any) {
      console.error("Error marking all read:", err);
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  };

  // Filtered in memory by tab and search
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Tab filter
      if (filterTab === "UNREAD" && n.isRead) return false;
      if (filterTab === "READ" && !n.isRead) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title?.toLowerCase().includes(q);
        const matchMsg = n.message?.toLowerCase().includes(q);
        if (!matchTitle && !matchMsg) return false;
      }
      return true;
    });
  }, [notifications, filterTab, searchQuery]);

  const getTypeIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case "SUCCESS":
        return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
      case "WARNING":
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case "ERROR":
        return <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />;
      case "INFO":
      default:
        return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs px-2 py-0.5">
                    {unreadCount} unread
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Operational events, stock arrivals, and transaction alerts for your account.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNotifications(true, meta.page)}
            disabled={loading || refreshing}
            className="h-9 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || markingAll || loading}
            className="h-9 cursor-pointer"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            {markingAll ? "Marking..." : "Mark All as Read"}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center bg-muted/60 p-1 rounded-lg border text-xs font-medium self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterTab("ALL")}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              filterTab === "ALL"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("UNREAD")}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterTab === "UNREAD"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("READ")}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              filterTab === "READ"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Read
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-xs bg-background"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <Card className="border shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {/* Loading State */}
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 sm:p-5 flex items-start gap-3.5">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            /* Error State */
            <div className="p-12 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Failed to Load Notifications</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNotifications(false, meta.page)}
                className="mt-2"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try Again
              </Button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            /* Empty State */
            <div className="p-16 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <BellOff className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {searchQuery || filterTab !== "ALL" ? "No Matching Notifications" : "No Notifications Yet"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery || filterTab !== "ALL"
                  ? "Try clearing your search query or switching to another filter tab."
                  : "You are all caught up! New operational events and transaction vouchers will appear here."}
              </p>
              {(searchQuery || filterTab !== "ALL") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilterTab("ALL");
                    setSearchQuery("");
                  }}
                  className="mt-2 text-xs"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            /* Notifications List */
            <div className="divide-y divide-border">
              {filteredNotifications.map((n) => {
                const isUnread = !n.isRead;
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (isUnread) handleMarkAsRead(n.id);
                      if (n.link) router.push(n.link);
                    }}
                    className={`p-4 sm:p-5 flex items-start gap-3.5 transition-colors cursor-pointer hover:bg-muted/40 ${
                      isUnread ? "bg-primary/[0.03] dark:bg-primary/[0.06]" : ""
                    }`}
                  >
                    {/* Unread Accent Dot & Icon */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 border">
                        {getTypeIcon(n.type)}
                      </div>
                      {isUnread && (
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <h4
                          className={`text-sm ${
                            isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/85"
                          }`}
                        >
                          {n.title}
                        </h4>
                        <span className="text-[11px] text-muted-foreground shrink-0 font-mono">
                          {relativeTime(n.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {n.message}
                      </p>

                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-[10px] text-muted-foreground/80">
                          {new Date(n.createdAt).toLocaleString("en-PK", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>

                        {n.link && (
                          <span className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                            View Details <ExternalLink className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Mark Read Action */}
                    {isUnread && (
                      <div className="shrink-0 self-center pl-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          title="Mark as read"
                          className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-background border cursor-pointer"
                        >
                          Mark read
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Footer if multiple pages */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2 text-xs text-muted-foreground">
          <span>
            Showing page <strong className="text-foreground">{meta.page}</strong> of{" "}
            <strong className="text-foreground">{meta.totalPages}</strong> ({meta.total} total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1 || loading}
              onClick={() => fetchNotifications(false, meta.page - 1)}
              className="h-8 text-xs cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages || loading}
              onClick={() => fetchNotifications(false, meta.page + 1)}
              className="h-8 text-xs cursor-pointer"
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
