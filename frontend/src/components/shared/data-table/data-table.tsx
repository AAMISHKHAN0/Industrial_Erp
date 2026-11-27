"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState } from "react";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  meta?: { total: number; page: number; totalPages: number; limit: number };
  onPageChange?: (page: number) => void;
}

export function DataTable<TData>({
  columns,
  data,
  loading,
  searchable = true,
  searchPlaceholder = "Search",
  pageSize = 20,
  meta,
  onPageChange,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const pagination = meta
    ? { pageIndex: (meta.page || 1) - 1, pageSize: meta.limit || pageSize }
    : { pageIndex: 0, pageSize };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination: meta ? undefined : pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: meta ? undefined : getPaginationRowModel(),
    manualPagination: !!meta,
    pageCount: meta?.totalPages || -1,
  });

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="flex items-center gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 rounded-lg pl-9 text-sm"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, ci) => (
                    <TableCell key={ci}>
                      <div className="h-4 rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="text-muted-foreground">
                    <p className="text-sm font-medium text-foreground">No results found</p>
                    <p className="mt-1 text-xs">Try adjusting your search</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="order-2 font-mono text-xs tabular-nums text-muted-foreground sm:order-1">
          {meta ? (
            <>Page {meta.page} of {meta.totalPages} ({meta.total} total)</>
          ) : (
            <>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</>
          )}
        </p>
        <div className="order-1 flex items-center gap-1 sm:order-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => {
              if (onPageChange) onPageChange(1);
              else table.setPageIndex(0);
            }}
            disabled={meta ? (meta.page || 1) <= 1 : !table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => {
              if (onPageChange) onPageChange((meta?.page || 1) - 1);
              else table.previousPage();
            }}
            disabled={meta ? (meta.page || 1) <= 1 : !table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <span className="px-2 font-mono text-xs font-medium tabular-nums text-foreground">
            {meta?.page || table.getState().pagination.pageIndex + 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => {
              if (onPageChange) onPageChange((meta?.page || 1) + 1);
              else table.nextPage();
            }}
            disabled={meta ? (meta.page || 1) >= (meta.totalPages || 1) : !table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => {
              if (onPageChange) onPageChange(meta?.totalPages || 1);
              else table.setPageIndex(table.getPageCount() - 1);
            }}
            disabled={meta ? (meta.page || 1) >= (meta.totalPages || 1) : !table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </div>
  );
}
