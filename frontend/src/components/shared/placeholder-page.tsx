"use client";

import { Package } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description?: string;
  module?: string;
}

export function PlaceholderPage({ title, description, module }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-in">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
        <Package className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <h2 className="mb-2 text-lg font-medium text-foreground">{title}</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {description || `${title} module is under development and will be available in an upcoming release.`}
      </p>
      {module && (
        <span className="mt-4 inline-flex items-center rounded-md border border-border bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
          {module}
        </span>
      )}
    </div>
  );
}
