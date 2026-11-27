export const ROLES = ["owner", "admin", "manager", "staff"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Administrator",
  manager: "Manager",
  staff: "Staff",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function getUserRole(
  appMetadata?: Record<string, unknown> | null
): Role | null {
  if (!appMetadata) return null;
  const role = appMetadata.role;
  return isRole(role) ? role : null;
}
