"use client";

import { CreatedByCell } from "@/components/shared/created-by-cell";

/** Reusable "Created By" column showing the creator's email + role. Typed loosely so it fits any table. */
export const createdByColumn = {
  id: "createdBy",
  header: "Created By",
  cell: ({ row }: any) => <CreatedByCell creator={row.original.createdByUser} />,
} as any;
