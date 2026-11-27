"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { DLogo } from "@/components/ui/logo";
import { PoweredByFooter } from "@/components/shared/powered-by-footer";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAuthSessionToken, getApiBase } from "@/lib/api/client";
import { saveStoredCompany } from "@/lib/company";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [canBootstrap, setCanBootstrap] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const API_BASE = getApiBase();

  useEffect(() => {
    let active = true;
    let retries = 0;

    async function checkStatus() {
      try {
        const baseUrl = getApiBase();
        const res = await fetch(`${baseUrl}/auth/bootstrap/status`, {
          headers: { "Cache-Control": "no-cache" },
        });
        if (!active) return;
        if (res.ok) {
          const json = await res.json();
          const status = json.data || json;
          setCanBootstrap(status.canBootstrap ?? !status.initialized);
          setChecking(false);
          return;
        }
      } catch {
        if (!active) return;
        if (retries < 6) {
          retries++;
          setTimeout(checkStatus, 800);
          return;
        }
      }
      if (active) {
        setChecking(false);
      }
    }
    checkStatus();
    return () => {
      active = false;
    };
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    try {
      const baseUrl = getApiBase();
      const res = await fetch(`${baseUrl}/auth/bootstrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyName: companyName.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          taxNumber: taxNumber.trim() || undefined,
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          password,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Initial setup failed");
      }

      const data = json.data || json;
      if (data.sessionToken) {
        setAuthSessionToken(data.sessionToken);
      }
      if (data.user?.email) {
        localStorage.setItem("user-email", data.user.email);
        localStorage.setItem("remember-email", data.user.email);
      }

      // Persist active company profile immediately so it is available in settings, reports & receipts
      const companyPayload = data.company || {
        name: companyName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        taxNumber: taxNumber.trim(),
      };
      saveStoredCompany(companyPayload);

      toast.success("Administrator account and company profile initialized");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Setup failed. Please check connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
          <p className="text-xs text-muted-foreground">Verifying database initialization state</p>
        </div>
      </div>
    );
  }

  if (!canBootstrap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm gap-0 rounded-2xl border border-border bg-card p-6 text-center shadow-none ring-0">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted text-success">
              <ShieldCheck className="h-6 w-6" strokeWidth={1.5} />
            </div>
          </div>
          <h2 className="text-lg font-medium text-foreground">System initialized</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            The primary administrator and company entity have already been configured. One-time setup is closed for anti-takeover protection.
          </p>
          <div className="mt-6">
            <Link href="/login" className="block w-full">
              <Button className="h-10 w-full rounded-lg text-sm font-medium shadow-none">
                Return to sign in
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel: quiet industrial neutral */}
      <div className="relative hidden items-center justify-center border-r border-border bg-muted/30 p-12 lg:flex lg:w-1/2">
        <div className="max-w-md">
          <div className="mb-6">
            <DLogo size={40} />
          </div>
          <h2 className="text-2xl font-medium text-foreground">First-run configuration</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Provision the local PostgreSQL database, create the master tenant entity, and configure the primary administrator account.
          </p>

          <div className="mt-8 space-y-2 rounded-xl border border-border bg-card p-5 text-xs">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-success" strokeWidth={1.5} />
              <span>One-time initialization guard</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Passwords are salted and hashed on-device with Argon2id. Once submitted, this bootstrap wizard is deactivated at the database engine level.
            </p>
          </div>

          <p className="mt-8 font-mono text-xs text-muted-foreground">
            Industrial ERP · System setup wizard
          </p>
          <PoweredByFooter compact className="mt-2 justify-start" />
        </div>
      </div>

      {/* Setup Form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-left">
            <div className="mb-4 lg:hidden">
              <DLogo size={36} />
            </div>
            <h1 className="text-2xl font-medium text-foreground">Create owner account</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure initial credentials and enterprise profile
            </p>
          </div>

          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-xs font-medium text-foreground">
                Company name *
              </Label>
              <Input
                id="companyName"
                placeholder="Industrial Enterprises Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="h-10 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium text-foreground">
                  Phone / mobile
                </Label>
                <Input
                  id="phone"
                  placeholder="+92 300 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-10 rounded-lg text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="taxNumber" className="text-xs font-medium text-foreground">
                  NTN / STRN tax #
                </Label>
                <Input
                  id="taxNumber"
                  placeholder="1234567-8"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  className="h-10 rounded-lg font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-xs font-medium text-foreground">
                Company address
              </Label>
              <Input
                id="address"
                placeholder="Plot 123, Industrial Area, Karachi"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-10 rounded-lg text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adminName" className="text-xs font-medium text-foreground">
                Administrator name
              </Label>
              <Input
                id="adminName"
                placeholder="Chief Administrator"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
                className="h-10 rounded-lg text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adminEmail" className="text-xs font-medium text-foreground">
                Administrator email
              </Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="owner@industrialerp.local"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                className="h-10 rounded-lg text-sm"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-foreground">
                Master password (min 8 chars)
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 rounded-lg pr-10 text-sm"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">
                Confirm master password
              </Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-10 rounded-lg text-sm"
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="mt-2 h-10 w-full rounded-lg text-sm font-medium shadow-none" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} />
                  <span>Provisioning database</span>
                </>
              ) : (
                "Create owner account"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center font-mono text-xs text-muted-foreground">
            One-time bootstrap · Irreversible once completed
          </p>
          <PoweredByFooter compact className="mt-2" />
        </div>
      </div>
    </div>
  );
}
