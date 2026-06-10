const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const dgram = require('dgram');
const { autoUpdater } = require('electron-updater');
// ============================================================
// CONFIGURATION
// ============================================================
const APP_VERSION = '3.3.1';
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
// AUTO-UPDATER (electron-updater — proper NSIS auto-update)
// ============================================================
let mainWindow = null;
let licenseWindow = null;

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

// Helper: make HTTP GET request (for services that don't support HTTPS, e.g. ip-api.com free tier)
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 80,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': 'BAGA-HMS', ...headers },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('HTTP request timeout')); });
    req.end();
  });
}

// Helper: make HTTP POST request (for LAN client requests)
function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': 'BAGA-HMS',
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(bodyStr);
    req.end();
  });
}

// ============================================================
// CONFIGURE electron-updater autoUpdater
// ============================================================
function configureAutoUpdater() {
  // Set the GitHub provider and authentication token
  if (GH_TOKEN) {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'mohsin-rasheedbaga',
      repo: 'baga-hms',
      token: GH_TOKEN,
    });
    updateLog('autoUpdater configured with GH_TOKEN for GitHub provider');
  } else {
    // For public repo, token is optional but helps with rate limits
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'mohsin-rasheedbaga',
      repo: 'baga-hms',
    });
    updateLog('autoUpdater configured for GitHub provider (no token)');
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = {
    info: (msg) => updateLog('INFO: ' + msg),
    warn: (msg) => updateLog('WARN: ' + msg),
    error: (msg) => updateLog('ERROR: ' + msg),
    debug: (msg) => updateLog('DEBUG: ' + msg),
  };
  updateLog('autoUpdater configured. Current version: ' + autoUpdater.currentVersion.getVersion());

  // ---- Event: Checking for update ----
  autoUpdater.on('checking-for-update', () => {
    updateLog('Checking for updates...');
    sendToAllWindows('update-status', { status: 'checking' });
  });

  // ---- Event: Update available ----
  autoUpdater.on('update-available', (info) => {
    updateLog('Update available: ' + info.version + ' (release notes: ' + (info.releaseNotes || 'N/A').substring(0, 100) + ')');
    sendToAllWindows('update-status', {
      status: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : JSON.stringify(info.releaseNotes || ''),
    });

    // Show system notification
    try {
      new Notification({
        title: 'BAGA HMS — Update Available',
        body: 'Version ' + info.version + ' is downloading...\nPlease keep the app open.',
        silent: false,
      }).show();
    } catch (e) {}
  });

  // ---- Event: Update NOT available ----
  autoUpdater.on('update-not-available', (info) => {
    updateLog('No update available. Current: ' + info.currentVersion + ' Latest: ' + info.latestVersion);
    sendToAllWindows('update-status', { status: 'not-available', currentVersion: info.currentVersion });
  });

  // ---- Event: Download progress ----
  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    updateLog('Download progress: ' + percent + '% (' + Math.round(progress.transferred / 1024 / 1024) + 'MB / ' + Math.round(progress.total / 1024 / 1024) + 'MB)');
    sendToAllWindows('update-status', {
      status: 'downloading',
      percent: percent,
      transferred: Math.round(progress.transferred / 1024 / 1024),
      total: Math.round(progress.total / 1024 / 1024),
      bytesPerSecond: Math.round(progress.bytesPerSecond / 1024),
    });
  });

  // ---- Event: Update downloaded ----
  autoUpdater.on('update-downloaded', (info) => {
    updateLog('Update downloaded: ' + info.version + ' — File: ' + info.downloadedFile);
    sendToAllWindows('update-status', {
      status: 'downloaded',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : JSON.stringify(info.releaseNotes || ''),
    });

    // Show system notification
    try {
      new Notification({
        title: 'BAGA HMS — Update Ready!',
        body: 'Version ' + info.version + ' has been downloaded. Restart to install.',
        silent: false,
      }).show();
    } catch (e) {}

    // Ask user if they want to restart now
    const buttons = ['Restart & Install Now', 'Later'];
    if (!mainWindow || mainWindow.isDestroyed()) {
      // No window available, just quit and install
      autoUpdater.quitAndInstall();
      return;
    }
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready to Install',
      message: 'BAGA HMS version ' + info.version + ' has been downloaded.',
      detail: 'Click "Restart & Install Now" to close the app and install the update.\nClick "Later" to install when you next close the app.',
      buttons: buttons,
      noLink: true,
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        updateLog('User chose Restart & Install Now');
        sendToAllWindows('update-status', { status: 'installing', version: info.version });
        // Give UI a moment to show "installing" state
        setTimeout(() => {
          autoUpdater.quitAndInstall(true, true);
        }, 500);
      } else {
        updateLog('User chose Later — will install on next quit');
        sendToAllWindows('update-status', { status: 'downloaded', version: info.version, deferred: true });
      }
    });
  });

  // ---- Event: Error ----
  autoUpdater.on('error', (err) => {
    updateLog('ERROR: ' + (err ? err.message || String(err) : 'Unknown error'));
    if (err && err.stack) updateLog('Stack: ' + err.stack);
    sendToAllWindows('update-status', {
      status: 'error',
      message: err ? err.message : 'Unknown update error',
    });
    // Silent failure for network errors — offline usage is normal
    console.log('[AutoUpdate] Error (likely no internet — this is normal):', err ? err.message : 'Unknown');
  });
}

