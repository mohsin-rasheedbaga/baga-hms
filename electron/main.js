const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
// ============================================================
// CONFIGURATION
// ============================================================
const APP_VERSION = require('../package.json').version;
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
// AUTO-UPDATER (GitHub Releases API — uses Node.js https module, NOT fetch)
// ============================================================
let mainWindow = null;
let licenseWindow = null;
let updateDownloaded = false;

// Log file for auto-update debugging
const UPDATE_LOG = path.join(app.getPath('userData'), 'auto-update.log');
function updateLog(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try { fs.appendFileSync(UPDATE_LOG, line, 'utf8'); } catch (e) {}
  console.log('[AutoUpdate]', msg);
}

// GitHub PAT for private repo - read from config file (not in git for security)
let GH_TOKEN = '';
try {
  const cfgPaths = [
    path.join(app.getPath('userData'), 'baga-config.json'),
    path.join(__dirname, 'config.json'),
  ];
  for (const cp of cfgPaths) {
    if (fs.existsSync(cp)) {
      GH_TOKEN = JSON.parse(fs.readFileSync(cp, 'utf8')).gh_token || '';
      updateLog('GH_TOKEN loaded from: ' + cp);
      break;
    }
  }
} catch (e) { updateLog('No config file found'); }

function sendToAllWindows(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
  if (licenseWindow && !licenseWindow.isDestroyed()) licenseWindow.webContents.send(channel, data);
}

// Compare semver versions: returns 1 if b > a, -1 if b < a, 0 if equal
function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (nb > na) return 1;
    if (nb < na) return -1;
  }
  return 0;
}

// Helper: make HTTPS GET request using Node.js https module (reliable, no fetch needed)
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': 'BAGA-HMS-Updater', ...headers },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

// Helper: download file using Node.js https module (streams to disk — reliable)
function httpsDownload(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': 'BAGA-HMS-Updater' },
    };

    const fileStream = fs.createWriteStream(destPath);
    let receivedBytes = 0;

    const req = https.request(options, (res) => {
      // Handle redirects (GitHub releases use 302)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fileStream.close();
        fs.unlinkSync(destPath);
        updateLog('Following redirect to: ' + res.headers.location);
        httpsDownload(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        fileStream.close();
        fs.unlinkSync(destPath);
        reject(new Error('Download failed: HTTP ' + res.statusCode));
        return;
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0');

      res.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (totalBytes > 0 && onProgress) {
          onProgress(Math.round((receivedBytes / totalBytes) * 100));
        }
      });

      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        updateLog('Downloaded: ' + destPath + ' (' + Math.round(receivedBytes / 1024 / 1024) + 'MB)');
        resolve(receivedBytes);
      });
    });

    req.on('error', (err) => {
      fileStream.close();
      try { fs.unlinkSync(destPath); } catch (e) {}
      reject(err);
    });
    req.setTimeout(600000, () => { // 10 min timeout for large files
      req.destroy();
      fileStream.close();
      try { fs.unlinkSync(destPath); } catch (e) {}
      reject(new Error('Download timeout'));
    });
    req.end();
  });
}

