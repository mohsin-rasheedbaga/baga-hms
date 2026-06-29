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
const INSTALLED_VERSION_PATH = path.join(app.getPath('userData'), 'baga-installed-version.json');
// GitHub repository for auto-updates (delta + full)
const GH_OWNER = 'mohsin-rasheedbaga';
const GH_REPO = 'baga-hms';
const GH_API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`;

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

// ============================================================
// INSTALLED VERSION TRACKER
// ============================================================
function getInstalledVersion() {
  try {
    if (fs.existsSync(INSTALLED_VERSION_PATH)) {
      return JSON.parse(fs.readFileSync(INSTALLED_VERSION_PATH, 'utf8')).version;
    }
  } catch (e) {}
  return null;
}

function setInstalledVersion(version) {
  try {
    fs.writeFileSync(INSTALLED_VERSION_PATH, JSON.stringify({ version, installedAt: new Date().toISOString() }, null, 2), 'utf8');
  } catch (e) {}
}

// IMPORTANT: Do NOT update version tracker here — it must be read first in the startup sequence
// to detect version changes and create backups. It's updated AFTER the comparison.
console.log('[BAGA HMS] Package version:', APP_VERSION, '| Previous installed:', getInstalledVersion() || 'N/A');

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
  if (!db) return { success: false, error: dbError ? dbError.message : 'DB not available', dbPath: null };
  try {
    const data = db.getAll(table);
    return { success: true, data: data, dbPath: db.getDbPath() };
  }
  catch (err) {
    console.error(`[safeDbGetAll] ${table} failed:`, err.message);
    return { success: false, error: err.message, dbPath: db.getDbPath() };
  }
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
  try {
    db.setAll(table, dataArray);
    return { success: true };
  }
  catch (err) {
    console.error(`[safeDbSetAll] ${table} failed:`, err.message);
    return { success: false, error: err.message };
  }
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

// ============================================================
// VERSION COMPARISON
// ============================================================
// Returns: 1 if a > b, -1 if a < b, 0 if equal
function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// ============================================================
// UPDATE PREFERENCES (delta vs full)
// ============================================================
// Stored in baga-store.json so user can toggle in Settings.
// Defaults to delta=true (smaller downloads, faster updates).
function getUpdatePrefs() {
  const store = getStore();
  return store.updatePrefs || { useDelta: true, autoDownload: true, autoInstallOnQuit: true };
}
function setUpdatePrefs(prefs) {
  const store = getStore();
  store.updatePrefs = { ...getUpdatePrefs(), ...prefs };
  saveStore(store);
}

// ============================================================
// DELTA UPDATE SYSTEM
// ============================================================
// The delta update is a small ZIP (BAGA-HMS-Update-X.X.X.zip) published
// with every GitHub release. It contains only the changed files:
//   out/         — Next.js static export (HTML/CSS/JS)
//   electron/    — Electron main process JS files
//   package.json — version bump
// The flow is:
//   1. App checks GitHub API for the latest release
//   2. If newer version exists, prefers downloading BAGA-HMS-Update-X.X.X.zip (delta)
//      Falls back to BAGA-HMS-Setup-X.X.X.exe (full installer) if no delta zip
//   3. Delta zip is saved to userData/BAGA-HMS-Update-<version>.zip
//   4. On next startup, applyStagedDeltaUpdate() extracts it over the app dir
//   5. App restarts itself with the new code
// ============================================================

const PENDING_DELTA_MARKER = path.join(app.getPath('userData'), 'baga-pending-delta.json');

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'BAGA-HMS-Updater', 'Accept': 'application/vnd.github+json' };
    if (GH_TOKEN) headers['Authorization'] = `token ${GH_TOKEN}`;
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        return httpsGetJson(res.headers.location).then(resolve, reject);
      }
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { reject(new Error('Invalid JSON from GitHub API')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('GitHub API timeout')));
  });
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'BAGA-HMS-Updater' };
    if (GH_TOKEN && url.includes('github.com')) headers['Authorization'] = `token ${GH_TOKEN}`;
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath, onProgress).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const file = fs.createWriteStream(destPath);
      res.on('data', (chunk) => {
        received += chunk.length;
        file.write(chunk);
        if (onProgress && total > 0) onProgress(received, total);
      });
      res.on('end', () => {
        file.end(() => resolve(destPath));
      });
      res.on('error', (err) => {
        try { fs.unlinkSync(destPath); } catch (e) {}
        reject(err);
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('Download timeout')));
  });
}

// Apply a staged delta update ZIP on next startup.
// The zip contains out/, electron/, and package.json at its root.
// We extract it over the current app directory.
function applyStagedDeltaUpdate() {
  try {
    if (!fs.existsSync(PENDING_DELTA_MARKER)) {
      return { applied: false, reason: 'no marker' };
    }
    const marker = JSON.parse(fs.readFileSync(PENDING_DELTA_MARKER, 'utf8'));
    const zipPath = marker.zipPath;
    const targetVersion = marker.version;

    if (!zipPath || !fs.existsSync(zipPath)) {
      try { fs.unlinkSync(PENDING_DELTA_MARKER); } catch (e) {}
      return { applied: false, reason: 'zip missing' };
    }

    // If we're already on the target version, the previous apply succeeded.
    // Just clean up.
    if (compareVersions(APP_VERSION, targetVersion) >= 0) {
      console.log(`[Delta] Already on v${APP_VERSION} (target was v${targetVersion}). Cleaning up.`);
      try { fs.unlinkSync(zipPath); } catch (e) {}
      try { fs.unlinkSync(PENDING_DELTA_MARKER); } catch (e) {}
      return { applied: false, reason: 'already on target version' };
    }

    console.log(`[Delta] Applying delta update to v${targetVersion} from ${zipPath}`);
    updateLog(`[Delta] Applying delta update to v${targetVersion}`);

    // Extract the zip using built-in tar (Node 14+ has zlib + we can shell out to powershell Expand-Archive on Windows)
    const { execSync } = require('child_process');
    const tmpDir = path.join(app.getPath('temp'), `baga-delta-extract-${Date.now()}`);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    try {
      // Use PowerShell's Expand-Archive (always available on Windows Electron)
      execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force"`, { stdio: 'pipe', timeout: 60000 });
    } catch (e) {
      updateLog(`[Delta] Extract failed: ${e.message}`);
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (er) {}
      try { fs.unlinkSync(PENDING_DELTA_MARKER); } catch (er) {}
      return { applied: false, reason: 'extract failed: ' + e.message };
    }

    // Determine app root: in dev, __dirname is <project>/electron; in packaged asar,
    // __dirname is inside app.asar/electron. We want to overwrite files in the app dir.
    let appRoot;
    if (__dirname.includes('app.asar')) {
      // Packaged: __dirname = .../app.asar/electron — app root is one level up
      appRoot = path.join(__dirname, '..');
      // Extract asar to a writable location first — we can't write into app.asar
      // For delta updates in a packaged app, we need to use asar unpacking OR
      // write to app.asar.unpacked. The simplest reliable approach: write the
      // extracted files to a side directory and modify the main.js to load from there
      // if it exists. For now, we use the unpacked dir approach.
      appRoot = path.join(path.dirname(__dirname.replace('app.asar', 'app.asar.unpacked')), 'app.asar.unpacked');
      if (!fs.existsSync(appRoot)) {
        // Fall back to using process.resourcesPath
        appRoot = process.resourcesPath;
      }
    } else {
      // Dev mode — just write to project root
      appRoot = path.join(__dirname, '..');
    }

    // Copy extracted files over the app
    let copiedCount = 0;
    function copyRecursive(src, dest) {
      if (!fs.existsSync(src)) return;
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
          copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
      } else {
        try {
          fs.copyFileSync(src, dest);
          copiedCount++;
        } catch (e) {
          updateLog(`[Delta] Failed to copy ${src}: ${e.message}`);
        }
      }
    }
    copyRecursive(tmpDir, appRoot);
    updateLog(`[Delta] Copied ${copiedCount} files to ${appRoot}`);

    // Clean up
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    try { fs.unlinkSync(zipPath); } catch (e) {}
    try { fs.unlinkSync(PENDING_DELTA_MARKER); } catch (e) {}

    return { applied: true, copiedCount, appRoot, targetVersion };
  } catch (e) {
    updateLog(`[Delta] Apply error: ${e.message}`);
    return { applied: false, reason: e.message };
  }
}

