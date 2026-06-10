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
  manualCheckUpdate: () => ipcRenderer.invoke('manual-check-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  
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
  dbGetKV: (key) => ipcRenderer.sendSync('db-get-kv', key),
  dbSetKV: (key, value) => ipcRenderer.sendSync('db-set-kv', key, value),
  dbBackup: (filePath) => ipcRenderer.sendSync('db-backup', filePath),
  dbGetPath: () => ipcRenderer.sendSync('db-get-path'),

  // LAN Network Sharing
  discoverLAN: () => ipcRenderer.invoke('lan-discover'),
  connectLAN: (ip, port) => ipcRenderer.invoke('lan-connect', ip, port),
  lanLogin: (username, password) => ipcRenderer.invoke('lan-login', username, password),
  getLANStatus: () => ipcRenderer.invoke('lan-get-status'),
  disconnectLAN: () => ipcRenderer.invoke('lan-disconnect'),

  // Device Tracking
  registerDevice: () => ipcRenderer.invoke('device-register'),
  sendHeartbeat: () => ipcRenderer.invoke('device-heartbeat'),
  getDeviceInfo: () => ipcRenderer.invoke('device-get-info'),
  getLocation: () => ipcRenderer.invoke('device-get-location'),
});

// Also expose for license.html window
contextBridge.exposeInMainWorld('electronAPI', {
  activateLicense: (key) => ipcRenderer.invoke('license-activate', key),
  getLicenseInfo: () => ipcRenderer.invoke('license-get-info'),
  resetLicense: () => ipcRenderer.invoke('license-reset'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  openMainWindow: () => ipcRenderer.send('open-main-window'),
  
  // LAN Network Sharing
  discoverLAN: () => ipcRenderer.invoke('lan-discover'),
  connectLAN: (ip, port) => ipcRenderer.invoke('lan-connect', ip, port),
  lanLogin: (username, password) => ipcRenderer.invoke('lan-login', username, password),
  getLANStatus: () => ipcRenderer.invoke('lan-get-status'),
  disconnectLAN: () => ipcRenderer.invoke('lan-disconnect'),

  // Demo
  activateDemo: () => ipcRenderer.invoke('demo-activate'),
  getDemoStatus: () => ipcRenderer.invoke('demo-get-status'),
  onUpdateStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
});