// Check for updates — called on app startup and manually
async function checkForUpdates() {
  updateLog('=== UPDATE CHECK START ===');
  updateLog('Version: ' + APP_VERSION + ' | Electron: ' + process.versions.electron);
  updateLog('isPackaged: ' + app.isPackaged);

  // Only use electron-updater in packaged (production) builds
  if (!app.isPackaged) {
    updateLog('Dev mode detected — skipping electron-updater, using GitHub API fallback');

    // Dev mode: still check GitHub API so devs can see if updates exist
    sendToAllWindows('update-status', { status: 'checking' });
    try {
      const apiHeaders = { 'Accept': 'application/vnd.github.v3+json' };
      if (GH_TOKEN) apiHeaders['Authorization'] = 'token ' + GH_TOKEN;
      const apiResult = await httpsGet('https://api.github.com/repos/mohsin-rasheedbaga/baga-hms/releases/latest', apiHeaders);
      if (apiResult.statusCode === 200) {
        const release = JSON.parse(apiResult.body);
        const latestVersion = release.tag_name.replace(/^v/, '');
        updateLog('Latest release: ' + latestVersion + ' | Current: ' + APP_VERSION);
        if (latestVersion !== APP_VERSION) {
          sendToAllWindows('update-status', {
            status: 'available',
            version: latestVersion,
            releaseNotes: release.body || 'Update available on GitHub.',
            releaseDate: release.published_at || '',
            isDevMode: true,
          });
        } else {
          sendToAllWindows('update-status', { status: 'not-available', currentVersion: APP_VERSION });
        }
      }
    } catch (err) {
      updateLog('Dev mode API check failed: ' + err.message);
      sendToAllWindows('update-status', { status: 'not-available', currentVersion: APP_VERSION });
    }
    return;
  }

  // Production mode: use electron-updater (reads latest.yml from GitHub Release)
  try {
    updateLog('Calling autoUpdater.checkForUpdates()...');
    const result = await autoUpdater.checkForUpdates();
    if (result) {
      updateLog('checkForUpdates result: ' + JSON.stringify(result.updateInfo || result));
    }
  } catch (err) {
    updateLog('checkForUpdates FAILED: ' + (err ? err.message : String(err)));
    // Don't send error to UI for network failures (silent)
  }
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

      // ── LAN Server API Routes ──────────────────────────────────
      const reqUrl = decodedUrl;

      // LAN client: Get server info (license + hospital info)
      if (reqUrl === '/api/lan/info') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        const store = getStore();
        const license = store.license || null;
        if (license && license.key) {
          // Get users for LAN clients
          let users = [];
          if (db) {
            try { users = db.getAll('users'); } catch(e) { users = []; }
          }
          res.end(JSON.stringify({
            mode: 'server',
            hospitalName: license.hospitalName,
            licenseType: license.licenseType,
            features: license.features,
            expiryDate: license.expiryDate,
            address: license.address,
            phone: license.phone,
            version: APP_VERSION,
            users: users,
          }));
        } else {
          res.end(JSON.stringify({ mode: 'no_license' }));
        }
        return;
      }

      // LAN client: Authenticate user
      if (reqUrl === '/api/lan/login') {
        // Handle POST body
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          try {
            const { username, password } = JSON.parse(body);
            if (!db) {
              res.end(JSON.stringify({ success: false, error: 'Database not available' }));
              return;
            }
            const store = getStore();
            if (!store.license) {
              res.end(JSON.stringify({ success: false, error: 'No active license on server' }));
              return;
            }
            // Find user by username
            const users = db.getAll('users');
            const user = users.find(u => {
              const d = typeof u === 'string' ? JSON.parse(u) : u;
              return d.email === username && d.password === password && d.active !== false;
            });
            if (user) {
              const userData = typeof user === 'string' ? JSON.parse(user) : user;
              res.end(JSON.stringify({
                success: true,
                user: { ...userData, password: undefined }
              }));
            } else {
              res.end(JSON.stringify({ success: false, error: 'Invalid username or password' }));
            }
          } catch (e) {
            res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
          }
        });
        return;
      }

      // LAN client: Discover server (responds to discovery ping)
      if (reqUrl === '/api/lan/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        const store = getStore();
        res.end(JSON.stringify({
          pong: true,
          service: 'baga-hms',
          version: APP_VERSION,
          hasLicense: !!(store.license && store.license.key),
          hospitalName: store.license ? store.license.hospitalName : '',
        }));
        return;
      }
      // ── End LAN Server API Routes ─────────────────────────────

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

