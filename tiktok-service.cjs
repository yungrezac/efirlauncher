const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { fork } = require('node:child_process');
function startTikTokService(app, mainWindow, ipcMain) {
  const token = crypto.randomBytes(32).toString('hex');
  const profile = path.join(app.getPath('userData'), 'tiktok.json');
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(profile, 'utf8')); } catch {}
  let username = saved.username || '';
  let state = { status: 'offline', username, nickname:saved.nickname || username,avatar:saved.avatar || '',roomId: '', message: '', subscribers: 0 };
  let cachedProfile = JSON.stringify(saved);
  let streams=[];
  const publish = patch => {
    state = { ...state, ...patch };
    if (state.username && state.avatar) {
      const next=JSON.stringify({username:state.username,nickname:state.nickname,avatar:state.avatar});
      if(next!==cachedProfile){cachedProfile=next;fs.writeFileSync(profile,next);}
    }
    if (process.env.NNSI_DEV_SMOKE === '1') fs.writeFileSync(path.join(app.getPath('userData'), 'tiktok-status.json'), JSON.stringify(state, null, 2));
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('tiktok:state', state);
  };
  // Electron can run a regular Node child when ELECTRON_RUN_AS_NODE is set.
  // Reusing the packaged executable avoids shipping a second ~90 MB Node binary.
  const node = app.isPackaged ? process.execPath : path.resolve(__dirname, '../../runtimes/node/node.exe');
  const script = app.isPackaged ? path.join(process.resourcesPath, 'tiktok-service/worker.cjs') : path.join(__dirname, 'tiktok-service/worker.cjs');
  const log = fs.openSync(path.join(app.getPath('userData'), 'tiktok-service.log'), 'a');
  const childEnv = { ...process.env, NNSI_TIKTOK_TOKEN: token };
  if (app.isPackaged) childEnv.ELECTRON_RUN_AS_NODE = '1';
  const child = fork(script, [], { execPath: node, windowsHide: true, stdio: ['ignore', log, log, 'ipc'], env: childEnv });
  fs.closeSync(log);
  let port;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    rejectReady = reject;
    const timer = setTimeout(() => reject(new Error('Сервис TikTok не запустился за 20 секунд')), 20000);
    child.on('message', message => {
      if (message.type === 'ready') { clearTimeout(timer); port = message.port; resolve(); }
      if (message.type === 'status') publish(message.state);
      if (message.type === 'metrics') streams=message.streams;
    });
  });
  ready.catch(error => publish({ status: 'offline', message: error.message }));
  ready.then(()=>{if(username&&child.connected)child.send({type:'connect',username});}).catch(()=>{});
  const failed = error => { rejectReady(error); publish({ status: 'offline', roomId: '', message: error.message }); };
  child.on('error', failed);
  child.on('exit', () => failed(new Error('Сервис TikTok остановлен. Перезапустите лаунчер.')));
  const guard = callback => (event, ...args) => {
    if (event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Unauthorized TikTok request');
    return callback(...args);
  };
  ipcMain.handle('tiktok:get', guard(() => state));
  ipcMain.handle('tiktok:connect', guard(async value => {
    const clean = String(value || '').trim().replace(/^@/, '');
    if (!/^[a-zA-Z0-9_.]{1,32}$/.test(clean)) throw new Error('Введите имя TikTok без ссылки и пробелов');
    await ready;
    if (!child.connected) throw new Error('Сервис TikTok остановлен');
    if (state.username === clean && ['connecting','live'].includes(state.status)) return true;
    fs.writeFileSync(profile, JSON.stringify({ username: clean }, null, 2));
    child.send({ type: 'connect', username: clean });
    return true;
  }));
  const disconnect = () => { if (child.connected) child.send({ type: 'connect', username: '' }); };
  ipcMain.handle('tiktok:disconnect', guard(disconnect));
  app.once('will-quit', () => child.kill());
  return {
    disconnect,
    resetMetrics:()=>{streams=[];if(child.connected)child.send({type:'reset-metrics'});},
    snapshot:()=>({stream:{status:state.status,username:state.username,roomId:state.roomId},streams}),
    async environment() { await ready; if (!child.connected) throw new Error('Сервис TikTok остановлен'); return { NNSI_TIKTOK_PORT: String(port), NNSI_TIKTOK_TOKEN: token }; }
  };
}
module.exports = { startTikTokService };
