const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bagaAPI', {
  // App Info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  getApiBase: () => ipcRenderer.invoke('get-api-base'),
  getLanInfo: () => ipcRenderer.invoke('get-lan-info'),
  checkFirewallStatus: () => ipcRenderer.invoke('check-firewall-status'),
  addFirewallRule: () => ipcRenderer.invoke('add-firewall-rule'),
  
  // License Management
  getLicenseInfo: () => ipcRenderer.invoke('license-get-info'),
  activateLicense: (key) => ipcRenderer.invoke('license-activate', key),
  resetLicense: () => ipcRenderer.invoke('license-reset'),
  
  // Demo Management
  activateDemo: () => ipcRenderer.invoke('demo-activate'),
  getDemoStatus: () => ipcRenderer.invoke('demo-get-status'),
  
  // Full License Info (for main app)
  getFullLicenseInfo: () => ipcRenderer.invoke('license-get-full-info'),
  
  // Hospital Logo
  getLogoBase64: () => ipcRenderer.invoke('get-logo-base64'),
  
  // Login
  apiLogin: (credentials) => ipcRenderer.invoke('api-login', credentials),

  // Sync remote users (admin-panel users) to local SQLite for LAN login
  syncRemoteUsers: () => ipcRenderer.invoke('sync-remote-users'),
  
  // Update
  checkForUpdate: () => ipcRenderer.invoke('check-update'),
  manualCheckUpdate: () => ipcRenderer.invoke('manual-check-update'),
  onUpdateStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  openUpdateFile: (filePath) => ipcRenderer.invoke('open-update-file', filePath),

  // Delta Update Control
  applyDeltaUpdate: () => ipcRenderer.invoke('apply-delta-update'),
  restartForUpdate: () => ipcRenderer.invoke('restart-for-update'),
  getUpdatePrefs: () => ipcRenderer.invoke('get-update-prefs'),
  setUpdatePrefs: (prefs) => ipcRenderer.invoke('set-update-prefs', prefs),
  getUpdateLog: () => ipcRenderer.invoke('get-update-log'),
  getPendingDelta: () => ipcRenderer.invoke('get-pending-delta'),
  dismissPendingDelta: () => ipcRenderer.invoke('dismiss-pending-delta'),
  
  // App Control
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // App Config (for GH token etc.)
  saveAppConfig: (config) => ipcRenderer.invoke('save-app-config', config),
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  printHtml: (html) => ipcRenderer.invoke('print-html', html),

  // Save custom hospital logo (base64 PNG/JPG)
  selectLogoFile: () => ipcRenderer.invoke('select-logo-file'),
  saveLogo: (base64Data, mimeType) => ipcRenderer.invoke('save-logo', base64Data, mimeType),
  removeLogo: () => ipcRenderer.invoke('remove-logo'),

  // Database operations (synchronous via sendSync)
  dbGetAll: (table) => ipcRenderer.sendSync('db-get-all', table),
  dbGetById: (table, id) => ipcRenderer.sendSync('db-get-by-id', table, id),
  dbSetById: (table, id, data) => ipcRenderer.sendSync('db-set-by-id', table, id, data),
  dbSetAll: (table, dataArray) => ipcRenderer.sendSync('db-set-all', table, dataArray),
  dbDeleteById: (table, id) => ipcRenderer.sendSync('db-delete-by-id', table, id),
  dbGetCounter: (key) => ipcRenderer.sendSync('db-get-counter', key),
  dbSetCounter: (key, value) => ipcRenderer.sendSync('db-set-counter', key, value),
  dbIncrementCounter: (key) => ipcRenderer.sendSync('db-increment-counter', key),
  dbGetKV: (key) => ipcRenderer.sendSync('db-get-kv', key),
  dbSetKV: (key, value) => ipcRenderer.sendSync('db-set-kv', key, value),
  dbBackup: (filePath) => ipcRenderer.sendSync('db-backup', filePath),
  dbGetPath: () => ipcRenderer.sendSync('db-get-path'),

  // Thermal Printer (ESC/POS)
  printerGetStatus: () => ipcRenderer.invoke('printer-get-status'),
  printerGetConfig: () => ipcRenderer.invoke('printer-get-config'),
  printerSetConfig: (config) => ipcRenderer.invoke('printer-set-config', config),
  printerDetect: () => ipcRenderer.invoke('printer-detect'),
  printerListPorts: () => ipcRenderer.invoke('printer-list-ports'),
  printerTest: () => ipcRenderer.invoke('printer-test'),
  printerPrintReceipt: (html, options) => ipcRenderer.invoke('printer-print-receipt', html, options),
  printerPrintRaw: (base64, options) => ipcRenderer.invoke('printer-print-raw', base64, options),
});

// Also expose for license.html window
contextBridge.exposeInMainWorld('electronAPI', {
  activateLicense: (key) => ipcRenderer.invoke('license-activate', key),
  getLicenseInfo: () => ipcRenderer.invoke('license-get-info'),
  resetLicense: () => ipcRenderer.invoke('license-reset'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  openMainWindow: () => ipcRenderer.send('open-main-window'),
  
  // Demo
  activateDemo: () => ipcRenderer.invoke('demo-activate'),
  getDemoStatus: () => ipcRenderer.invoke('demo-get-status'),
  onUpdateStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  openUpdateFile: (filePath) => ipcRenderer.invoke('open-update-file', filePath),
});
