(function () {
const SUPABASE_URL = 'https://qpoyojxupblhjeqbvqfr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QxJKRVOdn07hduJkqcbciw_oUADNl-C';
const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = selector => document.querySelector(selector);
// Обработчик профиля подключаем сразу: верхняя панель имеет прозрачные слои,
// поэтому поздняя регистрация могла теряться после ошибки другого элемента.
document.addEventListener('click', event => {
  const profileButton = event.target.closest?.('#profile-button');
  if (!profileButton) return;
  event.preventDefault();
  event.stopPropagation();
  openProfile();
}, true);
$('#auth-form').setAttribute('novalidate', 'true');


const windowControls = document.createElement('div'); windowControls.className = 'window-controls'; windowControls.innerHTML = '<button class="window-control" id="window-minimize" title="Свернуть">−</button><button class="window-control" id="window-maximize" title="Развернуть">□</button><button class="window-control close" id="window-close" title="Скрыть в трей">×</button>'; $('.topbar').appendChild(windowControls);
$('#window-minimize').addEventListener('click', () => window.launcher.minimize());
$('#window-maximize').addEventListener('click', () => window.launcher.maximize());
$('#window-close').addEventListener('click', () => window.launcher.closeLauncher());
const catalogNav = document.createElement('button'); catalogNav.id = 'catalog-nav'; catalogNav.textContent = 'Каталог'; $('#apps-nav').textContent = 'Мои'; $('#apps-nav').parentElement.appendChild(catalogNav);
const exclusiveNav = document.createElement('button'); exclusiveNav.id = 'exclusive-nav'; exclusiveNav.textContent = 'Эксклюзив'; catalogNav.after(exclusiveNav);
exclusiveNav.addEventListener('click', () => switchView('exclusive'));
function switchView(mode) { viewMode = mode; const catalogMode = mode === 'catalog'; $('#apps-nav').classList.toggle('nav-active', mode === 'mine'); exclusiveNav.classList.toggle('nav-active', mode === 'exclusive'); catalogNav.classList.toggle('nav-active', catalogMode); $('#home-view .section-heading .eyebrow').textContent = mode === 'exclusive' ? 'ЭКСКЛЮЗИВ' : catalogMode ? 'КАТАЛОГ' : 'МОИ ПРИЛОЖЕНИЯ'; $('#home-view .section-heading h2').textContent = mode === 'exclusive' ? 'Доступно лично вам' : catalogMode ? 'Каталог приложений' : 'Ваши приложения'; renderApps(); }
$('#apps-nav').addEventListener('click', event => { event.preventDefault(); switchView('mine'); });
catalogNav.addEventListener('click', event => { event.preventDefault(); switchView('catalog'); });








let authMode = 'login';
let apps = [];
let accountSubscription = null;
let selectedAppId = null;
let viewMode = 'mine';
const activeOperations = new Map();
const pendingAppActions = new Map();
const appVersions = new Map();
let launcherSettings = { autoUpdate: false, autoStart: false };
const automaticUpdates = new Set();

function show(selector) { const element = $(selector); element.classList.remove('hidden'); if (selector === '#auth') element.style.visibility = 'visible'; }
function hide(selector) { $(selector).classList.add('hidden'); }
function message(text, error = false) { const el = $('#auth-message'); el.textContent = text; el.className = `message ${error ? 'error' : ''}`; }





function showSubscriptionModal() { if ($('.subscription-overlay')) return; const overlay = document.createElement('div'); overlay.className = 'subscription-overlay'; overlay.innerHTML = '<div class="subscription-box"><h3>Доступно только по подписке</h3><p>Для запуска ТАЙМЕР нужна активная подписка или лицензия.</p><button type="button">Понятно</button></div>'; document.body.appendChild(overlay); overlay.querySelector('button').addEventListener('click', () => overlay.remove()); overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); }); }






