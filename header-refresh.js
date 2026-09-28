(() => {
  const tiktok = document.querySelector('.tiktok-control');
  if (!tiktok) return;
  const control = document.createElement('div');
  control.className = 'catalog-refresh-control';
  control.innerHTML = `<button id="catalog-refresh" type="button" title="Обновить каталог и проверить обновления" aria-label="Обновить каталог и проверить обновления" aria-busy="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1A8 8 0 0 1 19.8 11M4.2 13A8 8 0 0 0 17.9 17.9"/></svg></button><span class="catalog-refresh-result" role="status" aria-live="polite"></span>`;
  tiktok.before(control);
  const button = control.querySelector('button');
  const result = control.querySelector('[role="status"]');
  let pending = false, hideTimer;
  button.addEventListener('click', async () => {
    if (pending) return;
    pending = true;
    clearTimeout(hideTimer);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    control.dataset.state = 'checking';
    result.textContent = 'Обновляем каталог и проверяем версии…';
    try {
      const [catalog, launcher] = await Promise.allSettled([
        Promise.resolve().then(() => window.efirCatalog.refresh()),
        Promise.resolve().then(() => window.launcher.checkSelfUpdate())
      ]);
      const failed = catalog.status === 'rejected' || catalog.value.failed > 0 || launcher.status === 'rejected' || launcher.value?.phase === 'error';
      const updates = (catalog.status === 'fulfilled' ? catalog.value.updates : 0) + (launcher.status === 'fulfilled' && ['available', 'downloading', 'ready'].includes(launcher.value?.phase) ? 1 : 0);
      control.dataset.state = failed ? 'error' : 'success';
      result.textContent = catalog.status === 'rejected' ? 'Не удалось обновить каталог. Повторите попытку.' : failed ? 'Каталог обновлён. Часть обновлений проверить не удалось.' : updates ? `Каталог обновлён. Доступно обновлений: ${updates}` : 'Каталог обновлён. У вас последние версии.';
    } catch {
      control.dataset.state = 'error';
      result.textContent = 'Проверка не удалась. Повторите попытку.';
    } finally {
      pending = false;
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
      button.title = result.textContent;
      hideTimer = setTimeout(() => { delete control.dataset.state; button.title = 'Обновить каталог и проверить обновления'; }, 6000);
    }
  });
})();
