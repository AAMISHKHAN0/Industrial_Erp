"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  LogOut,
  Settings,
  Bell,
  User,
  Command,
  ShoppingCart,
  Users,
  Building,
  LayoutDashboard,
  Factory,
  DollarSign,
  HelpCircle,
  Warehouse,
  ClipboardList,
  Database,
  Loader2,
  BellOff,
  Menu,
  PackageCheck,
  PackageMinus,
  FileText,
  Receipt,
  CreditCard,
  Banknote,
  ArrowUpRight,
  BookOpen,
  ShieldCheck,
  BarChart3,
  HardDrive,
  Activity,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { DLogo } from "@/components/ui/logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, getApiBase, getAuthSessionToken, clearAuthSessionToken, UnauthorizedError } from "@/lib/api/client";
import { getStoredCompany, saveStoredCompany } from "@/lib/company";

interface SearchResult {
  entity: string;
  id: string;
  label: string;
  subLabel?: string;
  url: string;
}

interface SearchResponse {
  results: SearchResult[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

const searchItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  // Stores
  { label: "Material inward (GRN)", href: "/purchase/goods-receiving", icon: PackageCheck },
  { label: "Material issue", href: "/inventory/material-issue", icon: PackageMinus },
  { label: "Stock register", href: "/inventory/stock-ledger", icon: ClipboardList },
  // Sales
  { label: "Sales invoices", href: "/sales/invoices", icon: FileText },
  { label: "Customer receipts", href: "/sales/receipts", icon: Receipt },
  { label: "Customers", href: "/customers", icon: Users },
  // Payroll
  { label: "Monthly salaries", href: "/hr/payroll", icon: CreditCard },
  { label: "Daily wages", href: "/hr/wages", icon: Banknote },
  // Accounts
  { label: "Sundry expenses", href: "/finance/expenses", icon: DollarSign },
  { label: "Outgoing payments", href: "/finance/payments", icon: ArrowUpRight },
  { label: "Ledgers", href: "/finance/ledgers", icon: BookOpen },
  // More / Operations
  { label: "Vendor quotations", href: "/purchase/quotations", icon: ShoppingCart },
  { label: "Purchase orders", href: "/purchase/orders", icon: ShoppingCart },
  { label: "Bill of materials (BOM)", href: "/production/bom", icon: Factory },
  { label: "Production orders", href: "/production/orders", icon: Factory },
  { label: "Quality control", href: "/production/quality", icon: ShieldCheck },
  { label: "Warehouse setup", href: "/warehouse/list", icon: Warehouse },
  // Master Data
  { label: "Company", href: "/master-data/company", icon: Building },
  { label: "Branches", href: "/master-data/branches", icon: Building },
  { label: "Departments", href: "/master-data/departments", icon: Building },
  { label: "Designations", href: "/master-data/designations", icon: Building },
  { label: "Employees", href: "/master-data/employees", icon: Users },
  // Administration
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Activity log", href: "/activity", icon: Activity },
  { label: "Backups", href: "/backups", icon: HardDrive },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Help center", href: "/help", icon: HelpCircle },
];

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [companyName, setCompanyName] = useState<string>("Industrial ERP");
  const mountedRef = useRef(true);

