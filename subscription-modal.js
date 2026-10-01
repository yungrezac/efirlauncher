(() => {
  if(!window.launcher?.onSubscriptionModal)return;
  const style=document.createElement('style');
  style.textContent=`.subscription-modal{position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;color:#edf4e8;overflow:hidden;-webkit-app-region:no-drag}.subscription-modal::backdrop{background:rgba(3,8,5,.78);backdrop-filter:blur(5px)}.subscription-modal-card{position:absolute;background:#141b13;border:1px solid #455732;border-radius:18px;box-shadow:0 24px 100px #0009;overflow:hidden;box-sizing:border-box}.subscription-modal-header{height:59px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;box-sizing:border-box}.subscription-modal-heading{font-size:16px;font-weight:700}.subscription-modal-close{border:0;background:#293522;color:#d7ff7a;border-radius:10px;width:34px;height:34px;font:24px/1 sans-serif;cursor:pointer}.subscription-modal-loading{position:absolute;inset:60px 0 46px;display:grid;place-items:center;color:#bfd3ae;font-size:15px}.subscription-modal-footer{position:absolute;bottom:0;left:0;right:0;height:45px;display:flex;align-items:center;padding:0 16px;font-size:11px;line-height:1.3;color:#b6c5aa;box-sizing:border-box}`;
  document.head.append(style);
  const dialog=document.createElement('dialog');dialog.className='subscription-modal';dialog.setAttribute('aria-label','Подписка EFIR');
  dialog.innerHTML='<section class="subscription-modal-card"><header class="subscription-modal-header"><span class="subscription-modal-heading"></span><button class="subscription-modal-close" aria-label="Закрыть окно">×</button></header><div class="subscription-modal-loading">Загружаем…</div><footer class="subscription-modal-footer"></footer></section>';
  document.body.append(dialog);let restoreFocus;
  const close=()=>window.launcher.closeSubscriptionModal().catch(()=>{});
  dialog.querySelector('button').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  window.launcher.onSubscriptionModal(state=>{
    if(!state.open){if(dialog.open){dialog.close();restoreFocus?.focus();}return;}
    const scale=state.scale||1,b=state.bounds,card=dialog.querySelector('section');
    // Main-process geometry is in DIP; CSS is adjusted for the launcher's zoom.
    Object.assign(card.style,{left:b.x/scale+'px',top:b.y/scale+'px',width:b.width+'px',height:b.height+'px',transform:`scale(${1/scale})`,transformOrigin:'top left'});
    dialog.querySelector('.subscription-modal-heading').textContent=state.title;
    dialog.querySelector('.subscription-modal-footer').textContent=state.error||state.host||'Защищённое соединение';
    dialog.querySelector('.subscription-modal-loading').textContent=state.error||'Загружаем…';
    dialog.querySelector('.subscription-modal-loading').style.visibility=state.loading?'visible':'hidden';
    if(!dialog.open){restoreFocus=document.activeElement;dialog.showModal();}
  });
})();
