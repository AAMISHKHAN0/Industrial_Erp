"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  Warehouse,
  TrendingUp,
  Users,
  Landmark,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Package,
  PackageCheck,
  PackageMinus,
  ClipboardList,
  FileText,
  Receipt,
  CreditCard,
  Banknote,
  DollarSign,
  ArrowUpRight,
  BookOpen,
  ShoppingCart,
  Factory,
  ShieldCheck,
  Building,
  Activity,
  HardDrive,
  Settings,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DLogo } from "@/components/ui/logo";
import { APP_PAGES, defaultPagesForRole } from "@/lib/access";
import { api, getAuthSessionToken } from "@/lib/api/client";
import { getStoredCompany } from "@/lib/company";

export interface NavChildItem {
  title: string;
  href: string;
  icon?: LucideIcon;
  permission?: string;
}

export interface NavSubSection {
  label: string;
  items: NavChildItem[];
}

export interface NavGroupItem {
  id: string;
  title: string;
  href?: string;
  icon: LucideIcon;
  permission?: string | string[];
  children?: NavChildItem[];
  subsections?: NavSubSection[];
}

export const navGroups: NavGroupItem[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard",
  },
  {
    id: "purchasing",
    title: "Purchasing",
    icon: ShoppingCart,
    permission: "purchase",
    children: [
      {
        title: "Purchase orders",
        href: "/purchase/orders",
        icon: ShoppingCart,
        permission: "purchase",
      },
      {
        title: "Vendors",
        href: "/vendors",
        icon: Users,
        permission: "purchase",
      },
      {
        title: "Vendor quotations",
        href: "/purchase/quotations",
        icon: ShoppingCart,
        permission: "purchase",
      },
    ],
  },
  {
    id: "stores",
    title: "Stores",
    icon: Warehouse,
    permission: ["purchase", "inventory"],
    children: [
      {
        title: "Material inward (GRN)",
        href: "/purchase/goods-receiving",
        icon: PackageCheck,
        permission: "purchase",
      },
      {
        title: "Material issue",
        href: "/inventory/material-issue",
        icon: PackageMinus,
        permission: "inventory",
      },
      {
        title: "Stock register",
        href: "/inventory/stock-ledger",
        icon: ClipboardList,
        permission: "inventory",
      },
      {
        title: "Items catalog",
        href: "/inventory/items",
        icon: Package,
        permission: "inventory",
      },
    ],
  },
  {
    id: "production",
    title: "Production",
    icon: Factory,
    permission: "production",
    children: [
      {
        title: "Bill of materials (BOM)",
        href: "/production/bom",
        icon: Factory,
        permission: "production",
      },
      {
        title: "Production orders",
        href: "/production/orders",
        icon: Factory,
        permission: "production",
      },
      {
        title: "Quality control",
        href: "/production/quality",
        icon: ShieldCheck,
        permission: "production",
      },
    ],
  },
  {
    id: "sales",
    title: "Sales",
    icon: TrendingUp,
    permission: "sales",
    children: [
      {
        title: "Sales invoices",
        href: "/sales/invoices",
        icon: FileText,
        permission: "sales",
      },
      {
        title: "Customer receipts",
        href: "/sales/receipts",
        icon: Receipt,
        permission: "sales",
      },
      {
        title: "Customers",
        href: "/customers",
        icon: Users,
        permission: "sales",
      },
    ],
  },
  {
    id: "payroll",
    title: "Payroll",
    icon: Users,
    permission: "hr",
    children: [
      {
        title: "Monthly salaries",
        href: "/hr/payroll",
        icon: CreditCard,
        permission: "hr",
      },
      {
        title: "Daily wages",
        href: "/hr/wages",
        icon: Banknote,
        permission: "hr",
      },
    ],
  },
  {
    id: "accounts",
    title: "Accounts",
    icon: Landmark,
    permission: "finance",
    children: [
      {
        title: "Sundry expenses",
        href: "/finance/expenses",
        icon: DollarSign,
        permission: "finance",
      },
      {
        title: "Outgoing payments",
        href: "/finance/payments",
        icon: ArrowUpRight,
        permission: "finance",
      },
      {
        title: "Ledgers",
        href: "/finance/ledgers",
        icon: BookOpen,
        permission: "finance",
      },
    ],
  },
  {
    id: "more",
    title: "More",
    icon: SlidersHorizontal,
    permission: [
      "warehouse",
      "master-data",
      "settings",
      "reports",
      "role-management",
    ],
    subsections: [
      {
        label: "Warehouse & master data",
        items: [
          {
            title: "Warehouse setup",
            href: "/warehouse/list",
            icon: Warehouse,
            permission: "warehouse",
          },
          {
            title: "Company",
            href: "/master-data/company",
            icon: Building,
            permission: "master-data",
          },
          {
            title: "Branches",
            href: "/master-data/branches",
            icon: Building,
            permission: "master-data",
          },
          {
            title: "Departments",
            href: "/master-data/departments",
            icon: Building,
            permission: "master-data",
          },
          {
            title: "Designations",
            href: "/master-data/designations",
            icon: Building,
            permission: "master-data",
          },
          {
            title: "Employees",
            href: "/master-data/employees",
            icon: Users,
            permission: "master-data",
          },
        ],
      },
      {
        label: "System & administration",
        items: [
          {
            title: "Reports",
            href: "/reports",
            icon: BarChart3,
            permission: "reports",
          },
          {
            title: "Role management",
            href: "/role-management",
            icon: Users,
            permission: "role-management",
          },
          {
            title: "Activity log",
            href: "/activity",
            icon: Activity,
            permission: "settings",
          },
          {
            title: "Backups",
            href: "/backups",
            icon: HardDrive,
            permission: "settings",
          },
          {
            title: "Settings",
            href: "/settings",
            icon: Settings,
            permission: "settings",
          },
        ],
      },
    ],
  },
];

