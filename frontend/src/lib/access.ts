import type { Role } from "@/lib/roles";

export interface AppPage {
  id: string;
  label: string;
  href: string;
  /** Roles that get access by default when no explicit pages are assigned. */
  roles: Role[];
}

export const APP_PAGES: AppPage[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", roles: ["owner", "admin", "manager", "staff"] },
  { id: "purchase", label: "Purchase", href: "/purchase", roles: ["owner", "admin", "manager", "staff"] },
  { id: "inventory", label: "Inventory", href: "/inventory", roles: ["owner", "admin", "manager", "staff"] },
  { id: "production", label: "Production", href: "/production", roles: ["owner", "admin", "manager"] },
  { id: "sales", label: "Sales", href: "/sales", roles: ["owner", "admin", "manager", "staff"] },
  { id: "hr", label: "HR", href: "/hr", roles: ["owner", "admin", "manager"] },
  { id: "finance", label: "Finance", href: "/finance", roles: ["owner", "admin", "manager"] },
  { id: "master-data", label: "Master Data", href: "/master-data", roles: ["owner", "admin", "manager"] },
  { id: "warehouse", label: "Warehouse", href: "/warehouse", roles: ["owner", "admin", "manager"] },
  { id: "reports", label: "Reports", href: "/reports", roles: ["owner", "admin", "manager", "staff"] },
  { id: "role-management", label: "Role Management", href: "/role-management", roles: ["owner", "admin"] },
  { id: "settings", label: "Settings", href: "/settings", roles: ["owner", "admin", "manager"] },
  { id: "help", label: "Help Center", href: "/help", roles: ["owner", "admin", "manager", "staff"] },
];

/** Page ids a role is allowed to access by default. */
export function defaultPagesForRole(role: Role | null): string[] {
  if (!role) return [];
  return APP_PAGES.filter((p) => p.roles.includes(role)).map((p) => p.id);
}

/**
 * Resolve the list of page ids a user is allowed to access.
 * Explicitly assigned pages (in app_metadata.pages) take precedence;
 * otherwise we fall back to the role's default pages.
 * Users without a known role are granted full access (fail-open) so the
 * app never locks them out of navigation.
 */
export function getAllowedPageIds(
  appMetadata?: Record<string, unknown> | null,
  role?: Role | null
): string[] {
  const explicit = appMetadata?.pages;
  if (Array.isArray(explicit)) {
    const valid = (explicit as unknown[]).filter(
      (p): p is string => typeof p === "string" && APP_PAGES.some((ap) => ap.id === p)
    );
    if (valid.length > 0) return valid;
  }
  if (!role) return APP_PAGES.map((p) => p.id);
  return defaultPagesForRole(role);
}