// ============================================================
// DEVICE LOCK CHECK
// ============================================================
async function checkLicenseLock(licenseKey) {
  try {
    const machineId = getMachineId();
    // Get our IP address first
    const location = await detectLocation();
    const ipAddress = location.ip_address || '';

    const ADMIN_PANEL = 'https://baga-hospital-api.vercel.app'; // Change to actual admin panel URL later

    const response = await fetch(`${ADMIN_PANEL}/api/license/check-lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        device_id: machineId,
        ip_address: ipAddress,
      }),
    });

    const data = await response.json();
    console.log('[License] Lock check:', JSON.stringify(data));
    return data;
  } catch (e) {
    console.error('[License] Lock check failed:', e.message);
    // If check fails (network error), allow activation (graceful degradation)
    return { allowed: true, reason: 'check_failed' };
  }
}

async function lockLicenseToServer(licenseKey, deviceId) {
  try {
    const location = await detectLocation();
    const deviceInfo = getDeviceInfo();
    const subnet = getNetworkSubnet(location.ip_address);
    const ADMIN_PANEL = 'https://baga-hospital-api.vercel.app';

    await fetch(`${ADMIN_PANEL}/api/license/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        device_id: deviceId,
        device_name: deviceInfo.device_name,
        ip_address: location.ip_address,
        network: subnet,
        enable_sharing: true, // Network sharing enabled by default
        max_clients: 10,
        server_port: SERVER_PORT,
      }),
    });
    console.log('[License] Locked to device:', deviceId, 'Network:', subnet);
  } catch (e) {
    console.error('[License] Lock registration failed:', e.message);
  }
}

function getNetworkSubnet(ip) {
  if (!ip || ip === '') return 'unknown';
  const parts = ip.split('.');
  if (parts.length < 4) return ip;
  return parts[0] + '.' + parts[1] + '.' + parts[2] + '.0/24';
}