function checkPermission(
  perm: string | string[] | undefined,
  allowed: string[] | null
): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (!perm) return true;
  if (Array.isArray(perm)) {
    return perm.some((p) => allowed.includes(p));
  }
  return allowed.includes(perm);
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowedPages, setAllowedPages] = useState<string[] | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("Industrial ERP");

  useEffect(() => {
    setCompanyName(getStoredCompany().name || "Industrial ERP");
    const onCompanyUpdate = (e: any) => {
      if (e?.detail?.name) {
        setCompanyName(e.detail.name);
      }
    };
    window.addEventListener("company-profile-updated", onCompanyUpdate);
    return () => window.removeEventListener("company-profile-updated", onCompanyUpdate);
  }, []);

  useEffect(() => {
    const fetchAccess = async () => {
      if (typeof window !== "undefined" && localStorage.getItem("dev-mode") === "true") {
        setAllowedPages(APP_PAGES.map((p) => p.id));
        return;
      }
      try {
        const token = getAuthSessionToken();
        if (token) {
          try {
            const me = await api.get<any>("/auth/me");
            if (me) {
              const r = String(me.role || "").toLowerCase();
              if (r === "owner" || r === "admin") {
                setAllowedPages(APP_PAGES.map((p) => p.id));
                return;
              }
              if (r === "manager") {
                setAllowedPages(defaultPagesForRole("manager"));
                return;
              }
              if (Array.isArray(me.pages) && me.pages.length > 0) {
                setAllowedPages(me.pages);
                return;
              }
              setAllowedPages(defaultPagesForRole("staff"));
              return;
            }
          } catch {}
        }

        setAllowedPages(APP_PAGES.map((p) => p.id));
      } catch {
        setAllowedPages(APP_PAGES.map((p) => p.id));
      }
    };
    fetchAccess();
  }, []);

  const visibleGroups = useMemo(() => {
    return navGroups
      .map((group) => {
        if (group.subsections) {
          const filteredSubsections = group.subsections
            .map((section) => ({
              ...section,
              items: section.items.filter((item) =>
                checkPermission(item.permission, allowedPages)
              ),
            }))
            .filter((section) => section.items.length > 0);

          const allItems = filteredSubsections.flatMap((s) => s.items);
          return {
            ...group,
            visibleChildren: allItems,
            visibleSubsections: filteredSubsections,
          };
        }

        const items = (group.children || []).filter((child) =>
          checkPermission(child.permission, allowedPages)
        );
        return {
          ...group,
          visibleChildren: items,
          visibleSubsections: undefined,
        };
      })
      .filter((group) => {
        if (!checkPermission(group.permission, allowedPages)) return false;
        if (group.href) return true;
        return group.visibleChildren && group.visibleChildren.length > 0;
      });
  }, [allowedPages]);

  const isGroupActive = (group: (typeof visibleGroups)[number]) => {
    if (group.href && pathname === group.href) return true;
    if (group.visibleChildren?.some((c) => pathname.startsWith(c.href))) return true;
    return false;
  };

  useEffect(() => {
    const active = visibleGroups.find((g) => g.id !== "dashboard" && isGroupActive(g));
    if (active) {
      setOpenGroup(active.id);
    }
  }, [pathname, visibleGroups]);

  const toggleGroup = (groupId: string) => {
    setOpenGroup((prev) => (prev === groupId ? null : groupId));
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "md:z-30",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Branding header: displays active company name */}
        <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger className="flex w-full items-center justify-center">
                <Link
                  href="/dashboard"
                  className="flex w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-lg"
                  onClick={onMobileClose}
                  aria-label={companyName || "Industrial ERP"}
                >
                  <DLogo size={28} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-sm font-medium">{companyName || "Industrial ERP"}</p>
                <p className="text-xs text-muted-foreground">Industrial ERP</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/dashboard"
              className="flex w-full items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              onClick={onMobileClose}
            >
              <DLogo size={28} className="shrink-0" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-sidebar-foreground">
                  {companyName || "Industrial ERP"}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {companyName && companyName !== "Industrial ERP"
                    ? "Industrial ERP"
                    : "Digitalerena"}
                </span>
              </div>
            </Link>
          )}
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          <nav className="flex flex-col gap-1">
            {visibleGroups.map((group) => {
              const active = isGroupActive(group);
              const isOpen = openGroup === group.id;

              // Direct link items (e.g. Dashboard)
              if (group.href) {
                if (collapsed) {
                  return (
                    <Tooltip key={group.id}>
                      <TooltipTrigger
                        className={cn(
                          "flex h-9 w-full items-center justify-center rounded-lg transition-colors duration-150",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                      >
                        <Link
                          href={group.href}
                          onClick={onMobileClose}
                          className="flex h-full w-full items-center justify-center"
                        >
                          <group.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{group.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <Link
                    key={group.id}
                    href={group.href}
                    onClick={onMobileClose}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                        : "text-sidebar-foreground/80 font-normal hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <span className="flex w-5 shrink-0 items-center justify-center">
                      <group.icon
                        className={cn(
                          "h-4 w-4",
                          active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60"
                        )}
                        strokeWidth={1.5}
                      />
                    </span>
                    <span className="truncate">{group.title}</span>
                  </Link>
                );
              }

              // Collapsed mode for groups with children (2-click dropdown navigation)
              if (collapsed) {
                return (
                  <DropdownMenu key={group.id}>
                    <DropdownMenuTrigger
                      className={cn(
                        "flex h-9 w-full cursor-pointer items-center justify-center rounded-lg transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                      title={group.title}
                      aria-label={group.title}
                    >
                      <group.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="right"
                      align="start"
                      sideOffset={8}
                      className="w-56 border border-sidebar-border bg-sidebar p-2 text-sidebar-foreground shadow-none"
                    >
                      <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-sidebar-foreground/70">
                        {group.title}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="my-1 bg-sidebar-border" />
                      {group.visibleSubsections ? (
                        group.visibleSubsections.map((section, sIdx) => (
                          <div
                            key={section.label}
                            className={cn(sIdx > 0 && "mt-3 border-t border-sidebar-border pt-2")}
                          >
                            <div className="px-2 pb-1 text-xs font-medium text-sidebar-foreground/55">
                              {section.label}
                            </div>
                            {section.items.map((item) => (
                              <DropdownMenuItem
                                key={item.href}
                                className={cn(
                                  "flex h-8 cursor-pointer items-center rounded-md px-2 text-xs text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:bg-sidebar-accent focus:text-sidebar-foreground",
                                  pathname.startsWith(item.href) &&
                                    "bg-sidebar-accent text-sidebar-foreground font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                                )}
                                onClick={() => {
                                  router.push(item.href);
                                  onMobileClose?.();
                                }}
                              >
                                {item.title}
                              </DropdownMenuItem>
                            ))}
                          </div>
                        ))
                      ) : (
                        group.visibleChildren?.map((item) => (
                          <DropdownMenuItem
                            key={item.href}
                            className={cn(
                              "flex h-8 cursor-pointer items-center rounded-md px-2 text-xs text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:bg-sidebar-accent focus:text-sidebar-foreground",
                              pathname.startsWith(item.href) &&
                                "bg-sidebar-accent text-sidebar-foreground font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                            )}
                            onClick={() => {
                              router.push(item.href);
                              onMobileClose?.();
                            }}
                          >
                            {item.title}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              // Expanded mode for groups with children
              return (
                <div key={group.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={cn(
                      "flex h-9 w-full cursor-pointer items-center justify-between rounded-lg px-3 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      active
                        ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                        : "text-sidebar-foreground/80 font-normal hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex w-5 shrink-0 items-center justify-center">
                        <group.icon
                          className={cn(
                            "h-4 w-4",
                            active ? "text-sidebar-foreground" : "text-sidebar-foreground/60"
                          )}
                          strokeWidth={1.5}
                        />
                      </span>
                      <span className="truncate">{group.title}</span>
                    </div>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 text-sidebar-foreground/50 transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        isOpen && "rotate-90"
                      )}
                      strokeWidth={1.5}
                    />
                  </button>

                  {isOpen && (
                    <div className="ml-5 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                      {group.visibleSubsections ? (
                        group.visibleSubsections.map((section, sIdx) => (
                          <div key={section.label} className={cn(sIdx > 0 && "mt-4")}>
                            <div className="px-2 pb-1.5 text-xs font-medium text-sidebar-foreground/55">
                              {section.label}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              {section.items.map((item) => {
                                const isItemActive = pathname.startsWith(item.href);
                                return (
                                  <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={onMobileClose}
                                    className={cn(
                                      "flex h-8 items-center rounded-md px-2.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                                      isItemActive
                                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                                    )}
                                  >
                                    <span className="truncate">{item.title}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      ) : (
                        group.visibleChildren?.map((item) => {
                          const isItemActive = pathname.startsWith(item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={onMobileClose}
                              className={cn(
                                "flex h-8 items-center rounded-md px-2.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                                isItemActive
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                              )}
                            >
                              <span className="truncate">{item.title}</span>
                            </Link>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer with collapse toggle */}
        <div className="hidden border-t border-sidebar-border p-3 md:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-8 w-full justify-center text-xs font-normal text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <>
                <ChevronLeft className="mr-2 h-4 w-4" strokeWidth={1.5} />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}
