const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');

// ============================================================
// CONFIGURATION
// ============================================================
const APP_VERSION = '2.6.0';
const API_BASE = 'https://baga-hospital-api.vercel.app';
const SERVER_PORT = 18765;
const STORE_PATH = path.join(app.getPath('userData'), 'baga-store.json');

// ============================================================
// PERSISTENT STORE (machine ID, license, etc.)
// ============================================================
function getStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Store read error:', e);
  }
  return {};
}

function saveStore(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Store write error:', e);
  }
}

function getMachineId() {
  let store = getStore();
  if (!store.machineId) {
    store.machineId = crypto.randomBytes(16).toString('hex');
    saveStore(store);
  }
  return store.machineId;
}

// ============================================================
// AUTO-UPDATER
// ============================================================
let mainWindow = null;
let licenseWindow = null;
let updateDownloaded = false;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'mohsin-rasheedbaga',
  repo: 'baga-hms'
});

autoUpdater.on('checking-for-update', () => {
  console.log('[AutoUpdate] Checking for updates...');
  sendToAllWindows('update-status', { status: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  console.log('[AutoUpdate] Update available:', info.version);
  sendToAllWindows('update-status', { status: 'available', version: info.version, releaseNotes: info.releaseNotes });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[AutoUpdate] No update available. Current:', APP_VERSION);
  sendToAllWindows('update-status', { status: 'not-available' });
});

autoUpdater.on('download-progress', (progress) => {
  const percent = Math.round(progress.percent);
  console.log(`[AutoUpdate] Downloading: ${percent}%`);
  sendToAllWindows('update-status', { status: 'downloading', percent });
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[AutoUpdate] Update downloaded:', info.version);
  updateDownloaded = true;
  sendToAllWindows('update-status', { status: 'downloaded', version: info.version });
  
  // Notify user
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Downloaded',
    message: `Version ${info.version} has been downloaded.`,
    detail: 'The new version will be installed when the application closes. Would you like to restart now?',
    buttons: ['Restart Now', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  console.error('[AutoUpdate] Error:', err.message);
  sendToAllWindows('update-status', { status: 'error', message: err.message });
});

function sendToAllWindows(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
  if (licenseWindow && !licenseWindow.isDestroyed()) {
    licenseWindow.webContents.send(channel, data);
  }
}

function checkForUpdates() {
  console.log('[AutoUpdate] Checking for updates...');
  try {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[AutoUpdate] Check failed:', err.message);
    });
  } catch (e) {
    console.error('[AutoUpdate] Check error:', e.message);
  }
}

// ============================================================
// HTTP SERVER (serves Next.js static export)
// ============================================================
function startServer() {
  const outDir = path.join(__dirname, '..', 'out');
  
  const server = http.createServer((req, res) => {
    let filePath = path.join(outDir, req.url === '/' ? 'index.html' : req.url);
    
    // Handle Next.js static routing
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // Try with .html extension
      if (!filePath.endsWith('.html')) {
        const htmlPath = filePath + '.html';
        if (fs.existsSync(htmlPath)) {
          filePath = htmlPath;
        } else {
          // Try index.html in directory
          const indexPath = path.join(filePath, 'index.html');
          if (fs.existsSync(indexPath)) {
            filePath = indexPath;
          } else {
            // Fallback to index.html for SPA-like behavior
            filePath = path.join(outDir, 'index.html');
          }
        }
      } else {
        filePath = path.join(outDir, 'index.html');
      }
    }
    
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
    };
    
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
  
  return new Promise((resolve) => {
    server.listen(SERVER_PORT, '0.0.0.0', () => {
      console.log(`[Server] Running on http://localhost:${SERVER_PORT}`);
      resolve(server);
    });
  });
}

// ============================================================
// LICENSE WINDOW (shown before main app)
// ============================================================
function createLicenseWindow() {
  licenseWindow = new BrowserWindow({
    width: 550,
    height: 680,
    resizable: false,
    maximizable: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  
  licenseWindow.loadFile(path.join(__dirname, 'license.html'));
  licenseWindow.setMenuBarVisibility(false);
  
  licenseWindow.on('closed', () => {
    licenseWindow = null;
  });
}

// ============================================================
// MAIN WINDOW
// ============================================================
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'BAGA Hospital Management System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  
  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
  mainWindow.setMenuBarVisibility(false);
  
  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
  
  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  
  // Check for updates after window loads
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(checkForUpdates, 3000);
  });
}

// ============================================================
// IPC HANDLERS - LICENSE MANAGEMENT
// ============================================================

// Check license from store
ipcMain.handle('license-get-info', async () => {
  const store = getStore();
  const licenseInfo = store.license || null;
  return {
    machineId: getMachineId(),
    license: licenseInfo,
    version: APP_VERSION,
  };
});

