const { contextBridge, ipcRenderer } = require('electron');

/**
 * Hardened desktop preload bridge.
 * Node integration is disabled; renderer access is sandboxed.
 */
contextBridge.exposeInMainWorld('desktopBridge', {
  isDesktop: true,
  platform: process.platform,
  version: '1.0.6',
  getApiBase: () => ipcRenderer.sendSync('app:get-api-base'),
  getSession: () => ipcRenderer.sendSync('session:get'),
  setSession: (token) => ipcRenderer.send('session:set', token),
  clearSession: () => ipcRenderer.send('session:clear'),
  print: () => {
    ipcRenderer.send('window-print');
  },
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (_event, status) => callback(status));
  },
  retryStartup: () => ipcRenderer.invoke('app:retry-startup'),
  exitApp: () => ipcRenderer.invoke('app:exit'),
  backup: {
    getStatus: () => ipcRenderer.invoke('backup:get-status'),
    getConfig: () => ipcRenderer.invoke('backup:get-config'),
    setConfig: (config) => ipcRenderer.invoke('backup:set-config', config),
    selectDirectory: () => ipcRenderer.invoke('backup:select-directory'),
    createNow: () => ipcRenderer.invoke('backup:create-now'),
    list: () => ipcRenderer.invoke('backup:list'),
    validate: (filePath) => ipcRenderer.invoke('backup:validate', filePath),
    restore: (filePath) => ipcRenderer.invoke('backup:restore', filePath),
    selectRestoreFile: () => ipcRenderer.invoke('backup:select-restore-file'),
  },
  openLogs: () => ipcRenderer.invoke('app:open-logs'),
  openBackups: () => ipcRenderer.invoke('app:open-backups'),
});
