"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/shared/data-table/data-table";
import { CreatedByCell } from "@/components/shared/created-by-cell";
import { EntitySelect } from "@/components/shared/entity-select";
import type { QuickCreateEntityType } from "@/components/shared/quick-create-dialog";
import { generateNextCodeFromRows } from "@/lib/code-generator";
import { createCrudService, type QueryParams } from "@/lib/api/crud";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  key: string;
  label: string;
  type?: "text" | "email" | "textarea" | "number" | "select";
  required?: boolean;
  width?: number;
  placeholder?: string;
  isMoreDetail?: boolean;
  autoCodePrefix?: string;
  quickAddType?: QuickCreateEntityType;
  entityLabel?: string;
  onQuickCreated?: (created: any) => void;
  options?: FieldOption[];
  renderCell?: (value: any, row: Record<string, any>) => React.ReactNode;
}

export interface MasterDataPageProps {
  title: string;
  description?: string;
  path: string;
  fields: FieldConfig[];
  searchPlaceholder?: string;
  onAfterSave?: (saved: Record<string, any>, mode: "create" | "update") => void;
}

export function MasterDataPage({
  title,
  description,
  path,
  fields,
  searchPlaceholder,
  onAfterSave,
}: MasterDataPageProps) {
  interface Item { id: string; [key: string]: any; }
  const service = createCrudService<Item>(path);

  const [data, setData] = useState<Item[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryParams>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Item | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const initForm = useCallback(
    (rows: Item[] = data) => {
      const f: Record<string, string> = {};
      fields.forEach((fld) => {
        if (fld.autoCodePrefix) {
          f[fld.key] = generateNextCodeFromRows(
            fld.autoCodePrefix,
            rows,
            (row) => row?.[fld.key],
          );
        } else {
          f[fld.key] = "";
        }
      });
      return f;
    },
    [fields, data],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.findAll(query);
      setData(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      toast.error(e.message || `Failed to fetch ${title.toLowerCase()} records`);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchData(); }, [query]);

  const columns: ColumnDef<Item>[] = [
    ...fields.map((fld): ColumnDef<Item> => ({
      accessorKey: fld.key,
      header: fld.label,
      ...(fld.renderCell
        ? {
            cell: ({ row }) => fld.renderCell!(row.original[fld.key], row.original),
          }
        : {}),
    })),
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.original.status === "ACTIVE";
        return (
          <Badge variant="outline" className="gap-1.5 rounded-md font-mono text-xs font-normal">
            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-success" : "bg-muted-foreground/50"}`} />
            <span>{row.original.status}</span>
          </Badge>
        );
      },
    },
    {
      id: "createdBy",
      header: "Created by",
      cell: ({ row }) => <CreatedByCell creator={(row.original as any).createdByUser} />,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => {
              setEditing(row.original);
              const f: Record<string, string> = {};
              fields.forEach((fld) => {
                const val = row.original[fld.key];
                f[fld.key] = val !== undefined && val !== null ? String(val) : "";
              });
              setForm(f);
              setDialogOpen(true);
            }} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} /> Edit
            </DropdownMenuItem>

            {row.original.status && (
              <DropdownMenuItem
                onClick={async () => {
                  const newStatus = row.original.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                  try {
                    await service.update(row.original.id, { status: newStatus });
                    toast.success(`Status updated to ${newStatus}`);
                    fetchData();
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
                className="cursor-pointer"
              >
                {row.original.status === "ACTIVE" ? (
                  <>
                    <XCircle className="mr-2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} /> Deactivate
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} /> Activate
                  </>
                )}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-destructive" onClick={() => setDeleteDialog(row.original)}>
              <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      fields.forEach((fld) => {
        const raw = form[fld.key];
        if (raw === undefined || raw === null || raw === "") {
          payload[fld.key] = undefined;
        } else if (fld.type === "number" || fld.key === "rating" || fld.key === "creditLimit") {
          const num = Number(raw);
          payload[fld.key] = isNaN(num) ? undefined : num;
        } else {
          payload[fld.key] = typeof raw === "string" ? raw.trim() : raw;
        }
      });

      const cleanPayload: Record<string, any> = {};
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined) {
          cleanPayload[k] = v;
        }
      });

      if (editing) {
        const updated = await service.update(editing.id, cleanPayload);
        toast.success(`${title} updated`);
        onAfterSave?.(updated || { ...editing, ...cleanPayload }, "update");
      } else {
        const created = await service.create(cleanPayload);
        toast.success(`${title} created`);
        onAfterSave?.(created || cleanPayload, "create");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(initForm());
      fetchData();
    } catch (e: any) {
      toast.error(e.message || `Failed to save ${title.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await service.remove(deleteDialog.id);
      toast.success(`${title} deleted`);
      setDeleteDialog(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || `Failed to delete ${title.toLowerCase()}`);
    }
  };

  const renderFieldInput = (fld: FieldConfig) => {
    if (fld.type === "select") {
      if (fld.quickAddType) {
        return (
          <EntitySelect
            id={`field-${fld.key}`}
            value={form[fld.key] ?? ""}
            onValueChange={(v) => setForm({ ...form, [fld.key]: v })}
            options={fld.options || []}
            entityLabel={fld.entityLabel || fld.label}
            quickAddType={fld.quickAddType}
            onQuickCreated={fld.onQuickCreated}
            placeholder={fld.placeholder || `Select ${fld.label.toLowerCase()}`}
            allowNone={!fld.required}
          />
        );
      }
      return (
        <select
          id={`field-${fld.key}`}
          value={form[fld.key] ?? ""}
          onChange={(e) => setForm({ ...form, [fld.key]: e.target.value })}
          required={fld.required}
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{fld.placeholder || `Select ${fld.label.toLowerCase()}`}</option>
          {(fld.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (fld.type === "textarea") {
      return (
        <textarea
          id={`field-${fld.key}`}
          className="flex min-h-[72px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={form[fld.key] ?? ""}
          onChange={(e) => setForm({ ...form, [fld.key]: e.target.value })}
          placeholder={fld.placeholder || `Enter ${fld.label.toLowerCase()}`}
          required={fld.required}
        />
      );
    }

    return (
      <Input
        id={`field-${fld.key}`}
        type={fld.type || "text"}
        step={fld.type === "number" ? "any" : undefined}
        value={form[fld.key] ?? ""}
        onChange={(e) => setForm({ ...form, [fld.key]: e.target.value })}
        placeholder={fld.placeholder || `Enter ${fld.label.toLowerCase()}`}
        required={fld.required}
        className="h-9 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-ring"
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{description || `Manage ${title.toLowerCase()}`}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="h-8 gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span>Refresh</span>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditing(null);
              setForm(initForm());
            }
          }}>
            <DialogTrigger
              onClick={() => {
                setEditing(null);
                setForm(initForm(data));
                service.findAll({ limit: 500 }).then((full) => {
                  const rows = full.data || [];
                  setForm((prev) => {
                    const next = { ...prev };
                    fields.forEach((fld) => {
                      if (fld.autoCodePrefix) {
                        next[fld.key] = generateNextCodeFromRows(
                          fld.autoCodePrefix,
                          rows,
                          (row) => row?.[fld.key],
                        );
                      }
                    });
                    return next;
                  });
                }).catch(() => {});
              }}
              className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              <span>Add {title}</span>
            </DialogTrigger>
            <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-md">
              <DialogHeader className="shrink-0 border-b border-border px-6 pb-3 pt-5">
                <DialogTitle className="font-medium">{editing ? `Edit ${title}` : `Add ${title}`}</DialogTitle>
                <DialogDescription>Fill in the details below</DialogDescription>
              </DialogHeader>
              <div className="max-h-[calc(85vh-130px)] flex-1 space-y-4 overflow-y-auto px-6 py-4">
                {fields.filter((f) => !f.isMoreDetail).map((fld) => (
                  <div key={fld.key} className="space-y-1.5">
                    <Label htmlFor={`field-${fld.key}`} className="text-xs font-medium text-foreground">
                      {fld.label} {fld.required && <span className="text-destructive">*</span>}
                    </Label>
                    {renderFieldInput(fld)}
                  </div>
                ))}

                {fields.some((f) => f.isMoreDetail) && (() => {
                  const moreFields = fields.filter((f) => f.isMoreDetail);
                  const hasMoreValues = moreFields.some((f) => Boolean(form[f.key]));
                  const isExpanded = showMoreDetails || hasMoreValues;

                  return (
                    <div className="border-t border-border pt-2">
                      <button
                        type="button"
                        onClick={() => setShowMoreDetails((prev) => !prev)}
                        className="flex w-full items-center justify-between px-1 py-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                      >
                        <span>{isExpanded ? "Hide additional details" : "More details (address, tax, payment terms)"}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
                        ) : (
                          <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-1 space-y-3 border-t border-dashed border-border pt-3">
                          {moreFields.map((fld) => (
                            <div key={fld.key} className="space-y-1.5">
                              <Label htmlFor={`field-${fld.key}`} className="text-xs font-medium text-foreground">
                                {fld.label} {fld.required && <span className="text-destructive">*</span>}
                              </Label>
                              {renderFieldInput(fld)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <DialogFooter className="shrink-0 gap-2 border-t border-border bg-muted/30 px-6 py-3 sm:gap-0">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {saving ? "Saving" : editing ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        meta={meta}
        onPageChange={(page) => setQuery({ ...query, page })}
        searchPlaceholder={searchPlaceholder || `Search ${title.toLowerCase()}`}
      />

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-medium">Delete {title}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action can be undone by restoring from archives.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
