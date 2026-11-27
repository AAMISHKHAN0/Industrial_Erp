"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DLogo } from "@/components/ui/logo";
import { getApiBase } from "@/lib/api/client";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RecoveryAccount {
  email: string;
  role: string;
  companyName: string;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [accounts, setAccounts] = useState<RecoveryAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Fetch accounts configured on this local machine
  useEffect(() => {
    async function loadAccounts() {
      try {
        const baseUrl = getApiBase();
        const res = await fetch(`${baseUrl}/auth/recovery-accounts`, {
          headers: { "Cache-Control": "no-cache" },
        });
        if (res.ok) {
          const json = await res.json();
          const list: RecoveryAccount[] = json.data?.accounts || json.accounts || [];
          setAccounts(list);

          const savedEmail = localStorage.getItem("remember-email") || localStorage.getItem("user-email");
          if (savedEmail && list.some((a) => a.email.toLowerCase() === savedEmail.toLowerCase())) {
            setEmail(savedEmail);
          } else if (list.length > 0) {
            setEmail(list[0].email);
          }
        }
      } catch {
        // Fallback to local storage if API temporarily loading
        const saved = localStorage.getItem("remember-email");
        if (saved) setEmail(saved);
      } finally {
        setLoadingAccounts(false);
      }
    }
    loadAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Please enter your account email address");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);

    try {
      const baseUrl = getApiBase();
      const res = await fetch(`${baseUrl}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          newPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Failed to reset password");
      }

      // Update remembered email so login screen has the right account
      localStorage.setItem("remember-email", email.trim());
      setSuccess(true);
      toast.success("Password updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md gap-0 rounded-2xl border border-border bg-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-0 dark:shadow-none sm:p-8">
        <CardHeader className="px-0 pb-6 text-center">
          <div className="mb-3 flex justify-center">
            <DLogo size={40} />
          </div>

          {success ? (
            <>
              <div className="mb-2 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted text-success">
                  <CheckCircle2 className="h-6 w-6" strokeWidth={1.5} />
                </div>
              </div>
              <CardTitle className="text-xl font-medium text-foreground">
                Password reset complete
              </CardTitle>
              <CardDescription className="mt-1 text-xs text-muted-foreground">
                Your password for <span className="font-medium text-foreground">{email}</span> has been updated on this device.
              </CardDescription>
            </>
          ) : (
            <>
              <div className="mb-2 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Local recovery</span>
                </span>
              </div>
              <CardTitle className="mt-1 text-xl font-medium text-foreground">
                Reset account password
              </CardTitle>
              <CardDescription className="mt-1 text-xs text-muted-foreground">
                Update your administrator password directly on this device without email verification.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="px-0">
          {success ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-success/30 bg-success/10 p-3.5 text-xs leading-relaxed text-foreground">
                You can now sign in immediately with your updated password.
              </div>

              <Button
                type="button"
                className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-none hover:bg-primary/90"
                onClick={() => router.push("/login")}
              >
                Sign in with new password
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              {/* Account Selector if multiple found */}
              {!loadingAccounts && accounts.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Configured accounts on this device
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {accounts.map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => setEmail(acc.email)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-left text-xs transition-colors ${
                          email.toLowerCase() === acc.email.toLowerCase()
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <UserCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                        <span>{acc.email}</span>
                        <span className="font-mono text-xs opacity-75">({acc.role})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Input */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-foreground">
                  Account email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@industrialerp.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                  className="h-10 rounded-lg border-input bg-background text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-xs font-medium text-foreground">
                  New password (min 8 characters)
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="h-10 rounded-lg border-input bg-background pr-10 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
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

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">
                  Confirm new password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="h-10 rounded-lg border-input bg-background pr-10 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-none hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} />
                    <span>Updating password</span>
                  </>
                ) : (
                  "Update password"
                )}
              </Button>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Return to sign in</span>
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