async function checkForUpdates() {
  updateLog('=== UPDATE CHECK START ===');
  updateLog('Token: ' + (GH_TOKEN ? 'SET' : 'EMPTY') + ' | Version: ' + APP_VERSION);
  const now = new Date().toISOString();
  sendToAllWindows('update-status', { status: 'checking', lastChecked: now });

  try {
    // Step 1: Fetch latest release info from GitHub API
    const apiHeaders = { 'Accept': 'application/vnd.github.v3+json' };
    if (GH_TOKEN) apiHeaders['Authorization'] = 'token ' + GH_TOKEN;

    updateLog('Fetching: https://api.github.com/repos/mohsin-rasheedbaga/baga-hms/releases/latest');
    const apiResult = await httpsGet('https://api.github.com/repos/mohsin-rasheedbaga/baga-hms/releases/latest', apiHeaders);

    if (apiResult.statusCode !== 200) {
      updateLog('GitHub API error: HTTP ' + apiResult.statusCode);
      sendToAllWindows('update-status', { status: 'error', message: 'GitHub API error: ' + apiResult.statusCode });
      return;
    }

    let release;
    try {
      release = JSON.parse(apiResult.body);
    } catch (e) {
      updateLog('Failed to parse GitHub response: ' + e.message);
      return;
    }

    const latestVersion = release.tag_name.replace(/^v/, '');
    updateLog('Latest release: ' + latestVersion + ' | Current: ' + APP_VERSION);

    // Version guard: NEVER download older or equal version
    // compareVersions returns 1 if b>a (newer), -1 if b<a (older), 0 if equal
    // Skip update only when installed >= latest (b <= a), i.e. result <= 0
    if (compareVersions(APP_VERSION, latestVersion) <= 0) {
      updateLog('Already up to date (or newer). Installed: ' + APP_VERSION + ', Latest: ' + latestVersion);
      sendToAllWindows('update-status', { status: 'not-available', lastChecked: new Date().toISOString(), version: latestVersion });
      return;
    }

    // Also check latest.yml in assets for accurate version info
    const latestYmlAsset = release.assets.find(a => a.name === 'latest.yml');
    if (latestYmlAsset) {
      updateLog('Found latest.yml in release — version should be: ' + latestVersion);
    } else {
      updateLog('WARNING: No latest.yml in release assets! Auto-update may not work correctly.');
    }

    // Step 2: Find Setup exe for auto-update
    const setupAsset = release.assets.find(a => a.name.includes('Setup') && a.name.endsWith('.exe'));
    const portableAsset = release.assets.find(a => a.name.includes('Portable') && a.name.endsWith('.exe'));
    const downloadAsset = setupAsset || portableAsset;

    if (!downloadAsset) {
      updateLog('No exe asset found in release.');
      sendToAllWindows('update-status', { status: 'error', message: 'No downloadable update found.' });
      return;
    }

    updateLog('Update found: ' + latestVersion + ' — Asset: ' + downloadAsset.name + ' (' + Math.round(downloadAsset.size / 1024 / 1024) + 'MB)');
    sendToAllWindows('update-status', {
      status: 'available',
      version: latestVersion,
      releaseNotes: release.body || '',
    });

    // Step 3: Show notification that download is starting
    try {
      new Notification({
        title: 'BAGA HMS — Update Available',
        body: 'Version ' + latestVersion + ' is downloading...\nPlease keep the app open.',
        silent: false,
      }).show();
    } catch (e) {}

    // Step 4: Download the update
    sendToAllWindows('update-status', { status: 'downloading', percent: 0 });
    const downloadUrl = downloadAsset.browser_download_url;
    updateLog('Downloading: ' + downloadUrl);

    const updatePath = path.join(app.getPath('userData'), 'BAGA-HMS-Update-' + latestVersion + '.exe');

    await httpsDownload(downloadUrl, updatePath, (percent) => {
      sendToAllWindows('update-status', { status: 'downloading', percent });
      updateLog('Download progress: ' + percent + '%');
    });

    updateDownloaded = true;
    updateLog('Download complete! File: ' + updatePath);
    sendToAllWindows('update-status', {
      status: 'downloaded',
      version: latestVersion,
      filePath: updatePath,
    });

    // Step 5: Notify user — show install dialog
    try {
      new Notification({
        title: 'BAGA HMS — Update Ready!',
        body: 'Version ' + latestVersion + ' has been downloaded. Install now!',
        silent: false,
      }).show();
    } catch (e) {}

    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: 'BAGA HMS version ' + latestVersion + ' is ready to install.',
      detail: 'Click "Install Now" to close the app and install the update.\nClick "Later" to install on next launch.',
      buttons: ['Install Now', 'Later'],
      noLink: true,
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      updateLog('User chose Install Now — launching installer...');
      shell.openPath(updatePath);
      app.quit();
    } else {
      updateLog('User chose Later — will install on next launch.');
    }

  } catch (err) {
    updateLog('FAILED: ' + err.message);
    updateLog('Stack: ' + (err.stack || 'N/A'));
    sendToAllWindows('update-status', { status: 'error', message: err.message });

    // Only show error notification for non-network errors (e.g., GitHub auth issues)
    // Silently ignore network/offline errors to avoid annoying the user
    const isNetworkError = err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' ||
                           err.code === 'ENETUNREACH' || err.code === 'ETIMEDOUT' ||
                           err.code === 'ECONNRESET' || err.code === 'ESOCKETTIMEDOUT' ||
                           (err.message && err.message.includes('network')) ||
                           (err.message && err.message.includes('ENOTFOUND'));
    if (!isNetworkError) {
      try {
        new Notification({
          title: 'BAGA HMS — Update Check Failed',
          body: err.message,
          silent: false,
        }).show();
      } catch (e) {}
    } else {
      updateLog('Silently ignoring network error (user is likely offline)');
    }
  }
}