ipcMain.handle('license-activate', async (event, licenseKey) => {
  try {
    const machineId = getMachineId();
    const store = getStore();
    console.log('[License] Activating:', licenseKey, 'Machine:', machineId);

    // Step 1: Check device lock before activating
    const lockCheck = await checkLicenseLock(licenseKey);
    if (!lockCheck.allowed) {
      console.log('[License] BLOCKED - locked to another device');
      return { 
        success: false, 
        error: 'already_activated', 
        locked_device_name: lockCheck.locked_device_name,
        locked_network: lockCheck.locked_network,
      };
    }
    
    // Step 2: If allowed because of network sharing, store server info
    if (lockCheck.reason === 'network_shared') {
      const store = getStore();
      store.networkClient = {
        serverIp: lockCheck.server_ip,
        serverPort: lockCheck.server_port || 18765,
        hospitalName: lockCheck.hospital_name,
        licenseType: lockCheck.license_type,
        features: lockCheck.features,
        expiryDate: lockCheck.expiry_date,
        licenseKey: licenseKey,
        connectedAt: new Date().toISOString(),
      };
      saveStore(store);
      return { success: true, mode: 'network_client', server: lockCheck };
    }

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

      // Start device tracking
      startHeartbeat();

      // Register device with location (fire-and-forget)
      registerDeviceBackground(licenseKey);

      // Lock license to this device
      lockLicenseToServer(licenseKey, machineId);

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
    lastLocation: store.lastLocation || null,
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
ipcMain.handle('check-update', () => { checkForUpdates(); return { checking: true }; });
ipcMain.handle('manual-check-update', async () => {
  // Trigger internal auto-update check (no browser redirect to source code)
  checkForUpdates();
  return { checking: true };
});
ipcMain.handle('install-update', () => {
  // Force install the already-downloaded update
  try {
    autoUpdater.quitAndInstall(true, true);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle('quit-app', () => app.quit());

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
// DEVICE TRACKING - INFO, LOCATION & HEARTBEAT
// ============================================================

const os = require('os');

function getDeviceInfo() {
  return {
    device_name: os.hostname(),
    operating_system: `${os.type()} ${os.release()} (${os.arch()})`,
    app_version: APP_VERSION,
    device_id: getMachineId(),
    platform: process.platform,
    arch: os.arch(),
    cpu_cores: os.cpus().length,
    total_memory: os.totalmem(),
  };
}

async function detectLocation() {
  try {
    const result = await httpGet('http://ip-api.com/json/?fields=status,country,regionName,city,timezone,query');
    const data = JSON.parse(result.body);
    if (data.status === 'success') {
      return {
        ip_address: data.query,
        country: data.country,
        region: data.regionName,
        city: data.city,
        timezone: data.timezone,
      };
    }
  } catch (e) {
    console.error('[Location] Detection failed:', e.message);
  }
  return { ip_address: '', country: '', region: '', city: '', timezone: '' };
}

async function registerDeviceBackground(licenseKey) {
  try {
    const deviceInfo = getDeviceInfo();
    const location = await detectLocation();

    await fetch(`${API_BASE}/api/device/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        device_id: deviceInfo.device_id,
        device_name: deviceInfo.device_name,
        operating_system: deviceInfo.operating_system,
        app_version: deviceInfo.app_version,
        ip_address: location.ip_address,
      }),
    });

    // Store location locally
    const store = getStore();
    store.lastLocation = { ...location, detectedAt: new Date().toISOString() };
    saveStore(store);

    console.log('[Device] Registered with location:', JSON.stringify(location));
  } catch (e) {
    console.error('[Device] Background registration failed:', e.message);
  }
}

// --- Heartbeat ---
let heartbeatTimer = null;

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  // Send first heartbeat immediately
  sendHeartbeatPing();

  // Then every 5 minutes
  heartbeatTimer = setInterval(() => {
    sendHeartbeatPing();
  }, 5 * 60 * 1000); // 5 minutes

  console.log('[Heartbeat] Timer started (every 5 minutes)');
}

async function sendHeartbeatPing() {
  try {
    const store = getStore();
    const licenseKey = store.license ? store.license.key : null;
    if (!licenseKey) {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      return;
    }

    const response = await fetch(`${API_BASE}/api/device/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        device_id: getMachineId(),
        app_version: APP_VERSION,
      }),
    });

    console.log('[Heartbeat] Ping sent:', new Date().toISOString());
  } catch (error) {
    console.error('[Heartbeat] Ping failed:', error.message);
  }
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log('[Heartbeat] Timer stopped');
  }
}

// --- Device IPC Handlers ---

ipcMain.handle('device-register', async () => {
  try {
    const store = getStore();
    const licenseKey = store.license ? store.license.key : null;
    if (!licenseKey) return { success: false, error: 'No active license' };

    const deviceInfo = getDeviceInfo();
    const location = await detectLocation();

    const response = await fetch(`${API_BASE}/api/device/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        device_id: deviceInfo.device_id,
        device_name: deviceInfo.device_name,
        operating_system: deviceInfo.operating_system,
        app_version: deviceInfo.app_version,
        ip_address: location.ip_address,
      }),
    });

    const data = await response.json();
    console.log('[Device] Registration response:', data);

    // Store last known location locally
    store.lastLocation = {
      ...location,
      detectedAt: new Date().toISOString(),
    };
    saveStore(store);

    return { success: true, location, data };
  } catch (error) {
    console.error('[Device] Registration error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('device-heartbeat', async () => {
  try {
    const store = getStore();
    const licenseKey = store.license ? store.license.key : null;
    if (!licenseKey) return { success: false, error: 'No active license' };

    const response = await fetch(`${API_BASE}/api/device/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        device_id: getMachineId(),
        app_version: APP_VERSION,
      }),
    });

    return { success: true };
  } catch (error) {
    console.error('[Heartbeat] Error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('device-get-info', async () => {
  const store = getStore();
  return {
    device: getDeviceInfo(),
    location: store.lastLocation || null,
  };
});

ipcMain.handle('device-get-location', async () => {
  try {
    const location = await detectLocation();

    // Update stored location
    const store = getStore();
    store.lastLocation = { ...location, detectedAt: new Date().toISOString() };
    saveStore(store);

    return { success: true, location };
  } catch (error) {
    console.error('[Location] Detection error:', error.message);
    return { success: false, error: error.message };
  }
});

// ============================================================
// LAN DISCOVERY - UDP Broadcast for finding license servers
// ============================================================
const DISCOVERY_PORT = 18766;

function startLANDiscovery() {
  try {
    const udpSocket = dgram.createSocket('udp4');
    
    udpSocket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'baga-hms-discover') {
          // A client is looking for a server — respond
          const store = getStore();
          const response = JSON.stringify({
            type: 'baga-hms-announce',
            service: 'baga-hms',
            version: APP_VERSION,
            port: SERVER_PORT,
            hasLicense: !!(store.license && store.license.key),
            hospitalName: store.license ? store.license.hospitalName : '',
          });
          udpSocket.send(response, rinfo.port, rinfo.address);
          console.log('[LAN] Responded to discovery from', rinfo.address);
        }
      } catch (e) {}
    });

    udpSocket.on('error', (err) => {
      console.log('[LAN] Discovery socket error:', err.message);
    });

    udpSocket.bind(DISCOVERY_PORT, () => {
      udpSocket.setBroadcast(true);
      console.log('[LAN] Discovery listening on UDP port', DISCOVERY_PORT);
    });
  } catch (e) {
    console.log('[LAN] Discovery not available:', e.message);
  }
}

