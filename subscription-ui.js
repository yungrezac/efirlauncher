(() => {
 let stopCurrent=()=>{};
 const telegramIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m20.7 4.2-3.3 15.3c-.3 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1L17 6c.4-.4-.1-.6-.6-.3L4.8 13l-5-1.6c-1.1-.3-1.1-1.1.2-1.6L19.5 2c.9-.3 1.6.2 1.2 2.2Z" transform="translate(2 1) scale(.9)"/></svg>';
 window.decorateSubscription=function(view,refreshSubscription){
  stopCurrent();
  const content=view.querySelector('.profile-content'),panel=content.querySelector('.subscription-panel');
  content.classList.add('subscription-minimal');content.querySelector('.profile-large-avatar')?.remove();
  content.querySelector('.profile-page-subtitle').textContent='Все приложения EFIR в одной подписке';
  const summary=panel.querySelector('.subscription-summary'),promo=panel.querySelector('.promo-form');
  panel.replaceChildren(summary);
  const flow=document.createElement('section');flow.className='tribute-flow';
  flow.innerHTML=`<div class="tribute-heading"><span class="tribute-mark">${telegramIcon}</span><div><span class="tribute-eyebrow">EFIR × TELEGRAM</span><h2>Один аккаунт. Все возможности.</h2><p>Привяжите Telegram и оформите подписку через Tribute.</p></div></div>
   <div class="tribute-step" id="tribute-link-step"><span class="tribute-step-number">1</span><div class="tribute-step-content"><h3>Ваш Telegram</h3><div id="tribute-identity">Проверяем привязку…</div><div class="subscription-actions"><button type="button" id="tribute-login" class="primary-payment" disabled>Войти через Telegram ↗</button><button type="button" id="tribute-change" class="secondary-payment hidden">Сменить Telegram</button><button type="button" id="tribute-cancel" class="secondary-payment hidden">Отмена</button></div></div></div>
   <div class="tribute-step is-locked" id="tribute-pay-step"><span class="tribute-step-number">2</span><div class="tribute-step-content"><h3>Подписка EFIR Launcher</h3><p id="tribute-offer">Срок и стоимость выбираются на странице Tribute.</p><div id="tribute-prices" class="tribute-prices"></div><p class="tribute-account-note">Оплачивайте через тот же Telegram, который привязали здесь.</p><div class="subscription-actions"><button type="button" id="tribute-pay" class="primary-payment hidden">Оплатить через Tribute ↗</button><button type="button" id="tribute-check" class="secondary-payment hidden">Проверить подписку</button></div></div></div>
   <p id="subscription-message" class="subscription-message" role="status" aria-live="polite"></p>`;
  panel.append(flow);
  if(promo){const details=document.createElement('details');details.className='subscription-promo';const heading=document.createElement('summary');heading.textContent='Есть промокод?';details.append(heading,promo);panel.append(details);}
  const get=id=>flow.querySelector('#'+id),api=window.launcher;
  let code=null,checkout=null,stopped=false,timer=null,busy=false,expiresAt=0,generation=0;
  const stopPaymentListener=api.onSubscriptionPaymentClosed?.(()=>{if(alive()&&!busy&&checkout)get('tribute-check').click();});
  const stopModalListener=api.onSubscriptionModal?.(state=>{
   if(!alive())return;
   if(state.loginCompleted){clearTimeout(timer);timer=setTimeout(poll,0);}
   if(state.loginError||(state.closedByUser&&state.closedMode==='login')){
    generation++;code=null;clearTimeout(timer);
    load().then(()=>{if(alive())message(state.loginError||'Вход закрыт. Можно попробовать снова.',!!state.loginError);});
   }
  });
  const alive=()=>!stopped&&flow.isConnected&&!view.classList.contains('hidden');
  const message=(text,error=false)=>{get('subscription-message').textContent=text;get('subscription-message').classList.toggle('error',error);};
  const button=(id,visible,disabled=false)=>{get(id).classList.toggle('hidden',!visible);get(id).disabled=disabled;};
  function renderIdentity(telegram){
   const target=get('tribute-identity');target.replaceChildren();
   if(!telegram){target.textContent='Вход нужен, чтобы зачислить подписку вашему аккаунту EFIR.';return;}
   const username=telegram.username||(telegram.display_name?.startsWith('@')?telegram.display_name.slice(1):'');
   const name=telegram.name||(!telegram.display_name?.startsWith('@')?telegram.display_name:'')||'Telegram';
   const card=document.createElement('div');card.className='tribute-user';
   const avatar=document.createElement('span');avatar.className='tribute-user-avatar';avatar.textContent=Array.from(name)[0]?.toUpperCase()||'T';
   try{const url=new URL(telegram.photo_url);if(url.protocol==='https:'&&!url.username&&!url.password){const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.src=url.href;img.onerror=()=>img.remove();avatar.append(img);}}catch{}
   const info=document.createElement('div');info.className='tribute-user-info';
   const title=document.createElement('strong');title.textContent=name;
   const handle=document.createElement('span');handle.textContent=username?'@'+username:'Без username';
   info.append(title,handle);card.append(avatar,info);target.append(card);
  }
  stopCurrent=()=>{stopped=true;clearTimeout(timer);stopPaymentListener?.();stopModalListener?.();};
  async function load(){
   try{const state=await api.getTelegramSubscription();if(!alive())return;
    checkout=state.checkout_url;const linked=!!state.telegram;
    renderIdentity(state.telegram);
    get('tribute-link-step').classList.toggle('is-complete',linked);get('tribute-pay-step').classList.toggle('is-locked',!linked);
    button('tribute-login',!linked,!state.ready);button('tribute-change',linked,!state.ready);button('tribute-cancel',false);
    button('tribute-pay',linked,!(state.ready&&checkout));button('tribute-check',linked,!state.ready);
    if(!state.ready)message('Оплата через Tribute готовится к запуску. Уже активная подписка продолжает действовать.');
    else {
     const offer=await api.getTributeOffer();if(!alive())return;
     const names={monthly:'месяц',quarterly:'3 месяца',halfyearly:'6 месяцев',yearly:'год',weekly:'неделя',onetime:'разовый доступ',trial:'пробный период'};
     get('tribute-prices').replaceChildren();
     for(const p of offer.periods||[]){if(!Number.isFinite(Number(p.price)))continue;const tag=document.createElement('span');
      let price;try{price=new Intl.NumberFormat('ru-RU',{style:'currency',currency:offer.currency}).format(Number(p.price));}catch{price=String(p.price)+' '+String(offer.currency||'').toUpperCase();}
      tag.textContent=price+' / '+(names[p.period]||p.period);get('tribute-prices').append(tag);}
     get('tribute-offer').textContent='Условия Tribute. Итоговая сумма и доступные способы оплаты — на странице оформления.';
    }
   }catch(e){if(alive())message(e.message||'Не удалось загрузить Telegram. Попробуйте открыть раздел заново.',true);}
  }
  async function poll(){
   if(!alive()||!code||busy)return;
   const attempt=generation;
   if(Date.now()>expiresAt){code=null;await api.cancelTelegramLink();button('tribute-login',true);message('Время входа истекло. Нажмите «Войти через Telegram» ещё раз.',true);return;}
   try{const state=await api.getTelegramLinkStatus(code);if(!alive()||attempt!==generation)return;
    if(state.expired||Date.now()>expiresAt){code=null;await api.cancelTelegramLink();button('tribute-login',true);message('Время входа истекло. Нажмите «Войти через Telegram» ещё раз.',true);return;}
    if(state.telegram){await completeLogin();return;}
   }catch(e){if(alive()&&attempt===generation)message(e.message||'Ожидаем соединение…',true);}
   if(alive()&&attempt===generation)timer=setTimeout(poll,2500);
  }
  async function start(){if(busy)return;busy=true;const attempt=++generation;code=null;clearTimeout(timer);button('tribute-login',true,true);button('tribute-change',false);button('tribute-cancel',true);
   try{const result=await api.startTelegramLink();if(!alive()||attempt!==generation)return;code=result.code;expiresAt=Date.now()+result.expires_in*1000;
    message('Завершите вход в Telegram. Аккаунт привяжется автоматически, подписка и доступы обновятся.');timer=setTimeout(poll,1000);
   }catch(e){if(alive())message(e.message||'Не удалось открыть Telegram.',true);}finally{busy=false;if(alive())get('tribute-login').disabled=false;}
  }
  get('tribute-login').onclick=start;get('tribute-change').onclick=start;
  get('tribute-cancel').onclick=async()=>{if(busy)return;generation++;code=null;clearTimeout(timer);await api.cancelTelegramLink();if(alive()){message('Смена аккаунта отменена.');await load();}};
  async function completeLogin(){if(busy||!code)return;busy=true;clearTimeout(timer);
   button('tribute-login',false);button('tribute-cancel',false);button('tribute-change',false);button('tribute-pay',false);button('tribute-check',false);
   message('Обновляем Telegram и подписку…');
   let outcome='',failed=false;
   try{const result=await api.confirmTelegramLink(code);await refreshSubscription();outcome=result.verification_pending?'Telegram подключён. Проверка подписки Tribute пока недоступна.':'Telegram подключён. Подписка и доступы обновлены.';}
   catch(e){outcome=e.message||'Не удалось привязать Telegram.';failed=true;}
   finally{code=null;if(alive()){await load();message(outcome,failed);}busy=false;}
  }
  get('tribute-pay').onclick=async()=>{if(!checkout)return;try{await api.openSubscriptionPayment();message('Оплата открыта внутри EFIR. После закрытия окна подписка проверится автоматически.');}catch(e){message(e.message,true);}};
  get('tribute-check').onclick=async()=>{if(busy)return;busy=true;get('tribute-check').disabled=true;message('Проверяем подписку…');
   try{const result=await api.checkTributeSubscription();if(!alive())return;
    await refreshSubscription();if(!alive())return;
    message(result.verification_pending?'Tribute пока не ответил. Статус обновится после подтверждения оплаты.':result.subscription.active?'Подписка активна. Приложения доступны.':'Оплата пока не подтверждена. Проверьте, что оплатили с привязанного Telegram.');
   }catch(e){if(alive())message(e.message||'Не удалось проверить подписку.',true);}finally{busy=false;if(alive())get('tribute-check').disabled=false;}
  };
  load();
 };
 window.updateSubscriptionPresentation=function(subscription){
  const view=document.querySelector('#profile-view');if(!view?.querySelector('.tribute-flow'))return;
  const active=!!subscription?.active,days=Math.max(0,Math.ceil(Number(subscription?.days_left)||0));
  const word=days%100>=11&&days%100<=14?'дней':days%10===1?'день':days%10>=2&&days%10<=4?'дня':'дней';
  view.querySelector('.profile-page-subtitle').textContent=active?'Вам осталось '+days+' '+word:'Все приложения EFIR в одной подписке';
  view.querySelector('.subscription-summary strong').textContent=active?'Подписка активна':'Все приложения EFIR launcher';
  view.querySelector('#tribute-pay').textContent=active?'Управлять подпиской в Tribute ↗':'Оплатить через Tribute ↗';
 };
})();
