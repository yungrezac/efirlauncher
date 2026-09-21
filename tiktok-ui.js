(() => {
  const panel = document.createElement('section');
  panel.className = 'tiktok-panel';
  panel.innerHTML = '<form id="tiktok-form"><strong>TikTok LIVE</strong><label>Аккаунт <input id="tiktok-username" placeholder="@username" maxlength="33" autocomplete="off" required></label><button type="submit" id="tiktok-connect">Подключить</button><button type="button" id="tiktok-disconnect">Отключить</button></form><p id="tiktok-status" role="status">Не подключено</p><small>Общий эфир для всех приложений. Управление подключением — здесь.</small>';
  document.querySelector('#store main').prepend(panel);
  const input = panel.querySelector('input');
  const status = panel.querySelector('#tiktok-status');
  const render = state => {
    if (document.activeElement !== input && state.username) input.value = state.username;
    panel.querySelector('#tiktok-connect').disabled = state.status === 'connecting';
    panel.querySelector('#tiktok-disconnect').disabled = state.status === 'offline' && !state.retryIn;
    status.textContent = `${state.status === 'live' ? 'В эфире @' + state.username : state.status === 'connecting' ? 'Подключение…' : 'Не подключено'} · приложений: ${state.subscribers || 0}${state.message ? ' · ' + state.message : ''}`;
  };
  panel.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    try { await window.launcher.connectTikTok(input.value); } catch (error) { status.textContent = error.message; }
  });
  panel.querySelector('#tiktok-disconnect').onclick = () => window.launcher.disconnectTikTok().catch(error => { status.textContent = error.message; });
  window.launcher.onTikTokState(render);
  window.launcher.getTikTokState().then(render);
})();
