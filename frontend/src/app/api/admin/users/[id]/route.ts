import { NextResponse } from "next/server";
import { getAdminContext, getServerSessionToken, resolveServerApiBase } from "@/lib/auth";
import { isRole, type Role } from "@/lib/roles";
import { APP_PAGES, defaultPagesForRole } from "@/lib/access";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, isAdmin, bootstrap } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin && !bootstrap) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (!isRole(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const role: Role = body.role;

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
    const res = await fetch(`${baseUrl}/auth/users/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role, pages }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: json.message || "Failed to update user" },
        { status: res.status }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backend API unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, isAdmin } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const token = await getServerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = await resolveServerApiBase();
    const res = await fetch(`${baseUrl}/auth/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: json.message || "Failed to delete user" },
        { status: res.status }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backend API unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
