const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');

// ============================================================
// CONFIGURATION
// ============================================================
const APP_VERSION = '3.0.0';
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
// DATABASE (loaded safely - won't crash if better-sqlite3 fails)
// ============================================================
let db = null;
let dbError = null;

function initDatabaseSafe() {
  try {
    db = require('./database');
    db.initDatabase(app);
    console.log('[DB] SQLite initialized successfully');
  } catch (err) {
    dbError = err;
    console.error('[DB] SQLite FAILED (app will use localStorage):', err.message);
    db = null;
  }
}

// Safe DB wrappers that work even if SQLite is unavailable
function safeDbGetAll(table) {
  if (!db) return { success: false, error: dbError ? dbError.message : 'DB not available' };
  try { return { success: true, data: db.getAll(table) }; }
  catch (err) { return { success: false, error: err.message }; }
}
function safeDbGetById(table, id) {
  if (!db) return { success: false, error: dbError ? dbError.message : 'DB not available' };
  try { return { success: true, data: db.getById(table, id) }; }
  catch (err) { return { success: false, error: err.message }; }
}
function safeDbSetById(table, id, data) {
  if (!db) return { success: false, error: dbError ? dbError.message : 'DB not available' };
  try { db.setById(table, id, data); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
}
function safeDbSetAll(table, dataArray) {
  if (!db) return { success: false, error: dbError ? dbError.message : 'DB not available' };
  try { db.setAll(table, dataArray); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
}
function safeDbDeleteById(table, id) {
  if (!db) return { success: false, error: dbError ? dbError.message : 'DB not available' };
  try { db.deleteById(table, id); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
}
function safeDbGetCounter(key) {
  if (!db) return { success: false, error: dbError ? dbError.message : 'DB not available' };
  try { return { success: true, data: db.getCounter(key) }; }
  catch (err) { return { success: false, error: err.message }; }
}
function safeDbSetCounter(key, value) {
  if (!db) return { success: false, error: dbError ? dbError.message : 'DB not available' };
  try { db.setCounter(key, value); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
}
function safeDbGetKV(key) {
  if (!db) return { success: false, error: dbError ? dbError.message : 'DB not available' };
  try { return { success: true, data: db.getKV(key) }; }
  catch (err) { return { success: false, error: err.message }; }
}
function safeDbSetKV(key, value) {
  if (!db) return { success: false, error: dbError ? dbError.message : 'DB not available' };
  try { db.setKV(key, value); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
}
function safeDbBackup(filePath) {
  if (!db) return { success: false, error: dbError ? dbError.message : 'DB not available' };
  try { db.backup(filePath); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
}
function safeDbGetPath() {
  if (!db) return { success: false, error: 'DB not available' };
  try { return { success: true, data: db.getDbPath() }; }
  catch (err) { return { success: false, error: err.message }; }
}

// ============================================================
// AUTO-UPDATER
// ============================================================
let mainWindow = null;
let licenseWindow = null;
let updateDownloaded = false;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
const GH_TOKEN = process.env.GH_TOKEN || '';
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'mohsin-rasheedbaga',
  repo: 'baga-hms',
  token: GH_TOKEN
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
  sendToAllWindows('update-status', { status: 'downloading', percent });
});
autoUpdater.on('update-downloaded', (info) => {
  updateDownloaded = true;
  sendToAllWindows('update-status', { status: 'downloaded', version: info.version });
  dialog.showMessageBox({
    type: 'info', title: 'Update Downloaded',
    message: `Version ${info.version} has been downloaded.`,
    detail: 'Restart now to install?',
    buttons: ['Restart Now', 'Later']
  }).then((result) => {
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
});
autoUpdater.on('error', (err) => {
  console.error('[AutoUpdate] Error:', err.message);
  sendToAllWindows('update-status', { status: 'error', message: err.message });
});

function sendToAllWindows(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
  if (licenseWindow && !licenseWindow.isDestroyed()) licenseWindow.webContents.send(channel, data);
}

function checkForUpdates() {
  try { autoUpdater.checkForUpdates().catch(() => {}); } catch (e) {}
}

// ============================================================
// HTTP SERVER (serves Next.js static export from out/)
// ============================================================
let serverInstance = null;

function startServer() {
  // Resolve out directory - works in both dev and packaged app
  let outDir = path.join(__dirname, '..', 'out');

  // In packaged asar, __dirname is inside app.asar/electron/
  // Verify the out directory exists
  if (!fs.existsSync(outDir)) {
    console.warn('[Server] out/ not found at:', outDir);
    // Try alternative: resources/app/out (unpacked)
    outDir = path.join(process.resourcesPath, 'app', 'out');
    console.warn('[Server] Trying:', outDir);
  }

  const server = http.createServer((req, res) => {
    try {
      // Decode the URL to handle encoded characters
      const decodedUrl = decodeURIComponent(req.url.split('?')[0]);
      let filePath = path.join(outDir, decodedUrl === '/' ? 'index.html' : decodedUrl);

      // Security: ensure we don't escape the out directory
      if (!filePath.startsWith(outDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        if (!filePath.endsWith('.html') && !filePath.endsWith('/')) {
          const htmlPath = filePath + '.html';
          if (fs.existsSync(htmlPath)) {
            filePath = htmlPath;
          } else {
            const indexPath = path.join(filePath, 'index.html');
            if (fs.existsSync(indexPath)) {
              filePath = indexPath;
            } else {
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
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.txt': 'text/plain; charset=utf-8',
        '.map': 'application/json',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          console.error('[Server] File not found:', filePath);
          res.writeHead(404);
          res.end('Not Found: ' + decodedUrl);
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    } catch (err) {
      console.error('[Server] Error:', err);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(SERVER_PORT, '127.0.0.1', () => {
      console.log(`[Server] Running on http://127.0.0.1:${SERVER_PORT}`);
      console.log(`[Server] Serving from: ${outDir}`);
      resolve(server);
    });
    server.on('error', (err) => {
      console.error('[Server] Failed to start:', err.message);
      reject(err);
    });
  });
}

// ============================================================
// ERROR/FALLBACK WINDOW
// ============================================================
function showErrorWindow(title, message, details) {
  const errorWin = new BrowserWindow({
    width: 600,
    height: 400,
    title: 'BAGA HMS - Error',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });
  errorWin.setMenuBarVisibility(true);

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Error</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; padding: 30px; background: #fef2f2; color: #991b1b; }
  h1 { font-size: 20px; margin-bottom: 15px; }
  p { font-size: 14px; line-height: 1.6; margin-bottom: 10px; }
  .details { background: #fff; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin-top: 15px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
  button { margin-top: 15px; padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
  button:hover { background: #b91c1c; }
</style></head><body>
  <h1>${title}</h1>
  <p>${message}</p>
  ${details ? '<div class="details">' + details.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' : ''}
  <button onclick="require('electron').ipcRenderer.send('quit-app')">Close Application</button>
</body></html>`;

  errorWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
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
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  const licenseHtmlPath = path.join(__dirname, 'license.html');
  console.log('[Window] Loading license from:', licenseHtmlPath);

  licenseWindow.loadFile(licenseHtmlPath).then(() => {
    licenseWindow.show();
    licenseWindow.setMenuBarVisibility(false);
  }).catch((err) => {
    console.error('[Window] Failed to load license.html:', err.message);
    // Show fallback license UI
    licenseWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>BAGA HMS</title></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:linear-gradient(135deg,#059669,#0d9488,#0284c7)">
        <div style="background:white;border-radius:20px;padding:40px;text-align:center;max-width:500px">
          <h2 style="color:#1f2937">BAGA Hospital Management System</h2>
          <p style="color:#6b7280;margin:20px 0">License activation required</p>
          <p style="color:#dc2626;font-size:13px">Could not load license UI. Please restart the app.</p>
        </div>
      </body></html>
    `));
    licenseWindow.show();
  });

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
    show: false,
    backgroundColor: '#f9fafb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}`).then(() => {
    mainWindow.show();
    mainWindow.setMenuBarVisibility(false);
  }).catch((err) => {
    console.error('[Window] Failed to load main URL:', err.message);
    // Show error in window
    mainWindow.show();
    mainWindow.setMenuBarVisibility(true);
    mainWindow.webContents.executeJavaScript(`
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#dc2626;text-align:center"><div><h2>Failed to load application</h2><p>Please restart the app. Error: ${err.message}</p></div></div>';
    `);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(checkForUpdates, 3000);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Renderer] Process crashed:', details);
    showErrorWindow('Application Error', 'The application window crashed. Please restart.', `Reason: ${details.reason}`);
  });

  // Open DevTools for debugging (remove in production if needed)
  // mainWindow.webContents.openDevTools();
}

// ============================================================
// IPC HANDLERS - LICENSE MANAGEMENT
// ============================================================

ipcMain.handle('license-get-info', async () => {
  const store = getStore();
  const licenseInfo = store.license || null;
  return {
    machineId: getMachineId(),
    license: licenseInfo,
    version: APP_VERSION,
    dbStatus: db ? 'sqlite' : 'localStorage',
    dbError: dbError ? dbError.message : null,
  };
});

ipcMain.handle('license-activate', async (event, licenseKey) => {
  try {
    const machineId = getMachineId();
    const store = getStore();
    console.log('[License] Activating:', licenseKey, 'Machine:', machineId);

    const response = await fetch(`${API_BASE}/api/license/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: licenseKey, machine_id: machineId }),
    });

    const data = await response.json();
    console.log('[License] API response:', JSON.stringify(data));

    if (data.valid) {
      // Determine license type from features
      let licenseType = 'hospital';
      const features = data.features || [];
      if (features.length === 1 && features[0] === 'pharmacy') {
        licenseType = 'pharmacy';
      } else if (features.length === 1 && features[0] === 'lab') {
        licenseType = 'lab';
      } else if (features.includes('clinic')) {
        licenseType = 'clinic';
      }

      // Download logo if URL exists
      let logoPath = '';
      if (data.logo_url) {
        try {
          const logoResponse = await fetch(data.logo_url);
          if (logoResponse.ok) {
            const logoBuffer = await logoResponse.arrayBuffer();
            logoPath = path.join(app.getPath('userData'), 'hospital-logo.png');
            fs.writeFileSync(logoPath, Buffer.from(logoBuffer));
            console.log('[License] Logo downloaded to:', logoPath);
          }
        } catch (logoErr) {
          console.error('[License] Logo download failed:', logoErr.message);
        }
      }

      store.license = {
        key: licenseKey,
        hospitalName: data.hospital_name,
        hospitalId: data.hospital_id,
        features: data.features || [],
        licenseType: licenseType,
        licenseDuration: data.license_duration,
        expiryDate: data.expiry_date,
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        mobile: data.mobile || '',
        logoUrl: data.logo_url || '',
        logoPath: logoPath,
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

ipcMain.handle('license-reset', async () => {
  const store = getStore();
  store.license = null;
  saveStore(store);
  return { success: true };
});

ipcMain.handle('demo-activate', async () => {
  try {
    const store = getStore();
    const machineId = getMachineId();
    
    // Check if demo was already used
    if (store.demo && store.demo.blocked) {
      return { success: false, error: 'Demo period has expired. Please purchase a license to continue using the software.' };
    }
    
    if (store.demo && store.demo.activatedAt) {
      // Demo already activated - check if expired
      const now = new Date();
      const expiresAt = new Date(store.demo.expiresAt);
      if (now > expiresAt) {
        // Demo expired - block it permanently
        store.demo.blocked = true;
        store.demo.expiredAt = now.toISOString();
        saveStore(store);
        return { success: false, error: 'Demo period has expired. Please purchase a license to continue using the software.' };
      }
      // Demo still active
      return { success: true, data: { ...store.demo, remaining: Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) } };
    }
    
    // First time demo activation
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
    
    store.demo = {
      activated: true,
      activatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      blocked: false,
    };
    saveStore(store);
    
    return { 
      success: true, 
      data: { 
        ...store.demo, 
        remaining: 3,
        message: 'Demo activated for 3 days. Full access to all features.' 
      } 
    };
  } catch (error) {
    console.error('[Demo] Activation error:', error);
    return { success: false, error: 'Failed to activate demo' };
  }
});

ipcMain.handle('demo-get-status', async () => {
  try {
    const store = getStore();
    const demo = store.demo || null;
    
    if (!demo || !demo.activated) {
      return { active: false, blocked: false, message: 'Demo not activated' };
    }
    
    if (demo.blocked) {
      return { active: false, blocked: true, message: 'Demo period has expired. Please purchase a license.' };
    }
    
    const now = new Date();
    const expiresAt = new Date(demo.expiresAt);
    
    if (now > expiresAt) {
      // Auto-block expired demo
      store.demo.blocked = true;
      store.demo.expiredAt = now.toISOString();
      saveStore(store);
      return { active: false, blocked: true, message: 'Demo period has expired. Please purchase a license.' };
    }
    
    const remaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
    return { 
      active: true, 
      blocked: false, 
      remaining,
      expiresAt: demo.expiresAt,
      activatedAt: demo.activatedAt,
      message: `Demo active - ${remaining} day(s) remaining`
    };
  } catch (error) {
    return { active: false, blocked: false, message: 'Error checking demo status' };
  }
});

ipcMain.handle('demo-reset', async () => {
  // This is only for development/testing - normally demo cannot be reset
  const store = getStore();
  store.demo = null;
  saveStore(store);
  return { success: true };
});

ipcMain.handle('license-get-full-info', async () => {
  const store = getStore();
  const license = store.license || null;
  const demo = store.demo || null;
  
  // Determine mode
  let mode = 'none'; // 'licensed', 'demo', 'none'
  let licenseType = 'hospital';
  let features = [];
  
  if (demo && demo.activated && !demo.blocked) {
    const now = new Date();
    const expiresAt = new Date(demo.expiresAt);
    if (now <= expiresAt) {
      mode = 'demo';
      licenseType = 'hospital'; // Demo has full access
      features = ['all'];
    }
  }
  
  if (license) {
    mode = 'licensed';
    licenseType = license.licenseType || 'hospital';
    features = license.features || [];
    
    // Check license expiry
    if (license.expiryDate && license.licenseDuration !== 'lifetime') {
      const now = new Date();
      const expiry = new Date(license.expiryDate);
      if (now > expiry) {
        return {
          mode: 'expired',
          licenseType,
          features: [],
          expired: true,
          expiryDate: license.expiryDate,
          hospitalName: license.hospitalName,
          error: 'License has expired. Please contact support to renew.',
        };
      }
    }
  }
  
  return {
    mode,
    licenseType,
    features,
    expired: false,
    hospitalName: license ? license.hospitalName : (mode === 'demo' ? 'BAGA Hospital (Demo)' : ''),
    hospitalAddress: license ? license.address : '',
    hospitalPhone: license ? license.phone : '',
    hospitalEmail: license ? (license.email || '') : '',
    hospitalMobile: license ? (license.mobile || '') : '',
    logoUrl: license ? (license.logoUrl || '') : '',
    logoPath: license ? (license.logoPath || '') : '',
    licenseKey: license ? license.key : null,
    expiryDate: license ? license.expiryDate : null,
    licenseDuration: license ? license.licenseDuration : null,
    demo: mode === 'demo' ? {
      remaining: Math.ceil((new Date(demo.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)),
      expiresAt: demo.expiresAt,
    } : null,
  };
});

// ============================================================
// IPC HANDLERS - LOGIN
// ============================================================

ipcMain.handle('api-login', async (event, { username, password }) => {
  try {
    const store = getStore();
    const licenseKey = store.license ? store.license.key : null;
    console.log('[Login] Attempt:', username, 'License:', licenseKey ? 'yes' : 'no');

    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, license_key: licenseKey }),
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

ipcMain.handle('get-app-version', () => APP_VERSION);
ipcMain.handle('get-machine-id', () => getMachineId());
ipcMain.handle('get-api-base', () => API_BASE);
ipcMain.handle('check-update', () => { checkForUpdates(); return { checking: true }; });
ipcMain.handle('quit-app', () => app.quit());

// Serve hospital logo as base64 for renderer
ipcMain.handle('get-logo-base64', () => {
  try {
    const store = getStore();
    const license = store.license;
    if (!license || !license.logoPath) return { success: false };
    const logoPath = license.logoPath;
    if (!fs.existsSync(logoPath)) return { success: false };
    const buffer = fs.readFileSync(logoPath);
    const base64 = buffer.toString('base64');
    const ext = path.extname(logoPath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'image/png';
    return { success: true, data: `data:${mime};base64,${base64}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle('db-status', () => ({
  available: !!db,
  error: dbError ? dbError.message : null,
  path: db ? safeDbGetPath().data : null,
}));

// ============================================================
// DATABASE IPC HANDLERS (safe wrappers)
// ============================================================

ipcMain.on('db-get-all', (event, table) => { event.returnValue = safeDbGetAll(table); });
ipcMain.on('db-get-by-id', (event, table, id) => { event.returnValue = safeDbGetById(table, id); });
ipcMain.on('db-set-by-id', (event, table, id, data) => { event.returnValue = safeDbSetById(table, id, data); });
ipcMain.on('db-set-all', (event, table, dataArray) => { event.returnValue = safeDbSetAll(table, dataArray); });
ipcMain.on('db-delete-by-id', (event, table, id) => { event.returnValue = safeDbDeleteById(table, id); });
ipcMain.on('db-get-counter', (event, key) => { event.returnValue = safeDbGetCounter(key); });
ipcMain.on('db-set-counter', (event, key, value) => { event.returnValue = safeDbSetCounter(key, value); });
ipcMain.on('db-get-kv', (event, key) => { event.returnValue = safeDbGetKV(key); });
ipcMain.on('db-set-kv', (event, key, value) => { event.returnValue = safeDbSetKV(key, value); });
ipcMain.on('db-backup', (event, filePath) => { event.returnValue = safeDbBackup(filePath); });
ipcMain.on('db-get-path', (event) => { event.returnValue = safeDbGetPath(); });

// ============================================================
// WINDOW MANAGEMENT
// ============================================================

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
  console.log('='.repeat(60));
  console.log(`[BAGA HMS] v${APP_VERSION} starting...`);
  console.log(`[BAGA HMS] Electron: ${process.versions.electron}`);
  console.log(`[BAGA HMS] Node: ${process.versions.node}`);
  console.log(`[BAGA HMS] Platform: ${process.platform} ${process.arch}`);
  console.log(`[BAGA HMS] Machine ID: ${getMachineId()}`);
  console.log(`[BAGA HMS] __dirname: ${__dirname}`);
  console.log(`[BAGA HMS] userData: ${app.getPath('userData')}`);
  console.log(`[BAGA HMS] resourcesPath: ${process.resourcesPath || 'N/A'}`);
  console.log('='.repeat(60));

  // 1. Initialize SQLite (non-fatal if it fails)
  initDatabaseSafe();

  // 2. Start HTTP server (non-fatal if it fails)
  try {
    serverInstance = await startServer();
  } catch (serverErr) {
    console.error('[BAGA HMS] HTTP Server failed:', serverErr.message);
    // Try alternative port
    try {
      const altPort = SERVER_PORT + 1;
      console.log(`[BAGA HMS] Trying alternative port: ${altPort}`);
      // We can't easily change the port dynamically, so show error
      showErrorWindow(
        'Server Start Error',
        `Failed to start the internal server on port ${SERVER_PORT}.\n\nPlease make sure no other instance of BAGA HMS is running, then try again.`,
        serverErr.message
      );
      return;
    } catch (e2) {
      showErrorWindow('Fatal Error', 'Cannot start the application.', e2.message);
      return;
    }
  }

  // 3. Check license/demo and show appropriate window
  const store = getStore();
  
  // Check demo mode first
  const demo = store.demo;
  if (demo && demo.activated && !demo.blocked) {
    const now = new Date();
    const expiresAt = new Date(demo.expiresAt);
    if (now <= expiresAt) {
      console.log('[BAGA HMS] Demo mode active. Opening main window.');
      createMainWindow();
    } else {
      // Demo expired - block and show license window
      demo.blocked = true;
      demo.expiredAt = now.toISOString();
      saveStore(store);
      console.log('[BAGA HMS] Demo expired. Showing activation window.');
      createLicenseWindow();
    }
  } else if (!store.license) {
    console.log('[BAGA HMS] No license found. Showing activation window.');
    createLicenseWindow();
  } else {
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
        store.license.hospitalName = data.hospital_name || store.license.hospitalName;
        store.license.features = data.features || store.license.features;
        store.license.expiryDate = data.expiry_date || store.license.expiryDate;
        store.license.address = data.address || store.license.address;
        store.license.phone = data.phone || store.license.phone;
        store.license.email = data.email || store.license.email || '';
        store.license.mobile = data.mobile || store.license.mobile || '';
        if (data.logo_url && data.logo_url !== store.license.logoUrl) {
          store.license.logoUrl = data.logo_url;
          // Download updated logo
          try {
            const logoResponse = await fetch(data.logo_url);
            if (logoResponse.ok) {
              const logoBuffer = await logoResponse.arrayBuffer();
              const logoPath = path.join(app.getPath('userData'), 'hospital-logo.png');
              fs.writeFileSync(logoPath, Buffer.from(logoBuffer));
              store.license.logoPath = logoPath;
            }
          } catch (e) {}
        }
        
        // Update license type
        let lt = 'hospital';
        const feats = data.features || [];
        if (feats.length === 1 && feats[0] === 'pharmacy') lt = 'pharmacy';
        else if (feats.length === 1 && feats[0] === 'lab') lt = 'lab';
        else if (feats.includes('clinic')) lt = 'clinic';
        store.license.licenseType = lt;
        
        saveStore(store);
        console.log('[BAGA HMS] License valid. Opening main window.');
        createMainWindow();
      } else {
        console.log('[BAGA HMS] License invalid:', data.error);
        store.license = null;
        saveStore(store);
        createLicenseWindow();
      }
    } catch (error) {
      console.error('[BAGA HMS] License validation failed (offline?):', error.message);
      if (store.license) {
        // Check if cached license is expired
        if (store.license.expiryDate && store.license.licenseDuration !== 'lifetime') {
          const now = new Date();
          const expiry = new Date(store.license.expiryDate);
          if (now > expiry) {
            console.log('[BAGA HMS] Cached license expired. Showing activation window.');
            store.license = null;
            saveStore(store);
            createLicenseWindow();
          } else {
            console.log('[BAGA HMS] Allowing offline use with cached license.');
            createMainWindow();
          }
        } else {
          console.log('[BAGA HMS] Allowing offline use with cached license.');
          createMainWindow();
        }
      } else {
        createLicenseWindow();
      }
    }
  }
}).catch((err) => {
  console.error('[BAGA HMS] CRITICAL STARTUP ERROR:', err);
  // Show error window as last resort
  showErrorWindow(
    'Application Failed to Start',
    'A critical error occurred during startup. Please contact support.',
    err.stack || err.message
  );
});

app.on('before-quit', () => {
  try {
    if (serverInstance) serverInstance.close();
    if (db) db.close();
  } catch (e) {}
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      if (!serverInstance) await startServer();
      const store = getStore();
      if (store.license) createMainWindow();
      else createLicenseWindow();
    } catch (e) {
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
