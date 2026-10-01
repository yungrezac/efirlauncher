'use strict';
const crypto = require('node:crypto');
const LOGIN_ORIGIN = 'https://license-server-production-8e69.up.railway.app';
const CHECKOUT = 'https://web.tribute.tg/s/17SJ';
function secureUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
function createSubscriptionWindows({ BrowserWindow, session, parent, icon, show = true, onPaymentClosed = () => {} }) {
  let partition, paymentWindow;
  const windows = new Set();
  function closeAll() { for (const win of [...windows]) if (!win.isDestroyed()) win.destroy(); }
  function reset() { closeAll(); partition = undefined; }
  function getPartition() {
    if (!partition) {
      partition = 'efir-subscription-' + crypto.randomUUID();
      const isolated = session.fromPartition(partition);
      isolated.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
      isolated.setPermissionCheckHandler(() => false);
      isolated.on('will-download', event => event.preventDefault());
    }
    return partition;
  }
  function options(label) {
    return { parent, title: label, width: 620, height: 820, minWidth: 420, minHeight: 600,
      icon, backgroundColor: '#101510', autoHideMenuBar: true, show,
      webPreferences: { partition: getPartition(), sandbox: true, contextIsolation: true,
        nodeIntegration: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false,
        webSecurity: true, allowRunningInsecureContent: false, webviewTag: false } };
  }
  function protect(win, label) {
    windows.add(win); win.setMenu(null);
    win.on('closed', () => windows.delete(win));
    win.webContents.on('will-attach-webview', event => event.preventDefault());
    for (const eventName of ['will-navigate', 'will-redirect']) win.webContents.on(eventName, (event, url) => {
      if (!secureUrl(url)) event.preventDefault();
    });
    win.webContents.on('page-title-updated', event => event.preventDefault());
    win.webContents.on('did-navigate', (_event, url) => {
      if (secureUrl(url)) win.setTitle(label + ' — ' + new URL(url).hostname);
    });
    // Keep Telegram's window.opener/postMessage flow intact; every popup is isolated too.
    win.webContents.setWindowOpenHandler(({url}) => secureUrl(url) && windows.size < 6
      ? { action: 'allow', overrideBrowserWindowOptions: options(label) }
      : { action: 'deny' });
    win.webContents.on('did-create-window', child => protect(child, label));
    return win;
  }
  async function openLogin(value) {
    const u = new URL(value);
    if (u.origin !== LOGIN_ORIGIN || !['/', '/v1/telegram/login'].includes(u.pathname) || !/^#[a-f0-9]{48}$/.test(u.hash) || u.search || u.username || u.password) throw Error('Некорректный адрес входа Telegram.');
    reset(); // A new isolated session lets the user choose a different Telegram account.
    const win = protect(new BrowserWindow(options('Вход в Telegram · EFIR')), 'Вход в Telegram · EFIR');
    try { await win.loadURL(u.href); } catch { if (!win.isDestroyed()) win.destroy(); throw Error('Не удалось загрузить вход Telegram. Проверьте интернет и повторите попытку.'); }
  }
  async function openPayment(value) {
    if (value !== CHECKOUT) throw Error('Оплата недоступна. Сначала подтвердите Telegram.');
    if (paymentWindow && !paymentWindow.isDestroyed()) { paymentWindow.show(); paymentWindow.focus(); return; }
    const win = paymentWindow = protect(new BrowserWindow(options('Подписка Tribute · EFIR')), 'Подписка Tribute · EFIR');
    win.once('close', () => onPaymentClosed());
    win.once('closed', () => { if (paymentWindow === win) paymentWindow = null; });
    try { await win.loadURL(CHECKOUT); } catch { if (!win.isDestroyed()) win.destroy(); throw Error('Не удалось загрузить Tribute. Проверьте интернет и повторите попытку.'); }
  }
  return { openLogin, openPayment, finishLogin: closeAll, reset };
}
module.exports = { createSubscriptionWindows, secureUrl };
