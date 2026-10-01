(() => {
  'use strict';
  const api=window.launcher,client=window.efirLandingClient;
  if(!api?.redeemCode||!client)return;
  let pending=null,account=null,generation=0;
  const hint=document.createElement('p');hint.className='message';hint.hidden=true;
  document.querySelector('#auth-form')?.append(hint);
  function updateHint(){hint.hidden=!pending;hint.textContent=pending?`Промокод ${pending.code} сохранён. После входа откройте «Промокоды» в настройках аккаунта.`:'';}
  function appsText(apps){return (apps||[]).map(a=>a.name||a.id).join(', ');}
  window.efirPromos=Object.freeze({mount(host,refresh){
    if(!host)return;const request=++generation;
    host.innerHTML='<h2>Введите промокод</h2><p>Промокод автора открывает выбранные приложения в каталоге. Для запуска нужна подписка. Пробный промокод добавляет дни доступа.</p><form class="promo-form"><label for="promo-code">Промокод</label><div class="subscription-actions"><input id="promo-code" maxlength="64" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Ваш промокод" required><button type="submit" class="primary-payment">Применить</button></div><p class="promo-result" role="status" aria-live="polite"></p></form><p class="promo-current" role="status"></p>';
    const form=host.querySelector('form'),input=host.querySelector('input'),button=host.querySelector('button'),result=host.querySelector('.promo-result'),current=host.querySelector('.promo-current');
    const alive=()=>generation===request&&host.isConnected&&!host.closest('#profile-view')?.classList.contains('hidden');
    input.value=pending?.code||'';
    let submitted=false;
    function showCurrent(referral){current.textContent=referral?`Привязан промокод: ${referral.code}. ${referral.apps?.length?'В каталоге: '+appsText(referral.apps)+'.':'Приложения для этого промокода пока не выбраны.'}`:'';}
    api.getPendingReferral().then(value=>{if(alive()&&!submitted&&!input.value)input.value=value?.code||'';}).catch(()=>{});
    api.getReferralStatus().then(state=>{if(alive()&&!submitted)showCurrent(state.referral);}).catch(()=>{if(alive()&&!submitted)current.textContent='Не удалось загрузить применённый промокод. Можно повторить ввод.';});
    form.onsubmit=async event=>{
      event.preventDefault();if(button.disabled||!form.reportValidity())return;
      submitted=true;button.disabled=true;result.textContent='Проверяем промокод…';
      try{
        const saved=await api.redeemCode(input.value);if(!alive())return;
        if(!saved.ok)throw Error(saved.error||'Не удалось применить промокод.');
        if(saved.kind==='referral'){
          pending=null;updateHint();showCurrent(saved);
          result.textContent=saved.apps?.length?'Промокод применён. Теперь в каталоге: '+appsText(saved.apps)+'. Для запуска нужна подписка.':'Промокод применён. Для него пока не выбраны приложения.';
        }else result.textContent='Пробный доступ активирован на '+saved.days+' дн., до '+new Date(saved.expires_at).toLocaleDateString('ru-RU')+'.';
        input.value='';
        try{await refresh();}catch{if(alive())result.textContent+=' Не удалось обновить каталог. Нажмите обновление после восстановления соединения.';}
      }catch(error){if(alive())result.textContent=error.message||'Не удалось применить промокод.';}
      finally{if(alive())button.disabled=false;}
    };
  }});
  function changed(session){const next=session?.user?.id||null;if(next!==account){generation++;account=next;}updateHint();}
  client.auth.getSession().then(({data})=>changed(data.session)).catch(()=>{});
  client.auth.onAuthStateChange((_event,session)=>changed(session));
  api.getPendingReferral().then(value=>{pending=value;updateHint();}).catch(()=>{});
  api.onReferralPending(value=>{pending=value;updateHint();if(pending&&account)window.efirProfile?.openPromos();});
})();
