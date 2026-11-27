"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiBase, getAuthSessionToken, clearAuthSessionToken } from "@/lib/api/client";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function checkStateAndRoute() {
      // 1. Check system bootstrap initialization status FIRST
      try {
        const baseUrl = getApiBase();
        const res = await fetch(`${baseUrl}/auth/bootstrap/status`, {
          headers: { "Cache-Control": "no-cache" },
        });

        if (!active) return;

        if (res.ok) {
          const json = await res.json();
          const status = json.data || json;
          // Uninitialized workspace: clear any stale/orphaned session token and route directly to /setup
          if (status.initialized === false || status.canBootstrap === true) {
            clearAuthSessionToken();
            router.replace("/setup");
            return;
          }
        }
      } catch {
        // Backend offline or starting up; proceed to check session
      }

      if (!active) return;

      // 2. If system is initialized, verify session via token or HttpOnly cookie
      const baseUrl = getApiBase();
      const token = getAuthSessionToken();
      try {
        const headers: Record<string, string> = { "Cache-Control": "no-cache" };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const meRes = await fetch(`${baseUrl}/auth/me`, {
          headers,
          credentials: "include",
        });
        if (!active) return;
        if (meRes.ok) {
          router.replace("/dashboard");
          return;
        }
        if (meRes.status === 401 && token) {
          clearAuthSessionToken();
        }
      } catch {
        if (token) {
          router.replace("/dashboard");
          return;
        }
      }

      // 3. Otherwise route to login
      if (active) {
        router.replace("/login");
      }
    }

    checkStateAndRoute();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
      <Loader2 className="h-6 w-6 animate-spin text-[#2563eb]" />
    </div>
  );
}
