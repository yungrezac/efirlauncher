window.decorateSubscription = function(view) {
 const content=view.querySelector('.profile-content');content.classList.add('subscription-minimal');
 content.querySelector('.profile-large-avatar')?.remove();
 content.querySelector('.profile-page-subtitle').textContent='Все приложения EFIR в одной подписке';
 const panel=content.querySelector('.subscription-panel');panel.querySelector(':scope > p')?.remove();
 const methods=document.createElement('section');methods.className='payment-methods';methods.setAttribute('aria-label','Способ оплаты');
 methods.innerHTML=`<h3>Способ оплаты</h3><div class="payment-method-grid"><button type="button" class="payment-method selected" aria-pressed="true"><img src="./Gram_Circular_Badge.webp" alt=""><span>Gram <small>TON</small></span><span class="payment-check">✓</span></button><button type="button" class="payment-method" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/></svg><span>Карта<small>Скоро</small></span></button><button type="button" class="payment-method" disabled><img src="./assets/payments/patreon.svg" alt=""><span>Patreon<small>Скоро</small></span></button><button type="button" class="payment-method" disabled><img src="./assets/payments/boosty.png" alt=""><span>Boosty<small>Скоро</small></span></button></div>`;
 panel.querySelector('#subscription-plans').after(methods);
 const checkout=document.createElement('div');checkout.className='subscription-checkout';
 const quote=panel.querySelector('#subscription-quote'),actions=panel.querySelector(':scope > .subscription-actions');
 quote.before(checkout);checkout.append(quote,actions);
 const promo=panel.querySelector('.promo-form');if(promo){const details=document.createElement('details');details.className='subscription-promo';const summary=document.createElement('summary');summary.textContent='Есть промокод?';details.append(summary);promo.before(details);details.append(promo);promo.querySelector('label').textContent='Промокод';promo.querySelector('p').textContent='Один пробный промокод на аккаунт.';}
};

window.updateSubscriptionPresentation = function(subscription) {
 const view=document.querySelector('#profile-view');
 if(!view?.querySelector('#subscription-create-order')) return;
 const active=Boolean(subscription?.active), days=Math.max(0,Math.ceil(Number(subscription?.days_left)||0));
 const word=days%100>=11&&days%100<=14?'дней':days%10===1?'день':days%10>=2&&days%10<=4?'дня':'дней';
 view.querySelector('.profile-page-subtitle').textContent=active?'Вам осталось '+days+' '+word:'Все приложения EFIR в одной подписке';
 view.querySelector('.subscription-summary strong').textContent=active?'Подписка активна':'Все приложения EFIR launcher';
 view.querySelector('#subscription-create-order').textContent=active?'Продлить':'Создать счет';
};
