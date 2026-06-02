const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bagaAPI', {
  // App Info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  getApiBase: () => ipcRenderer.invoke('get-api-base'),
  
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
  
  // Update
  checkForUpdate: () => ipcRenderer.invoke('check-update'),
  onUpdateStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  
  // App Control
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // Print HTML content via Electron's native print dialog
  printHtml: (html) => ipcRenderer.invoke('print-html', html),

  // Password Change
  changePassword: (data) => ipcRenderer.invoke('api-change-password', data),

  // Save custom hospital logo (base64 PNG/JPG)
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
  dbGetKV: (key) => ipcRenderer.sendSync('db-get-kv', key),
  dbSetKV: (key, value) => ipcRenderer.sendSync('db-set-kv', key, value),
  dbBackup: (filePath) => ipcRenderer.sendSync('db-backup', filePath),
  dbGetPath: () => ipcRenderer.sendSync('db-get-path'),
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
});
