"use client";

import React, { useState, createContext, useContext, useCallback } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Topbar } from "@/components/layouts/topbar";
import { Breadcrumb } from "@/components/layouts/breadcrumb";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { PoweredByFooter } from "@/components/shared/powered-by-footer";

const Sidebar = dynamic(() => import("@/components/layouts/sidebar").then((m) => m.Sidebar), {
  ssr: false,
});

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

const AppShellContext = createContext(false);

export function AppShell({ children, title }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isNested = useContext(AppShellContext);

  const toggleCollapsed = useCallback(() => setCollapsed((p) => !p), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  if (isNested) {
    return (
      <>
        {title && <h1 className="text-2xl font-bold mb-6 capitalize">{title}</h1>}
        <ErrorBoundary>{children}</ErrorBoundary>
      </>
    );
  }

  return (
    <AppShellContext.Provider value={true}>
      <div className="min-h-screen bg-background">
        <Sidebar
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          mobileOpen={mobileOpen}
          onMobileClose={closeMobile}
        />
        <div
          className={cn(
            "flex min-h-screen flex-col transition-all duration-300 ease-in-out",
            collapsed ? "md:ml-16" : "md:ml-64",
          )}
        >
          <Topbar onMenuClick={openMobile} />
          <main className="flex-1 p-4 md:p-6">
            <Breadcrumb />
            {title && (
              <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 capitalize">{title}</h1>
            )}
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
          <PoweredByFooter showProductLabel />
        </div>
      </div>
    </AppShellContext.Provider>
  );
}