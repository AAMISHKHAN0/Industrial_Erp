"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Shield, ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { APP_PAGES, defaultPagesForRole } from "@/lib/access";
import { api, getAuthSessionToken } from "@/lib/api/client";

interface ManagedUser {
  id: string;
  email: string;
  role: Role | null;
  fullName: string;
  pages: string[];
  confirmed: boolean;
  createdAt: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [bootstrap, setBootstrap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [pages, setPages] = useState<string[]>(defaultPagesForRole("staff"));

  const getAuthHeaders = useCallback(() => {
    const token = getAuthSessionToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let resolvedRole: Role | null = null;
      try {
        const me = await api.get<any>("/auth/me");
        if (me && me.role) {
          const r = String(me.role).toLowerCase();
          if (r === "owner") resolvedRole = "owner";
          else if (r === "admin") resolvedRole = "admin";
          else if (r === "manager") resolvedRole = "manager";
          else resolvedRole = "staff";
        }
      } catch (err: any) {
        if (
          err?.name === "UnauthorizedError" ||
          err?.message?.includes("Session invalid") ||
          err?.message?.includes("Unauthorized")
        ) {
          toast.error("Session expired. Please sign in again.");
          if (typeof window !== "undefined") {
            window.location.href = `/login?error=session_expired&redirect=${encodeURIComponent(
              window.location.pathname
            )}`;
            return;
          }
        }
      }
      setCurrentRole(resolvedRole);

      try {
        const usersData = await api.get<any>("/auth/users");
        const list = Array.isArray(usersData)
          ? usersData
          : (usersData?.users || usersData?.data || []);
        setUsers(list);
        setBootstrap(list.length === 0 || Boolean(usersData?.bootstrap));
      } catch (apiErr) {
        // Fallback to Next.js route
        const res = await fetch("/api/admin/users", {
          cache: "no-store",
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          const list = json.users ?? [];
          setUsers(list);
          setBootstrap(list.length === 0 || Boolean(json.bootstrap));
        } else {
          setUsers([]);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = currentRole === "admin" || currentRole === "owner";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      try {
        await api.post("/auth/users", {
          email,
          password,
          fullName,
          role,
          pages,
        });
      } catch (apiErr) {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ email, password, fullName, role, pages }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to create user");
      }

      toast.success(`User ${email} created`);
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("staff");
      setPages(defaultPagesForRole("staff"));
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (id: string, newRole: Role) => {
    try {
      try {
        await api.patch(`/auth/users/${id}`, { role: newRole });
      } catch (apiErr) {
        const res = await fetch(`/api/admin/users/${id}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ role: newRole }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to update role");
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
      );
      toast.success("Role updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update role");
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      try {
        await api.delete(`/auth/users/${id}`);
      } catch (apiErr) {
        const res = await fetch(`/api/admin/users/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to delete user");
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete user");
    }
  };

  if (!isAdmin && !loading && !bootstrap) {
    return (
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4 text-destructive" strokeWidth={1.5} />
            <span>Access denied</span>
          </CardTitle>
          <CardDescription>
            Only administrators can manage users. Contact your system administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {bootstrap && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
          <p className="flex items-center gap-2 font-medium">
            <Shield className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <span>Bootstrap mode</span>
          </p>
          <p className="mt-1 text-muted-foreground">
            No administrator exists yet. The first user you create will be assigned the
            <span className="font-medium text-foreground"> Administrator</span> role automatically.
          </p>
        </div>
      )}

      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="font-medium">Users</CardTitle>
            <CardDescription>Add team members and manage their access roles</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Refresh">
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4 text-muted-foreground"} strokeWidth={1.5} />
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" strokeWidth={1.5} />
                    <span>Add user</span>
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-medium">Add user</DialogTitle>
                  <DialogDescription>
                    The user will receive a confirmation email. They must confirm before they can sign in.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-xs font-medium">Full name</Label>
                    <Input
                      id="fullName"
                      placeholder="Enter full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-10 rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-10 rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-10 rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Role</Label>
                    <Select
                      value={role}
                      onValueChange={(v: string | null) => {
                        if (v !== null) {
                          const r = v as Role;
                          setRole(r);
                          setPages(defaultPagesForRole(r));
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 w-full rounded-lg">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Page access</Label>
                    <p className="text-xs text-muted-foreground">
                      Select the pages this user can access. Pages are pre-selected based on role.
                    </p>
                    <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-border p-3">
                      {APP_PAGES.map((p) => {
                        const checked = pages.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              setPages((prev) =>
                                checked
                                  ? prev.filter((id) => id !== p.id)
                                  : [...prev, p.id]
                              )
                            }
                            className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                              checked
                                ? "border-primary bg-primary/10 font-medium text-foreground"
                                : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                              }`}
                            >
                              {checked && (
                                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <DialogFooter showCloseButton>
                    <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} />
                          <span>Creating</span>
                        </>
                      ) : (
                        "Create user"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} />
              <span>Loading users</span>
            </div>
          ) : users.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No users found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Page access</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{u.fullName || u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <select
                          value={u.role ?? "staff"}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                          className="flex h-9 w-40 select-none items-center justify-between gap-1.5 whitespace-nowrap rounded-lg border border-input bg-transparent py-1.5 pl-2.5 pr-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant="outline">{u.role ? ROLE_LABELS[u.role] : "No role"}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.pages.length === APP_PAGES.length ? (
                        <Badge variant="outline" className="font-normal">All pages</Badge>
                      ) : (
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {u.pages.length} page{u.pages.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.confirmed ? (
                        <Badge variant="outline" className="gap-1.5 font-normal">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          <span>Confirmed</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                          <span>Pending</span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(u.id, u.email)}
                          aria-label="Delete user"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
