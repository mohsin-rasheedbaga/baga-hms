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
});

// Also expose for license.html window
contextBridge.exposeInMainWorld('electronAPI', {
  activateLicense: (key) => ipcRenderer.invoke('license-activate', key),
  getLicenseInfo: () => ipcRenderer.invoke('license-get-info'),
  resetLicense: () => ipcRenderer.invoke('license-reset'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  openMainWindow: () => ipcRenderer.send('open-main-window'),
  onUpdateStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
});