async function discoverLANServer() {
  return new Promise((resolve) => {
    try {
      const udpSocket = dgram.createSocket('udp4');
      let found = false;
      const timeout = setTimeout(() => {
        if (!found) {
          udpSocket.close();
          resolve(null);
        }
      }, 3000); // 3 second timeout

      udpSocket.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.type === 'baga-hms-announce' && data.hasLicense) {
            found = true;
            clearTimeout(timeout);
            udpSocket.close();
            resolve({
              ip: rinfo.address,
              port: data.port,
              hospitalName: data.hospitalName,
              version: data.version,
            });
          }
        } catch (e) {}
      });

      udpSocket.on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });

      // Broadcast discovery message
      const message = JSON.stringify({ type: 'baga-hms-discover', version: APP_VERSION });
      udpSocket.send(message, 0, message.length, DISCOVERY_PORT, '255.255.255.255');
      console.log('[LAN] Sent discovery broadcast');
    } catch (e) {
      console.log('[LAN] Discovery not available:', e.message);
      resolve(null);
    }
  });
}

// ============================================================
// IPC HANDLERS - LAN CLIENT
// ============================================================

ipcMain.handle('lan-discover', async () => {
  try {
    const server = await discoverLANServer();
    if (server) {
      return { success: true, server };
    }
    return { success: false, error: 'No server found on network' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('lan-connect', async (event, serverIp, serverPort) => {
  try {
    const port = serverPort || 18765;
    const url = `http://${serverIp}:${port}/api/lan/info`;
    
    const response = await httpGet(url);
    const data = JSON.parse(response.body);
    
    if (data.mode === 'server') {
      // Store server connection info
      const store = getStore();
      store.networkClient = {
        serverIp: serverIp,
        serverPort: port,
        hospitalName: data.hospitalName,
        licenseType: data.licenseType,
        features: data.features,
        expiryDate: data.expiryDate,
        licenseKey: 'lan-shared',
        connectedAt: new Date().toISOString(),
        version: data.version,
      };
      // Store server users locally for offline login
      if (data.users && data.users.length > 0) {
        store.networkClientUsers = data.users;
      }
      saveStore(store);
      
      console.log('[LAN] Connected to server:', serverIp, '-', data.hospitalName);
      return { success: true, data };
    } else {
      return { success: false, error: 'Server has no active license' };
    }
  } catch (e) {
    console.error('[LAN] Connect error:', e.message);
    return { success: false, error: 'Failed to connect to server' };
  }
});

ipcMain.handle('lan-login', async (event, username, password) => {
  try {
    const store = getStore();
    const client = store.networkClient;
    if (!client || !client.serverIp) {
      return { success: false, error: 'Not connected to a LAN server' };
    }
    
    // Try online login via server first
    try {
      const port = client.serverPort || 18765;
      const response = await httpPost(`http://${client.serverIp}:${port}/api/lan/login`, {
        username, password,
      });
      const data = JSON.parse(response.body);
      if (data.success) {
        return { success: true, user: data.user, mode: 'lan_client' };
      }
      return { success: false, error: data.error };
    } catch (e) {
      // Fallback to cached users
      console.log('[LAN] Server unreachable, trying cached users');
      const cachedUsers = store.networkClientUsers || [];
      const user = cachedUsers.find(u => {
        const d = typeof u === 'string' ? JSON.parse(u) : u;
        return d.email === username && d.password === password && d.active !== false;
      });
      if (user) {
        const userData = typeof user === 'string' ? JSON.parse(user) : user;
        return { success: true, user: { ...userData, password: undefined }, mode: 'lan_client_offline' };
      }
      return { success: false, error: 'Server unreachable and no cached users found' };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('lan-get-status', () => {
  const store = getStore();
  return store.networkClient || null;
});

ipcMain.handle('lan-disconnect', () => {
  const store = getStore();
  store.networkClient = null;
  store.networkClientUsers = null;
  saveStore(store);
  return { success: true };
});

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

  // 0. Configure auto-updater (before anything else)
  try {
    configureAutoUpdater();
  } catch (e) {
    console.error('[BAGA HMS] Failed to configure autoUpdater:', e.message);
  }
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

  // Start LAN discovery (for network sharing)
  startLANDiscovery();

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

        // Start device tracking for validated license
        startHeartbeat();
        registerDeviceBackground(store.license.key);

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
  // Stop heartbeat timer on quit
  stopHeartbeat();
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
