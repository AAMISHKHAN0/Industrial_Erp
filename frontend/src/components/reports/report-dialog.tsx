"use client";

import { useState, useEffect, type ReactNode } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileDown, FileText } from "lucide-react";
import { exportExcel, exportPdf, type ExportColumn } from "@/lib/reports/export-utils";
import { PoweredByFooter } from "@/components/shared/powered-by-footer";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  fetchFn: () => Promise<any[]>;
  columns: ExportColumn[];
  filename: string;
  summaryCards?: ReactNode;
}

export function ReportDialog({ open, onClose, title, description, fetchFn, columns, filename, summaryCards }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchFn()
      .then((res) => {
        if (Array.isArray(res)) {
          setData(res);
        } else if (res && Array.isArray((res as any).data)) {
          setData((res as any).data);
        } else if (res && typeof res === "object") {
          setData([res]);
        } else {
          setData([]);
        }
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [open, fetchFn]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] grid grid-rows-[auto_auto_1fr_auto] p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {summaryCards && <div className="px-4 pb-2">{summaryCards}</div>}
        <div className="px-4 py-2 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No data found.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    {columns.map((col) => (
                      <th key={col.header} className="text-left p-2 font-medium whitespace-nowrap">{col.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={row.id || i} className="border-b last:border-0 hover:bg-muted/30">
                      {columns.map((col) => (
                        <td key={col.header} className="p-2 whitespace-nowrap">{col.accessor(row)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter className="px-4 pb-4 pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          <PoweredByFooter compact className="sm:justify-start" />
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={data.length === 0} onClick={() => exportExcel(data, columns, filename)}>
              <FileDown className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" disabled={data.length === 0} onClick={() => exportPdf(title, data, columns, filename)}>
              <FileText className="h-4 w-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
