'use strict';

function createSelfUpdate({ updater, currentVersion, enabled, publish, beforeInstall, log = () => {} }) {
  let state = { phase: 'idle', currentVersion, version: null, percent: 0 };
  let checking = null;
  let downloading = null;
  let retry = 'check';
  const snapshot = () => ({ ...state });
  const set = patch => { state = { ...state, ...patch }; publish(snapshot()); };
  const fail = error => {
    log('launcher update failed', { message: error?.message || String(error) });
    set({ phase: 'error', retry, message: retry === 'download'
      ? 'Не удалось скачать обновление. Проверьте подключение и повторите попытку.'
      : 'Не удалось проверить обновления. Попробуйте позже.' });
  };
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.disableWebInstaller = true;
  updater.on('update-available', info => set({ phase: 'available', version: info.version, message: null, percent: 0 }));
  updater.on('update-not-available', () => set({ phase: 'current', version: null, message: null }));
  updater.on('download-progress', info => set({ phase: 'downloading', percent: Math.max(0, Math.min(100, Number(info.percent) || 0)), transferred: info.transferred, total: info.total, bytesPerSecond: info.bytesPerSecond }));
  updater.on('update-downloaded', info => set({ phase: 'ready', version: info.version, percent: 100 }));
  updater.on('error', fail);
  return {
    snapshot,
    async check() {
      if (!enabled) { set({ phase: 'disabled', message: 'Проверка обновлений доступна в установленном лаунчере.' }); return snapshot(); }
      if (checking) return checking;
      if (['available', 'downloading', 'ready', 'installing'].includes(state.phase)) return snapshot();
      retry = 'check';
      set({ phase: 'checking', message: null });
      checking = Promise.resolve().then(() => updater.checkForUpdates()).catch(fail).then(snapshot).finally(() => { checking = null; });
      return checking;
    },
    async download() {
      if (downloading) return downloading;
      if (!enabled || !(state.phase === 'available' || (state.phase === 'error' && retry === 'download'))) return snapshot();
      retry = 'download';
      set({ phase: 'downloading', message: null, percent: 0, transferred: 0, total: 0 });
      downloading = Promise.resolve().then(() => updater.downloadUpdate()).catch(fail).then(snapshot).finally(() => { downloading = null; });
      return downloading;
    },
    install() {
      if (!enabled || state.phase !== 'ready') return false;
      set({ phase: 'installing' });
      try { beforeInstall(); updater.quitAndInstall(false, true); return true; }
      catch (error) { fail(error); return false; }
    }
  };
}
module.exports = { createSelfUpdate };