function appAction(item) { if (item.licenseAvailable === false) return 'unavailable'; if (item.running) return 'close'; if (item.update && item.installed) return 'update'; return item.installed ? 'launch' : 'install'; }
function appActionText(action) { return ({ unavailable: 'Недоступно', close: 'Закрыть', update: 'Обновить', launch: 'Открыть', install: 'Установить' })[action] || 'Недоступно'; }
function openProfile() { renderProfilePage('account'); }
function renderProfilePage(section = 'account') { hide('#home-view'); hide('#detail-view'); show('#profile-view'); $('#store .topbar nav').style.display = 'none'; $('#profile-menu').classList.add('hidden'); const name = $('#profile-name').textContent || 'Пользователь'; const email = $('#profile-menu-email').textContent || ''; const license = apps.find(item => item.id === 'tiktimer')?.licenseAvailable === true; const content = section === 'subscription' ? `<div class="profile-heading"><div class="profile-large-avatar">$</div><div><h1>Подписка</h1><p class="profile-page-subtitle">Управление доступом к приложениям</p></div></div><div class="subscription-panel"><h2>ТАЙМЕР</h2><p>${license ? 'Подписка активна. Приложение доступно для запуска на этом компьютере.' : 'Для запуска ТАЙМЕР требуется активная подписка или лицензия.'}</p><span class="subscription-status${license ? ' active' : ''}">${license ? 'Активна' : 'Не активна'}</span></div>` : `<div class="profile-heading"><div class="profile-large-avatar">${$('#profile-avatar').textContent || '?'}</div><div><h1>Профиль</h1><p class="profile-page-subtitle">${name}</p></div></div><div class="profile-info"><div class="profile-info-row"><span>Имя</span><strong>${name}</strong></div><div class="profile-info-row"><span>Email</span><strong>${email}</strong></div><div class="profile-info-row"><span>Статус</span><strong>Аккаунт EFIR launcher</strong></div></div>`; $('#profile-view').innerHTML = `<div class="profile-layout"><aside class="profile-sidebar"><button class="profile-page-back" id="profile-back" title="Назад">‹</button><nav><button class="profile-nav-button${section === 'account' ? ' active' : ''}" data-profile-section="account">Аккаунт</button><button class="profile-nav-button${section === 'subscription' ? ' active' : ''}" data-profile-section="subscription">Подписка</button></nav></aside><div class="profile-content">${content}</div><button class="profile-logout" id="profile-logout">Выйти из аккаунта</button></div>`; $('#profile-back').addEventListener('click', showHomeView); $('#profile-logout').addEventListener('click', logout); $('#profile-view').querySelectorAll('[data-profile-section]').forEach(button => button.addEventListener('click', () => renderProfilePage(button.dataset.profileSection))); }
function renderProfilePage(section = 'account') { const name = $('#profile-name').textContent || 'Пользователь'; const email = $('#profile-menu-email').textContent || ''; const license = apps.find(item => item.id === 'tiktimer')?.licenseAvailable === true; const content = section === 'subscription' ? `<div class="profile-heading"><div class="profile-large-avatar">$</div><div><h1>Подписка</h1><p class="profile-page-subtitle">Управление доступом к приложениям</p></div></div><div class="subscription-panel"><h2>ТАЙМЕР</h2><p>${license ? 'Подписка активна. Приложение доступно для запуска на этом компьютере.' : 'Для запуска ТАЙМЕР требуется активная подписка или лицензия.'}</p><span class="subscription-status${license ? ' active' : ''}">${license ? 'Активна' : 'Не активна'}</span></div>` : section === 'settings' ? `<div class="profile-heading"><div class="profile-large-avatar">⚙</div><div><h1>Настройки</h1><p class="profile-page-subtitle">Управление поведением EFIR launcher</p></div></div><div class="settings-panel"><h2>Приложение</h2><div class="setting-row"><div><strong>Автообновление</strong><small>Автоматически обновлять установленные приложения при появлении новой версии.</small></div><label class="setting-switch"><input id="setting-auto-update" type="checkbox" ${launcherSettings.autoUpdate ? 'checked' : ''}><span class="setting-slider"></span></label></div><div class="setting-row"><div><strong>Автозапуск EFIR launcher</strong><small>Запускать лаунчер автоматически при входе в Windows и скрывать его в трей.</small></div><label class="setting-switch"><input id="setting-auto-start" type="checkbox" ${launcherSettings.autoStart ? 'checked' : ''}><span class="setting-slider"></span></label></div></div>` : `<div class="profile-heading"><div class="profile-large-avatar">${$('#profile-avatar').textContent || '?'}</div><div><h1>Профиль</h1><p class="profile-page-subtitle">${name}</p></div></div><div class="profile-info"><div class="profile-info-row"><span>Имя</span><strong>${name}</strong></div><div class="profile-info-row"><span>Email</span><strong>${email}</strong></div><div class="profile-info-row"><span>Статус</span><strong>Аккаунт EFIR launcher</strong></div></div>`; $('#profile-view').innerHTML = `<div class="profile-layout"><aside class="profile-sidebar"><button class="profile-page-back" id="profile-back" title="Назад">‹</button><nav><button class="profile-nav-button${section === 'account' ? ' active' : ''}" data-profile-section="account">Аккаунт</button><button class="profile-nav-button${section === 'subscription' ? ' active' : ''}" data-profile-section="subscription">Подписка</button><button class="profile-nav-button${section === 'settings' ? ' active' : ''}" data-profile-section="settings">Настройки</button></nav></aside><div class="profile-content">${content}</div><button class="profile-logout" id="profile-logout">Выйти из аккаунта</button></div>`; $('#profile-back').addEventListener('click', showHomeView); $('#profile-logout').addEventListener('click', logout); $('#profile-view').querySelectorAll('[data-profile-section]').forEach(button => button.addEventListener('click', () => renderProfilePage(button.dataset.profileSection))); if (section === 'settings') { $('#setting-auto-update').addEventListener('change', async event => { launcherSettings.autoUpdate = event.target.checked; localStorage.setItem('nnsi-auto-update', String(launcherSettings.autoUpdate)); if (launcherSettings.autoUpdate) runAutomaticUpdates(); }); $('#setting-auto-start').addEventListener('change', async event => { launcherSettings = await window.launcher.setAutoStart(event.target.checked); }); } }
async function runAutomaticUpdates() {
  if (!launcherSettings.autoUpdate || activeOperations.size || automaticUpdates.size) return;
  const candidates = apps.filter(item => item.installed && item.update && !item.running && item.licenseAvailable !== false);
  for (const item of candidates) {
    if (!launcherSettings.autoUpdate || automaticUpdates.has(item.id) || activeOperations.has(item.id)) continue;
    automaticUpdates.add(item.id);
    try {
      startOperation('update', item);
      $('#status').textContent = `Автообновление: ${item.name}`;
      setOperationStage('downloading', item.id);
      const result = await window.launcher.update(item.id, item);
      applyOperationResult('update', item.id, result);
    } catch (error) {
      console.warn('[NNSI AutoUpdate]', item.id, error);
      $('#status').textContent = `Ошибка автообновления: ${item.name}`;
    } finally {
      finishOperation(item.id);
      automaticUpdates.delete(item.id);
    }
  }
}
function renderProfilePage(section = 'account') {
  clearInterval(subscriptionQuoteTimer);
  const profileView = $('#profile-view');
  if (!profileView) return;
  hide('#home-view');
  hide('#detail-view');
  show('#profile-view');
  const storeNav = $('#store .topbar nav');
  if (storeNav) storeNav.style.display = 'none';
  const profileMenu = $('#profile-menu');
  if (profileMenu) profileMenu.classList.add('hidden');
  const name = $('#profile-name')?.textContent || 'Пользователь';
  const email = $('#profile-menu-email')?.textContent || '';
  const license = apps.find(item => item.id === 'tiktimer')?.licenseAvailable === true;
  let content = '';
  if (section === 'subscription') {
    content = `<div class="profile-heading"><div class="profile-large-avatar">$</div><div><h1>Подписка</h1><p class="profile-page-subtitle">Оплата и доступ к ТАЙМЕР</p></div></div><div class="subscription-panel"><div class="subscription-summary"><div><strong>ТАЙМЕР</strong><small id="subscription-expires">Загрузка статуса…</small></div><span id="subscription-status-value" class="subscription-status${license ? ' active' : ''}">${license ? 'Активна' : 'Проверяем'}</span></div><p>Оплата native TON (GRAM) в сети TON Mainnet.</p><div id="subscription-plans" class="subscription-plans"><button class="subscription-plan active" data-months="1">1 месяц<br>$30</button><button class="subscription-plan" data-months="3">3 месяца<br>−5%</button><button class="subscription-plan" data-months="6">6 месяцев<br>−10%</button></div><div id="subscription-quote" class="subscription-quote">Загружаем курс TON…</div><div class="subscription-actions"><button id="subscription-create-order" class="primary-payment">Создать счет</button></div><div id="subscription-payment" class="subscription-payment hidden"><img id="subscription-qr" alt="QR-код оплаты TON"><strong>Сумма и комментарий должны совпадать</strong><code id="subscription-address"></code><code id="subscription-comment"></code><div class="subscription-actions"><button id="subscription-open-wallet" class="primary-payment">Открыть кошелек</button><button id="subscription-copy-address" class="secondary-payment">Скопировать адрес</button><button id="subscription-verify" class="secondary-payment">Проверить оплату</button></div></div><div id="subscription-message" class="subscription-message"></div></div>`;
  } else if (section === 'settings') {
    content = `<div class="profile-heading"><div class="profile-large-avatar">⚙</div><div><h1>Настройки</h1><p class="profile-page-subtitle">Управление поведением EFIR launcher</p></div></div><div class="settings-panel"><h2>Приложение</h2><div class="setting-row"><div><strong>Автообновление</strong><small>Автоматически обновлять установленные приложения при появлении новой версии.</small></div><label class="setting-switch"><input id="setting-auto-update" type="checkbox" ${launcherSettings.autoUpdate ? 'checked' : ''}><span class="setting-slider"></span></label></div><div class="setting-row"><div><strong>Автозапуск EFIR launcher</strong><small>Запускать лаунчер автоматически при входе в Windows и скрывать его в трей.</small></div><label class="setting-switch"><input id="setting-auto-start" type="checkbox" ${launcherSettings.autoStart ? 'checked' : ''}><span class="setting-slider"></span></label></div></div>`;
  } else {
    content = `<div class="profile-heading"><div class="profile-large-avatar">${$('#profile-avatar')?.textContent || '?'}</div><div><h1>Профиль</h1><p class="profile-page-subtitle">${name}</p></div></div><div class="profile-info"><div class="profile-info-row"><span>Имя</span><strong>${name}</strong></div><div class="profile-info-row"><span>Email</span><strong>${email}</strong></div><div class="profile-info-row"><span>Статус</span><strong>Аккаунт EFIR launcher</strong></div></div>`;
  }
  profileView.innerHTML = `<div class="profile-layout"><aside class="profile-sidebar"><button class="profile-page-back" id="profile-back" title="Назад">‹</button><nav><button class="profile-nav-button${section === 'account' ? ' active' : ''}" data-profile-section="account">Аккаунт</button><button class="profile-nav-button${section === 'subscription' ? ' active' : ''}" data-profile-section="subscription">Подписка</button><button class="profile-nav-button${section === 'settings' ? ' active' : ''}" data-profile-section="settings">Настройки</button></nav></aside><div class="profile-content">${content}</div><button class="profile-logout" id="profile-logout">Выйти из аккаунта</button></div>`;
  profileView.prepend($('#profile-back'));
  profileView.querySelector('.profile-sidebar').appendChild($('#profile-logout'));
  if (section === 'subscription') {
    const intro = profileView.querySelector('.subscription-panel > p');
    if (intro) intro.textContent = 'Оплаченная подписка дает доступ ко всем приложениям EFIR launcher — существующим и будущим: скачивание, обновление, обслуживание и техническая поддержка. Оплата — native Gram (TON), сеть TON Mainnet.';
    const subscriptionTitle = profileView.querySelector('.subscription-summary strong');
    if (subscriptionTitle) subscriptionTitle.textContent = 'Все приложения EFIR launcher';
    const subscriptionSubtitle = profileView.querySelector('.profile-page-subtitle');
    if (subscriptionSubtitle) subscriptionSubtitle.textContent = 'Единая подписка на экосистему EFIR launcher';
    const payment = $('#subscription-payment');
    if (payment) {
      payment.classList.remove('subscription-payment');
      payment.classList.add('subscription-payment-overlay');
      const modal = document.createElement('div');
      modal.className = 'subscription-payment subscription-payment-modal';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'subscription-payment-close';
      close.title = 'Закрыть';
      close.textContent = '×';
      close.addEventListener('click', () => cancelPendingSubscription(true));
      modal.appendChild(close);
      const networkHeader = document.createElement('div');
      networkHeader.className = 'payment-network-header';
      networkHeader.innerHTML = '<div class="payment-coin-logo" aria-hidden="true"><img src="./Gram_Circular_Badge.webp" alt="Gram"></div><div><strong>Gram (TON)</strong><span>Сеть TON Mainnet</span></div>';
      modal.appendChild(networkHeader);
      const paymentAmount = document.createElement('div');
      paymentAmount.className = 'payment-amount';
      paymentAmount.innerHTML = '<span>К оплате</span><strong id="subscription-payment-amount-value">Загрузка суммы…</strong>';
      modal.appendChild(paymentAmount);
      while (payment.firstChild) modal.appendChild(payment.firstChild);
      const paymentMessage = $('#subscription-message');
      if (paymentMessage) modal.appendChild(paymentMessage);
      const waiting = document.createElement('div');
      waiting.id = 'subscription-payment-waiting';
      waiting.className = 'payment-waiting';
      waiting.innerHTML = '<span class="payment-waiting-spinner" aria-hidden="true"></span><span id="subscription-waiting-text">Ожидаем оплату и подтверждение сети…</span>';
      modal.appendChild(waiting);
      payment.appendChild(modal);
      payment.addEventListener('click', event => {
        if (event.target === payment) cancelPendingSubscription(true);
      });
    }
  }
  $('#profile-back').addEventListener('click', showHomeView);
  $('#profile-logout').addEventListener('click', logout);
  profileView.querySelectorAll('[data-profile-section]').forEach(button => button.addEventListener('click', () => navigateProfileSection(button.dataset.profileSection)));
  $('#setting-auto-update')?.addEventListener('change', async event => { launcherSettings = await window.launcher.setAutoUpdate(event.target.checked); if (launcherSettings.autoUpdate) runAutomaticUpdates(); });
  $('#setting-auto-start')?.addEventListener('change', async event => { launcherSettings = await window.launcher.setAutoStart(event.target.checked); });
  if (section === 'subscription') {
    const promoForm = document.createElement('form');
    promoForm.className = 'promo-form';
    promoForm.innerHTML = '<label for="promo-code">Промокод на пробный период</label><p>Один промокод на аккаунт за всё время. Индивидуальные ограничения на приложения сохраняются.</p><div class="subscription-actions"><input id="promo-code" maxlength="64" autocomplete="off" placeholder="Введите промокод" required><button type="submit" class="primary-payment">Применить</button></div><p class="promo-result" role="status" aria-live="polite"></p>';
    profileView.querySelector('.subscription-panel').appendChild(promoForm);
    promoForm.addEventListener('submit', async event => {
      event.preventDefault();
      const button = promoForm.querySelector('button');
      const result = promoForm.querySelector('.promo-result');
      button.disabled = true;
      result.textContent = 'Проверяем промокод…';
      try {
        const redeemed = await window.launcher.redeemPromo(promoForm.querySelector('input').value);
        result.textContent = 'Пробный доступ активирован на ' + redeemed.days + ' дн., до ' + new Date(redeemed.expires_at).toLocaleDateString('ru-RU') + '.';
        promoForm.querySelector('input').value = '';
        await Promise.all([loadSubscriptionPanel(), refreshStatuses()]);
      } catch (error) { result.textContent = error.message || 'Не удалось применить промокод.'; }
      finally { button.disabled = false; }
    });
    window.decorateSubscription(profileView);
    subscriptionSelectedMonths = 1;
    $('#subscription-plans').querySelectorAll('.subscription-plan').forEach(button => button.addEventListener('click', () => { subscriptionSelectedMonths = Number(button.dataset.months); loadSubscriptionQuote(subscriptionSelectedMonths); }));
    $('#subscription-create-order').addEventListener('click', () => createSubscriptionOrder(subscriptionSelectedMonths));
    $('#subscription-open-wallet').addEventListener('click', () => window.launcher.openExternal($('#subscription-open-wallet').dataset.link));
    $('#subscription-copy-address').addEventListener('click', async () => { await navigator.clipboard.writeText($('#subscription-address').textContent); setSubscriptionMessage('Адрес скопирован.'); });
    $('#subscription-verify').addEventListener('click', () => verifySubscriptionOrder(false));
    loadSubscriptionPanel();
    subscriptionQuoteTimer = setInterval(() => loadSubscriptionQuote(subscriptionSelectedMonths), 20000);
  }
}
let subscriptionOrder = null;
let subscriptionPollTimer = null;
let subscriptionQuoteTimer = null;
let subscriptionSelectedMonths = 1;

