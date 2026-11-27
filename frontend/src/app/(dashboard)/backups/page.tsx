"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AppShell } from "@/components/layouts/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  HardDrive,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Database,
  Clock,
  FileJson,
  FolderOpen,
  ShieldCheck,
  Archive,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import { formatDate } from "@/lib/reports/export-utils";

interface BackupFile {
  id: string;
  filename: string;
  label: string;
  size: number;
  createdAt: string;
  path?: string;
}

interface DesktopBackupConfig {
  backupDir: string;
  autoBackupEnabled: boolean;
}

interface DesktopBridge {
  isDesktop?: boolean;
  openBackups?: () => Promise<any>;
  backup?: {
    getStatus: () => Promise<{ config: DesktopBackupConfig; isBackupInProgress: boolean; isRestoreInProgress: boolean }>;
    getConfig: () => Promise<DesktopBackupConfig>;
    setConfig: (config: Partial<DesktopBackupConfig>) => Promise<DesktopBackupConfig>;
    selectDirectory: () => Promise<string | null>;
    createNow: () => Promise<{ success?: boolean; path?: string; size?: number; recordCount?: number }>;
    list: () => Promise<Array<{ filename: string; path: string; size: number; createdAt: string }>>;
    validate: (filePath: string) => Promise<{ valid: boolean; manifest?: any; error?: string }>;
    restore: (filePath: string) => Promise<{ success?: boolean; recordCount?: number; message?: string }>;
    selectRestoreFile: () => Promise<string | null>;
  };
}

