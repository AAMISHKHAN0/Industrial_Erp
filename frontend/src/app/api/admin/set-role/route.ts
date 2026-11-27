import { NextResponse } from "next/server";
import { getAdminContext, getServerSessionToken, resolveServerApiBase } from "@/lib/auth";
import { isRole, type Role } from "@/lib/roles";

export async function POST(req: Request) {
  const { user, isAdmin } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const token = await getServerSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const requestedRole: Role = isRole(body.role) ? body.role : "admin";
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const baseUrl = await resolveServerApiBase();
    const usersRes = await fetch(`${baseUrl}/auth/users`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const usersJson = await usersRes.json().catch(() => ({}));
    if (!usersRes.ok) {
      return NextResponse.json(
        { error: usersJson.message || "Failed to query users" },
        { status: usersRes.status }
      );
    }

    const list: Array<{ id: string; email: string }> = usersJson.data || usersJson || [];
    const target = list.find((u) => (u.email || "").toLowerCase() === email);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const patchRes = await fetch(`${baseUrl}/auth/users/${target.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role: requestedRole }),
    });
    const patchJson = await patchRes.json().catch(() => ({}));
    if (!patchRes.ok) {
      return NextResponse.json(
        { error: patchJson.message || "Failed to update role" },
        { status: patchRes.status }
      );
    }

    return NextResponse.json({ success: true, email, role: requestedRole });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
