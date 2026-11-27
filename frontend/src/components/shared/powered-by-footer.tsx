"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PoweredByFooterProps {
  className?: string;
  compact?: boolean;
  showProductLabel?: boolean;
}

export function PoweredByFooter({
  className,
  compact = false,
  showProductLabel = false,
}: PoweredByFooterProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground",
          className,
        )}
      >
        <span>Powered by</span>
        <span className="font-medium text-foreground/85">Digitalerena</span>
        <span aria-hidden="true">·</span>
        <a
          href="https://digitalerena.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary/90 underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          digitalerena.com
        </a>
      </div>
    );
  }

  return (
    <footer
      className={cn(
        "mt-auto border-t border-border/60 bg-background/60 px-4 py-3 md:px-6",
        className,
      )}
    >
      <div className="flex flex-col items-center justify-between gap-1.5 text-xs text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          {showProductLabel ? (
            <span>Industrial ERP · Operations &amp; Accounting Suite</span>
          ) : (
            <span>Industrial ERP</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span>Powered by</span>
          <span className="font-medium text-foreground/85">Digitalerena</span>
          <span aria-hidden="true">·</span>
          <a
            href="https://digitalerena.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary/90 underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            digitalerena.com
          </a>
        </div>
      </div>
    </footer>
  );
}