  useEffect(() => {
    setCompanyName(getStoredCompany().name || "Industrial ERP");
    const onCompanyUpdate = (e: any) => {
      if (e?.detail?.name) {
        setCompanyName(e.detail.name);
      }
    };
    window.addEventListener("company-profile-updated", onCompanyUpdate);

    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);

    const fetchUser = async () => {
      const token = getAuthSessionToken();
      if (token) {
        const storedEmail =
          typeof window !== "undefined"
            ? localStorage.getItem("user-email") || "admin@industrialerp.local"
            : "admin@industrialerp.local";
        const storedName =
          typeof window !== "undefined"
            ? localStorage.getItem("user-fullName") || ""
            : "";
        setUser({
          email: storedEmail,
          name: storedName || storedEmail.split("@")[0].toUpperCase(),
        });

        try {
          const profile = await api.get<any>("/auth/me");
          if (profile && mountedRef.current) {
            const displayName =
              profile.fullName ||
              (profile.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : "") ||
              (profile.email ? profile.email.split("@")[0].toUpperCase() : "");
            if (displayName) {
              setUser({
                email: profile.email || storedEmail,
                name: displayName,
              });
              if (typeof window !== "undefined") {
                localStorage.setItem("user-fullName", displayName);
              }
            }
            if (profile.company) {
              saveStoredCompany(profile.company);
              setCompanyName(profile.company.name || "Industrial ERP");
            }
          }
        } catch {}
        return;
      }
    };
    fetchUser();

    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("company-profile-updated", onCompanyUpdate);
      mountedRef.current = false;
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    const token = getAuthSessionToken();
    if (!token) {
      setNotificationLoading(false);
      return;
    }

    setNotificationLoading(true);
    setNotificationError(null);

    let list: Notification[] = [];
    let count = 0;
    let hasError = false;

    try {
      const data = await api.get<any>("/notifications?limit=10");
      list = Array.isArray(data) ? data : (data?.data || []);
    } catch (e: any) {
      if (e instanceof UnauthorizedError) {
        if (mountedRef.current) setNotificationLoading(false);
        return;
      }
      console.error("Failed to fetch notification list:", e);
      hasError = true;
    }

    try {
      const data = await api.get<{ count: number }>("/notifications/unread-count");
      count = typeof data?.count === "number" ? data.count : (data as any)?.data?.count ?? 0;
    } catch (e: any) {
      if (e instanceof UnauthorizedError) {
        if (mountedRef.current) setNotificationLoading(false);
        return;
      }
      console.error("Failed to fetch unread count:", e);
      hasError = true;
    }

    if (mountedRef.current) {
      setNotifications(list);
      setUnreadCount(count);
      if (hasError) setNotificationError("Failed to load notifications");
    }
    setNotificationLoading(false);
  }, []);

  useEffect(() => {
    loadNotifications();
    const handleUpdate = () => loadNotifications();
    window.addEventListener("notifications-updated", handleUpdate);
    const interval = setInterval(() => loadNotifications(), 60000);
    return () => {
      window.removeEventListener("notifications-updated", handleUpdate);
      clearInterval(interval);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (notificationOpen) loadNotifications();
  }, [notificationOpen, loadNotifications]);

  const handleMarkAsRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error("Failed to mark as read:", e);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await api.patch("/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Failed to mark all as read:", e);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const token = getAuthSessionToken();
      const apiBase = getApiBase();
      await fetch(`${apiBase}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => undefined);

      clearAuthSessionToken();
      document.cookie = "dev-mode=; path=/; max-age=0";
      localStorage.removeItem("dev-mode");
      localStorage.removeItem("user-fullName");
      localStorage.removeItem("user-name");
      localStorage.removeItem("user-phone");
      localStorage.removeItem("sb-auth-token");
      sessionStorage.removeItem("sb-auth-token");
    } catch (e) {
      console.error("Logout error:", e);
    }
    router.push("/login");
  }, [router]);

  const performSearch = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const response = await api.get<SearchResponse>(
        `/search?q=${encodeURIComponent(query.trim())}`
      );
      setSearchResults(response.results || []);
    } catch (e) {
      console.error("Search error:", e);
      setSearchError("Search failed");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => performSearch(searchQuery), 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, performSearch]);

  const filtered = searchItems.filter((i) =>
    i.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const combinedResults = [
    ...filtered.map((item) => ({
      entity: "Navigation",
      id: item.href,
      label: item.label,
      subLabel: undefined,
      url: item.href,
      icon: item.icon,
    })),
    ...searchResults,
  ];

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 md:px-6">
      <button
        type="button"
        className="-ml-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" strokeWidth={1.5} />
      </button>

      {/* Visible Branding: Always display 'Industrial ERP' (with DLogo) */}
      <Link
        href="/dashboard"
        className="group mr-2 flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Industrial ERP Dashboard"
      >
        <DLogo size={24} className="shrink-0" />
        <span className="hidden text-sm font-medium text-foreground transition-colors group-hover:text-primary sm:inline-block">
          Industrial ERP
        </span>
      </Link>

      <div className="flex flex-1 items-center gap-4">
        <Button
          variant="outline"
          className="relative h-9 w-full max-w-sm justify-between rounded-lg border-border bg-muted/40 px-3 text-xs font-normal text-muted-foreground shadow-none hover:bg-muted/70 md:max-w-md"
          onClick={() => setSearchOpen(true)}
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span>Search</span>
          </span>
          <kbd className="hidden items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground sm:inline-flex">
            Ctrl K
          </kbd>
        </Button>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">Search</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-none text-sm shadow-none focus-visible:ring-0"
              autoFocus
            />
            <kbd className="hidden items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground sm:inline-flex">
              <Command className="h-3 w-3" strokeWidth={1.5} />K
            </kbd>
          </div>
          <ScrollArea className="max-h-72">
            <div className="space-y-1 pt-2">
              {searchLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={1.5} />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Searching
                  </span>
                </div>
              )}
              {!searchLoading && searchError && (
                <p className="py-4 text-center text-sm text-destructive">
                  {searchError}
                </p>
              )}
              {!searchLoading &&
                !searchError &&
                combinedResults.length === 0 &&
                searchQuery.trim().length >= 2 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No results found
                  </p>
                )}
              {!searchLoading &&
                !searchError &&
                combinedResults.length === 0 &&
                searchQuery.trim().length < 2 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search
                  </p>
                )}
              {!searchLoading &&
                combinedResults.length > 0 &&
                combinedResults.map((result, index) => (
                  <Button
                    key={`${result.entity}-${result.id}-${index}`}
                    variant="ghost"
                    className="h-auto w-full justify-start gap-3 py-2 text-sm"
                    onClick={() => {
                      setSearchOpen(false);
                      router.push(result.url);
                    }}
                  >
                    <Database className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <div className="flex-1 text-left">
                      <p className="font-medium text-foreground">{result.label}</p>
                      {result.subLabel && (
                        <p className="text-xs text-muted-foreground">
                          {result.subLabel}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {result.entity}
                      </p>
                    </div>
                  </Button>
                ))}
              {!searchQuery &&
                filtered.map((item) => (
                  <Button
                    key={item.href}
                    variant="ghost"
                    className="h-9 w-full justify-start gap-3 text-sm font-normal"
                    onClick={() => {
                      setSearchOpen(false);
                      router.push(item.href);
                    }}
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    {item.label}
                  </Button>
                ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2">
        {companyName && (
          <div
            className="mr-1 hidden items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground md:flex"
            title="Active company"
          >
            <Building className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <span className="max-w-[160px] truncate font-medium text-foreground lg:max-w-[220px]">
              {companyName}
            </span>
          </div>
        )}
        <ThemeToggle />

        {/* Notification dropdown */}
        <DropdownMenu open={notificationOpen} onOpenChange={setNotificationOpen}>
          <DropdownMenuTrigger
            className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-medium tabular-nums text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0 shadow-none">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-medium text-foreground">Notifications</span>
              <div className="flex gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={handleMarkAllRead}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    setNotificationOpen(false);
                    router.push("/notifications");
                  }}
                >
                  View all
                </button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notificationLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
                </div>
              ) : notificationError ? (
                <div className="px-4 py-8 text-center">
                  <BellOff className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" strokeWidth={1.5} />
                  <p className="text-sm text-muted-foreground">
                    {notificationError}
                  </p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <BellOff className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" strokeWidth={1.5} />
                  <p className="text-sm text-muted-foreground">
                    {unreadCount > 0 ? "Loading" : "No notifications"}
                  </p>
                </div>
              ) : (
                <>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-0 transition-colors hover:bg-muted/40 ${
                        !n.isRead ? "bg-muted/30" : ""
                      }`}
                      onClick={() => {
                        setNotificationOpen(false);
                        if (!n.isRead) handleMarkAsRead(n.id);
                        if (n.link) router.push(n.link);
                      }}
                    >
                      <div
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          !n.isRead ? "bg-primary" : "bg-transparent"
                        }`}
                      />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.message}</p>
                        <p className="font-mono text-xs tabular-nums text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarFallback className="rounded-lg border border-border bg-muted text-xs font-medium uppercase text-foreground">
                {user?.name?.substring(0, 2) || "AD"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden flex-col items-start text-sm md:flex">
              <span className="font-medium leading-tight text-foreground">
                {user?.name || "Admin User"}
              </span>
              <span className="text-xs leading-tight text-muted-foreground">
                {user?.email || "admin@industrialerp.com"}
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 shadow-none">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{user?.name || "Admin User"}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user?.email || "admin@industrialerp.com"}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings?tab=profile")}>
              <User className="mr-2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" strokeWidth={1.5} />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
