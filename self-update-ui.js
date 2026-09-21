(() => {
  const api = window.launcher;
  if (!api?.getSelfUpdate) return;
  let state = null;
  let dismissed = null;
  let manual = false;
  let previousFocus;
  const overlay = document.createElement('div');
  overlay.className = 'self-update-overlay hidden';
  overlay.innerHTML = '<section class="self-update-card" role="dialog" aria-modal="true" aria-labelledby="self-update-title"><span class="self-update-label">EFIR LAUNCHER</span><h2 id="self-update-title"></h2><p class="self-update-description"></p><div class="self-update-progress hidden"><progress max="100" value="0" aria-label="Скачивание обновления"></progress><div class="self-update-metrics" aria-live="polite"></div></div><p class="self-update-note"></p><div class="self-update-actions"><button class="self-update-later">Позже</button><button class="self-update-primary">Обновить</button></div></section>';
  document.body.appendChild(overlay);
  const find = selector => overlay.querySelector(selector);
  const hide = () => { overlay.classList.add('hidden'); previousFocus?.focus?.(); };
  const bytes = value => (Math.max(0, Number(value) || 0) / 1048576).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' МБ';
  function render(next) {
    if (!next) return;
    state = next;
    const phase = state.phase;
    if (!manual && (['idle', 'checking', 'current', 'disabled'].includes(phase) || (phase === 'error' && state.retry !== 'download'))) return;
    if (!manual && phase === 'available' && dismissed === state.version) return;
    const wasHidden = overlay.classList.contains('hidden');
    if (wasHidden) previousFocus = document.activeElement;
    overlay.classList.remove('hidden');
    const busy = ['checking', 'downloading', 'installing'].includes(phase);
    const titles = { available: 'Доступна новая версия', downloading: 'Скачиваем обновление', ready: 'Обновление готово', installing: 'Запускаем установщик', error: 'Обновление не выполнено', checking: 'Проверяем обновления', current: 'У вас последняя версия', disabled: 'Обновление лаунчера' };
    find('h2').textContent = titles[phase] || 'Обновление лаунчера';
    find('.self-update-description').textContent = state.message || (state.version ? 'Версия ' + state.currentVersion + ' → ' + state.version : 'Текущая версия: ' + state.currentVersion);
    find('.self-update-note').textContent = ['available', 'downloading', 'ready'].includes(phase) ? 'После скачивания нажмите «Установить». Лаунчер и запущенные через него программы закроются. Сохраните работу перед установкой.' : '';
    find('.self-update-progress').classList.toggle('hidden', phase !== 'downloading');
    const progress = find('progress');
    if (state.total > 0) progress.value = state.percent || 0; else progress.removeAttribute('value');
    find('.self-update-metrics').textContent = Math.round(state.percent || 0) + '% · ' + bytes(state.transferred) + (state.total ? ' / ' + bytes(state.total) : '') + (state.bytesPerSecond ? ' · ' + bytes(state.bytesPerSecond) + '/с' : '');
    const primary = find('.self-update-primary');
    primary.disabled = busy;
    primary.hidden = ['current', 'disabled'].includes(phase);
    primary.textContent = phase === 'ready' ? 'Установить' : phase === 'error' ? 'Повторить' : busy ? 'Подождите…' : 'Обновить';
    find('.self-update-later').disabled = ['downloading', 'installing'].includes(phase);
    find('.self-update-later').textContent = ['current', 'disabled', 'error'].includes(phase) ? 'Закрыть' : 'Позже';
    if (wasHidden) (primary.disabled || primary.hidden ? find('.self-update-later') : primary).focus();
  }
  find('.self-update-later').addEventListener('click', () => { dismissed = state?.version; manual = false; hide(); });
  find('.self-update-primary').addEventListener('click', async () => {
    try {
      if (state?.phase === 'ready') await api.installSelfUpdate();
      else if (state?.phase === 'error' && state.retry !== 'download') render(await api.checkSelfUpdate());
      else render(await api.downloadSelfUpdate());
    } catch { render({ ...state, phase: 'error', retry: 'check', message: 'Не удалось выполнить обновление. Повторите попытку.' }); }
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !find('.self-update-later').disabled) find('.self-update-later').click();
    if (event.key === 'Tab') {
      const buttons = [...overlay.querySelectorAll('button')].filter(button => !button.disabled && !button.hidden);
      if (!buttons.length) { event.preventDefault(); return; }
      const index = buttons.indexOf(document.activeElement);
      event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
  });
  api.onSelfUpdate(render);
  api.getSelfUpdate().then(render).catch(() => {});
  // Settings is dynamically rendered; add a manual check without coupling to its redraws.
  const profile = document.querySelector('#profile-view');
  const addSettings = () => {
    const panel = profile?.querySelector('.settings-panel');
    if (!panel || panel.querySelector('.self-update-check')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'self-update-check'; button.textContent = 'Проверить обновление лаунчера';
    button.addEventListener('click', async () => { manual = true; dismissed = null; render({ ...state, phase: 'checking' }); try { render(await api.checkSelfUpdate()); } catch { render({ ...state, phase: 'error', retry: 'check', message: 'Проверка обновлений не удалась.' }); } });
    panel.appendChild(button);
  };
  if (profile) new MutationObserver(addSettings).observe(profile, { childList: true, subtree: true });
  addSettings();
})();
