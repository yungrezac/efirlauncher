'use strict';
const crypto = require('node:crypto');
const LOGIN_ORIGIN = 'https://license-server-production-8e69.up.railway.app';
const CHECKOUT = 'https://web.tribute.tg/s/17SJ';
const TELEGRAM_ORIGIN = 'https://oauth.telegram.org';
function secureUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
function telegramLoginLink(value, source) {
  try {
    const u = new URL(value);
    if(new URL(source).origin!==TELEGRAM_ORIGIN||u.protocol!=='tg:'||u.username||u.password||u.port||u.hash||!['','/'].includes(u.pathname))return false;
    const keys=[...u.searchParams.keys()];
    if(u.hostname==='resolve')return keys.length===2&&u.searchParams.get('domain')==='oauth'&&/^[A-Za-z0-9_-]{1,2048}$/.test(u.searchParams.get('startapp')||'');
    return u.hostname==='login'&&keys.length===1
      && (/^[A-Za-z0-9_=-]{16,2048}$/.test(u.searchParams.get('token') || '') || /^[0-9]{5,8}$/.test(u.searchParams.get('code') || ''));
  } catch { return false; }
}
function createSubscriptionWindows({ WebContentsView, session, shell, parent, onState = () => {}, onPaymentClosed = () => {} }) {
  let partition, mode = null, visible = null, error = '', closing = false, cancelPending, loginMonitor, loginPhase='';
  const views = new Set(), stack = [];
  function geometry() {
    const [w,h] = parent.getContentSize(), width = Math.min(580, Math.max(280,w-40)), height = Math.min(780,Math.max(240,h-48));
    return { x: Math.max(0,Math.round((w-width)/2)), y: Math.max(0,Math.round((h-height)/2)), width, height };
  }
  function update(extra={}) {
    if(parent.isDestroyed())return;
    const bounds=geometry();
    if(visible&&!visible.webContents.isDestroyed())visible.setBounds({x:bounds.x+1,y:bounds.y+60,width:bounds.width-2,height:Math.max(1,bounds.height-106)});
    onState({open:!!mode,mode,title:mode==='payment'?'Подписка Tribute':'Вход в Telegram',error,loading:!!mode&&!visible,loadingText:mode==='login'&&loginPhase==='verifying'?'Подтверждаем вход…':'Загружаем…',
      host:visible&&!visible.webContents.isDestroyed()?safeHost(visible.webContents.getURL()):'',bounds,scale:parent.webContents.getZoomFactor(),...extra});
  }
  function safeHost(url) { try{return new URL(url).hostname;}catch{return '';} }
  function detach() { if(visible&&!parent.isDestroyed())parent.contentView.removeChildView(visible);visible=null; }
  function display(view) { detach();visible=view;parent.contentView.addChildView(view);update();view.webContents.focus(); }
  function closeAll(notify=false,result={}) {
    clearTimeout(loginMonitor);loginMonitor=null;loginPhase='';
    const closedMode=mode,wasPayment=mode==='payment';mode=null;closing=true;cancelPending?.();cancelPending=null;detach();
    for(const view of views)if(!view.webContents.isDestroyed())view.webContents.close({waitForBeforeUnload:false});
    views.clear();stack.length=0;error='';closing=false;update({closedByUser:notify,closedMode,...result});
    if(notify&&wasPayment)onPaymentClosed();
  }
  function reset() { closeAll();partition=undefined; }
  function watchLogin(root) {
    const wc=root.webContents,deadline=Date.now()+600000;
    let noPopupSince=0,checkingSince=0;
    const current=()=>mode==='login'&&views.has(root)&&!wc.isDestroyed();
    const fail=text=>closeAll(false,{loginError:text});
    async function check(){
      if(!current())return;
      try{
        if(new URL(wc.getURL()).origin!==LOGIN_ORIGIN)throw Error('origin');
        // Only read our own coordinator. Identity is still checked via the authenticated API.
        const result=await wc.executeJavaScript(`(()=>{const s=document.getElementById('status');return {phase:s?.dataset.phase||(s?.classList.contains('error')?'error':''),text:s?.textContent?.slice(0,500)};})()`);
        if(!current())return;
        if(result.phase==='error'){fail(result.text||'Не удалось завершить вход. Повторите попытку.');return;}
        if(result.phase==='verified'){closeAll(false,{loginCompleted:true});return;}
        loginPhase=result.phase;update();
        const now=Date.now();
        if(result.phase==='verifying')checkingSince ||= now;
        if(!visible)noPopupSince ||= now;else noPopupSince=0;
        if(now>deadline||(checkingSince&&now-checkingSince>20000)||(noPopupSince&&now-noPopupSince>20000)){
          fail('Не удалось получить подтверждение Telegram. Начните вход заново.');return;
        }
      }catch{if(current()){fail('Не удалось завершить вход. Проверьте соединение и повторите попытку.');return;}}
      if(current())loginMonitor=setTimeout(check,500);
    }
    loginMonitor=setTimeout(check,250);
  }
  function preferences() {
    if(!partition){partition='efir-subscription-'+crypto.randomUUID();const s=session.fromPartition(partition);
      s.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));s.setPermissionCheckHandler(()=>false);
      s.on('will-download',event=>event.preventDefault());}
    return {partition,sandbox:true,contextIsolation:true,nodeIntegration:false,nodeIntegrationInWorker:false,nodeIntegrationInSubFrames:false,
      webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,backgroundThrottling:false};
  }
  function openTelegram(url, source) {
    if(!telegramLoginLink(url,source))return false;
    shell.openExternal(url).then(()=>{error='Подтвердите вход в Telegram. Если приложение не открылось, выберите вход по QR-коду.';update();})
      .catch(()=>{error='Не удалось открыть приложение Telegram. Используйте вход по QR-коду.';update();});
    return true;
  }
  function createView(options={}, coordinator=false) {
    const view=new WebContentsView({...options,webPreferences:{...options.webPreferences,...preferences()}}), wc=view.webContents;
    views.add(view);view.setBackgroundColor('#1b2329');
    wc.on('will-attach-webview',e=>e.preventDefault());
    const navigation=(event,url)=>{
      const target=url||event.url;
      if(!secureUrl(target)){event.preventDefault();openTelegram(target,wc.getURL());}
      else if(coordinator&&new URL(target).origin!==LOGIN_ORIGIN)event.preventDefault();
    };
    wc.on('will-navigate',navigation);wc.on('will-redirect',navigation);
    wc.on('will-frame-navigate',event=>{if(!event.isMainFrame&&!secureUrl(event.url)){event.preventDefault();
      if(event.initiator?.url&&secureUrl(event.initiator.url)&&new URL(event.initiator.url).origin===TELEGRAM_ORIGIN)openTelegram(event.url,event.initiator.url);}});
    wc.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='Escape'){event.preventDefault();closeAll(true);}});
    wc.on('did-navigate',()=>{if(view===visible){error='';update();}});
    wc.on('did-fail-load',(_e,code,_description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3&&mode){error='Не удалось загрузить страницу. Проверьте соединение и повторите вход.';update();}});
    wc.on('destroyed',()=>{
      views.delete(view);const index=stack.indexOf(view);if(index>=0)stack.splice(index,1);
      if(!closing&&view===visible){detach();const previous=stack.at(-1);if(previous)display(previous);else update();}
    });
    wc.setWindowOpenHandler(details=>{
      if(openTelegram(details.url,wc.getURL()))return {action:'deny'};
      if(!secureUrl(details.url)||views.size>=6||(coordinator&&new URL(details.url).origin!==TELEGRAM_ORIGIN))return {action:'deny'};
      return {action:'allow',overrideBrowserWindowOptions:{webPreferences:preferences()},createWindow:options=>{
        const child=createView(options);stack.push(child);display(child);
        if(details.disposition==='background-tab')child.webContents.loadURL(details.url).catch(()=>{});
        return child.webContents;
      }};
    });
    return view;
  }
  async function openLogin(value) {
    const u=new URL(value);
    if(u.origin!==LOGIN_ORIGIN||!['/','/v1/telegram/login'].includes(u.pathname)||!/^#[a-f0-9]{48}$/.test(u.hash)||u.search||u.username||u.password)throw Error('Некорректный адрес входа Telegram.');
    reset();mode='login';update();
    const root=createView({},true),wc=root.webContents;
    const cancelled=new Promise((_,reject)=>{cancelPending=()=>reject(Error('Вход закрыт.'));});
    try {
      await Promise.race([cancelled,(async()=>{
        await wc.loadURL(u.href);
        // Keep the official opener/postMessage flow; only its popup is visible.
        if(new URL(wc.getURL()).origin!==LOGIN_ORIGIN)throw Error('Некорректная страница входа.');
        await wc.executeJavaScript(`new Promise((resolve,reject)=>{const end=Date.now()+10000;const run=()=>{const b=document.getElementById('login');if(b&&!b.disabled){b.click();resolve();}else if(Date.now()>end)reject(Error('Telegram недоступен. Повторите вход.'));else setTimeout(run,100);};run();})`,true);
        if(!visible)throw Error('Не удалось открыть Telegram. Повторите вход.');
        watchLogin(root);
      })()]);
    } catch(e) { if(views.has(root)){closeAll();}throw e; }
    finally { cancelPending=null; }
  }
  async function openPayment(value) {
    if(value!==CHECKOUT)throw Error('Сначала подтвердите Telegram.');
    if(mode==='payment'){visible?.webContents.focus();return;}
    closeAll();mode='payment';const view=createView();stack.push(view);display(view);
    try{await view.webContents.loadURL(CHECKOUT);}catch{if(views.has(view)){error='Не удалось загрузить Tribute. Закройте окно и повторите попытку.';update();}}
  }
  parent.on('resize',()=>update());parent.webContents.on('zoom-changed',()=>update());parent.once('closed',reset);
  return {openLogin,openPayment,finishLogin:()=>closeAll(),reset,close:()=>closeAll(true)};
}
module.exports={createSubscriptionWindows,secureUrl,telegramLoginLink};
