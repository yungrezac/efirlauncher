(() => {
  'use strict';
  const api = window.launcher;
  const client = window.efirLandingClient;
  if (!api?.claimReferral || !client) return;
  let pending = null, account = null, overlay = null, requestId = 0;
  const nav = document.createElement('button');
  nav.id = 'referral-nav';
  nav.type = 'button';
  nav.textContent = 'Код автора';
  document.querySelector('#store .topbar nav')?.append(nav);
  const hint = document.createElement('p');
  hint.className = 'message';
  hint.hidden = true;
  document.querySelector('#auth-form')?.append(hint);

  function close() {
    requestId++;
    overlay?.remove();
    overlay = null;
  }
  function updateHint() {
    hint.hidden = !pending;
    hint.textContent = pending ? `Код автора ${pending.code} сохранён. После входа подтвердите его в разделе «Код автора».` : '';
    nav.textContent = pending ? 'Код автора •' : 'Код автора';
    nav.title = pending ? `Подтвердить код ${pending.code}` : 'Ввести код со страницы автора';
  }
  async function open() {
    if (!account) return;
    close();
    const version = requestId, user = account;
    overlay = document.createElement('div');
    overlay.className = 'subscription-overlay';
    overlay.innerHTML = '<section class="subscription-box" role="dialog" aria-modal="true" aria-labelledby="referral-title"><h3 id="referral-title">Код автора</h3><p>Код со страницы автора добавит TIMER и IMMWIGET в ваш каталог. Для запуска нужна подписка. Код закрепляется за аккаунтом один раз.</p><form class="promo-form"><label for="referral-code">Код автора</label><input id="referral-code" name="code" maxlength="40" minlength="3" pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,39}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Например, имя автора" required><div class="subscription-actions"><button type="submit" disabled>Подтвердить код</button><button type="button" data-referral-close>Закрыть</button></div><p class="promo-result" role="status" aria-live="polite">Проверяем код аккаунта…</p></form></section>';
    const panel = overlay;
    const form = panel.querySelector('form'), input = panel.querySelector('input');
    const submit = form.querySelector('[type="submit"]'), result = form.querySelector('[role="status"]');
    input.value = pending?.code || '';
    panel.querySelector('[data-referral-close]').onclick = close;
    panel.addEventListener('click', event => { if (event.target === panel) close(); });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const focusable = [...panel.querySelectorAll('input,button')].filter(element => !element.disabled);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    document.body.append(panel);
    input.focus();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled || !form.reportValidity()) return;
      submit.disabled = true;
      result.textContent = 'Сохраняем код…';
      try {
        const saved = await api.claimReferral(input.value.trim().toLowerCase());
        if (version !== requestId || account !== user) return;
        input.value = saved.code;
        input.disabled = true;
        pending = null;
        updateHint();
        result.textContent = 'Код закреплён за аккаунтом. TIMER и IMMWIGET доступны в каталоге. Для запуска нужна подписка.';
        try { await window.efirCatalog.refresh(); }
        catch { if (version === requestId) result.textContent = 'Код закреплён. Не удалось обновить каталог: нажмите обновление, когда появится интернет.'; }
      } catch (error) {
        if (version !== requestId || account !== user) return;
        result.textContent = error.message || 'Не удалось сохранить код. Повторите попытку.';
        submit.disabled = false;
      }
    });
    try {
      const state = await api.getReferralStatus();
      if (version !== requestId || account !== user) return;
      if (state.referral) {
        input.value = state.referral.code;
        input.disabled = true;
        result.textContent = `Ваш автор: ${state.referral.creator_name || state.referral.code}. Код ${state.referral.code} уже закреплён за аккаунтом.`;
      } else { result.textContent = ''; submit.disabled = false; }
    } catch {
      if (version !== requestId || account !== user) return;
      result.textContent = 'Не удалось проверить текущий код. Можно повторить подтверждение: уже сохранённый код не изменится.';
      submit.disabled = false;
    }
  }
  nav.onclick = open;
  function changed(session) {
    const next = session?.user?.id || null;
    if (next !== account) { close(); account = next; }
    updateHint();
  }
  client.auth.getSession().then(({ data }) => changed(data.session)).catch(() => {});
  client.auth.onAuthStateChange((_event, session) => changed(session));
  api.getPendingReferral().then(value => { pending = value; updateHint(); }).catch(() => {});
  api.onReferralPending(value => { pending = value; updateHint(); if (account) open(); });
})();