// ============================================================
// LAN SHARING API HANDLER
// ============================================================
function handleLanApi(req, res, url, method) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const sendJson = (code, data) => { res.writeHead(code); res.end(JSON.stringify(data)); };
  const readBody = (callback) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { callback(JSON.parse(body)); } catch { callback({}); } });
  };

  // GET /api/license-info
  if (url === '/api/license-info' && method === 'GET') {
    const store = getStore();
    const license = store.license || null;
    const demo = store.demo || null;
    let mode = 'none', licenseType = 'hospital', features = [];

    if (demo && demo.activated && !demo.blocked) {
      const now = new Date(), expiresAt = new Date(demo.expiresAt);
      if (now <= expiresAt) { mode = 'demo'; licenseType = 'hospital'; features = ['all']; }
    }
    if (license) {
      mode = 'licensed';
      licenseType = license.licenseType || 'hospital';
      features = license.features || [];
      if (license.expiryDate && license.licenseDuration !== 'lifetime') {
        if (new Date() > new Date(license.expiryDate)) {
          return sendJson(200, { mode: 'expired', licenseType, features: [], expired: true, expiryDate: license.expiryDate, hospitalName: license.hospitalName });
        }
      }
    }
    return sendJson(200, {
      mode, licenseType, features, expired: false,
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
      activatedAt: license ? license.activatedAt : null,
      demo: mode === 'demo' ? { remaining: Math.ceil((new Date(demo.expiresAt) - new Date()) / 86400000), expiresAt: demo.expiresAt } : null,
    });
  }

  // POST /api/login
  if (url === '/api/login' && method === 'POST') {
    return readBody(({ username, password }) => {
      if (!username || !password) return sendJson(400, { success: false, error: 'Missing credentials' });
      try {
        const users = db ? db.getAll('users') : null;
        if (!users) return sendJson(200, { success: false, error: 'Database not available' });
        const user = users.find(u => u.email === username.trim() && u.password === password.trim() && u.active !== false);
        if (!user) return sendJson(200, { success: false, error: 'Invalid Login ID or Password' });
        return sendJson(200, {
          success: true,
          user: { id: user.id, name: user.name, role: user.role, department: user.department || '', email: user.email, active: user.active, permissions: user.permissions || ['all'] },
        });
      } catch (err) { return sendJson(500, { success: false, error: err.message }); }
    });
  }

  // GET /api/db/:table
  if (url.startsWith('/api/db/') && !url.includes('/kv/') && method === 'GET') {
    const table = url.replace('/api/db/', '');
    const allowed = ['hospital','hospital_settings','users','patients','medicines','prescriptions','bills','appointments','admissions','lab_orders','lab_test_catalog','room_types','employees','attendance','salaries','xray_orders','ultrasound_orders','dispenses','visits'];
    if (!allowed.includes(table)) return sendJson(403, { success: false, error: 'Forbidden' });
    try {
      const data = db ? db.getAll(table) : null;
      sendJson(200, { success: true, data: data || [] });
    } catch (err) { sendJson(500, { success: false, error: err.message }); }
    return;
  }

  // POST /api/db/:table
  if (url.startsWith('/api/db/') && method === 'POST') {
    const table = url.replace('/api/db/', '');
    const allowed = ['hospital','hospital_settings','users','patients','medicines','prescriptions','bills','appointments','admissions','lab_orders','lab_test_catalog','room_types','employees','attendance','salaries','xray_orders','ultrasound_orders','dispenses','visits'];
    if (!allowed.includes(table)) return sendJson(403, { success: false, error: 'Forbidden' });
    return readBody(({ data }) => {
      if (!Array.isArray(data)) return sendJson(400, { success: false, error: 'Data must be array' });
      try { if (db) { db.setAll(table, data); sendJson(200, { success: true }); } else sendJson(500, { success: false, error: 'DB not available' }); }
      catch (err) { sendJson(500, { success: false, error: err.message }); }
    });
  }

  // GET /api/kv/:key
  if (url.startsWith('/api/kv/') && method === 'GET') {
    const key = url.replace('/api/kv/', '');
    try { const val = db ? db.getKV(key) : null; sendJson(200, { success: true, data: val || null }); }
    catch (err) { sendJson(500, { success: false, error: err.message }); }
    return;
  }

  // POST /api/kv/:key
  if (url.startsWith('/api/kv/') && method === 'POST') {
    const key = url.replace('/api/kv/', '');
    return readBody(({ value }) => {
      try { if (db) { db.setKV(key, typeof value === 'string' ? value : JSON.stringify(value)); sendJson(200, { success: true }); } else sendJson(500, { success: false, error: 'DB not available' }); }
      catch (err) { sendJson(500, { success: false, error: err.message }); }
    });
  }

  // GET /api/counter/:key
  if (url.startsWith('/api/counter/') && method === 'GET') {
    const key = url.replace('/api/counter/', '');
    try { const val = db ? db.getCounter(key) : null; sendJson(200, { success: true, data: val !== null ? val : 0 }); }
    catch (err) { sendJson(500, { success: false, error: err.message }); }
    return;
  }

  // POST /api/counter/:key
  if (url.startsWith('/api/counter/') && method === 'POST') {
    const key = url.replace('/api/counter/', '');
    return readBody(({ value }) => {
      try { if (db) { db.setCounter(key, value); sendJson(200, { success: true }); } else sendJson(500, { success: false, error: 'DB not available' }); }
      catch (err) { sendJson(500, { success: false, error: err.message }); }
    });
  }

  sendJson(404, { error: 'API endpoint not found' });
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
      // Add headers for LAN sharing support
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Decode the URL to handle encoded characters
      const decodedUrl = decodeURIComponent(req.url.split('?')[0]);

      // ==================== API ROUTES FOR LAN SHARING ====================
      if (decodedUrl.startsWith('/api/')) {
        handleLanApi(req, res, decodedUrl, req.method);
        return;
      }
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
    server.listen(SERVER_PORT, '0.0.0.0', () => {
      console.log(`[Server] Running on http://0.0.0.0:${SERVER_PORT}`);
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
    updateLog('MAIN WINDOW DID FINISH LOAD — scheduling auto-update check in 3s');
    sendToAllWindows('update-status', { status: 'idle', lastChecked: null });
    setTimeout(() => {
      updateLog('AUTO UPDATE CHECK TRIGGERED (3s after load)');
      sendToAllWindows('update-status', { status: 'checking', lastChecked: new Date().toISOString() });
      checkForUpdates();
    }, 3000);
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
    activatedAt: license ? license.activatedAt : null,
    demo: mode === 'demo' ? {
      remaining: Math.ceil((new Date(demo.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)),
      expiresAt: demo.expiresAt,
    } : null,
  };
});

