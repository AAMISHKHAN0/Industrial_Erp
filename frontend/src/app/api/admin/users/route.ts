import { NextResponse } from "next/server";
import { getAdminContext, getServerSessionToken, resolveServerApiBase } from "@/lib/auth";
import { isRole, type Role } from "@/lib/roles";
import { APP_PAGES, defaultPagesForRole } from "@/lib/access";

export async function GET() {
  const { user, isAdmin, bootstrap } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin && !bootstrap) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = await getServerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = await resolveServerApiBase();
    const res = await fetch(`${baseUrl}/auth/users`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: json.message || "Failed to load users" },
        { status: res.status }
      );
    }
    const users = json.data || json;
    return NextResponse.json({ users, bootstrap });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backend API unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const { user, isAdmin, bootstrap } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin && !bootstrap) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const fullName = String(body.fullName ?? "").trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const role: Role = bootstrap ? "admin" : isRole(body.role) ? body.role : "staff";
  const validPageIds = new Set(APP_PAGES.map((p) => p.id));
  const requestedPages = Array.isArray(body.pages)
    ? (body.pages as unknown[]).filter(
        (p): p is string => typeof p === "string" && validPageIds.has(p)
      )
    : [];
  const pages = requestedPages.length > 0 ? requestedPages : defaultPagesForRole(role);

  const token = await getServerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = await resolveServerApiBase();
    const res = await fetch(`${baseUrl}/auth/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, password, fullName, role, pages }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: json.message || "Failed to create user" },
        { status: res.status }
      );
    }
    return NextResponse.json({
      user: json.data?.user || json.data || json,
      emailSent: false,
      bootstrap: Boolean(bootstrap),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backend API unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