// Validate and activate license via API
ipcMain.handle('license-activate', async (event, licenseKey) => {
  try {
    const machineId = getMachineId();
    const store = getStore();
    
    console.log('[License] Activating:', licenseKey, 'Machine:', machineId);
    
    // Call API to check and activate license
    const response = await fetch(`${API_BASE}/api/license/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        machine_id: machineId,
      }),
    });
    
    const data = await response.json();
    console.log('[License] API response:', JSON.stringify(data));
    
    if (data.valid) {
      // Save license info locally
      store.license = {
        key: licenseKey,
        hospitalName: data.hospital_name,
        hospitalId: data.hospital_id,
        features: data.features || [],
        licenseDuration: data.license_duration,
        expiryDate: data.expiry_date,
        address: data.address || '',
        phone: data.phone || '',
        activatedAt: new Date().toISOString(),
        machineId: machineId,
      };
      saveStore(store);
      
      return { success: true, data: store.license };
    } else {
      return { success: false, error: data.error || 'Invalid license key' };
    }
  } catch (error) {
    console.error('[License] Activation error:', error);
    return { success: false, error: 'Connection error - please check your internet and try again.' };
  }
});

// Reset license (clear stored data)
ipcMain.handle('license-reset', async () => {
  const store = getStore();
  store.license = null;
  saveStore(store);
  return { success: true };
});

// ============================================================
// IPC HANDLERS - LOGIN
// ============================================================

// Login via API
ipcMain.handle('api-login', async (event, { username, password }) => {
  try {
    const store = getStore();
    const licenseKey = store.license ? store.license.key : null;
    
    console.log('[Login] Attempt:', username, 'License:', licenseKey ? 'yes' : 'no');
    
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        license_key: licenseKey,
      }),
    });
    
    const data = await response.json();
    console.log('[Login] API response:', response.status, JSON.stringify(data).substring(0, 200));
    
    if (response.ok && data.success !== false) {
      return { success: true, user: data };
    } else {
      return { success: false, error: data.error || 'Login failed - invalid username or password' };
    }
  } catch (error) {
    console.error('[Login] API error:', error);
    return { success: false, error: 'Connection error - please check your internet and try again.' };
  }
});

// ============================================================
// IPC HANDLERS - APP INFO
// ============================================================

ipcMain.handle('get-app-version', () => {
  return APP_VERSION;
});

ipcMain.handle('get-machine-id', () => {
  return getMachineId();
});

ipcMain.handle('get-api-base', () => {
  return API_BASE;
});

ipcMain.handle('check-update', () => {
  checkForUpdates();
  return { checking: true };
});

ipcMain.handle('quit-app', () => {
  app.quit();
});

// Open main window from license window
ipcMain.on('open-main-window', () => {
  if (licenseWindow && !licenseWindow.isDestroyed()) {
    licenseWindow.close();
  }
  if (!mainWindow) {
    createMainWindow();
  } else {
    mainWindow.focus();
  }
});

// ============================================================
// APP LIFECYCLE
// ============================================================

app.whenReady().then(async () => {
  console.log(`[BAGA HMS] v${APP_VERSION} starting...`);
  console.log(`[BAGA HMS] Machine ID: ${getMachineId()}`);
  console.log(`[BAGA HMS] API Base: ${API_BASE}`);
  
  // Start HTTP server
  await startServer();
  
  // Check if license exists
  const store = getStore();
  
  if (!store.license) {
    // No license - show license activation window
    console.log('[BAGA HMS] No license found. Showing activation window.');
    createLicenseWindow();
  } else {
    // License exists - validate it and show main window
    console.log('[BAGA HMS] License found. Validating...');
    try {
      const response = await fetch(`${API_BASE}/api/license/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: store.license.key,
          machine_id: store.license.machineId,
        }),
      });
      
      const data = await response.json();
      
      if (data.valid) {
        // Update stored license info
        store.license.hospitalName = data.hospital_name || store.license.hospitalName;
        store.license.features = data.features || store.license.features;
        store.license.expiryDate = data.expiry_date || store.license.expiryDate;
        saveStore(store);
        
        console.log('[BAGA HMS] License valid. Opening main window.');
        createMainWindow();
      } else {
        // License invalid - show activation window
        console.log('[BAGA HMS] License invalid:', data.error);
        store.license = null;
        saveStore(store);
        createLicenseWindow();
      }
    } catch (error) {
      console.error('[BAGA HMS] License validation failed (offline?):', error.message);
      // If offline and we have a cached license, allow offline use
      if (store.license) {
        console.log('[BAGA HMS] Allowing offline use with cached license.');
        createMainWindow();
      } else {
        createLicenseWindow();
      }
    }
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await startServer();
    const store = getStore();
    if (store.license) {
      createMainWindow();
    } else {
      createLicenseWindow();
    }
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else if (licenseWindow) {
      licenseWindow.focus();
    }
  });
}