// ============================================================
// IPC HANDLERS - APP CONFIG
// ============================================================

ipcMain.handle('save-app-config', async (event, config) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'baga-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    // Also save to electron dir for dev mode
    try {
      const devPath = path.join(__dirname, 'config.json');
      if (__dirname.includes('baga-hms')) {
        fs.writeFileSync(devPath, JSON.stringify(config, null, 2), 'utf8');
      }
    } catch (e) {}
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-app-config', () => {
  try {
    const cfgPaths = [
      path.join(app.getPath('userData'), 'baga-config.json'),
      path.join(__dirname, 'config.json'),
    ];
    for (const cp of cfgPaths) {
      if (fs.existsSync(cp)) return JSON.parse(fs.readFileSync(cp, 'utf8'));
    }
  } catch (e) {}
  return {};
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

// Get local IP address for LAN sharing
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

ipcMain.handle('get-lan-info', () => {
  return {
    port: SERVER_PORT,
    localIP: getLocalIP(),
    lanURL: `http://${getLocalIP()}:${SERVER_PORT}`,
  };
});
ipcMain.handle('check-update', () => {
  updateLog('CHECK-UPDATE IPC INVOKED');
  checkForUpdates();
  return { checking: true };
});
ipcMain.handle('manual-check-update', async () => {
  updateLog('MANUAL UPDATE CHECK STARTED');
  // Send immediate status update so UI shows "checking" right away
  sendToAllWindows('update-status', { status: 'checking', lastChecked: new Date().toISOString() });
  try {
    await checkForUpdates();
    updateLog('MANUAL UPDATE CHECK FINISHED');
  } catch (err) {
    updateLog('MANUAL UPDATE CHECK FAILED: ' + (err && err.message ? err.message : String(err)));
    updateLog('Error code: ' + (err && err.code ? err.code : 'N/A'));
    updateLog('Error stack: ' + (err && err.stack ? err.stack : 'N/A'));
    sendToAllWindows('update-status', {
      status: 'error',
      message: err.message,
      code: err.code,
      stack: err.stack,
      lastChecked: new Date().toISOString(),
    });
  }
  return { checking: true };
});
ipcMain.handle('quit-app', () => app.quit());
ipcMain.handle('open-update-file', async (event, filePath) => {
  if (!filePath) {
    // If no path provided, find the latest downloaded update
    const userDataPath = app.getPath('userData');
    const fs = require('fs');
    const path = require('path');
    try {
      const files = fs.readdirSync(userDataPath).filter(f => f.startsWith('BAGA-HMS-Update-') && f.endsWith('.exe'));
      if (files.length > 0) {
        files.sort().reverse(); // newest first
        filePath = path.join(userDataPath, files[0]);
      }
    } catch (e) {}
  }
  if (!filePath) return { success: false, error: 'No update file found' };
  try {
    const { shell } = require('electron');
    await shell.openPath(filePath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ============================================================
// IPC HANDLERS - PRINT (Native Electron Print Dialog)
// ============================================================

ipcMain.handle('print-html', async (event, htmlContent) => {
  return new Promise((resolve) => {
    try {
      // Write HTML to temp file — data:text/html URLs have a ~2MB limit
      // that causes silent failures on large print content (receipts with logos, etc.)
      const tmpPath = path.join(app.getPath('temp'), `baga-print-${Date.now()}.html`);
      fs.writeFileSync(tmpPath, htmlContent, 'utf8');
      console.log('[Print] Temp file:', tmpPath, 'Size:', (htmlContent.length / 1024).toFixed(1) + 'KB');

      const printWin = new BrowserWindow({
        width: 1024,
        height: 768,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      let handled = false;
      const cleanup = (success, reason) => {
        if (handled) return;
        handled = true;
        try { if (!printWin.isDestroyed()) printWin.destroy(); } catch (e) {}
        try { fs.unlinkSync(tmpPath); } catch (e) {}
        console.log('[Print]', success ? 'OK' : 'FAIL', '-', reason || 'none');
        resolve({ success, reason });
      };

      printWin.loadFile(tmpPath).then(() => {
        // Give time for CSS/fonts to render before printing
        setTimeout(() => {
          if (printWin.isDestroyed()) { cleanup(false, 'Window destroyed before print'); return; }

          // Use window.print() via executeJavaScript — most reliable on all platforms.
          // webContents.print() callback has known bugs on Windows where it never fires.
          printWin.webContents.executeJavaScript('window.print()').then(() => {
            // window.print() was called — print dialog is now shown (or system handled it).
            // Wait a reasonable time for user to interact with dialog, then clean up.
            console.log('[Print] window.print() executed, waiting for dialog...');
            setTimeout(() => cleanup(true, 'Print dialog shown'), 5000);
          }).catch((execErr) => {
            console.error('[Print] executeJavaScript failed:', execErr.message);
            // Fallback: try webContents.print()
            printWin.webContents.print({
              silent: false,
              printBackground: true,
              margins: { marginType: 0 },
            }, (success, reason) => {
              cleanup(success || false, reason);
            });
            // Fallback timeout for webContents.print callback not firing (Windows bug)
            setTimeout(() => cleanup(true, 'Print dialog shown (fallback)'), 15000);
          });
        }, 800); // 800ms for CSS/layout rendering
      }).catch((err) => {
        console.error('[Print] loadFile failed:', err.message);
        cleanup(false, err.message);
      });

      // Absolute safety timeout — 30 seconds
      setTimeout(() => cleanup(false, 'Print timed out'), 30000);

    } catch (err) {
      resolve({ success: false, reason: err.message });
    }
  });
});

// ============================================================
// IPC HANDLERS - CUSTOM LOGO UPLOAD
// ============================================================

// Native file picker dialog for logo selection
ipcMain.handle('select-logo-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Select Hospital Logo',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    const filePath = result.filePaths[0];
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'image/png';
    const base64 = `data:${mime};base64,${buffer.toString('base64')}`;
    return { success: true, data: base64, mimeType: mime, fileName: path.basename(filePath) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-logo', async (event, base64Data, mimeType) => {
  try {
    const store = getStore();
    const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/jpeg' ? '.jpg' : '.png';
    const logoPath = path.join(app.getPath('userData'), 'hospital-logo-custom' + ext);
    
    // Remove base64 prefix if present
    const rawBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(rawBase64, 'base64');
    fs.writeFileSync(logoPath, buffer);
    
    // Update store to use custom logo
    if (store.license) {
      store.license.logoPath = logoPath;
      saveStore(store);
    } else {
      // Save a reference even without license for demo mode
      if (!store.customLogo) store.customLogo = {};
      store.customLogo.path = logoPath;
      saveStore(store);
    }
    
    return { success: true, path: logoPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('remove-logo', async () => {
  try {
    const store = getStore();
    // Remove custom logo file
    const customLogoPath = path.join(app.getPath('userData'), 'hospital-logo-custom.png');
    const customLogoJpg = path.join(app.getPath('userData'), 'hospital-logo-custom.jpg');
    if (fs.existsSync(customLogoPath)) fs.unlinkSync(customLogoPath);
    if (fs.existsSync(customLogoJpg)) fs.unlinkSync(customLogoJpg);
    
    // Clear reference but keep original license logo if any
    if (store.license) {
      // If there was an original license logo, restore it
      const origLogoPath = path.join(app.getPath('userData'), 'hospital-logo.png');
      if (fs.existsSync(origLogoPath)) {
        store.license.logoPath = origLogoPath;
      } else {
        store.license.logoPath = '';
      }
      saveStore(store);
    }
    if (store.customLogo) {
      delete store.customLogo.path;
      saveStore(store);
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Serve hospital logo as base64 for renderer (supports both license logo and custom logo)
ipcMain.handle('get-logo-base64', () => {
  try {
    const store = getStore();
    let logoPath = '';
    
    // Check custom logo first
    const customPng = path.join(app.getPath('userData'), 'hospital-logo-custom.png');
    const customJpg = path.join(app.getPath('userData'), 'hospital-logo-custom.jpg');
    if (fs.existsSync(customPng)) logoPath = customPng;
    else if (fs.existsSync(customJpg)) logoPath = customJpg;
    else if (store.license && store.license.logoPath) logoPath = store.license.logoPath;
    
    if (!logoPath || !fs.existsSync(logoPath)) return { success: false };
    const buffer = fs.readFileSync(logoPath);
    const base64 = buffer.toString('base64');
    const ext = path.extname(logoPath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'image/png';
    return { success: true, data: `data:${mime};base64,${base64}`, isCustom: logoPath.includes('custom') };
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
    // Auto-configure Windows Firewall for LAN sharing
    try {
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        try {
          execSync(`netsh advfirewall firewall add rule name="BAGA HMS Server" dir=in action=allow protocol=TCP localport=${SERVER_PORT}`, { stdio: 'ignore' });
          console.log('[Firewall] Rule added for LAN sharing on port', SERVER_PORT);
        } catch (fe) {
          // Rule may already exist - that's fine
          console.log('[Firewall] Firewall rule setup:', fe.message?.substring(0, 80) || 'skipped');
        }
      }
    } catch (fwErr) {
      console.log('[Firewall] Could not auto-configure firewall:', fwErr.message);
    }
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
        console.log('[BAGA HMS] License invalid/expired:', data.error);
        // Keep license data for master login access - mark as expired
        store.license._offlineExpired = true;
        store.license._apiInvalid = true;
        saveStore(store);
        console.log('[BAGA HMS] License invalid but keeping data for master login. Opening main window.');
        createMainWindow();
      }
    } catch (error) {
      console.error('[BAGA HMS] License validation failed (offline?):', error.message);
      if (store.license) {
        // Check if cached license is expired
        if (store.license.expiryDate && store.license.licenseDuration !== 'lifetime') {
          const now = new Date();
          const expiry = new Date(store.license.expiryDate);
          if (now > expiry) {
            // DON'T delete license - allow master login access for emergency
            console.log('[BAGA HMS] Cached license expired but offline. Opening main window for master login access.');
            store.license._offlineExpired = true;
            saveStore(store);
            createMainWindow();
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
  // Clear session data on quit — forces re-login on next launch
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.session.clearStorageData({
        storages: ['localstorage', 'sessionstorage'],
      });
    }
    if (db) {
      safeDbSetKV('baga_session', '');
    }
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
