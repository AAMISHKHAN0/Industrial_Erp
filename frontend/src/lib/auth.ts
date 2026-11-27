import { cookies, headers } from "next/headers";

export interface AdminContext {
  user: { id: string; email: string | null } | null;
  isAdmin: boolean;
  /** True when no admin user exists yet — allows bootstrapping the first admin. */
  bootstrap: boolean;
}

/**
 * Resolves the active backend API base URL on the server (Route Handlers / Server Components).
 */
export async function resolveServerApiBase(): Promise<string> {
  const envUrl = process.env.API_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");

  try {
    const headerList = await headers();
    const host = headerList.get("host") || "";
    const match = host.match(/:(\d+)$/);
    if (match) {
      const port = parseInt(match[1], 10);
      if (port >= 3000 && port !== 3000) {
        return `http://127.0.0.1:${4000 + (port - 3000)}/api/v1`;
      }
    }
  } catch {}

  return (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/api/v1").replace(/\/+$/, "");
}

export async function getServerSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  let sessionToken = cookieStore.get("session_token")?.value ?? null;
  if (!sessionToken) {
    try {
      const headerList = await headers();
      const authHeader = headerList.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.substring(7).trim();
      }
    } catch {}
  }
  return sessionToken;
}

export async function getAdminContext(): Promise<AdminContext> {
  const sessionToken = await getServerSessionToken();

  if (!sessionToken) {
    return { user: null, isAdmin: false, bootstrap: false };
  }

  try {
    const baseUrl = await resolveServerApiBase();
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      const userData = json.data || json;
      if (userData && userData.id) {
        const r = String(userData.role || "").toLowerCase();
        const isAdmin =
          r === "admin" ||
          r === "owner" ||
          (Array.isArray(userData.roles) &&
            userData.roles.some((s: string) =>
              ["admin", "owner"].includes(String(s).toLowerCase())
            ));
        return {
          user: { id: userData.id, email: userData.email ?? null },
          isAdmin,
          bootstrap: false,
        };
      }
    }
  } catch {}

  return { user: null, isAdmin: false, bootstrap: false };
}
