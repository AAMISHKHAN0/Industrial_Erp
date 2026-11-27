"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Loader2, ShieldAlert, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DLogo } from "@/components/ui/logo";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAuthSessionToken, getApiBase, getAuthSessionToken, clearAuthSessionToken } from "@/lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingDb, setCheckingDb] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const API_BASE = getApiBase();

  // Pre-load remembered email if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("remember-email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRemember(true);
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "session_expired") {
        setErrorMessage("Your session has expired or is invalid. Please sign in again.");
        toast.error("Your session has expired or is invalid. Please sign in again.");
      }
    }
  }, []);

  // Check database connectivity and bootstrap status
  const checkBootstrap = async () => {
    setCheckingDb(true);
    setDbError(null);
    try {
      const baseUrl = getApiBase();
      const res = await fetch(`${baseUrl}/auth/bootstrap/status`, {
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const json = await res.json();
        const status = json.data || json;
        if (status.initialized === false || status.canBootstrap === true) {
          clearAuthSessionToken();
          if (typeof window !== "undefined") {
            localStorage.removeItem("remember-email");
            localStorage.removeItem("user-email");
          }
          setEmail("");
          setPassword("");
          setNeedsSetup(true);
          router.replace("/setup");
          return;
        } else {
          setNeedsSetup(false);
          const params =
            typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
          if (params?.get("error") !== "session_expired") {
            const existingToken = getAuthSessionToken();
            try {
              const meHeaders: Record<string, string> = { "Cache-Control": "no-cache" };
              if (existingToken) {
                meHeaders["Authorization"] = `Bearer ${existingToken}`;
              }
              const meRes = await fetch(`${baseUrl}/auth/me`, {
                headers: meHeaders,
                credentials: "include",
              });
              if (meRes.ok) {
                router.replace("/dashboard");
                return;
              }
            } catch {}
          }
        }
      } else {
        setDbError("Unable to query workspace status. Please ensure database engine is running.");
      }
    } catch {
      setDbError("Unable to connect to database service. Retrying");
    } finally {
      setCheckingDb(false);
    }
  };

  useEffect(() => {
    checkBootstrap();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const baseUrl = getApiBase();
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Invalid email or password");
      }

      const data = json.data || json;

      if (data.sessionToken) {
        setAuthSessionToken(data.sessionToken);
      }
      if (data.user?.email) {
        localStorage.setItem("user-email", data.user.email);
      }
      if (remember) {
        localStorage.setItem("remember-email", email.trim());
      } else {
        localStorage.removeItem("remember-email");
      }

      toast.success("Authenticated");
      const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const redirectTarget = urlParams?.get("redirect") || "/dashboard";
      router.push(redirectTarget);
    } catch (err: any) {
      const msg = err.message || "Sign in failed. Please verify credentials.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-6 text-foreground selection:bg-primary selection:text-primary-foreground">
      <main className="my-auto w-full max-w-[420px]">
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:shadow-none sm:p-8">
          {/* Logo & Brand Header */}
          <div className="space-y-3 text-center">
            <div className="flex justify-center">
              <DLogo size={40} />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-foreground">
                Industrial ERP
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in to your workspace
              </p>
            </div>
          </div>

          {/* Database Connecting / Verification Status */}
          {checkingDb && (
            <div
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 animate-spin text-primary" strokeWidth={1.5} />
              <span>Checking workspace database</span>
            </div>
          )}

          {/* Database connection error / retry */}
          {dbError && !checkingDb && (
            <div
              className="flex items-start justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground"
              role="alert"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.5} />
                <span className="leading-relaxed">{dbError}</span>
              </div>
              <button
                type="button"
                onClick={checkBootstrap}
                className="shrink-0 rounded text-xs font-medium text-foreground underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Retry
              </button>
            </div>
          )}

          {/* Uninitialized Workspace */}
          {needsSetup ? (
            <div className="space-y-4">
              <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-center">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-primary">
                  <ShieldAlert className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-foreground">Initial setup required</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    This workspace database is uninitialized. Create your primary owner administrator account to configure the system.
                  </p>
                </div>
              </div>

              <Link href="/setup" className="block w-full">
                <Button
                  type="button"
                  className="h-10 w-full cursor-pointer rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-none transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Create owner account
                </Button>
              </Link>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setNeedsSetup(false)}
                  className="rounded text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Already configured? Switch to sign in
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Workspace status row */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  <span className="font-medium text-foreground">Enterprise workspace</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">Offline standalone</span>
              </div>

              {/* Readable Error Alert */}
              {errorMessage && (
                <div
                  className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span className="flex-1 leading-relaxed">{errorMessage}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
                {/* Email Address */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium text-foreground">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@industrialerp.local"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    required
                    className="h-10 rounded-lg border-input bg-background text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                    autoComplete="off"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-medium text-foreground">
                      Password
                    </Label>
                    <Link
                      href="/forgot-password"
                      className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      required
                      className="h-10 rounded-lg border-input bg-background pr-10 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
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

                {/* Remember Toggle & Clear Credentials Action */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2.5">
                    <Switch
                      id="remember"
                      checked={remember}
                      onCheckedChange={setRemember}
                      className="focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Label
                      htmlFor="remember"
                      className="cursor-pointer select-none text-xs font-normal text-muted-foreground"
                    >
                      Remember email
                    </Label>
                  </div>

                  {(email || password) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("");
                        setPassword("");
                        setRemember(false);
                        if (typeof window !== "undefined") {
                          localStorage.removeItem("remember-email");
                          localStorage.removeItem("user-email");
                        }
                        toast.info("Cleared entered and remembered credentials");
                      }}
                      className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-destructive"
                    >
                      Clear credentials
                    </button>
                  )}
                </div>

                {/* Primary Royal Blue Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 h-10 w-full cursor-pointer rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-none transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                      <span>Signing in</span>
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* Footer note */}
          <div className="border-t border-border pt-4 text-center">
            <p className="font-mono text-xs text-muted-foreground">
              Industrial ERP · Offline standalone edition
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
