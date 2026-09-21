const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } = require('electron');
const { execFile, execFileSync, spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const https = require('https');
const os = require('os');
const catalog = require('./catalog.json');
const { createSelfUpdate } = require('./self-update');
// Keep the existing runtime identity, login item and data directory across rebrands.
app.setName('NNSI App');
app.setPath('userData', path.join(app.getPath('appData'), 'NNSI App'));
app.setPath('sessionData', app.getPath('userData'));
// Avoid Chromium disk-cache locking errors on Windows installations.
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
const brandCatalogItem = item => item.id === 'tiktimer' ? {...item,name:'ТАЙМЕР',icon_url:'./assets/timer-logo.svg',cover_url:'./assets/timer-logo.svg'} : item;
let catalogItems = catalog.apps.map(brandCatalogItem);
const SUPABASE_URL = 'https://qpoyojxupblhjeqbvqfr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QxJKRVOdn07hduJkqcbciw_oUADNl-C';
const NNSI_LICENSE_SERVER_URL = (process.env.NNSI_LICENSE_SERVER_URL || 'https://license-server-production-8e69.up.railway.app').replace(/\/$/, '');
const publicKeyFile = path.join(__dirname, 'assets', 'nnsi-public.pem');
const NNSI_TICKET_PUBLIC_KEY = process.env.NNSI_TICKET_PUBLIC_KEY || (fs.existsSync(publicKeyFile) ? fs.readFileSync(publicKeyFile, 'utf8') : '');
const NNSI_APP_ID = 'tiktimer';
let supabaseAccessToken = null;
const licenseStatusCache = new Map();
let launcherSettings = { autoUpdate: false, autoStart: false };
let state = {};
let mainWindow;
let tray;
let isQuitting = false;
let selfUpdate;
let tiktokService;
const walletGateway=require('./wallet-gateway.cjs').startWalletGateway({url:SUPABASE_URL,key:SUPABASE_KEY,getToken:()=>supabaseAccessToken});
app.on('before-quit',()=>walletGateway.close());
const launchedPids = new Set();
const launchedExecutables = new Set();
const stateFile = () => path.join(app.getPath('userData'), 'state.json');
const appDir = item => path.join(app.getPath('userData'), 'apps', item.id);
const logFile = () => path.join(app.getPath('userData'), 'launcher.log');
function writeLog(message, details) {
  const line = `[${new Date().toISOString()}] ${message}${details === undefined ? '' : ` ${JSON.stringify(details)}`}\n`;
  try { fs.mkdirSync(path.dirname(logFile()), { recursive: true }); fs.appendFileSync(logFile(), line, 'utf8'); } catch (_) { /* logging must not stop the launcher */ }
  console.log(line.trim());
}
process.on('uncaughtException', error => writeLog('uncaughtException', { message: error.message, stack: error.stack }));
process.on('unhandledRejection', error => writeLog('unhandledRejection', { message: error?.message || String(error), stack: error?.stack }));
function migrateLegacyData() {
  const current = app.getPath('userData');
  const legacy = path.join(app.getPath('appData'), 'Astral Launcher');
  if (current === legacy || !fs.existsSync(legacy) || fs.existsSync(path.join(current, 'state.json')) || fs.existsSync(path.join(current, 'apps'))) return;
  try {
    fs.mkdirSync(current, { recursive: true });
    for (const name of ['state.json', 'catalog-cache.json', 'apps']) {
      const source = path.join(legacy, name); const target = path.join(current, name);
      if (fs.existsSync(source)) fs.cpSync(source, target, { recursive: true, force: false });
    }
  } catch (error) { writeLog('legacy data migration failed', { message: error.message, stack: error.stack }); }
}

function loadState() { try { state = JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { state = {}; } }
function settingsFile() { return path.join(app.getPath('userData'), 'settings.json'); }
function loadSettings() { try { launcherSettings = { ...launcherSettings, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch { /* defaults */ } }
async function saveSettings() { await fsp.mkdir(path.dirname(settingsFile()), { recursive: true }); await fsp.writeFile(settingsFile(), JSON.stringify(launcherSettings, null, 2)); }
function catalogCacheFile() { return path.join(app.getPath('userData'), 'catalog-cache.json'); }
function loadCatalogCache() { try { const cached = JSON.parse(fs.readFileSync(catalogCacheFile(), 'utf8')); if (Array.isArray(cached) && cached.length) catalogItems = cached.map(brandCatalogItem); } catch { /* Используем встроенный каталог. */ } }
async function syncCatalog() {
  // Supabase RLS decides which public or exclusive applications are visible.
  const url = `${SUPABASE_URL}/rest/v1/store_apps?select=*,store_media(*)&order=created_at.desc`;
  const remote = await new Promise((resolve, reject) => https.get(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'User-Agent': 'Astral-Launcher' } }, res => { let body = ''; res.setEncoding('utf8'); res.on('data', part => body += part); res.on('end', () => { if (res.statusCode !== 200) return reject(new Error(`Supabase catalog: ${res.statusCode}`)); try { resolve(JSON.parse(body)); } catch { reject(new Error('Некорректный каталог Supabase')); } }); }).on('error', reject));
  if (Array.isArray(remote)) { const merged = [...catalogItems]; for (const item of remote) { const index = merged.findIndex((entry) => entry.id === item.id); if (index >= 0) merged[index] = { ...merged[index], ...item }; else merged.push(item); } catalogItems = merged.map(brandCatalogItem); await fsp.mkdir(path.dirname(catalogCacheFile()), { recursive: true }); await fsp.writeFile(catalogCacheFile(), JSON.stringify(catalogItems, null, 2)); }
  return catalogItems;
}
async function saveState() { await fsp.mkdir(path.dirname(stateFile()), { recursive: true }); await fsp.writeFile(stateFile(), JSON.stringify(state, null, 2)); }
function apiJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Astral-Launcher' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return apiJson(res.headers.location).then(resolve, reject);
      let body = ''; res.setEncoding('utf8'); res.on('data', part => body += part); res.on('end', () => { if (res.statusCode !== 200) return reject(new Error(`GitHub API: ${res.statusCode}`)); try { resolve(JSON.parse(body)); } catch { reject(new Error('Некорректный ответ GitHub')); } });
    }).on('error', reject);
  });
}
function machineId() {
  try {
    if (process.platform === 'win32') return execFileSync('wmic', ['csproduct', 'get', 'uuid'], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/)[1].trim();
    if (process.platform === 'darwin') return execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8' }).split('"')[3];
    return fs.readFileSync('/etc/machine-id', 'utf8').trim();
  } catch (_) {
    return crypto.createHash('sha256').update(os.userInfo().username + os.hostname()).digest('hex');
  }
}
function issueLaunchTicket(appId, accessToken) {
  if (!NNSI_LICENSE_SERVER_URL) throw new Error('В лаунчере не настроен NNSI_LICENSE_SERVER_URL.');
  if (!accessToken) throw new Error('Сессия Supabase не найдена. Перезапустите лаунчер и войдите в аккаунт.');
  return new Promise((resolve, reject) => {
    const currentMachineId = machineId();
    writeLog('requesting launch ticket', { appId, machineId: currentMachineId });
    const body = JSON.stringify({ app_id: appId, machine_id: currentMachineId });
    const request = https.request(`${NNSI_LICENSE_SERVER_URL.replace(/\/$/, '')}/v1/issue-launch-ticket`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, response => {
      let result = ''; response.setEncoding('utf8'); response.on('data', part => result += part); response.on('end', () => {
        let data = {}; try { data = JSON.parse(result); } catch { /* handled below */ }
        if (response.statusCode !== 200) return reject(new Error(data.error || `Launch ticket: HTTP ${response.statusCode}`));
        if (!data.ticket) return reject(new Error('Supabase не вернул launch ticket'));
        resolve(data);
      });
    });
    request.setTimeout(15000, () => request.destroy(new Error('Supabase не ответил за 15 секунд')));
    request.on('error', reject); request.write(body); request.end();
  });
}
function checkLicense(appId = NNSI_APP_ID) {
  const cached = licenseStatusCache.get(appId);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  if (!NNSI_LICENSE_SERVER_URL || !supabaseAccessToken) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ app_id: appId, machine_id: machineId() });
    const request = https.request(`${NNSI_LICENSE_SERVER_URL}/v1/check-license`, { method: 'POST', headers: { Authorization: `Bearer ${supabaseAccessToken}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, response => {
      let result = ''; response.setEncoding('utf8'); response.on('data', part => result += part); response.on('end', () => {
        let data = {}; try { data = JSON.parse(result); } catch { /* handled below */ }
        if (response.statusCode !== 200) return reject(new Error(data.error || `License check: HTTP ${response.statusCode}`));
        const finish = value => {
          const result = { value: value === true, expiresAt: Date.now() + 30000 };
          licenseStatusCache.set(appId, result);
          resolve(result.value);
        };
        return finish(data.active === true);
      });
    });
    request.setTimeout(10000, () => request.destroy(new Error('License server timeout')));
    request.on('error', reject); request.write(body); request.end();
  });
}
function licenseRequest(method, endpoint, body = null) {
  if (!NNSI_LICENSE_SERVER_URL || !supabaseAccessToken) return Promise.reject(new Error('Supabase session is not available'));
  return new Promise((resolve, reject) => {
    const payload = body === null ? null : JSON.stringify(body);
    const request = https.request(`${NNSI_LICENSE_SERVER_URL}${endpoint}`, { method, headers: { Authorization: `Bearer ${supabaseAccessToken}`, apikey: SUPABASE_KEY, Accept: 'application/json', ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) } }, response => {
      let result = ''; response.setEncoding('utf8'); response.on('data', part => result += part); response.on('end', () => {
        let data = {}; try { data = JSON.parse(result); } catch (_) { /* handled below */ }
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(data.error || `License server: HTTP ${response.statusCode}`));
        resolve(data);
      });
    });
    request.setTimeout(15000, () => request.destroy(new Error('License server timeout')));
    request.on('error', reject); if (payload) request.write(payload); request.end();
  });
}
function githubLatestWithoutApi(item) {
  const start = `https://github.com/${item.owner}/${item.repo}/releases/latest`;
  return new Promise((resolve, reject) => {
    const follow = url => https.get(url, { headers: { 'User-Agent': 'Astral-Launcher' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString(); res.resume(); return follow(next);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`GitHub Releases: ${res.statusCode}`)); }
      const match = new URL(url).pathname.match(/\/releases\/tag\/([^/]+)$/); res.resume();
      if (!match) return reject(new Error('Не удалось определить версию GitHub-релиза'));
      const tag = decodeURIComponent(match[1]); const base = `https://github.com/${item.owner}/${item.repo}/releases/latest/download/`;
      resolve({ tag_name: tag, assets: [{ name: 'win-unpacked.zip', browser_download_url: `${base}win-unpacked.zip` }, { name: 'update.zip', browser_download_url: `${base}update.zip` }] });
    }).on('error', reject);
    follow(start);
  });
}
function download(url, target, win, id) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Astral-Launcher', Accept: 'application/octet-stream' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return download(res.headers.location, target, win, id).then(resolve, reject);
      if (res.statusCode !== 200) return reject(new Error(`Загрузка: HTTP ${res.statusCode}`));
      const total = Number(res.headers['content-length']) || 0; let received = 0; const out = fs.createWriteStream(target);
      res.on('data', chunk => { received += chunk.length; win.webContents.send('download:progress', { id, received, total }); }); res.pipe(out); out.on('finish', () => out.close(resolve)); out.on('error', reject);
    }).on('error', reject);
  });
}
function extract(zip, destination) {
  return new Promise((resolve, reject) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`], error => error ? reject(error) : resolve()));
}
// One cached scan for the entire launcher, shared by concurrent status requests.
let processSnapshot = [], processSnapshotAt = 0, processScan = null;
const ownedProcesses = new Map();
function trackProcess(child, directory) {
  if (!child.pid) return;
  ownedProcesses.set(child.pid, path.resolve(directory).toLowerCase());
  processSnapshotAt = 0;
  child.once('exit', () => { ownedProcesses.delete(child.pid); processSnapshotAt = 0; });
}
function isRunning(item) {
  const directory = path.resolve(appDir(item)).toLowerCase();
  if ([...ownedProcesses.values()].some(p => p === directory || p.startsWith(directory + path.sep))) return Promise.resolve(true);
  const matches = () => processSnapshot.some(p => p === directory || p.startsWith(directory + path.sep));
  if (Date.now() - processSnapshotAt < 15000) return Promise.resolve(matches());
  if (!processScan) processScan = new Promise(resolve => {
    const script = "@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.CommandLine -notmatch '--type=' } | Select-Object -ExpandProperty ExecutablePath) | ConvertTo-Json -Compress";
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 8000 }, (error, stdout) => {
      try { if (!error) { const result = JSON.parse(stdout || '[]'); processSnapshot = [].concat(result || []).map(p => path.dirname(p).toLowerCase()); } } catch {}
      processSnapshotAt = Date.now(); processScan = null; resolve();
    });
  });
  return processScan.then(matches);
}
function processIdsInAppDirectory(directory) {
  const root = path.resolve(directory).replace(/'/g, "''");
  const script = `$root = '${root}'; @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) } | Select-Object -ExpandProperty ProcessId)`;
  return new Promise(resolve => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true }, (_error, stdout) => {
    const ids = String(stdout || '').split(/\r?\n/).map(value => Number.parseInt(value.trim(), 10)).filter(Number.isInteger);
    resolve([...new Set(ids)]);
  }));
}
async function stopAppProcesses(item) {
  const directory = appDir(item);
  let remaining = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    remaining = await processIdsInAppDirectory(directory);
    for (const pid of remaining) spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
    if (!remaining.length) {
      launchedExecutables.delete(item.executable);
      return;
    }
    await wait(300);
  }
  remaining = await processIdsInAppDirectory(directory);
  if (remaining.length) throw new Error(`Не удалось закрыть все процессы приложения ${item.name || item.id}: ${remaining.join(', ')}`);
}
async function latest(item) {
  try { return await apiJson(`https://api.github.com/repos/${item.owner}/${item.repo}/releases/latest`); }
  catch (error) { if (String(error.message).includes('403')) return githubLatestWithoutApi(item); throw error; }
}
function asset(release, name) { return (release.assets || []).find(x => x.name.toLowerCase() === name.toLowerCase()); }
function resolveItem(id, item) { return catalogItems.find(x => x.id === id) || (item && item.id === id ? item : null); }
async function installedPackageIsComplete(item) {
  const executable = await findExecutable(item);
  return Boolean(executable && fs.existsSync(path.join(path.dirname(executable), 'resources', 'app.asar')));
}
async function installOrUpdate(item, win, forceUpdate = false) {
  const release = await latest(item); const dir = appDir(item); await fsp.mkdir(dir, { recursive: true });
  const updateAsset = asset(release, 'update.zip'); const fullAsset = asset(release, 'win-unpacked.zip'); const installed = state[item.id]?.version;
  const complete = installed ? await installedPackageIsComplete(item) : false;
  const chosen = (!installed || !complete) ? fullAsset : (updateAsset || fullAsset); if (!chosen) throw new Error('В релизе нет win-unpacked.zip или update.zip');
  const zip = path.join(app.getPath('temp'), `${item.id}-${Date.now()}.zip`);
  try {
    try { await download(chosen.browser_download_url, zip, win, item.id); }
    catch (error) {
      if (chosen.name.toLowerCase() !== 'update.zip' || !fullAsset) throw error;
      await download(fullAsset.browser_download_url, zip, win, item.id);
    }
    win.webContents.send('download:progress', { id: item.id, stage: 'extracting' });
    await stopAppProcesses(item);
    await extract(zip, dir);
  } finally { await fsp.rm(zip, { force: true }).catch(() => {}); }
  state[item.id] = { version: release.tag_name, directory: dir }; await saveState(); return { version: release.tag_name, delta: chosen.name.toLowerCase() === 'update.zip' };
}
async function check(item) {
  const release = await latest(item);
  const savedVersion = state[item.id]?.version || null;
  const installedOnDisk = Boolean(await findExecutable(item));
  const installed = savedVersion || (installedOnDisk ? 'локально' : null);
  return { installed, latest: release.tag_name, update: Boolean(savedVersion && savedVersion !== release.tag_name), running: installedOnDisk && await isRunning(item) };
}
async function findExecutable(item) {
  if (!item?.id) return null;
  const root = appDir(item);
  const declared = typeof item.executable === 'string' && item.executable.trim() ? item.executable.trim() : null;
  const candidates = [
    ...(item.id === 'tiktimer' ? [path.join(root, 'ТАЙМЕР.exe')] : []),
    ...(declared ? [path.join(root, declared), path.join(root, 'win-unpacked', declared)] : [])
  ];
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;

  // Windows ZIP tools can decode non-ASCII filenames using the wrong code page.
  // Identify an Electron package by its adjacent resources/app.asar so a damaged
  // executable filename cannot make a complete installation look missing.
  for (const directory of [root, path.join(root, 'win-unpacked')]) {
    try {
      if (!fs.existsSync(path.join(directory, 'resources', 'app.asar'))) continue;
      const executables = (await fsp.readdir(directory, { withFileTypes: true }))
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.exe'))
        .map(entry => path.join(directory, entry.name));
      if (executables.length === 1) return executables[0];
      const preferred = executables.find(file => !/^(unins|elevate|squirrel|update)/i.test(path.basename(file)));
      if (preferred) return preferred;
    } catch (error) {
      writeLog('executable fallback scan failed', { id: item.id, directory, message: error.message });
    }
  }
  return null;
}
function trayIcon() {
  return nativeImage.createFromPath(path.join(__dirname, 'assets', 'efir-logo.png'));
}
function createWindow() {
  const win = new BrowserWindow({ title: 'EFIR launcher', width: 1357, height: 851, minWidth: 1357, minHeight: 851, frame: false, icon: path.join(__dirname, 'assets', 'efir-logo.png'), backgroundColor: '#101110', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('close', event => { if (!isQuitting) { event.preventDefault(); win.hide(); } });
  return win;
}
function createTray(win) {
  tray = new Tray(trayIcon());
  tray.setToolTip('EFIR launcher');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Открыть лаунчер', click: () => { win.show(); win.focus(); } }, { type: 'separator' }, { label: 'Выйти', click: () => { isQuitting = true; app.quit(); } }]));
  tray.on('click', () => { if (win.isVisible()) win.hide(); else { win.show(); win.focus(); } });
}
function closeLaunchedApps() {
  for (const pid of launchedPids) spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
  for (const executable of launchedExecutables) spawnSync('taskkill.exe', ['/IM', executable, '/T', '/F'], { windowsHide: true });
  launchedPids.clear();
  launchedExecutables.clear();
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function removeAppDirectory(directory, win) {
  const files = []; const folders = [];
  async function collect(folder) {
    folders.push(folder);
    for (const entry of await fsp.readdir(folder, { withFileTypes: true })) {
      const fullPath = path.join(folder, entry.name);
      if (entry.isDirectory()) await collect(fullPath); else files.push(fullPath);
    }
  }
  await collect(directory); let removed = 0;
  for (const file of files) {
    let removedFile = false;
    for (let attempt = 1; attempt <= 8 && !removedFile; attempt++) {
      try { await fsp.unlink(file); removedFile = true; }
      catch (error) { if (attempt === 8) throw error; await wait(700); }
    }
    removed++; win.webContents.send('uninstall:progress', { step: 'files', percent: Math.round(removed / Math.max(files.length, 1) * 100) });
  }
  for (const folder of folders.sort((a, b) => b.length - a.length)) await fsp.rmdir(folder).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
app.whenReady().then(() => {
  writeLog('launcher ready', { userData: app.getPath('userData'), platform: process.platform, electron: process.versions.electron });
  migrateLegacyData();
  loadState(); loadSettings(); loadCatalogCache(); mainWindow = createWindow(); createTray(mainWindow); if (process.argv.includes('--hidden')) mainWindow.hide();
  tiktokService = require('./tiktok-service.cjs').startTikTokService(app, mainWindow, ipcMain);
  selfUpdate = createSelfUpdate({
    updater: require('electron-updater').autoUpdater,
    currentVersion: app.getVersion(), enabled: app.isPackaged,
    publish: value => {
      if (mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('self-update:state', value);
      if (value.phase === 'available') {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show(); mainWindow.focus();
      }
    },
    beforeInstall: () => { isQuitting = true; }, log: writeLog
  });
  const updaterHandler = action => event => {
    if (event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Unauthorized update request');
    return action();
  };
  ipcMain.handle('self-update:get', updaterHandler(() => selfUpdate.snapshot()));
  ipcMain.handle('self-update:check', updaterHandler(() => selfUpdate.check()));
  ipcMain.handle('self-update:download', updaterHandler(() => selfUpdate.download()));
  ipcMain.handle('self-update:install', updaterHandler(() => selfUpdate.install()));
  setTimeout(() => selfUpdate.check(), 5000).unref();
  setInterval(() => selfUpdate.check(), 60 * 60 * 1000).unref();
  syncCatalog().catch(error => console.warn('[Astral Catalog]', error.message));
  ipcMain.handle('catalog:get', () => catalogItems);
  ipcMain.handle('auth:set-session', (_e, accessToken) => { supabaseAccessToken = typeof accessToken === 'string' ? accessToken : null; licenseStatusCache.clear(); if (!supabaseAccessToken) tiktokService.disconnect(); return true; });
  ipcMain.handle('settings:get', () => ({ ...launcherSettings, autoStart: app.getLoginItemSettings().openAtLogin }));
  ipcMain.handle('settings:auto-update', async (_e, enabled) => { launcherSettings.autoUpdate = Boolean(enabled); await saveSettings(); return { ...launcherSettings, autoStart: app.getLoginItemSettings().openAtLogin }; });
  ipcMain.handle('settings:auto-start', async (_e, enabled) => { launcherSettings.autoStart = Boolean(enabled); app.setLoginItemSettings({ openAtLogin: launcherSettings.autoStart, path: process.execPath, args: ['--hidden'] }); await saveSettings(); return { ...launcherSettings, autoStart: launcherSettings.autoStart }; });
  ipcMain.handle('promo:redeem', async (_e, code) => {
    const result = await licenseRequest('POST', '/v1/promos/redeem', { code });
    licenseStatusCache.clear();
    return result;
  });
  ipcMain.handle('subscription:get', () => licenseRequest('GET', '/v1/subscription'));
  ipcMain.handle('subscription:quote', (_e, months) => licenseRequest('GET', `/v1/subscription/quote?months=${encodeURIComponent(Number(months))}`));
  ipcMain.handle('subscription:create-order', (_e, months) => licenseRequest('POST', '/v1/subscription/orders', { months: Number(months) }));
  ipcMain.handle('subscription:verify-order', async (_e, orderId) => { const result = await licenseRequest('POST', `/v1/subscription/orders/${encodeURIComponent(orderId)}/verify`, {}); licenseStatusCache.clear(); return result; });
  ipcMain.handle('subscription:cancel-order', (_e, orderId) => licenseRequest('POST', `/v1/subscription/orders/${encodeURIComponent(orderId)}/cancel`, {}));
  ipcMain.handle('external:open', async (_e, target) => { const parsed = new URL(String(target)); if (!['https:', 'http:', 'ton:'].includes(parsed.protocol)) throw new Error('Unsupported external protocol'); await shell.openExternal(parsed.toString()); return true; });
  ipcMain.handle('catalog:sync', async () => syncCatalog());
  ipcMain.handle('apps:cached', async () => Promise.all(catalogItems.map(async item => ({ id: item.id, installedVersion: state[item.id]?.version || null, installedOnDisk: Boolean(await findExecutable(item)), running: await isRunning(item), licenseAvailable: await checkLicense(item.id).catch(() => false) }))));
  ipcMain.handle('window:minimize', () => mainWindow.minimize());
  ipcMain.handle('window:maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
  ipcMain.handle('window:close', () => mainWindow.hide());
  ipcMain.handle('apps:list', async () => Promise.all(catalogItems.map(async item => { const status = await check(item).catch(error => ({ error: error.message })); return { ...item, ...status, licenseAvailable: await checkLicense(item.id).catch(() => false) }; })));
  ipcMain.handle('apps:status', async () => Promise.all(catalogItems.map(async item => ({ id: item.id, installedVersion: state[item.id]?.version || null, installedOnDisk: Boolean(await findExecutable(item)), running: await isRunning(item), licenseAvailable: await checkLicense(item.id).catch(() => null) }))));
  ipcMain.handle('app:status', async (_e, item) => ({ id: item.id, installedOnDisk: Boolean(await findExecutable(item)), running: await isRunning(item), licenseAvailable: item?.id ? await checkLicense(item.id).catch(() => null) : false }));
  async function requireSubscription(item) { if (!item?.id || !(await checkLicense(item.id))) throw new Error('Активная подписка необходима для скачивания и запуска приложения'); }
  ipcMain.handle('app:install', async (_e, payload) => { const item = resolveItem(payload.id, payload.item); await requireSubscription(item); return installOrUpdate(item, mainWindow); });
  ipcMain.handle('app:update', async (_e, payload) => { const item = resolveItem(payload.id, payload.item); await requireSubscription(item); return installOrUpdate(item, mainWindow, true); });
  ipcMain.handle('app:launch', async (_e, payload) => {
    const item = resolveItem(payload.id, payload.item); const exe = await findExecutable(item);
    if (!exe) throw new Error('Сначала установите приложение');
    await requireSubscription(item);
    writeLog('launch requested', { id: item?.id, executable: exe, cwd: exe ? path.dirname(exe) : null, electronRunAsNode: process.env.ELECTRON_RUN_AS_NODE || null });
    if (item.id) {
      if (!NNSI_TICKET_PUBLIC_KEY) throw new Error('В лаунчере не настроен NNSI_TICKET_PUBLIC_KEY.');
      const ticketResponse = await issueLaunchTicket(item.id, supabaseAccessToken);
      writeLog('launch ticket issued', { id: item.id, expiresAt: ticketResponse.expires_at });
      const launchEnv = { ...process.env, ...await tiktokService.environment(), ...await walletGateway.environment(), NNSI_LAUNCH_TICKET: ticketResponse.ticket, NNSI_TICKET_PUBLIC_KEY: NNSI_TICKET_PUBLIC_KEY };
      delete launchEnv.ELECTRON_RUN_AS_NODE;
      const child = spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore', windowsHide: false, env: launchEnv });
      trackProcess(child, path.dirname(exe));
      writeLog('child spawned', { pid: child.pid, executable: exe });
      child.on('error', error => { writeLog('child spawn error', { pid: child.pid, message: error.message, stack: error.stack }); console.warn('[NNSI Launch]', error.message); });
      child.on('exit', (code, signal) => writeLog('child exited', { pid: child.pid, code, signal }));
      launchedPids.add(child.pid); child.on('exit', () => launchedPids.delete(child.pid)); child.unref(); launchedExecutables.add(item.executable);
      return true;
    }
    const token = crypto.randomBytes(32).toString('hex');
    const launchEnv = { ...process.env, ...await tiktokService.environment(), ...await walletGateway.environment(), ASTRAL_LAUNCHER_TOKEN: token };
    delete launchEnv.ELECTRON_RUN_AS_NODE;
    const child = spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore', windowsHide: false, env: launchEnv });
    trackProcess(child, path.dirname(exe));
    writeLog('child spawned', { pid: child.pid, executable: exe });
    child.on('error', error => { writeLog('child spawn error', { pid: child.pid, message: error.message, stack: error.stack }); console.warn('[Astral Launch]', error.message); });
    child.on('exit', (code, signal) => writeLog('child exited', { pid: child.pid, code, signal }));
    launchedPids.add(child.pid); child.on('exit', () => launchedPids.delete(child.pid)); child.unref(); launchedExecutables.add(item.executable);
    setTimeout(() => {
      writeLog('focusing child window', { pid: child.pid });
      spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', `(New-Object -ComObject WScript.Shell).AppActivate(${child.pid})`], { windowsHide: true, stdio: 'ignore' }).unref();
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "$items = @(Get-Process -Name TikTimer,ТАЙМЕР -ErrorAction SilentlyContinue | Select-Object Id,MainWindowHandle,MainWindowTitle,Responding,Path); $items | ConvertTo-Json -Compress"], { windowsHide: true }, (_error, stdout) => {
        writeLog('windows after launch', { childPid: child.pid, processes: String(stdout || '').trim() });
      });
    }, 1200);
    return true;
  });
  ipcMain.handle('app:close', async (_e, payload) => {
    const item = resolveItem(payload.id, payload.item);
    if (!item) throw new Error('Приложение не найдено');
    await stopAppProcesses(item);
    return true;
  });
  ipcMain.handle('app:uninstall', async (_e, payload) => {
    const item = resolveItem(payload.id, payload.item);
    if (!item) throw new Error('Приложение не найдено');
    mainWindow.webContents.send('uninstall:progress', { step: 'closing' });
    await stopAppProcesses(item);
    mainWindow.webContents.send('uninstall:progress', { step: 'files' });
    await removeAppDirectory(appDir(item), mainWindow);
    mainWindow.webContents.send('uninstall:progress', { step: 'done' });
    delete state[item.id]; await saveState(); launchedExecutables.delete(item.executable);
    return true;
  });
});
app.on('before-quit', () => { isQuitting = true; closeLaunchedApps(); });
app.on('window-all-closed', event => { event.preventDefault(); });