// Недоступное приложение ведет пользователя сразу в раздел подписки.
function showSubscriptionModal() { renderProfilePage('subscription'); }

async function cancelPendingSubscription(confirmCancel = true) {
  if (!subscriptionOrder) return true;
  if (confirmCancel && !window.confirm('Оплата еще не подтверждена. Отменить счет?')) return false;
  clearInterval(subscriptionPollTimer);
  try {
    await window.launcher.cancelSubscriptionOrder(subscriptionOrder.id);
  } catch (error) {
    // Старый Railway-деплой еще может не знать новый маршрут отмены.
    // В этом случае не блокируем интерфейс: счет останется pending и истечет по TTL.
    if (/HTTP 404/.test(error?.message || '')) {
      setSubscriptionMessage('Сервер еще не обновлен: счет закрыт в интерфейсе и истечет автоматически.', true);
    } else {
      setSubscriptionMessage(error.message || 'Не удалось отменить счет.', true);
      return false;
    }
  }
  subscriptionOrder = null;
  $('#subscription-payment')?.classList.add('hidden');
  return true;
}

async function navigateProfileSection(section) {
  if (subscriptionOrder && !(await cancelPendingSubscription(true))) return;
  renderProfilePage(section);
}
function subscriptionStatusText(subscription) {
  if (!subscription?.active) return 'Подписка не активна';
  return `Осталось дней: ${subscription.days_left}`;
}
function setSubscriptionMessage(text, error = false) {
  const element = $('#subscription-message');
  if (element) { element.textContent = text; element.classList.toggle('error', error); }
}
function setPaymentWaiting(text) {
  const element = $('#subscription-waiting-text');
  if (element) element.textContent = text;
}
function setSubscriptionBadge(subscription) {
  accountSubscription = subscription || null;
  const badge = $('#subscription-badge');
  const days = $('#subscription-badge-days');
  if (!badge || !days) return;
  const active = Boolean(subscription?.active);
  badge.classList.toggle('hidden', !active);
  if (active) days.textContent = `${subscription.days_left} дн.`;

}
function applySubscriptionAccess() { /* Access comes exclusively from the server per application. */ }
async function refreshSubscriptionBadge() {
  if (!window.launcher?.getSubscription || !supabase) return;
  try {
    setSubscriptionBadge(await window.launcher.getSubscription());
  } catch (_) {
    setSubscriptionBadge(null);
  }
}
async function renderPaymentQr(deepLink) {
  const image = $('#subscription-qr');
  if (!image) return;
  try {
    if (window.QRCode?.toDataURL) image.src = await window.QRCode.toDataURL(deepLink, { width: 190, margin: 1 });
    else image.src = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(deepLink)}`;
  } catch (_) { image.src = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(deepLink)}`; }
}
async function loadSubscriptionPanel() {
  const statusElement = $('#subscription-status-value');
  if (!statusElement) return;
  try {
    const subscription = await window.launcher.getSubscription();
    setSubscriptionBadge(subscription);
    window.updateSubscriptionPresentation(subscription);
    statusElement.textContent = subscriptionStatusText(subscription);
    statusElement.className = `subscription-status${subscription.active ? ' active' : ''}`;
    const expires = $('#subscription-expires');
    if (expires) expires.textContent = subscription.expires_at ? `До ${new Date(subscription.expires_at).toLocaleDateString('ru-RU')}` : 'Оплата продлит доступ ко всем приложениям EFIR launcher';
    await loadSubscriptionQuote(1);
  } catch (error) { setSubscriptionMessage(error.message || 'Не удалось загрузить подписку', true); }
}
async function loadSubscriptionQuote(months) {
  const quoteElement = $('#subscription-quote');
  if (!quoteElement) return;
  try {
    const quote = await window.launcher.getSubscriptionQuote(months);
    quoteElement.innerHTML = `<span>К оплате за ${quote.months} мес.</span><strong>$${Number(quote.usd_amount).toFixed(2)}</strong><span>${Number(quote.ton_amount).toFixed(4)} Gram · TON Mainnet</span>`;
    $('#subscription-plans')?.querySelectorAll('.subscription-plan').forEach(button => button.classList.toggle('active', Number(button.dataset.months) === months));
  } catch (error) { quoteElement.textContent = error.message || 'Курс TON временно недоступен'; }
}
async function createSubscriptionOrder(months) {
  try {
    setSubscriptionMessage('Создаём счет…');
    subscriptionOrder = await window.launcher.createSubscriptionOrder(months);
    const payment = $('#subscription-payment');
    payment?.classList.remove('hidden');
    $('#subscription-address').textContent = subscriptionOrder.payment_address;
    $('#subscription-comment').textContent = `Комментарий: ${subscriptionOrder.payment_comment}`;
    $('#subscription-open-wallet').dataset.link = subscriptionOrder.deep_link;
    const gramAmount = Number(subscriptionOrder.ton_amount_nano) / 1e9;
    const gramAmountText = gramAmount.toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
    $('#subscription-payment-amount-value').textContent = `$${Number(subscriptionOrder.usd_amount).toFixed(2)} · ${gramAmountText} Gram`;
    await renderPaymentQr(subscriptionOrder.deep_link);
    setPaymentWaiting('Ожидаем оплату и подтверждение сети…');
    setSubscriptionMessage('Отправьте точную сумму с указанным комментарием, затем нажмите «Проверить оплату».');
    clearInterval(subscriptionPollTimer);
    subscriptionPollTimer = setInterval(() => verifySubscriptionOrder(true), 10000);
  } catch (error) { setSubscriptionMessage(error.message || 'Не удалось создать счет', true); }
}
async function verifySubscriptionOrder(silent = false) {
  if (!subscriptionOrder) return;
  try {
    if (!silent) setSubscriptionMessage('Проверяем транзакцию в сети TON…');
    setPaymentWaiting(silent ? 'Ожидаем оплату и подтверждение сети…' : 'Проверяем транзакцию в сети TON…');
    const result = await window.launcher.verifySubscriptionOrder(subscriptionOrder.id);
    if (!result.paid) { setPaymentWaiting(result.status === 'expired' ? 'Счет истек. Создайте новый счет.' : 'Ожидаем оплату и подтверждение сети…'); if (!silent) setSubscriptionMessage(result.status === 'expired' ? 'Счет истек. Создайте новый счет.' : 'Платеж пока не найден. Подождите подтверждение сети и попробуйте снова.', result.status === 'expired'); return; }
    clearInterval(subscriptionPollTimer);
    subscriptionOrder = null;
    $('#subscription-payment')?.classList.add('hidden');
    await refreshStatuses();
    renderApps();
    const subscription = result.subscription;
    setSubscriptionBadge(subscription);
    window.updateSubscriptionPresentation(subscription);
    $('#subscription-status-value').textContent = subscriptionStatusText(subscription);
    $('#subscription-status-value').className = 'subscription-status active';
    $('#subscription-expires').textContent = `До ${new Date(subscription.expires_at).toLocaleDateString('ru-RU')}`;
    setSubscriptionMessage(`Оплата подтверждена. Осталось дней: ${subscription.days_left}.`);
  } catch (error) { if (!silent) setSubscriptionMessage(error.message || 'Не удалось проверить оплату', true); }
}
function showHomeView() { hide('#profile-view'); hide('#detail-view'); show('#home-view'); showStoreNavigation(); }
async function showHomeView() {
  if (subscriptionOrder && !(await cancelPendingSubscription(true))) return;
  hide('#profile-view');
  hide('#detail-view');
  show('#home-view');
  showStoreNavigation();
}
async function logout() {
  if (subscriptionOrder && !(await cancelPendingSubscription(true))) return;
  await supabase.auth.signOut({scope:'local'});
  await window.launcher.setSession(null);
  hide('#store');
  show('#auth');
  $('#profile-menu').classList.add('hidden');
}
function initials(value) { return (value || '?').trim().slice(0, 1).toUpperCase(); }
function setProfile(user) { const name = user.user_metadata?.name || user.email?.split('@')[0] || 'Пользователь'; $('#profile-avatar').textContent = initials(name); $('#profile-email').textContent = name; $('#profile-name').textContent = name; $('#profile-menu-email').textContent = user.email || ''; }
function setAuthMode(mode) { authMode = mode; const signup = mode === 'signup'; $('#name-field').classList.toggle('hidden', !signup); $('#auth-title').textContent = signup ? 'Создать аккаунт' : 'Войти в магазин'; $('#auth-subtitle').textContent = signup ? 'Регистрация займёт несколько секунд.' : 'Управляйте своими приложениями.'; $('#auth-submit').textContent = signup ? 'Зарегистрироваться' : 'Войти'; $('#auth-switch').textContent = signup ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'; message(''); }
function fallbackApp(item, status = {}) { return { ...item, ...status, ...(item.id==='tiktimer'?{name:'ТАЙМЕР',icon_url:'./assets/timer-logo.svg',cover_url:'./assets/timer-logo.svg'}:{}), description: item.description || 'Ваш персональный инструмент от Astral.', media: item.media || [] }; }
async function loadApps() {
  const local = await window.launcher.getCatalog();
  const cached = await window.launcher.getCachedApps();
  apps = local.map(item => { const status = cached.find(x => x.id === item.id) || {}; return fallbackApp({ ...item, media: item.media || [] }, { ...status, installed: status.installedVersion || (status.installedOnDisk ? 'локально' : null) }); });
  applySubscriptionAccess();
  renderApps(); $('#status').textContent = 'Проверяю обновления в фоне…';
  getRemoteAppData(local).catch(error => { console.warn('[Astral Store]', error); $('#status').textContent = 'Оффлайн-режим'; });
}
async function getRemoteAppData(local) {
  const revisions = new Map(appStatusRevisions);
  const statuses = await window.launcher.getApps();
  // RLS returns public applications plus unpublished exclusive applications
  // granted to the current user. A client-side is_published filter would hide
  // those personal grants before they can reach the Exclusive tab.
  const result = await supabase.from('store_apps').select('*, store_media(*)').order('created_at', { ascending: false });
  const remote = !result.error && Array.isArray(result.data) ? result.data : null;
  const source = remote || local;
  const enriched = await Promise.all(source.map(async item => { const status = statuses.find(x => x.id === item.id) || await window.launcher.getAppStatus(item); const licenseAvailable = status.licenseAvailable === null || status.licenseAvailable === undefined ? apps.find(x => x.id === item.id)?.licenseAvailable : status.licenseAvailable; return fallbackApp({ ...item, media: item.store_media || item.media || [] }, { ...status, licenseAvailable, installed: status.installed || (status.installedOnDisk ? 'локально' : null) }); }));
  apps = preserveCompletedOperations(enriched, revisions);
  applySubscriptionAccess();
  apps.forEach(item => { if (item.latest) appVersions.set(item.id, item.latest); });
  renderApps(); $('#status').textContent = 'Готово';
}
async function reloadStoreCatalog() {
  const revisions = new Map(appStatusRevisions);
  const result = await supabase.from('store_apps').select('*, store_media(*)').order('created_at', { ascending: false });
  if (result.error) throw result.error;
  const source = Array.isArray(result.data) ? result.data : [];
  const enriched = await Promise.all(source.map(async item => { const status = await window.launcher.getAppStatus(item); const previous = apps.find(current => current.id === item.id); const licenseAvailable = status.licenseAvailable === null || status.licenseAvailable === undefined ? previous?.licenseAvailable : status.licenseAvailable; return fallbackApp({ ...previous, ...item, media: item.store_media || [] }, { ...status, licenseAvailable, installed: status.installedVersion || (status.installedOnDisk ? previous?.installed || 'локально' : null) }); }));
  apps = preserveCompletedOperations(enriched, revisions);
  applySubscriptionAccess();
  renderApps(); $('#status').textContent = 'Каталог обновлён';
}
// Проверяем обновления после фоновой синхронизации каталога.
let catalogChannel;
let catalogPollTimer;
function subscribeCatalogRealtime() {
  if (catalogChannel) supabase.removeChannel(catalogChannel);
  const reload = () => reloadStoreCatalog().catch(error => console.warn('[Astral Realtime]', error.message));
  catalogChannel = supabase.channel(`astral-store-catalog-${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'store_apps' }, reload).on('postgres_changes', { event: '*', schema: 'public', table: 'store_media' }, reload).on('postgres_changes', { event: '*', schema: 'public', table: 'exclusive_app_grants' }, reload).subscribe((status, error) => {
    if (status === 'SUBSCRIBED') $('#status').textContent = 'Каталог синхронизирован';
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { console.warn('[Astral Realtime]', status, error); $('#status').textContent = 'Синхронизация каталога включена'; setTimeout(subscribeCatalogRealtime, 3000); }
  });
  clearInterval(catalogPollTimer); catalogPollTimer = setInterval(() => { if (!document.hidden && !$('#store').classList.contains('hidden')) reloadStoreCatalog().catch(error => console.warn('[Astral Catalog]', error.message)); }, 120000);
}
let statusRefreshPending = null;
const appStatusRevisions = new Map();
function preserveCompletedOperations(items, revisions) {
  return items.map(item => {
    const current = apps.find(app => app.id === item.id);
    if (!current || (!activeOperations.has(item.id) && !pendingAppActions.has(item.id) && (revisions.get(item.id) || 0) === (appStatusRevisions.get(item.id) || 0))) return item;
    const local = {};
    for (const key of ['installed','installedVersion','installedOnDisk','latest','update','running']) local[key] = current[key];
    return {...item, ...local};
  });
}
function applyOperationResult(action, id, result) {
  appStatusRevisions.set(id, (appStatusRevisions.get(id) || 0) + 1);
  apps = apps.map(item => {
    if (item.id !== id) return item;
    if (action === 'install' || action === 'update') {
      if (!result?.version) throw new Error('Установка не вернула версию приложения');
      return {...item, installed:result.version, installedVersion:result.version, installedOnDisk:true,
        latest:result.version, update:false, running:result.unchanged ? item.running : false};
    }
    return {...item, running:action === 'launch'};
  });
}
function refreshStatuses() {
  if (statusRefreshPending) return statusRefreshPending;
  statusRefreshPending = (async () => {
    const revisions = new Map(appStatusRevisions);
    const statuses = await window.launcher.getStatuses();
    const before = JSON.stringify(apps);
    apps = apps.map(item => {
      if ((revisions.get(item.id) || 0) !== (appStatusRevisions.get(item.id) || 0) || activeOperations.has(item.id) || pendingAppActions.has(item.id)) return item;
      const status = statuses.find(x => x.id === item.id) || {};
      return { ...item, ...status, licenseAvailable: status.licenseAvailable == null ? item.licenseAvailable : status.licenseAvailable,
        installed: status.installedVersion || (status.installedOnDisk ? (item.installed || 'local') : null) };
    });
    applySubscriptionAccess();
    if (JSON.stringify(apps) !== before) {
      renderApps();
      if (selectedAppId && !$('#detail-view').classList.contains('hidden')) renderDetail(selectedAppId);
    }
    if (activeOperations.size) updateOperationUI();
  })().catch(error => console.warn('[Status]', error.message)).finally(() => { statusRefreshPending = null; });
  return statusRefreshPending;
}

function renderApps() {
  queueMicrotask(updateOperationUI);
  $('#apps').innerHTML = apps.map(item => { const running = item.running; const installed = Boolean(item.installed); const cover = item.cover_url || item.icon_url || ''; return `<article class="app-card" data-id="${item.id}"><div class="app-cover" style="${cover ? `background-image:url('${cover}')` : ''}"><span>${cover ? '' : initials(item.name)}</span><div class="cover-glow"></div></div><div class="app-card-body"><div class="app-card-title"><h3>${item.name}</h3>${running ? '<i class="live-dot">Запущено</i>' : ''}</div><p>${item.description || ''}</p><div class="app-card-footer"><small>${installed ? `Версия ${item.installed}` : `Версия ${item.latest || '—'}`}</small><button class="icon-arrow" data-open="${item.id}">↗</button></div></div></article>`; }).join('');
}
function enhanceCards() { document.querySelectorAll('.app-card').forEach(card => { if (card.querySelector('.card-action')) return; const id = card.dataset.id; const item = apps.find(app => app.id === id); if (!item) return; const running = item.running; const installed = Boolean(item.installed); const action = running ? 'close' : item.update && installed ? 'update' : installed ? 'launch' : 'install'; const text = running ? 'Закрыть' : item.update && installed ? 'Обновить' : installed ? 'Открыть' : 'Установить'; const button = document.createElement('button'); button.className = `card-action action-${action}`; button.dataset.appAction = id; button.dataset.action = action; button.textContent = text; card.querySelector('.app-card-footer').prepend(button); }); }
new MutationObserver(enhanceCards).observe($('#apps'), { childList: true });
function renderApps() {
  const visible = viewMode === 'exclusive' ? apps.filter(item => item.is_exclusive === true) : viewMode === 'mine' ? apps.filter(item => item.installed) : apps.filter(item => !item.installed && !item.is_exclusive);
  $('#apps').innerHTML = visible.length ? visible.map(item => { const running = item.running; const installed = Boolean(item.installed); const cover = item.cover_url || item.icon_url || ''; return `<article class="app-card" data-id="${item.id}"><div class="app-cover" style="${cover ? `background-image:url('${cover}')` : ''}"><span>${cover ? '' : initials(item.name)}</span><div class="cover-glow"></div></div><div class="app-card-body"><div class="app-card-title"><h3>${item.name}</h3>${running ? '<i class="live-dot">Запущено</i>' : ''}</div><p>${item.description || ''}</p><div class="app-card-footer"><small>${installed ? `Версия ${item.installed}` : `Версия ${item.latest || '—'}`}</small><button class="card-action action-${running ? 'close' : item.update && installed ? 'update' : installed ? 'launch' : 'install'}" data-app-action="${item.id}" data-action="${running ? 'close' : item.update && installed ? 'update' : installed ? 'launch' : 'install'}">${running ? 'Закрыть' : item.update && installed ? 'Обновить' : installed ? 'Открыть' : 'Установить'}</button></div></div></article>`; }).join('') : `<div class="empty-state">${viewMode === 'exclusive' ? 'Здесь появятся приложения, доступные лично вам.' : viewMode === 'mine' ? 'Установленных приложений пока нет.' : 'Каталог пуст.'}</div>`;
}
function renderApps() {
  queueMicrotask(updateOperationUI);
  const visible = viewMode === 'exclusive' ? apps.filter(item => item.is_exclusive === true) : viewMode === 'mine' ? apps.filter(item => item.installed) : apps.filter(item => !item.installed && !item.is_exclusive);
  $('#apps').innerHTML = visible.length ? visible.map(item => { const action = appAction(item); const cover = item.cover_url || item.icon_url || ''; return `<article class="app-card" data-id="${item.id}"><div class="app-cover" style="${cover ? `background-image:url('${cover}')` : ''}"><span>${cover ? '' : initials(item.name)}</span><div class="cover-glow"></div></div><div class="app-card-body"><div class="app-card-title"><h3>${item.name}</h3>${item.running ? '<i class="live-dot">Запущено</i>' : ''}</div><p>${item.description || ''}</p><div class="app-card-footer"><small>${item.installed ? `Версия ${item.installed}` : `Версия ${item.latest || '—'}`}</small><button class="card-action action-${action}" data-app-action="${item.id}" data-action="${action}">${appActionText(action)}</button></div></div></article>`; }).join('') : `<div class="empty-state">${viewMode === 'exclusive' ? 'Здесь появятся приложения, доступные лично вам.' : viewMode === 'mine' ? 'Установленных приложений пока нет.' : 'Каталог пуст.'}</div>`;
}

function renderDetail(id) {
  queueMicrotask(updateOperationUI);
  const item = apps.find(x => x.id === id); if (!item) return;
  selectedAppId = id;
  const installed = Boolean(item.installed); const cover = item.cover_url || item.icon_url || ''; const action = appAction(item); const text = action === 'unavailable' ? 'Недоступно' : item.running ? 'Закрыть приложение' : item.update && installed ? 'Обновить' : installed ? 'Запустить приложение' : 'Установить приложение';
  $('#detail-view').innerHTML = `<button class="back-button" id="back-button">← Все приложения</button><article class="detail"><div class="detail-hero" style="${cover ? `background-image:linear-gradient(90deg,#101110cc,#10111044),url('${cover}')` : ''}"><div class="detail-icon">${cover ? `<img src="${cover}" alt="">` : initials(item.name)}</div><div><span class="eyebrow">APPLICATION</span><h1>${item.name}</h1><p>${item.description || ''}</p></div></div><div class="detail-content"><div class="detail-main"><h2>О приложении</h2><p>${item.long_description || item.description || 'Описание приложения появится здесь.'}</p><div class="media-grid">${(item.media || []).map(media => `<img src="${media.url || media.media_url}" alt="${media.caption || ''}">`).join('')}</div></div><aside class="detail-side"><button class="primary wide" id="detail-action" data-action="${action}" data-id="${item.id}">${text}</button><div class="version-box"><span>Текущая версия</span><strong>${item.installed || 'Не установлено'}</strong><span>Последняя версия</span><strong>${item.latest || '—'}</strong></div></aside></div></article>`;
  hide('#home-view'); show('#detail-view'); $('#store .topbar nav').style.display = 'none';
  $('#detail-action').classList.add(`action-${action}`);
  if (installed) { const uninstallButton = document.createElement('button'); uninstallButton.className = 'uninstall-button'; uninstallButton.textContent = 'Удалить приложение'; uninstallButton.dataset.id = item.id; $('#detail-view .detail-side').appendChild(uninstallButton); }
  $('#back-button').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>'; $('#back-button').title = 'Назад';
}
async function performUninstall(id, button) { const item = apps.find(x => x.id === id); if (!item || !confirm(`Удалить ${item.name} с компьютера?`)) return; button.disabled = true; showUninstallOverlay('closing'); $('#status').textContent = 'Удаляю…'; try { await window.launcher.uninstall(id, item); apps = apps.map(app => app.id === id ? { ...app, installed: null, running: false, update: false } : app); renderApps(); hide('#detail-view'); show('#home-view'); showStoreNavigation(); $('#status').textContent = 'Приложение удалено'; } catch (error) { $('.uninstall-overlay')?.remove(); $('#status').textContent = `Ошибка: ${error.message}`; button.disabled = false; } }
function showUninstallOverlay(step, percent = 0) { let overlay = $('.uninstall-overlay'); if (!overlay) { overlay = document.createElement('div'); overlay.className = 'uninstall-overlay'; overlay.innerHTML = '<div class="uninstall-box"><h3>Удаляем приложение</h3><p class="uninstall-step">Подготовка…</p><div class="uninstall-progress"><div class="uninstall-progress-bar"></div></div><div class="uninstall-percent">0%</div></div>'; document.body.appendChild(overlay); } const labels = { closing: 'Закрываем процессы…', files: 'Удаляем файлы приложения…', done: 'Удаление завершено' }; overlay.querySelector('.uninstall-step').textContent = labels[step] || 'Удаляем файлы приложения…'; overlay.querySelector('.uninstall-progress-bar').style.width = `${step === 'done' ? 100 : percent}%`; overlay.querySelector('.uninstall-percent').textContent = `${step === 'done' ? 100 : percent}%`; if (step === 'done') setTimeout(() => overlay.remove(), 700); }
function setDownloadsOpen(open) {
  $('#downloads-panel').classList.toggle('hidden', !open);
  $('#downloads-toggle').setAttribute('aria-expanded', String(open));
}
$('#downloads-toggle').addEventListener('click', () => {
  setDownloadsOpen($('#downloads-panel').classList.contains('hidden'));
});
document.addEventListener('pointerdown', event => {
  if (!event.target.closest?.('#downloads')) setDownloadsOpen(false);
}, true);
document.addEventListener('click', event => {
  if (!event.target.closest?.('#downloads')) setDownloadsOpen(false);
}, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#downloads-panel').classList.contains('hidden')) {
    setDownloadsOpen(false);
    $('#downloads-toggle').focus();
  }
});
function updateOperationUI() {
  for (const [id, action] of pendingAppActions) {
    if (action !== 'close' && action !== 'launch') continue;
    document.querySelectorAll('[data-app-action], #detail-action').forEach(button => {
      if ((button.dataset.appAction || button.dataset.id) === id) {
        button.disabled = true;
        button.textContent = action === 'close' ? 'Закрытие…' : 'Запуск…';
      }
    });
  }
  const count = activeOperations.size;
  $('#downloads').classList.toggle('hidden', !count);
  $('#downloads-toggle').classList.toggle('is-active', count > 0);
  $('#downloads-count').textContent = String(count);
  $('#downloads-toggle').setAttribute('aria-label', 'Загрузки: ' + count);
  $('#downloads-summary').textContent = String(count);
  if (!count) setDownloadsOpen(false);
  const rows = [];
  for (const operation of activeOperations.values()) {
    const stage = { preparing: 'Подготовка', downloading: 'Скачивание', extracting: 'Распаковка', finalizing: 'Завершение' }[operation.stage] || 'Подготовка';
    const progress = operation.stage === 'downloading' && operation.total ? operation.percent + '%' : '…';
    const buttonText = stage + ' ' + progress;
    document.querySelectorAll('[data-app-action], #detail-action').forEach(button => {
      if ((button.dataset.appAction || button.dataset.id) === operation.id) {
        button.textContent = buttonText;
        button.disabled = true;
      }
    });
    const row = document.createElement('li');
    row.className = 'download-item';
    row.innerHTML = '<div class="download-item-heading"><strong></strong><span></span></div><small></small><div class="download-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div></div></div>';
    row.querySelector('strong').textContent = operation.name;
    row.querySelector('.download-item-heading span').textContent = progress;
    row.querySelector('small').textContent = (operation.action === 'update' ? 'Обновление · ' : '') + stage;
    const track = row.querySelector('.download-track');
    const determinate = operation.stage === 'downloading' && operation.total > 0;
    track.setAttribute('aria-label', operation.name + ': ' + stage);
    track.classList.toggle('is-indeterminate', !determinate);
    if (determinate) track.setAttribute('aria-valuenow', String(operation.percent));
    track.firstElementChild.style.width = determinate ? operation.percent + '%' : '35%';
    rows.push(row);
  }
  $('#downloads-list').replaceChildren(...rows);
}
function startOperation(action, item) {
  if (item && (action === 'install' || action === 'update')) {
    activeOperations.set(item.id, { id: item.id, name: item.name, action, percent: 0, total: 0, stage: 'preparing' });
    updateOperationUI();
  }
}
function setOperationStage(stage, id) {
  const operation = activeOperations.get(id);
  if (operation) { operation.stage = stage; updateOperationUI(); }
}
function finishOperation(id) {
  if (!activeOperations.delete(id)) return;
  renderApps();
  if (selectedAppId === id && !$('#detail-view').classList.contains('hidden')) renderDetail(id);
  updateOperationUI();
}
window.launcher.onProgress(({ id, received, total, stage }) => {
  const operation = activeOperations.get(id);
  if (!operation) return;
  operation.total = total || 0;
  operation.percent = total ? Math.max(0, Math.min(100, Math.round(received / total * 100))) : 0;
  operation.stage = stage || 'downloading';
  updateOperationUI();
});

// Keep the action button informative while the downloaded archive is being unpacked.
async function performApplicationAction(action, id, button) {
  const item = apps.find(x => x.id === id);
  if (!item || activeOperations.has(id) || pendingAppActions.has(id)) return;
  pendingAppActions.set(id, action);
  if (button) button.disabled = true;
  if (button && action === 'close') button.textContent = 'Закрытие…';
  if (button && action === 'launch') button.textContent = 'Запуск…';
  startOperation(action, item);
  $('#status').textContent = '\u0412\u044b\u043f\u043e\u043b\u043d\u044f\u044e\u2026';
  try {
    const result = await window.launcher[action](id, item);
    applyOperationResult(action, id, result);
    $('#status').textContent = '\u0413\u043e\u0442\u043e\u0432\u043e';
  } catch (error) {
    $('#status').textContent = '\u041e\u0448\u0438\u0431\u043a\u0430: ' + error.message;
    void refreshStatuses();
  } finally {
    pendingAppActions.delete(id);
    finishOperation(id);
    renderApps();
    if (selectedAppId === id && !$('#detail-view').classList.contains('hidden')) renderDetail(id);
    if (activeOperations.size) updateOperationUI();
    if (button) button.disabled = false;
  }
}
async function performAction(action, id) { return performApplicationAction(action, id, $('#detail-action')); }
async function performCardAction(action, id, button) { return performApplicationAction(action, id, button); }
async function enterStore(user, session, claim=false) { setProfile(user); if(!await window.launcher.setSession(session?.access_token || null,{initialize:true,claim}))return; await refreshSubscriptionBadge(); launcherSettings = await window.launcher.getSettings().catch(() => launcherSettings); hide('#auth'); show('#store'); await loadApps(); subscribeCatalogRealtime(); }
window.launcher.onSessionBlocked(async reason=>{
 hide('#store');hide('#auth');
 document.querySelector('.session-blocked')?.remove();
 const overlay=document.createElement('div');overlay.className='subscription-overlay session-blocked';
 const box=document.createElement('div');box.className='subscription-box';
 const title=document.createElement('h3');title.textContent=reason==='replaced'?'Вы вошли в аккаунт с другого устройства':'Не удалось подтвердить сессию';
 const text=document.createElement('p');text.textContent=reason==='replaced'?'Приложения на этом устройстве закрыты.':'Соединение с сервером отсутствует больше минуты. Приложения закрыты. Войдите после восстановления связи.';
 const button=document.createElement('button');button.textContent='Перезайти';button.onclick=()=>{overlay.remove();show('#auth');$('#auth-password').value='';$('#auth-email').focus();};
 box.append(title,text,button);overlay.append(box);document.body.append(overlay);
 await supabase.auth.signOut({scope:'local'}).catch(()=>{});
});

$('#auth-form').addEventListener('submit', async event => { event.preventDefault(); const email = $('#auth-email').value.trim(); const password = $('#auth-password').value; const name = $('#auth-name').value.trim(); if (!supabase) return message('Supabase не загрузился. Проверьте подключение к интернету и перезапустите лаунчер.', true); if (!email || !email.includes('@')) return message('Введите email, например user@example.com.', true); if (password.length < 6) return message('Пароль должен содержать минимум 6 символов.', true); $('#auth-submit').disabled = true; message('Подключаемся…'); try { const request = authMode === 'signup' ? supabase.auth.signUp({ email, password, options: { data: { name } } }) : supabase.auth.signInWithPassword({ email, password }); const result = await Promise.race([request, new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase не ответил за 15 секунд. Проверьте интернет или настройки проекта.')), 15000))]); if (result.error) throw result.error; if (authMode === 'signup' && !result.data.session) message('Аккаунт создан. Проверьте почту и подтвердите email.'); else await enterStore(result.data.user, result.data.session, true); } catch (error) { console.error('[NNSI Auth]', error); message(error.message || 'Не удалось выполнить вход.', true); } finally { $('#auth-submit').disabled = false; } });
$('#auth-email').addEventListener('invalid', event => { event.preventDefault(); message('Введите email, например user@example.com.', true); });
$('#auth-switch').addEventListener('click', event => { event.preventDefault(); setAuthMode(authMode === 'login' ? 'signup' : 'login'); });
$('#logout').addEventListener('click', logout);
$('#profile-button').addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openProfile(); }, true);
$('#subscription-badge').addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); renderProfilePage('subscription'); });
function showStoreNavigation() { $('#store .topbar nav').style.display = 'flex'; }
$('#home-button').addEventListener('click', showHomeView);
$('#apps').addEventListener('click', event => { const target = event.target.closest('[data-open], .app-card'); if (target) renderDetail(target.dataset.open || target.dataset.id); });
$('#apps').addEventListener('click', event => { const button = event.target.closest('[data-app-action]'); if (!button) return; event.preventDefault(); event.stopImmediatePropagation(); if (button.dataset.action === 'unavailable') return showSubscriptionModal(); performCardAction(button.dataset.action, button.dataset.appAction, button); }, true);
$('#detail-view').addEventListener('click', event => { const backButton = event.target.closest('#back-button'); if (backButton) { event.preventDefault(); hide('#detail-view'); show('#home-view'); showStoreNavigation(); selectedAppId = null; return; } const button = event.target.closest('#detail-action'); if (button) { if (button.dataset.action === 'unavailable') return showSubscriptionModal(); return performAction(button.dataset.action, button.dataset.id); } const uninstallButton = event.target.closest('.uninstall-button'); if (uninstallButton) performUninstall(uninstallButton.dataset.id, uninstallButton); });
if (supabase) { supabase.auth.getSession().then(({ data }) => data.session ? enterStore(data.session.user, data.session) : show('#auth')).catch(error => { show('#auth'); message(error.message, true); }); supabase.auth.onAuthStateChange((_event, session) => { window.launcher.setSession(session?.access_token || null).then(() => refreshSubscriptionBadge()); if (session) setProfile(session.user); else setSubscriptionBadge(null); }); } else { show('#auth'); setTimeout(() => message('Supabase не загрузился. Проверьте интернет-соединение.', true), 0); }
window.launcher.onUninstallProgress(({ step, percent }) => showUninstallOverlay(step, percent || 0));
document.title = 'EFIR launcher';
$('.logo-mark').innerHTML = '<img src="assets/efir-logo.png" alt="EFIR">';
$('.eyebrow').textContent = 'EFIR LAUNCHER';
$('#home-button').innerHTML = '<img class="wordmark-logo" src="assets/efir-logo.png" alt="EFIR"> EFIR <small>LAUNCHER</small>';
const authTabs = document.createElement('div');
authTabs.className = 'auth-tabs';
authTabs.innerHTML = '<button type="button" class="auth-tab active" data-auth-mode="login">Войти</button><button type="button" class="auth-tab" data-auth-mode="signup">Регистрация</button>';
$('#auth-title').before(authTabs);
authTabs.addEventListener('click', event => {
  const tab = event.target.closest('[data-auth-mode]');
  if (!tab) return;
  setAuthMode(tab.dataset.authMode);
  authTabs.querySelectorAll('.auth-tab').forEach(button => button.classList.toggle('active', button === tab));
});








function normalizeAppVisuals() {
  document.querySelectorAll('.app-card').forEach(card => {
    const item = apps.find(app => app.id === card.dataset.id);
    const cover = card.querySelector('.app-cover');
    if (!item || !cover) return;
    if (!item.latest && appVersions.has(item.id)) item.latest = appVersions.get(item.id);
    if (item.installed === 'local' || item.installed === 'локально') item.installed = item.latest || null;
    const version = card.querySelector('.app-card-footer small');
    if (version) version.textContent = item.installed ? `Версия ${item.installed}` : `Версия ${item.latest || '—'}`;
    const image = item.cover_url || item.icon_url || '';
    cover.style.backgroundImage = image ? `url('${image}')` : '';
    const fallback = cover.querySelector('span');
    if (fallback) fallback.textContent = image ? '' : initials(item.name);
    const title = card.querySelector('.app-card-title');
    if (title && item.icon_url && !title.querySelector('.app-title-logo')) {
      const logo = document.createElement('img');
      logo.className = 'app-title-logo'; logo.src = item.icon_url; logo.alt = '';
      title.insertBefore(logo, title.querySelector('h3'));
    }
  });
  if (selectedAppId && !$('#detail-view').classList.contains('hidden')) {
    const item = apps.find(app => app.id === selectedAppId);
    if (item && !item.latest && appVersions.has(item.id)) item.latest = appVersions.get(item.id);
    if (item && (item.installed === 'local' || item.installed === 'локально')) item.installed = item.latest || null;
    const hero = $('#detail-view .detail-hero');
    const icon = $('#detail-view .detail-icon');
    const versionValues = document.querySelectorAll('#detail-view .version-box strong');
    if (item && versionValues[0]) versionValues[0].textContent = item.installed || 'Не установлено';
    if (item && versionValues[1]) versionValues[1].textContent = item.latest || '—';
    if (item && hero) hero.style.backgroundImage = item.cover_url ? `linear-gradient(90deg,#101110cc,#10111044),url('${item.cover_url}')` : '';
    if (item && icon) {
      const current = icon.querySelector('img')?.getAttribute('src') || '';
      const detailImage = item.icon_url || '';
      if (detailImage && current !== detailImage) icon.innerHTML = `<img src="${detailImage}" alt="">`;
      else if (!detailImage && (current || icon.textContent !== initials(item.name))) icon.textContent = initials(item.name);
      $('#detail-view .detail-hero h1 .detail-title-logo')?.remove();
    }
  }
}
// Only observe replacing card/detail contents, never the full document.
const visualObserver = new MutationObserver(() => normalizeAppVisuals());
visualObserver.observe($('#apps'), { childList: true });
visualObserver.observe($('#detail-view'), { childList: true });
$('#profile-view').addEventListener('change', event => {
  if (event.target.id === 'setting-auto-update') {
    window.launcher.setAutoUpdate(event.target.checked).then(settings => { launcherSettings = settings; if (settings.autoUpdate) runAutomaticUpdates(); });
  }
});
setInterval(() => { if (!document.hidden && !$('#store').classList.contains('hidden')) refreshStatuses().then(() => { if (launcherSettings.autoUpdate) runAutomaticUpdates(); }); }, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#store').classList.contains('hidden')) refreshStatuses(); });
window.launcher.onAppRunning?.(({id,running}) => {
  appStatusRevisions.set(id, (appStatusRevisions.get(id) || 0) + 1);
  apps = apps.map(item => item.id === id ? {...item,running:Boolean(running)} : item);
  if (pendingAppActions.has(id)) return;
  renderApps();
  if (selectedAppId === id && !$('#detail-view').classList.contains('hidden')) renderDetail(id);
  if (activeOperations.size) updateOperationUI();
});

})();
