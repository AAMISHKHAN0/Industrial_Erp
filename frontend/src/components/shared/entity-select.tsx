"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  QuickCreateDialog,
  type QuickCreateEntityType,
} from "./quick-create-dialog";

export interface EntityOption {
  value: string;
  label: string;
  subLabel?: string;
}

export interface EntitySelectProps {
  id?: string;
  value?: string | null;
  onValueChange: (value: string) => void;
  options: EntityOption[];
  placeholder?: string;
  entityLabel: string;
  pluralLabel?: string;
  quickAddType?: QuickCreateEntityType;
  onQuickAdd?: () => void;
  onQuickCreated?: (created: any) => void;
  addLabel?: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
}

export function EntitySelect({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  entityLabel,
  pluralLabel,
  quickAddType,
  onQuickAdd,
  onQuickCreated,
  addLabel,
  allowNone = false,
  noneLabel = "None",
  disabled = false,
  className,
  searchable,
}: EntitySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const normalizedValue = value ?? "";
  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === normalizedValue),
    [options, normalizedValue],
  );

  const canQuickAdd = Boolean(onQuickAdd || quickAddType);
  const effectivePlural = pluralLabel || `${entityLabel}s`;
  const effectiveAddLabel = addLabel || `Add your ${entityLabel}`;

  const showSearch = searchable ?? options.length >= 6;
  const filteredOptions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.subLabel && o.subLabel.toLowerCase().includes(q)),
    );
  }, [options, search]);

  React.useEffect(() => {
    if (!open && search) setSearch("");
  }, [open, search]);

  const handleOpenQuickAdd = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpen(false);
    if (onQuickAdd) {
      onQuickAdd();
    } else if (quickAddType) {
      setQuickOpen(true);
    }
  };

  const handleSelectChange = (next: string | null) => {
    if (next === "__NONE__") {
      onValueChange("");
      return;
    }
    if (next !== null) {
      onValueChange(next);
    }
  };

  return (
    <>
      <Select
        value={normalizedValue || (allowNone ? "__NONE__" : "")}
        onValueChange={handleSelectChange}
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={cn("w-full", className)}>
          <span className="flex flex-1 items-center gap-1.5 truncate text-left">
            {selectedOption ? (
              <span className="truncate">{selectedOption.label}</span>
            ) : allowNone && (!normalizedValue || normalizedValue === "__NONE__") ? (
              <span className="truncate text-muted-foreground">
                {placeholder || noneLabel}
              </span>
            ) : (
              <span className="truncate text-muted-foreground">
                {placeholder || `Select ${entityLabel.toLowerCase()}`}
              </span>
            )}
          </span>
        </SelectTrigger>

        <SelectContent alignItemWithTrigger={false} className="min-w-[240px]">
          {showSearch && (
            <div
              className="sticky top-0 z-10 border-b bg-popover p-1.5"
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${effectivePlural.toLowerCase()}...`}
                  className="h-7 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {allowNone && (
            <SelectItem value="__NONE__">
              <span className="text-muted-foreground">{noneLabel}</span>
            </SelectItem>
          )}

          {filteredOptions.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 px-3 py-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">
                {options.length === 0
                  ? `No ${effectivePlural.toLowerCase()} added yet`
                  : `No matching ${entityLabel.toLowerCase()} found`}
              </p>
              {canQuickAdd && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleOpenQuickAdd}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {effectiveAddLabel}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="max-h-56 overflow-y-auto">
                {filteredOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex flex-col">
                      <span className="truncate">{opt.label}</span>
                      {opt.subLabel ? (
                        <span className="text-[11px] text-muted-foreground truncate">
                          {opt.subLabel}
                        </span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </div>
              {canQuickAdd && (
                <div className="sticky bottom-0 border-t bg-popover p-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleOpenQuickAdd}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-accent cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add {entityLabel}
                  </button>
                </div>
              )}
            </>
          )}
        </SelectContent>
      </Select>

      {quickAddType && !onQuickAdd && (
        <QuickCreateDialog
          open={quickOpen}
          onOpenChange={setQuickOpen}
          entityType={quickAddType}
          onCreated={(created) => {
            if (onQuickCreated) {
              onQuickCreated(created);
            }
            if (created?.id) {
              onValueChange(created.id);
            }
          }}
        />
      )}
    </>
  );
}