function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as any).desktopBridge as DesktopBridge | undefined;
  return bridge?.isDesktop && bridge.backup ? bridge : null;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function BackupsPage() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [desktopConfig, setDesktopConfig] = useState<DesktopBackupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [validatingPath, setValidatingPath] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    const bridge = getDesktopBridge();
    if (bridge?.backup) {
      setIsDesktop(true);
      try {
        const [list, cfg] = await Promise.all([
          bridge.backup.list(),
          bridge.backup.getConfig(),
        ]);
        setDesktopConfig(cfg);
        setBackups(
          (list || []).map((item) => ({
            id: item.path,
            path: item.path,
            filename: item.filename,
            label: item.filename.includes("auto") ? "auto" : "desktop",
            size: item.size,
            createdAt: item.createdAt,
          }))
        );
      } catch (e: any) {
        toast.error(e?.message || "Failed to load desktop backups");
        setBackups([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    setIsDesktop(false);
    try {
      const data = await api.get<BackupFile[]>("/backups");
      setBackups(data || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load backups");
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const createBackup = async () => {
    setCreating(true);
    try {
      const bridge = getDesktopBridge();
      if (bridge?.backup) {
        const res = await bridge.backup.createNow();
        toast.success(
          res?.recordCount != null
            ? `Backup archive created (${res.recordCount} records)`
            : "Backup archive created successfully"
        );
      } else {
        await api.post("/backups/create", {});
        toast.success("Backup created successfully");
      }
      await fetchBackups();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const downloadBackup = async (id: string, filename: string) => {
    try {
      await api.download(`/backups/download/${id}`, filename);
    } catch (e: any) {
      toast.error(e?.message || "Failed to download backup");
    }
  };

  const validateDesktopBackup = async (filePath: string) => {
    const bridge = getDesktopBridge();
    if (!bridge?.backup) return;
    setValidatingPath(filePath);
    try {
      const res = await bridge.backup.validate(filePath);
      if (res.valid) {
        const records = res.manifest?.database?.totalRecords;
        toast.success(
          records != null
            ? `Archive is valid (${records} records)`
            : "Backup archive verified"
        );
      } else {
        toast.error(res.error || "Backup archive validation failed");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to validate backup");
    } finally {
      setValidatingPath(null);
    }
  };

  const restoreBackup = async (id: string, filename: string) => {
    const bridge = getDesktopBridge();
    if (bridge?.backup) {
      setValidatingPath(id);
      try {
        const check = await bridge.backup.validate(id);
        if (!check.valid) {
          toast.error(check.error || "Selected archive failed validation");
          return;
        }
        const recCount = check.manifest?.database?.totalRecords;
        const details = recCount != null ? ` (${recCount} records)` : "";
        if (
          !confirm(
            `Restore "${filename}"${details}?\n\nThis will REPLACE all current database records and attachments. Cannot be undone.`
          )
        ) {
          return;
        }
        setRestoring(true);
        const res = await bridge.backup.restore(id);
        toast.success(res?.message || "Backup restored successfully");
        await fetchBackups();
      } catch (e: any) {
        toast.error(e?.message || "Restore failed");
      } finally {
        setValidatingPath(null);
        setRestoring(false);
      }
      return;
    }

    if (
      !confirm(
        `Restore "${filename}"?\n\nThis will REPLACE all current data with the backup. Cannot be undone.`
      )
    ) {
      return;
    }
    setRestoring(true);
    try {
      const res = await api.post<{ message: string }>(`/backups/restore/${id}`, {});
      toast.success(res.message);
      await fetchBackups();
    } catch (e: any) {
      toast.error(e?.message || "Restore failed");
    } finally {
      setRestoring(false);
    }
  };

  const restoreFromDesktopFile = async () => {
    const bridge = getDesktopBridge();
    if (!bridge?.backup) return;
    try {
      const filePath = await bridge.backup.selectRestoreFile();
      if (!filePath) return;
      const filename = filePath.split(/[/\\]/).pop() || filePath;
      await restoreBackup(filePath, filename);
    } catch (e: any) {
      toast.error(e?.message || "Failed to select backup file");
    }
  };

  const handleSelectDirectory = async () => {
    const bridge = getDesktopBridge();
    if (!bridge?.backup) return;
    try {
      const dir = await bridge.backup.selectDirectory();
      if (dir) {
        setDesktopConfig((prev) => (prev ? { ...prev, backupDir: dir } : { backupDir: dir, autoBackupEnabled: true }));
        toast.success("Backup folder updated");
        await fetchBackups();
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to change backup folder");
    }
  };

  const handleToggleAutoBackup = async (enabled: boolean) => {
    const bridge = getDesktopBridge();
    if (!bridge?.backup) return;
    try {
      const updated = await bridge.backup.setConfig({ autoBackupEnabled: enabled });
      setDesktopConfig(updated);
      toast.success(enabled ? "Automatic backups enabled" : "Automatic backups paused");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update backup schedule");
    }
  };

  const handleOpenFolder = async () => {
    const bridge = getDesktopBridge();
    if (!bridge?.openBackups) return;
    try {
      await bridge.openBackups();
    } catch (e: any) {
      toast.error(e?.message || "Failed to open backup folder");
    }
  };

  const deleteBackup = async (id: string) => {
    if (!confirm("Delete this backup?")) return;
    try {
      await api.delete(`/backups/${id}`);
      toast.success("Backup deleted");
      fetchBackups();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const uploadBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.models) throw new Error("Invalid backup file — missing 'models' key");
      await api.post("/backups/upload", data);
      toast.success("Backup uploaded and restored");
      fetchBackups();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload backup");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearAllData = async () => {
    setClearing(true);
    try {
      await api.delete("/backups");
      toast.success("All data cleared. Log in again to recreate your account.");
      setConfirmClear(false);
      fetchBackups();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setClearing(false);
    }
  };

  const latestBackup = backups.length > 0 ? backups[0] : null;

  return (
    <AppShell title="Backups">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {isDesktop
              ? "Full compressed archives (.tar.gz) of your PostgreSQL database and attachments stored locally."
              : "Backups are stored in the database (survives redeploys). Auto-backup every 6 hours."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={fetchBackups} disabled={loading || restoring}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            {isDesktop ? (
              <>
                <Button variant="outline" size="sm" onClick={handleOpenFolder}>
                  <FolderOpen className="h-4 w-4 mr-2" /> Open Folder
                </Button>
                <Button variant="outline" size="sm" onClick={restoreFromDesktopFile} disabled={restoring}>
                  <Archive className="h-4 w-4 mr-2" /> {restoring ? "Restoring..." : "Restore from File"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <FileJson className="h-4 w-4 mr-2" /> {uploading ? "Uploading..." : "Upload Backup"}
                </Button>
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={uploadBackup} />
              </>
            )}
            <Button size="sm" onClick={createBackup} disabled={creating || restoring}>
              <HardDrive className="h-4 w-4 mr-2" />
              {creating ? "Creating..." : "Create Backup Now"}
            </Button>
          </div>
        </div>

        {isDesktop && desktopConfig && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="h-4 w-4 text-primary" /> Desktop Backup Location & Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground">Archive Directory</p>
                <p className="text-xs font-mono truncate bg-muted/50 px-2.5 py-1.5 rounded border" title={desktopConfig.backupDir}>
                  {desktopConfig.backupDir}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-backup-switch"
                    checked={desktopConfig.autoBackupEnabled}
                    onCheckedChange={handleToggleAutoBackup}
                  />
                  <Label htmlFor="auto-backup-switch" className="text-xs">Auto-Backup</Label>
                </div>
                <Button variant="outline" size="sm" onClick={handleSelectDirectory}>
                  Change Folder
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" /> Backup Status
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{backups.length}</p>
              <p className="text-xs text-muted-foreground">Total Backups</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{latestBackup ? fmtBytes(latestBackup.size) : "-"}</p>
              <p className="text-xs text-muted-foreground">Latest Size</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{latestBackup ? formatDate(latestBackup.createdAt) : "Never"}</p>
              <p className="text-xs text-muted-foreground">Last Backup</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" /> Backup History
            </CardTitle>
            <CardDescription>
              {isDesktop
                ? "Local .tar.gz archives stored in your configured backup directory."
                : "Auto-backups run every 6 hours. Last 30 backups are kept."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-12">
                <Database className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No backups yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first backup or wait for the auto-backup</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-2 font-medium">Filename</th>
                      <th className="text-center p-2 font-medium">Type</th>
                      <th className="text-right p-2 font-medium">Size</th>
                      <th className="text-right p-2 font-medium">Created</th>
                      <th className="text-center p-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b) => (
                      <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-2 font-mono text-xs max-w-[280px] truncate" title={b.path || b.filename}>{b.filename}</td>
                        <td className="p-2 text-center">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              b.label === "auto"
                                ? "bg-blue-100 text-blue-700"
                                : b.label === "uploaded"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {b.label}
                          </span>
                        </td>
                        <td className="p-2 text-right text-muted-foreground">{fmtBytes(b.size)}</td>
                        <td className="p-2 text-right text-muted-foreground">{formatDate(b.createdAt)}</td>
                        <td className="p-2">
                          <div className="flex items-center justify-center gap-1">
                            {isDesktop ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600"
                                title="Validate Archive"
                                disabled={validatingPath === b.id || restoring}
                                onClick={() => validateDesktopBackup(b.id)}
                              >
                                {validatingPath === b.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Download"
                                onClick={() => downloadBackup(b.id, b.filename)}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-600"
                              title="Restore"
                              disabled={restoring || validatingPath === b.id}
                              onClick={() => restoreBackup(b.id, b.filename)}
                            >
                              <Upload className="h-3.5 w-3.5" />
                            </Button>
                            {!isDesktop && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                title="Delete"
                                onClick={() => deleteBackup(b.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {!isDesktop && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertTriangle className="h-4 w-4" /> Danger Zone
              </CardTitle>
              <CardDescription>Irreversible actions — make a backup first</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" size="sm" onClick={() => setConfirmClear(true)} disabled={clearing}>
                {clearing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Clear All Data
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Deletes ALL records from every table. You&apos;ll need to log in again.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Clear All Data?</DialogTitle>
            <DialogDescription>This permanently deletes ALL data. Cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button variant="destructive" onClick={clearAllData} disabled={clearing}>
              {clearing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Yes, Delete Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