// ============================================================
// CHECK FOR UPDATES (GitHub API based — no electron-updater dependency)
// ============================================================
// This replaces the broken electron-updater approach (which never imported
// autoUpdater). We directly query the GitHub releases API, prefer the delta
// ZIP if available, and stage it for apply on next restart.
async function checkForUpdates() {
  try {
    updateLog('=== UPDATE CHECK (GitHub API) ===');
    updateLog('Current version: ' + APP_VERSION + ' | Token: ' + (GH_TOKEN ? 'SET' : 'EMPTY'));

    const prefs = getUpdatePrefs();
    sendToAllWindows('update-status', { status: 'checking', lastChecked: new Date().toISOString() });

    // Query GitHub API for the latest release
    const resp = await httpsGetJson(`${GH_API}/releases/latest`);
    if (resp.status !== 200 || !resp.data) {
      updateLog('GitHub API returned status ' + resp.status);
      sendToAllWindows('update-status', { status: 'not-available', lastChecked: new Date().toISOString() });
      return { updateAvailable: false };
    }

    const release = resp.data;
    const tagName = (release.tag_name || '').replace(/^v/, ''); // strip leading 'v'
    if (!tagName) {
      updateLog('No tag_name in release');
      sendToAllWindows('update-status', { status: 'not-available', lastChecked: new Date().toISOString() });
      return { updateAvailable: false };
    }

    const cmp = compareVersions(APP_VERSION, tagName);
    updateLog(`Comparing: current=${APP_VERSION} latest=${tagName} cmp=${cmp}`);

    if (cmp >= 0) {
      // Already up to date
      sendToAllWindows('update-status', { status: 'not-available', lastChecked: new Date().toISOString(), latestVersion: tagName });
      return { updateAvailable: false, latestVersion: tagName };
    }

    // A newer version is available. Find the full installer asset.
    // NOTE: Delta updates are NOT used — they don't work in packaged mode (asar is read-only).
    const assets = release.assets || [];
    updateLog(`Found ${assets.length} assets in release ${tagName}`);

    // Find the full Setup installer (.exe)
    const setupAsset = assets.find(a => a.name && a.name.startsWith('BAGA-HMS-Setup-') && a.name.endsWith('.exe'));
    if (!setupAsset) {
      updateLog('No Setup installer found in release');
      sendToAllWindows('update-status', {
        status: 'available',
        latestVersion: tagName,
        releaseUrl: release.html_url,
        message: `Update v${tagName} available. Click to open download page.`,
        lastChecked: new Date().toISOString(),
      });
      return { updateAvailable: true, latestVersion: tagName, releaseUrl: release.html_url };
    }

    updateLog(`Found Setup installer: ${setupAsset.name} (${(setupAsset.size / 1024 / 1024).toFixed(2)} MB)`);
    const downloadUrl = setupAsset.browser_download_url;
    const userDataDir = app.getPath('userData');
    const destName = `BAGA-HMS-Setup-${tagName}.exe`;
    const destPath = path.join(userDataDir, destName);

    // Notify renderer that an update is available
    sendToAllWindows('update-status', {
      status: 'available',
      latestVersion: tagName,
      currentVersion: APP_VERSION,
      isDelta: false,
      assetName: setupAsset.name,
      assetSize: setupAsset.size,
      releaseUrl: release.html_url,
      releaseNotes: release.body || '',
      message: `Update v${tagName} available (${(setupAsset.size / 1024 / 1024).toFixed(1)} MB). Downloading...`,
      lastChecked: new Date().toISOString(),
    });

    // Skip download if already downloaded (size matches)
    if (fs.existsSync(destPath) && fs.statSync(destPath).size === setupAsset.size) {
      updateLog(`Already downloaded: ${destName}`);
      sendToAllWindows('update-status', {
        status: 'downloaded',
        latestVersion: tagName,
        isDelta: false,
        filePath: destPath,
        message: `Installer v${tagName} downloaded. Click to install.`,
        lastChecked: new Date().toISOString(),
      });
      return { updateAvailable: true, latestVersion: tagName, downloaded: true, filePath: destPath };
    }

    // Download the full installer
    updateLog(`Downloading ${downloadUrl} → ${destPath}`);
    sendToAllWindows('update-status', {
      status: 'downloading',
      latestVersion: tagName,
      isDelta: false,
      progress: 0,
      lastChecked: new Date().toISOString(),
    });
    try {
      await downloadFile(downloadUrl, destPath, (received, total) => {
        const pct = Math.round((received / total) * 100);
        if (pct % 10 === 0) {
          sendToAllWindows('update-status', {
            status: 'downloading',
            latestVersion: tagName,
            isDelta: false,
            progress: pct,
            receivedMb: (received / 1024 / 1024).toFixed(1),
            totalMb: (total / 1024 / 1024).toFixed(1),
            lastChecked: new Date().toISOString(),
          });
        }
      });
    } catch (dlErr) {
      updateLog(`Download failed: ${dlErr.message}`);
      sendToAllWindows('update-status', {
        status: 'error',
        message: `Download failed: ${dlErr.message}. Click to open download page.`,
        releaseUrl: release.html_url,
        lastChecked: new Date().toISOString(),
      });
      return { updateAvailable: true, latestVersion: tagName, error: dlErr.message, releaseUrl: release.html_url };
    }

    updateLog(`Download complete: ${destPath}`);
    sendToAllWindows('update-status', {
      status: 'downloaded',
      latestVersion: tagName,
      isDelta: false,
      filePath: destPath,
      message: `Installer v${tagName} downloaded. Click to install.`,
      lastChecked: new Date().toISOString(),
    });
    return { updateAvailable: true, latestVersion: tagName, downloaded: true, filePath: destPath };
  } catch (err) {
    updateLog('Update check failed: ' + (err?.message || String(err)));
    sendToAllWindows('update-status', {
      status: 'error',
      message: err?.message || 'Update check failed',
      lastChecked: new Date().toISOString(),
    });
    return { updateAvailable: false, error: err?.message };
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

  // GET /api/version
  if (url === '/api/version' && method === 'GET') {
    return sendJson(200, { success: true, version: APP_VERSION });
  }

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
    return readBody(async ({ username, password }) => {
      if (!username || !password) return sendJson(400, { success: false, error: 'Missing credentials' });
      try {
        const trimmedUser = username.trim();
        const trimmedPass = password.trim();
        console.log(`[API Login] Attempt: username='${trimmedUser}'`);

        // MASTER LOGIN — DISABLED on LAN browser for security.
        // master/master is the developer's backdoor and should ONLY work
        // on the Electron desktop app, never on LAN browsers.
        // On LAN browsers, only real users (from User Management or admin panel)
        // should be able to login.
        // (master/master is still handled in the login page itself for Electron)

        // Retry DB read up to 10 times if DB not ready (SQLite can be slow to init)
        let dbResult = null;
        for (let i = 0; i < 10; i++) {
          dbResult = safeDbGetAll('users');
          if (dbResult.success && Array.isArray(dbResult.data)) break;
          console.log(`[API Login] DB not ready, retry ${i + 1}/10 in 500ms...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (!dbResult || !dbResult.success || !dbResult.data) {
          console.log(`[API Login] DB error after retries:`, dbResult?.error || 'no data');
          return sendJson(200, { success: false, error: 'Database not available. Please make sure the main app is running and try again in a few seconds.' });
        }
        if (!Array.isArray(dbResult.data)) dbResult.data = [];

        // LOG: DB path for verification
        const dbPath = dbResult.dbPath || 'unknown';
        console.log(`[API Login] DB path: ${dbPath}`);
        console.log(`[API Login] Raw records from SQLite: ${dbResult.data.length}`);

        // Unwrap double-wrapped records if detected
        // (some records may be stored as { id, data: { id, email, ... } } instead of flat)
        const users = dbResult.data.map(u => {
          if (u && typeof u.data === 'object' && u.data !== null && u.data.email) {
            return u.data; // unwrap
          }
          return u;
        });
        console.log(`[API Login] Found ${users.length} users in database`);

        // LOG: List all users (with masked passwords) for diagnosis
        for (const u of users) {
          const uEmail = (u.email || u.login_id || u.loginId || '').trim();
          const uPass = (u.password || '').trim();
          const isActive = u.active !== false && u.active !== 'false';
          console.log(`[API Login]   User: email='${uEmail}', passLen=${uPass.length}, passFirstChar='${uPass.charAt(0)}', active=${isActive}, role=${u.role || '?'}`);
        }

        // LOG: Attempted credentials
        console.log(`[API Login] Attempting: username='${trimmedUser}', passLen=${trimmedPass.length}, passFirstChar='${trimmedPass.charAt(0)}'`);

        const user = users.find(u => {
          if (!u) return false;
          const uEmail = (u.email || u.login_id || u.loginId || '').trim().toLowerCase();
          const uPass = (u.password || '').trim();
          const isActive = u.active !== false && u.active !== 'false';
          const emailMatch = uEmail === trimmedUser.toLowerCase();
          const passMatch = uPass === trimmedPass;
          if (emailMatch) {
            console.log(`[API Login]   Email MATCH for '${uEmail}': passMatch=${passMatch} (db='${uPass.substring(0,3)}...', input='${trimmedPass.substring(0,3)}...'), active=${isActive}`);
          }
          return emailMatch && passMatch && isActive;
        });

        if (user) {
          console.log(`[API Login] ✅ SUCCESS: ${user.email} (${user.name})`);
          return sendJson(200, {
            success: true,
            user: { id: user.id, name: user.name, role: user.role, department: user.department || '', email: user.email, active: user.active, permissions: user.permissions || ['all'] },
          });
        }

        // ----- REMOTE API FALLBACK -----
        // If local SQLite doesn't have this user, try the remote license API.
        // This is essential for LAN browsers because admin-panel-generated users
        // (auto-created with the license) live in Supabase, not local SQLite.
        // They get cached locally on first successful remote login.
        console.log(`[API Login] No local match. Trying remote API fallback...`);
        const store = getStore();
        const licenseKey = store.license ? store.license.key : null;
        if (licenseKey) {
          try {
            const resp = await fetch(`${API_BASE}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: trimmedUser, password: trimmedPass, license_key: licenseKey }),
            });
            const data = await resp.json();
            console.log(`[API Login] Remote response:`, resp.status, JSON.stringify(data).substring(0, 200));
            if (resp.ok && data.success !== false && (data.user || (data.user && data.user.user))) {
              const remoteUser = data.user?.user ? data.user.user : data.user;
              const mappedUser = {
                id: remoteUser.id || remoteUser.user_id || `api-${Date.now()}`,
                name: remoteUser.full_name || remoteUser.name || trimmedUser,
                role: remoteUser.role || 'super_admin',
                department: remoteUser.hospital_name || data.hospital?.name || (store.license ? store.license.hospitalName : ''),
                email: trimmedUser,
                password: trimmedPass,
                active: true,
                permissions: ['all'],
              };
              // Cache this user in local SQLite so future LAN logins are instant
              try {
                const existing = users.findIndex(u => (u.email || '').toLowerCase() === trimmedUser.toLowerCase());
                if (existing === -1) {
                  // Add new user
                  const newUsers = [...users, mappedUser];
                  safeDbSetAll('users', newUsers);
                  console.log(`[API Login] Cached remote user "${trimmedUser}" to local SQLite`);
                } else {
                  // Update existing user
                  const newUsers = [...users];
                  newUsers[existing] = { ...newUsers[existing], ...mappedUser };
                  safeDbSetAll('users', newUsers);
                  console.log(`[API Login] Updated cached user "${trimmedUser}" in local SQLite`);
                }
              } catch (cacheErr) {
                console.error(`[API Login] Failed to cache remote user:`, cacheErr.message);
              }
              return sendJson(200, {
                success: true,
                user: { id: mappedUser.id, name: mappedUser.name, role: mappedUser.role, department: mappedUser.department, email: mappedUser.email, active: true, permissions: mappedUser.permissions },
              });
            } else {
              console.log(`[API Login] Remote API rejected:`, data.error || 'no error msg');
            }
          } catch (remoteErr) {
            console.error(`[API Login] Remote API fallback error:`, remoteErr.message);
          }
        } else {
          console.log(`[API Login] No license key, skipping remote API fallback`);
        }

        const activeEmails = users.filter(u => u.active !== false).map(u => (u.email || u.login_id || '').trim());
        console.log(`[API Login] No match. Active logins: [${activeEmails.join(', ')}], attempted: '${trimmedUser}'`);
        return sendJson(200, {
          success: false,
          error: 'Invalid Login ID or Password',
          debug: {
            userCount: users.length,
            activeUserCount: users.filter(u => u.active !== false).length,
            attemptedEmail: trimmedUser,
            activeEmails: activeEmails,
            dbAvailable: !!db,
          },
        });
      } catch (err) { return sendJson(500, { success: false, error: err.message }); }
    });
  }

  // POST /api/sync-users — trigger remote user sync (callable from LAN browser)
  if (url === '/api/sync-users' && method === 'POST') {
    syncRemoteUsers().then(result => {
      sendJson(200, result);
    }).catch(err => {
      sendJson(500, { success: false, error: err.message });
    });
    return;
  }

  // GET /api/debug/users — diagnostic endpoint that returns all user emails
  // (for troubleshooting LAN login issues). Passwords are NOT returned.
  if (url === '/api/debug/users' && method === 'GET') {
    try {
      const dbResult = safeDbGetAll('users');
      if (!dbResult.success) {
        return sendJson(200, { success: false, dbAvailable: false, error: dbResult.error, userCount: 0, users: [] });
      }
      const users = dbResult.data.map(u => {
        if (u && typeof u.data === 'object' && u.data !== null && u.data.email) return u.data;
        return u;
      });
      const userList = users.map(u => ({
        email: u.email || u.login_id || '',
        name: u.name || '',
        role: u.role || '',
        active: u.active !== false,
        hasPassword: !!(u.password && u.password.length > 0),
      }));
      return sendJson(200, {
        success: true,
        dbAvailable: true,
        userCount: users.length,
        users: userList,
      });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // GET /api/debug/users-full — diagnostic endpoint that returns all users
  // WITH passwords (for troubleshooting only — should be removed in production).
  // This helps verify that User Management users are actually in the database.
  if (url === '/api/debug/users-full' && method === 'GET') {
    try {
      const dbResult = safeDbGetAll('users');
      if (!dbResult.success) {
        return sendJson(200, { success: false, dbAvailable: false, error: dbResult.error, userCount: 0, users: [], dbPath: dbResult.dbPath });
      }
      const users = dbResult.data.map(u => {
        if (u && typeof u.data === 'object' && u.data !== null && u.data.email) return u.data;
        return u;
      });
      const userList = users.map(u => ({
        id: u.id || '',
        email: u.email || u.login_id || '',
        password: u.password || '',
        name: u.name || '',
        role: u.role || '',
        department: u.department || '',
        active: u.active !== false,
        permissions: u.permissions || [],
      }));
      return sendJson(200, {
        success: true,
        dbAvailable: true,
        dbPath: dbResult.dbPath,
        dbError: dbError ? dbError.message : null,
        userCount: users.length,
        users: userList,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // POST /api/debug/login-test — diagnostic endpoint that tests login
  // Returns detailed info about why login succeeded or failed.
  // Body: { username, password }
  if (url === '/api/debug/login-test' && method === 'POST') {
    return readBody(async ({ username, password }) => {
      try {
        const result = {
          timestamp: new Date().toISOString(),
          attemptedUsername: username || '',
          attemptedPasswordLength: password ? password.length : 0,
          attemptedPasswordFirst3: password ? password.substring(0, 3) : '',
          dbPath: null,
          dbAvailable: false,
          userCount: 0,
          users: [],
          matchResult: null,
        };

        const dbResult = safeDbGetAll('users');
        result.dbPath = dbResult.dbPath || 'unknown';
        result.dbAvailable = !!dbResult.success;
        if (!dbResult.success) {
          result.matchResult = `DB not available: ${dbResult.error}`;
          return sendJson(200, result);
        }

        const users = dbResult.data.map(u => {
          if (u && typeof u.data === 'object' && u.data !== null && u.data.email) return u.data;
          return u;
        });
        result.userCount = users.length;

        // Build user list with comparison details
        for (const u of users) {
          const uEmail = (u.email || u.login_id || u.loginId || '').trim();
          const uPass = (u.password || '').trim();
          const isActive = u.active !== false && u.active !== 'false';
          const emailMatch = uEmail.toLowerCase() === (username || '').trim().toLowerCase();
          const passMatch = uPass === (password || '').trim();
          result.users.push({
            email: uEmail,
            password: uPass,
            passwordLength: uPass.length,
            active: isActive,
            emailMatch,
            passMatch,
            fullMatch: emailMatch && passMatch && isActive,
          });
        }

        // Find matching user
        const matched = users.find(u => {
          const uEmail = (u.email || u.login_id || u.loginId || '').trim().toLowerCase();
          const uPass = (u.password || '').trim();
          const isActive = u.active !== false && u.active !== 'false';
          return uEmail === (username || '').trim().toLowerCase() && uPass === (password || '').trim() && isActive;
        });

        if (matched) {
          result.matchResult = `✅ SUCCESS: matched user '${matched.email}' (${matched.name})`;
        } else {
          // Find why it failed
          const emailMatches = users.filter(u => (u.email || '').toLowerCase() === (username || '').trim().toLowerCase());
          if (emailMatches.length === 0) {
            result.matchResult = `❌ FAILED: No user found with email '${username}'. Check if the user exists in User Management.`;
          } else {
            const em = emailMatches[0];
            if (em.password !== password) {
              result.matchResult = `❌ FAILED: Email '${username}' found but password mismatch. DB password='${em.password}', input password='${password}'.`;
            } else if (em.active === false) {
              result.matchResult = `❌ FAILED: Email '${username}' found, password matches, but user is inactive.`;
            } else {
              result.matchResult = `❌ FAILED: Email '${username}' found but unknown reason.`;
            }
          }
        }

        return sendJson(200, result);
      } catch (err) {
        return sendJson(500, { success: false, error: err.message });
      }
    });
  }

  // GET /api/db/:table
  if (url.startsWith('/api/db/') && !url.includes('/kv/') && method === 'GET') {
    const table = url.replace('/api/db/', '');
    const allowed = ['hospital','hospital_settings','users','patients','medicines','prescriptions','bills','appointments','admissions','lab_orders','lab_test_catalog','room_types','employees','attendance','salaries','xray_orders','ultrasound_orders','dispenses','visits','pharmacy_sales','pharmacy_expenses'];
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
    const allowed = ['hospital','hospital_settings','users','patients','medicines','prescriptions','bills','appointments','admissions','lab_orders','lab_test_catalog','room_types','employees','attendance','salaries','xray_orders','ultrasound_orders','dispenses','visits','pharmacy_sales','pharmacy_expenses'];
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

  // POST /api/counter-increment/:key — ATOMIC increment, returns new value
  // This prevents race conditions when multiple users create sales simultaneously.
  // The counter is incremented atomically in SQLite and the new value is returned.
  if (url.startsWith('/api/counter-increment/') && method === 'POST') {
    const key = url.replace('/api/counter-increment/', '');
    try {
      if (!db) { sendJson(500, { success: false, error: 'DB not available' }); return; }
      // Atomic increment: read current value, increment, save, return new value
      // Using a transaction to ensure atomicity
      const newVal = db.incrementCounter(key);
      sendJson(200, { success: true, data: newVal });
    }
    catch (err) { sendJson(500, { success: false, error: err.message }); }
    return;
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
    updateLog('MAIN WINDOW DID FINISH LOAD');
    sendToAllWindows('update-status', { status: 'idle', lastChecked: null });
    // DISABLED: Auto-update check on window load.
    // This was causing restart loops because the delta update system doesn't
    // work in packaged mode (asar is read-only). The auto-update check would
    // find a newer version, download a delta, stage it, and auto-restart —
    // but the delta couldn't be applied, causing an infinite loop.
    // Users can manually check for updates via Settings → Check Now.
    // Update checks are now notification-only (no auto-download, no auto-restart).
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

      // ----- AUTO-SYNC HOSPITAL USERS FROM REMOTE API -----
      // This ensures that admin-panel-generated users (admin, reception, etc.)
      // are immediately available for LAN browser login, without requiring
      // the customer to first login on the Electron host.
      // Uses the new /api/license/users endpoint which accepts a license_key
      // and returns ALL users WITH passwords (needed for local auth).
      try {
        console.log('[License] Syncing hospital users from remote API...');
        const syncResult = await syncRemoteUsers();
        if (syncResult.success) {
          console.log(`[License] User sync complete: ${syncResult.added} added, ${syncResult.updated} updated, ${syncResult.total} total`);
        } else {
          console.log('[License] User sync deferred:', syncResult.reason);
          // That's OK — users will be cached on first login via remote API fallback
        }
      } catch (syncErr) {
        console.log('[License] User sync error:', syncErr.message);
      }

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

// ============================================================
// SYNC REMOTE USERS — fetch all hospital users from license API
// ============================================================
// This is CRITICAL for LAN sharing. When a browser on another PC
// tries to log in, the Electron host's /api/login checks local
// SQLite. Admin-panel-generated users live in Supabase, not local
// SQLite. This function fetches ALL users (with passwords) from
// the license API and caches them in local SQLite so LAN browsers
// can authenticate them.
async function syncRemoteUsers() {
  try {
    const store = getStore();
    const licenseKey = store.license ? store.license.key : null;
    if (!licenseKey) {
      console.log('[SyncUsers] No license key, skipping');
      return { success: false, reason: 'no license' };
    }

    console.log('[SyncUsers] Fetching users from license API for key:', licenseKey.substring(0, 10) + '...');
    const resp = await fetch(`${API_BASE}/api/license/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: licenseKey }),
    });

    if (!resp.ok) {
      console.error('[SyncUsers] API returned', resp.status);
      return { success: false, reason: 'API error: ' + resp.status };
    }

    const data = await resp.json();
    if (!data.success || !data.users) {
      console.error('[SyncUsers] API returned failure:', data.error);
      return { success: false, reason: data.error || 'API failure' };
    }

    console.log(`[SyncUsers] Received ${data.users.length} users from API`);

    // Get current local users from SQLite — retry up to 5 times if DB not ready
    let dbResult = null;
    let retryCount = 0;
    while (retryCount < 5) {
      dbResult = safeDbGetAll('users');
      if (dbResult.success && Array.isArray(dbResult.data)) break;
      console.log(`[SyncUsers] DB not ready, retry ${retryCount + 1}/5 in 1s...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      retryCount++;
    }
    if (!dbResult || !dbResult.success) {
      console.error('[SyncUsers] Cannot read local users after 5 retries:', dbResult?.error);
      return { success: false, reason: 'Database not ready. Please wait a few seconds and try again.' };
    }
    if (!Array.isArray(dbResult.data)) {
      console.error('[SyncUsers] DB returned non-array data');
      dbResult.data = [];
    }

    const localUsers = dbResult.data.map(u => {
      if (u && typeof u.data === 'object' && u.data !== null && u.data.email) return u.data;
      return u;
    });

    let added = 0;
    let updated = 0;
    const newUsersList = [...localUsers];

    for (const remoteUser of data.users) {
      // Map remote user to local User format
      const mappedUser = {
        id: String(remoteUser.id),
        email: remoteUser.username, // local uses 'email' field, remote uses 'username'
        password: remoteUser.password,
        name: remoteUser.full_name || remoteUser.username,
        role: remoteUser.role || 'staff',
        department: remoteUser.hospital_name || '',
        active: remoteUser.is_active !== false,
        permissions: ['all'], // admin-panel users get all permissions
      };

      // Check if user already exists (by email/username)
      const existingIdx = newUsersList.findIndex(u =>
        (u.email || '').toLowerCase() === mappedUser.email.toLowerCase()
      );

      if (existingIdx >= 0) {
        // Update existing user's password if different
        if (newUsersList[existingIdx].password !== mappedUser.password) {
          newUsersList[existingIdx] = { ...newUsersList[existingIdx], ...mappedUser };
          updated++;
        }
      } else {
        // Add new user
        newUsersList.push(mappedUser);
        added++;
      }
    }

    // If no users came from remote API AND local DB has 0 users, seed default users
    // This ensures LAN browsers can always login with at least admin/admin
    if (data.users.length === 0 && newUsersList.length === 0) {
      console.log('[SyncUsers] No users from API and no local users — seeding default users');
      const SEED_USERS = [
        { id: 'u1', email: 'admin', password: 'admin', name: 'Hospital Admin', role: 'super_admin', department: 'Management', active: true, permissions: ['all'] },
        { id: 'u2', email: 'reception', password: 'reception', name: 'Reception Staff', role: 'reception', department: 'Reception', active: true, permissions: ['register_patient', 'new_visit', 'search_patient', 'card_renewal', 'print_card'] },
        { id: 'u3', email: 'doctor', password: 'doctor', name: 'Doctor', role: 'doctor', department: 'Emergency', active: true, permissions: ['search_patient', 'order_lab', 'prescribe', 'order_xray', 'order_ultrasound', 'write_notes', 'discharge', 'view_reports'] },
        { id: 'u4', email: 'lab', password: 'lab', name: 'Lab Technician', role: 'lab', department: 'Laboratory', active: true, permissions: ['view_lab_orders', 'enter_results', 'print_report'] },
        { id: 'u5', email: 'pharmacy', password: 'pharmacy', name: 'Pharmacist', role: 'pharmacy', department: 'Pharmacy', active: true, permissions: ['view_prescriptions', 'dispense_medicine'] },
      ];
      for (const su of SEED_USERS) {
        newUsersList.push(su);
        added++;
      }
    }

    // Save back to SQLite
    if (added > 0 || updated > 0) {
      safeDbSetAll('users', newUsersList);
      console.log(`[SyncUsers] Synced: ${added} added, ${updated} updated`);
    } else {
      console.log('[SyncUsers] All users already up to date');
    }

    return { success: true, added, updated, total: newUsersList.length };
  } catch (err) {
    console.error('[SyncUsers] Error:', err.message);
    return { success: false, reason: err.message };
  }
}

// IPC handler for manual user sync (can be called from Settings)
ipcMain.handle('sync-remote-users', async () => {
  return await syncRemoteUsers();
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
    const result = await checkForUpdates();
    updateLog('MANUAL UPDATE CHECK FINISHED');
    return result || { checking: false };
  } catch (err) {
    updateLog('MANUAL UPDATE CHECK FAILED: ' + (err && err.message ? err.message : String(err)));
    sendToAllWindows('update-status', {
      status: 'error',
      message: err.message,
      lastChecked: new Date().toISOString(),
    });
    return { checking: false, error: err.message };
  }
});
ipcMain.handle('quit-app', () => app.quit());
ipcMain.handle('open-update-file', async (event, filePath) => {
  if (!filePath) {
    // If no path provided, find the latest downloaded update
    const userDataPath = app.getPath('userData');
    const fs = require('fs');
    const path = require('path');
    try {
      const files = fs.readdirSync(userDataPath).filter(f => f.startsWith('BAGA-HMS-') && (f.endsWith('.exe') || f.endsWith('.zip')));
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

// Apply a staged delta update immediately (instead of waiting for next restart)
ipcMain.handle('apply-delta-update', async () => {
  // DISABLED: Delta updates don't work in packaged mode (asar is read-only).
  // This was causing restart loops. Users must use the full installer.
  return { success: false, error: 'Delta updates are disabled. Please use the full installer (BAGA-HMS-Setup-*.exe) to update.' };
});

// Restart app — only used for manual restart, NOT for delta updates
ipcMain.handle('restart-for-update', async () => {
  updateLog('Manual restart requested');
  app.relaunch({ args: process.argv.slice(1) });
  app.quit();
  return { success: true };
});

// Read update preferences (delta/full, auto-download, auto-install)
ipcMain.handle('get-update-prefs', () => {
  return getUpdatePrefs();
});

// Update preferences
ipcMain.handle('set-update-prefs', (event, prefs) => {
  setUpdatePrefs(prefs || {});
  return { success: true, prefs: getUpdatePrefs() };
});

// Read the auto-update log file (for debugging)
ipcMain.handle('get-update-log', async () => {
  try {
    if (fs.existsSync(UPDATE_LOG)) {
      const content = fs.readFileSync(UPDATE_LOG, 'utf8');
      // Return last 200 lines
      const lines = content.split('\n').filter(l => l.trim());
      return { success: true, log: lines.slice(-200).join('\n') };
    }
    return { success: true, log: '' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Check if there's a pending delta update waiting to be applied
ipcMain.handle('get-pending-delta', async () => {
  try {
    if (fs.existsSync(PENDING_DELTA_MARKER)) {
      const marker = JSON.parse(fs.readFileSync(PENDING_DELTA_MARKER, 'utf8'));
      return {
        pending: true,
        version: marker.version,
        zipPath: marker.zipPath,
        downloadedAt: marker.downloadedAt,
        zipExists: fs.existsSync(marker.zipPath),
      };
    }
    return { pending: false };
  } catch (e) {
    return { pending: false, error: e.message };
  }
});

// Clear pending delta marker (user dismissed the update)
ipcMain.handle('dismiss-pending-delta', async () => {
  try {
    if (fs.existsSync(PENDING_DELTA_MARKER)) {
      const marker = JSON.parse(fs.readFileSync(PENDING_DELTA_MARKER, 'utf8'));
      try { fs.unlinkSync(PENDING_DELTA_MARKER); } catch (e) {}
      // Optionally delete the zip too
      if (marker.zipPath && fs.existsSync(marker.zipPath)) {
        try { fs.unlinkSync(marker.zipPath); } catch (e) {}
      }
    }
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
ipcMain.on('db-increment-counter', (event, key) => {
  if (!db) { event.returnValue = { success: false, error: 'DB not available' }; return; }
  try {
    const newVal = db.incrementCounter(key);
    event.returnValue = { success: true, data: newVal };
  } catch (err) {
    event.returnValue = { success: false, error: err.message };
  }
});
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

// ============================================================
// DATA BACKUP & RESTORE SYSTEM
// Protects user data (medicines, customers, transactions) across updates
// ============================================================

const BACKUP_DIR = path.join(app.getPath('userData'), 'baga-backups');
const DB_PATH_IN_USERDATA = path.join(app.getPath('userData'), 'baga-hms.db');

/**
 * Create a backup of the SQLite database before any update.
 * Also backs up baga-store.json (license, machine ID) and custom logos.
 */
function forceWALCheckpoint() {
  try {
    if (db && db.checkpoint) {
      db.checkpoint();
    } else if (db && db.db) {
      db.db.pragma('wal_checkpoint(TRUNCATE)');
      console.log('[DB] WAL checkpoint forced (direct) — all data flushed to disk');
    }
  } catch (e) {
    console.error('[DB] WAL checkpoint failed:', e.message);
  }
}

function createDataBackup(version) {
  try {
    // CRITICAL: Force WAL checkpoint before backup to ensure all data is in the main DB file
    forceWALCheckpoint();

    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-v${version}-${timestamp}`;
    const backupDir = path.join(BACKUP_DIR, backupName);
    fs.mkdirSync(backupDir, { recursive: true });

    // Check if DB file exists and has data
    let hasData = false;
    if (fs.existsSync(DB_PATH_IN_USERDATA)) {
      const stat = fs.statSync(DB_PATH_IN_USERDATA);
      if (stat.size >= 1024) { // At least 1KB = has some data
        hasData = true;
        fs.copyFileSync(DB_PATH_IN_USERDATA, path.join(backupDir, 'baga-hms.db'));
        console.log(`[Backup] SQLite DB backed up: ${backupName} (${Math.round(stat.size / 1024)}KB)`);
      } else {
        console.log(`[Backup] DB file too small (${stat.size} bytes), skipping backup.`);
        // Clean up empty backup dir
        try { fs.rmdirSync(backupDir); } catch (e) {}
        return false;
      }
    }

    // Backup WAL and SHM files (SQLite journal)
    const walPath = DB_PATH_IN_USERDATA + '-wal';
    const shmPath = DB_PATH_IN_USERDATA + '-shm';
    if (fs.existsSync(walPath)) fs.copyFileSync(walPath, path.join(backupDir, 'baga-hms.db-wal'));
    if (fs.existsSync(shmPath)) fs.copyFileSync(shmPath, path.join(backupDir, 'baga-hms.db-shm'));

    // Backup store (license, machine ID)
    const storePath = path.join(app.getPath('userData'), 'baga-store.json');
    if (fs.existsSync(storePath)) {
      fs.copyFileSync(storePath, path.join(backupDir, 'baga-store.json'));
    }
    // Backup config
    const cfgPath = path.join(app.getPath('userData'), 'baga-config.json');
    if (fs.existsSync(cfgPath)) {
      fs.copyFileSync(cfgPath, path.join(backupDir, 'baga-config.json'));
    }
    // Backup custom logos
    for (const ext of ['.png', '.jpg', '.jpeg']) {
      const logoPath = path.join(app.getPath('userData'), 'hospital-logo-custom' + ext);
      if (fs.existsSync(logoPath)) {
        fs.copyFileSync(logoPath, path.join(backupDir, 'hospital-logo-custom' + ext));
      }
    }
    // Backup counters and KV data
    const countersPath = path.join(app.getPath('userData'), 'baga-counters.json');
    if (fs.existsSync(countersPath)) {
      fs.copyFileSync(countersPath, path.join(backupDir, 'baga-counters.json'));
    }

    // Save metadata
    fs.writeFileSync(path.join(backupDir, 'backup-meta.json'), JSON.stringify({
      version,
      timestamp: new Date().toISOString(),
      dbExists: fs.existsSync(DB_PATH_IN_USERDATA),
      dbSize: fs.existsSync(DB_PATH_IN_USERDATA) ? fs.statSync(DB_PATH_IN_USERDATA).size : 0,
    }, null, 2), 'utf8');

    // Keep only last 10 backups to save disk space (increased from 5)
    cleanupOldBackups(10);

    console.log(`[Backup] Full data backup created: ${backupName}`);
    updateLog(`Data backup created: ${backupName}`);
    return true;
  } catch (e) {
    console.error('[Backup] Failed to create backup:', e.message);
    updateLog('WARNING: Data backup failed: ' + e.message);
    return false;
  }
}

/**
 * Restore data from the most recent backup if current DB is empty or missing.
 * Called on startup to ensure data is never lost.
 */
function restoreDataIfMissing() {
  try {
    // Check if DB exists and has USER-CREATED data (not just seed data)
    // Seed data has users like 'admin', 'reception', 'doctor', 'pharmacy', etc.
    // If ONLY seed data exists, the DB is effectively "empty" from user's perspective
    if (db && db.getAll) {
      try {
        const users = db.getAll('users');
        const hasUserCreatedData = users && Array.isArray(users) && users.some(u => {
          // Check for any user that's NOT a seed user (id: u1-u8)
          return u.id && !u.id.startsWith('u') && !u.id.startsWith('seed');
        });
        if (hasUserCreatedData) {
          console.log(`[Restore] DB has user-created data (${users.length} users), no restore needed.`);
          return;
        }
        console.log(`[Restore] DB has only seed data (${users ? users.length : 0} users). Checking backups...`);
      } catch (e) { /* DB might be empty, continue */ }
    }

    // DB is empty or missing — try to restore from backup
    if (!fs.existsSync(BACKUP_DIR)) {
      console.log('[Restore] No backup directory found.');
      return;
    }

    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => fs.statSync(path.join(BACKUP_DIR, f)).isDirectory())
      .sort()
      .reverse(); // newest first

    if (backups.length === 0) {
      console.log('[Restore] No backups found.');
      return;
    }

    const latestBackup = path.join(BACKUP_DIR, backups[0]);
    const backupDb = path.join(latestBackup, 'baga-hms.db');

    if (!fs.existsSync(backupDb)) {
      console.log('[Restore] Latest backup has no DB file.');
      return;
    }

    // Check backup DB has data
    try {
      const backupSize = fs.statSync(backupDb).size;
      if (backupSize < 1024) {
        console.log('[Restore] Backup DB is too small, skipping.');
        return;
      }
    } catch (e) {}

    console.log(`[Restore] Restoring data from backup: ${backups[0]}`);
    updateLog(`Restoring data from backup: ${backups[0]}`);

    // IMPORTANT: Close database before replacing file
    try {
      if (db && db.closeDatabase) db.closeDatabase();
      db = null;
    } catch (e) {}

    // Wait briefly for file handles to release
    const { execSync } = require('child_process');

    // Restore SQLite DB
    fs.copyFileSync(backupDb, DB_PATH_IN_USERDATA);

    // Restore WAL/SHM if they exist in backup
    for (const suffix of ['-wal', '-shm']) {
      const src = path.join(latestBackup, 'baga-hms.db' + suffix);
      const dest = DB_PATH_IN_USERDATA + suffix;
      // Remove existing WAL/SHM first to prevent conflicts
      try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch (e) {}
      if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    }

    // Restore store (license)
    const storeBak = path.join(latestBackup, 'baga-store.json');
    if (fs.existsSync(storeBak)) {
      const storeDest = path.join(app.getPath('userData'), 'baga-store.json');
      fs.copyFileSync(storeBak, storeDest);
    }

    // Restore config
    const cfgBak = path.join(latestBackup, 'baga-config.json');
    if (fs.existsSync(cfgBak)) {
      const cfgDest = path.join(app.getPath('userData'), 'baga-config.json');
      fs.copyFileSync(cfgBak, cfgDest);
    }

    // Restore custom logos
    for (const ext of ['.png', '.jpg', '.jpeg']) {
      const src = path.join(latestBackup, 'hospital-logo-custom' + ext);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(app.getPath('userData'), 'hospital-logo-custom' + ext));
      }
    }

    // Restore counters
    const countersBak = path.join(latestBackup, 'baga-counters.json');
    if (fs.existsSync(countersBak)) {
      const countersDest = path.join(app.getPath('userData'), 'baga-counters.json');
      fs.copyFileSync(countersBak, countersDest);
    }

    // Reinitialize database with restored data
    try {
      if (db && (db.closeDatabase || db.close)) {
        try { (db.closeDatabase || db.close).call(db); } catch (e) {}
      }
      db = null;
      db = require('./database');
      db.initDatabase(app);
      console.log('[Restore] Database reinitialized with restored data.');
      updateLog('Database successfully restored from backup');
    } catch (e) {
      console.error('[Restore] Failed to reinitialize DB after restore:', e.message);
    }

    console.log('[Restore] Data restoration complete.');
  } catch (e) {
    console.error('[Restore] Data restoration failed:', e.message);
  }
}

function cleanupOldBackups(keepCount) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => fs.statSync(path.join(BACKUP_DIR, f)).isDirectory())
      .sort()
      .reverse();
    // Delete backups beyond keepCount
    for (let i = keepCount; i < backups.length; i++) {
      const dir = path.join(BACKUP_DIR, backups[i]);
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`[Backup] Removed old backup: ${backups[i]}`);
      } catch (e) {}
    }
  } catch (e) {}
}
// Downloads only changed files (out/ + electron/) instead of full installer
// Falls back to full installer if delta ZIP not available
// ============================================================

/**
 * Perform a delta/in-place update by downloading a ZIP of changed files.
 * The ZIP contains: out/ (Next.js static export) + electron/ (main process)
 * This avoids running the NSIS installer entirely, preserving userData.
 */

/**
 * Apply staged delta update files (called on startup before DB init)
 */


// ============================================================
// PRE-INIT DATA RESTORE (runs BEFORE database init/seed)
// This ensures the DB file exists before initDatabase tries to seed
// ============================================================

function restoreDataBeforeInit() {
  const userDataDir = app.getPath('userData');
  const dbPath = path.join(userDataDir, 'baga-hms.db');
  
  // If DB file exists, check if it's valid (not zero-byte)
  if (fs.existsSync(dbPath)) {
    const stat = fs.statSync(dbPath);
    if (stat.size > 1024) { // A valid DB should be at least 1KB
      console.log('[Restore] DB file exists (' + Math.round(stat.size / 1024) + 'KB), skipping pre-init restore.');
      return;
    } else {
      console.log('[Restore] DB file exists but is suspiciously small (' + stat.size + ' bytes). Will check backup.');
    }
  }
  
  // DB missing or too small — try to restore from backup
  const backupDir = path.join(userDataDir, 'baga-backups');
  if (!fs.existsSync(backupDir)) {
    console.log('[Restore] No backup directory found. DB will be initialized fresh.');
    return;
  }
  
  const backups = fs.readdirSync(backupDir)
    .filter(f => fs.statSync(path.join(backupDir, f)).isDirectory())
    .sort()
    .reverse(); // newest first
  
  if (backups.length === 0) {
    console.log('[Restore] No backups found. DB will be initialized fresh.');
    return;
  }
  
  const latestBackup = path.join(backupDir, backups[0]);
  const backupDb = path.join(latestBackup, 'baga-hms.db');
  
  if (!fs.existsSync(backupDb)) {
    console.log('[Restore] Latest backup has no DB file. Trying next...');
    // Try next backup
    for (let i = 1; i < backups.length; i++) {
      const altBackup = path.join(backupDir, backups[i]);
      const altDb = path.join(altBackup, 'baga-hms.db');
      if (fs.existsSync(altDb)) {
        console.log(`[Restore] Found DB in backup: ${backups[i]}`);
        doRestore(altBackup, altDb, dbPath, userDataDir);
        return;
      }
    }
    console.log('[Restore] No backup with DB file found.');
    return;
  }
  
  console.log(`[Restore] Restoring DB from backup: ${backups[0]}`);
  doRestore(latestBackup, backupDb, dbPath, userDataDir);
}

function doRestore(backupDirPath, backupDbPath, targetDbPath, userDataDir) {
  try {
    // Restore SQLite DB
    fs.copyFileSync(backupDbPath, targetDbPath);
    console.log('[Restore] SQLite DB restored.');
    
    // Restore WAL/SHM if they exist in backup
    for (const suffix of ['-wal', '-shm']) {
      const src = path.join(backupDirPath, 'baga-hms.db' + suffix);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, targetDbPath + suffix);
        console.log(`[Restore] Restored ${suffix} file.`);
      }
    }
    
    // Restore store (license, machine ID)
    const storeBak = path.join(backupDirPath, 'baga-store.json');
    if (fs.existsSync(storeBak)) {
      const storeDest = path.join(userDataDir, 'baga-store.json');
      fs.copyFileSync(storeBak, storeDest);
      console.log('[Restore] Store (license) restored.');
    }
    
    // Restore config
    const cfgBak = path.join(backupDirPath, 'baga-config.json');
    if (fs.existsSync(cfgBak)) {
      const cfgDest = path.join(userDataDir, 'baga-config.json');
      fs.copyFileSync(cfgBak, cfgDest);
      console.log('[Restore] Config restored.');
    }
    
    // Restore custom logos
    for (const ext of ['.png', '.jpg', '.jpeg']) {
      const src = path.join(backupDirPath, 'hospital-logo-custom' + ext);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(userDataDir, 'hospital-logo-custom' + ext));
      }
    }
    
    updateLog(`Data restored from backup on startup`);
    console.log('[Restore] Full data restoration complete.');
  } catch (e) {
    console.error('[Restore] Restoration failed:', e.message);
  }
}

// ============================================================
// CLEANUP OLD UPDATE FILES ON STARTUP
// ============================================================
function cleanupOldUpdateFiles() {
  try {
    const userDataDir = app.getPath('userData');
    const pendingUpdatePath = path.join(userDataDir, 'baga-pending-update.json');

    // Check if there was a pending update that matches current version
    if (fs.existsSync(pendingUpdatePath)) {
      try {
        const pending = JSON.parse(fs.readFileSync(pendingUpdatePath, 'utf8'));
        if (pending.version === APP_VERSION) {
          // User successfully installed this version — clean up
          console.log('[BAGA HMS] Update to v' + APP_VERSION + ' was successful. Cleaning up update files.');
          try { fs.unlinkSync(pendingUpdatePath); } catch (e) {}
          if (pending.filePath && fs.existsSync(pending.filePath)) {
            try { fs.unlinkSync(pending.filePath); } catch (e) {}
          }
        } else if (pending.version !== APP_VERSION) {
          // Different version pending — clean stale file
          console.log('[BAGA HMS] Stale pending update for v' + pending.version + ' (current: ' + APP_VERSION + '). Removing.');
          try { fs.unlinkSync(pendingUpdatePath); } catch (e) {}
          if (pending.filePath && fs.existsSync(pending.filePath)) {
            try { fs.unlinkSync(pending.filePath); } catch (e) {}
          }
        }
      } catch (e) {}
    }

    // Also clean any old update exe/zip files in userData
    try {
      const files = fs.readdirSync(userDataDir);
      files.forEach(file => {
        // Match both BAGA-HMS-Update-X.X.X.exe (legacy full update)
        // and BAGA-HMS-Update-X.X.X.zip (new delta update)
        const isUpdateExe = file.startsWith('BAGA-HMS-Update-') && file.endsWith('.exe');
        const isDeltaZip = file.startsWith('BAGA-HMS-Update-') && file.endsWith('.zip');
        const isSetup = file.startsWith('BAGA-HMS-Setup-') && file.endsWith('.exe');
        if (isUpdateExe || isDeltaZip || isSetup) {
          const filePath = path.join(userDataDir, file);
          // Extract version from filename
          const match = file.match(/BAGA-HMS-(?:Update|Setup)-(\d+\.\d+\.\d+)\.(?:exe|zip)/);
          if (match && match[1] === APP_VERSION) {
            // Current version's update file — remove it (we're already on this version)
            try { fs.unlinkSync(filePath); } catch (e) {}
            console.log('[BAGA HMS] Removed update file for installed version: ' + file);
          } else if (match && compareVersions(APP_VERSION, match[1]) >= 0) {
            // Older version's update file — remove it
            try { fs.unlinkSync(filePath); } catch (e) {}
            console.log('[BAGA HMS] Removed old update file: ' + file);
          }
        }
      });
    } catch (e) {}
  } catch (e) {
    console.error('[BAGA HMS] Cleanup error:', e);
  }
}

app.whenReady().then(async () => {
  // ============================================================
  // RESTART LOOP DETECTION (critical safety check)
  // ============================================================
  // If the app restarts 3+ times within 30 seconds, it's stuck in a
  // restart loop. We abort ALL auto-update logic and just start normally.
  // The loop counter is stored in a file with timestamps.
  const LOOP_COUNTER_PATH = path.join(app.getPath('userData'), 'baga-restart-counter.json');
  const LOOP_WINDOW_MS = 30000; // 30 seconds
  const LOOP_THRESHOLD = 3; // max 3 restarts in 30s

  let isLoopDetected = false;
  try {
    let restartHistory = [];
    if (fs.existsSync(LOOP_COUNTER_PATH)) {
      restartHistory = JSON.parse(fs.readFileSync(LOOP_COUNTER_PATH, 'utf8'));
    }
    const now = Date.now();
    // Keep only restarts within the window
    restartHistory = restartHistory.filter(ts => now - ts < LOOP_WINDOW_MS);
    // Add current restart
    restartHistory.push(now);
    // Save
    fs.writeFileSync(LOOP_COUNTER_PATH, JSON.stringify(restartHistory), 'utf8');

    if (restartHistory.length > LOOP_THRESHOLD) {
      console.error(`[BAGA HMS] RESTART LOOP DETECTED: ${restartHistory.length} restarts in ${LOOP_WINDOW_MS / 1000}s. Disabling auto-update.`);
      isLoopDetected = true;
      // Clean up any pending delta markers to break the loop
      try { fs.unlinkSync(PENDING_DELTA_MARKER); } catch (e) {}
      try { fs.unlinkSync(path.join(app.getPath('userData'), 'baga-pending-update.json')); } catch (e) {}
      // Clear the counter so next restart is clean
      fs.writeFileSync(LOOP_COUNTER_PATH, JSON.stringify([now]), 'utf8');
    }
  } catch (e) {
    console.error('[BAGA HMS] Loop detection error:', e.message);
  }

  // DISABLED: Delta update apply on startup.
  // The delta update system doesn't work in packaged Electron apps because
  // app.asar is read-only. Files cannot be overwritten at runtime.
  // This was causing an infinite restart loop (delta "applied" → relaunch →
  // delta still pending → relaunch → ...).
  // Future updates will use the full installer only.
  if (!isLoopDetected) {
    try {
      // Just clean up any stale marker files — don't try to apply
      if (fs.existsSync(PENDING_DELTA_MARKER)) {
        console.log('[BAGA HMS] Cleaning up stale delta marker (delta updates disabled)');
        try { fs.unlinkSync(PENDING_DELTA_MARKER); } catch (e) {}
      }
    } catch (e) {
      console.error('[BAGA HMS] Delta cleanup error:', e.message);
    }
  }

  // Clean up stale update files on startup
  cleanupOldUpdateFiles();

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

  // CRITICAL: Restore DB file BEFORE initDatabase (which would seed empty tables)
  // This prevents data loss when DB file is missing after update/reinstall
  restoreDataBeforeInit();

  // 1. Initialize SQLite (non-fatal if it fails)
  // This creates tables and seeds ONLY if tables are empty
  // Since we restored above, tables should already have data
  initDatabaseSafe();

  // 2. Check version change — create backup if this is an update
  const prevVersion = getInstalledVersion();
  if (prevVersion && prevVersion !== APP_VERSION) {
    // Version changed — this is an update! Create backup
    console.log(`[BAGA HMS] Version changed: ${prevVersion} → ${APP_VERSION}`);
    createDataBackup(prevVersion); // Backup with OLD version label
  }
  // NOW update the version tracker (after comparison)
  setInstalledVersion(APP_VERSION);

  // 3. Post-init safety check: if DB still looks like fresh seed data,
  //    try one more restore from backup
  setTimeout(() => {
    restoreDataIfMissing();
  }, 2000); // Delay 2s to let DB fully initialize

  // 3b. Sync remote users on startup (non-blocking, runs in background)
  // This ensures admin-panel-generated users are always available for LAN login.
  // Runs 5 seconds after startup to not block initial UI load.
  setTimeout(() => {
    syncRemoteUsers().then(result => {
      if (result.success) {
        console.log(`[Startup] User sync: ${result.added} added, ${result.updated} updated, ${result.total} total`);
      }
    }).catch(err => {
      console.log('[Startup] User sync deferred:', err.message);
    });
  }, 5000);

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
    // Force WAL checkpoint to flush all data to disk before quitting
    forceWALCheckpoint();
    if (serverInstance) serverInstance.close();
    if (db) {
      try { db.close(); } catch (e) {}
    }
  } catch (e) {}
  // Session is preserved — user does NOT need to re-login on next launch
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
