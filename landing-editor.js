(() => {
 'use strict';
 const client=window.efirLandingClient;if(!client)return;
 const L=window.EfirLanding;
 const nav=document.createElement('button');nav.id='landing-nav';nav.textContent='Мой лендинг';nav.hidden=true;
 document.querySelector('#store .topbar nav').append(nav);
 const overlay=document.createElement('section');overlay.className='landing-overlay';overlay.hidden=true;overlay.setAttribute('aria-label','Конструктор лендинга');document.body.append(overlay);
 let owner=null,state=null,doc=null,pendingPhoto=null,photoPreview='',dirty=false,busy=false,requestId=0,previewTimer,editing=false,slideTimer,statsRequest=0,previousNav=null,hintToken=0,previewRevision=0;
 const blank=()=>({nickname:'',slug:'',photo:'',items:[],rulesEnabled:false,rulesText:''});
 const message=(text,error=false)=>{const node=overlay.querySelector('.landing-status');if(node){node.textContent=text;node.classList.toggle('error',error);}};
 const errors={INVALID_LAYOUT:'Не удалось сохранить расположение. Сбросьте его в предпросмотре и попробуйте снова.',SLUG_RESERVED:'Этот адрес закреплён за страницей сайта. Выберите другой.',INVALID_RULES:'Правила могут содержать до 10 000 символов.',RULES_REQUIRED:'Напишите правила таймера или выключите кнопку правил.',LANDING_ACCESS_REQUIRED:'Доступ к лендингу отозван. Обратитесь к администратору.',LANDING_CHANGED:'Лендинг изменён в другом окне. Закройте редактор и откройте его снова перед сохранением.',SLUG_TAKEN:'Этот адрес уже занят. Выберите другой.',INVALID_NICKNAME:'Введите ник от 1 до 32 символов.',INVALID_SLUG:'Адрес: от 3 до 40 латинских букв, цифр, дефисов или подчёркиваний.',INVALID_LINK:'Укажите полную ссылку, начинающуюся с https:// или http://.',PHOTO_AND_BUTTON_REQUIRED:'Для публикации добавьте фотографию и хотя бы одну кнопку.',INVALID_PHOTO:'Фотография не загрузилась. Выберите её снова.',INVALID_BUTTON:'Проверьте название и содержимое каждой кнопки.',TOO_MANY_BUTTONS:'Можно добавить до 24 кнопок.'};
 function errorText(error){return Object.entries(errors).find(([key])=>String(error.message).includes(key))?.[1]||'Не удалось сохранить. Проверьте подключение и повторите попытку.';}
 function clear(){clearInterval(slideTimer);statsRequest++;nav.classList.remove('nav-active');requestId++;owner=null;state=null;doc=null;pendingPhoto=null;photoPreview='';dirty=false;nav.hidden=true;overlay.hidden=true;overlay.replaceChildren();}
 async function refreshAccess(){
  if(busy)return;
  const {data:{session}}=await client.auth.getSession();if(!session){clear();return;}
  if(owner&&owner!==session.user.id)clear();
  owner=session.user.id;
  const {data,error}=await client.rpc('landing_allowed');
  if(error)return;nav.hidden=!data;
  if(!data&&!overlay.hidden){overlay.hidden=true;dirty=false;doc=null;pendingPhoto=null;photoPreview='';}
 }
 async function open(){
  if(busy)return;
  if(!overlay.hidden){overlay.querySelector('#landing-nickname')?.focus();return;}
  const id=++requestId;nav.disabled=true;
  try{
   const {data,error}=await client.rpc('landing_get');if(id!==requestId)return;if(error)throw error;
   if(!data?.allowed){nav.hidden=true;return;}
   state=data;doc=structuredClone(data.draft||blank());pendingPhoto=null;photoPreview='';dirty=false;
   editing=!data.draft;draw();overlay.hidden=false;previousNav=document.querySelector('#store .topbar nav .nav-active');document.querySelectorAll('#store .topbar nav .nav-active').forEach(n=>n.classList.remove('nav-active'));nav.classList.add('nav-active');nav.setAttribute('aria-current','page');overlay.querySelector('#landing-nickname')?.focus();
  }catch(error){window.alert('Не удалось открыть лендинг. Проверьте интернет и попробуйте снова.');}
  finally{nav.disabled=false;}
 }
 function draw(){
  clearInterval(slideTimer);statsRequest++;
  if(!editing)return drawOverview();
  overlay.innerHTML=`<header class="landing-top"><div><h1>Мой лендинг</h1><p>Ваш ник, фотография и все ссылки в стиле EFIR.</p></div><div class="landing-top-actions"><button type="button" id="landing-update">${state.published?'Обновить':'Опубликовать'}</button><button type="button" id="landing-cancel">Отменить</button></div></header><div class="landing-workspace"><form class="landing-form"><fieldset style="border:0;padding:0;margin:0"><div class="landing-fields"><label>Ник<input id="landing-nickname" maxlength="32" required value="${L.esc(doc.nickname)}" placeholder="VIOLLA"></label><label>Адрес страницы<input id="landing-slug" minlength="3" maxlength="40" pattern="[a-z0-9][a-z0-9_-]{2,39}" required value="${L.esc(doc.slug)}" placeholder="violla"><small>efirlive.pro/<span id="landing-slug-hint">${L.esc(doc.slug||'ваш-ник')}</span></small></label></div><section class="landing-photo" aria-labelledby="landing-photo-heading"><h2 id="landing-photo-heading">Фотография</h2><div class="landing-upload"><div class="landing-upload-thumbnail"><img id="landing-photo-thumb" alt="Ваша фотография" hidden><span id="landing-photo-empty">＋</span></div><div><label class="landing-upload-button" for="landing-photo"><span id="landing-photo-action">Выбрать фотографию</span><input id="landing-photo" class="landing-file-input" type="file" accept="image/png,.png"></label><p id="landing-photo-name">Фотография ещё не добавлена</p><small>Только PNG · до 5 МБ</small></div></div><small>Выберите PNG с прозрачным фоном. Ник и логотип EFIR разместятся в свободной области вокруг портрета.</small><div class="landing-examples"><div class="landing-example-photo"><img id="landing-example" src="https://efirlive.pro/assets/creators/astral.png" alt="Пример портрета ASTRAL"></div><div><strong>Пример фотографии</strong><p>Портрет без фона, без надписей и логотипа.</p><div class="landing-example-controls"><button type="button" id="landing-example-prev" aria-label="Предыдущий пример">←</button><span id="landing-example-name">ASTRAL</span><button type="button" id="landing-example-next" aria-label="Следующий пример">→</button><button type="button" id="landing-example-pause" aria-label="Остановить слайды">Ⅱ</button></div></div></div></section><h2>Кнопки и ссылки</h2><div id="landing-items"></div><button type="button" class="landing-add" id="landing-add">+ Добавить кнопку</button><section class="landing-rules-editor"><label class="landing-rules-toggle"><input id="landing-rules-enabled" type="checkbox" ${doc.rulesEnabled?'checked':''}><span>Показывать кнопку «Правила таймера»</span></label><label id="landing-rules-field" ${doc.rulesEnabled?'':'hidden'}>Правила вашего таймера<textarea id="landing-rules-text" maxlength="10000" placeholder="Опишите, как подарки меняют время и какие правила действуют на вашем стриме." ${doc.rulesEnabled?'required':''}>${L.esc(doc.rulesText||'')}</textarea><small>Этот текст увидят зрители, открыв «Правила таймера». Переносы строк сохраняются.</small></label></section><div class="landing-actions"><button type="submit">Сохранить черновик</button><button type="button" class="landing-publish" id="landing-publish">${state.published?'Обновить':'Опубликовать'}</button><button type="button" id="landing-unpublish" ${state.published?'':'hidden'}>Снять с публикации</button></div></fieldset><p class="landing-status" role="status" aria-live="polite"></p><button type="button" class="landing-public-link" id="landing-open-public" ${state.published?'':'hidden'}></button><small>Изменения черновика появятся на странице только после публикации.</small></form><aside class="landing-preview-wrap"><p>ПРЕДПРОСМОТР</p><iframe class="landing-preview-frame" title="Предпросмотр лендинга" src="landing-preview.html" sandbox="allow-scripts allow-same-origin"></iframe></aside></div>`;
  rows();publishedLink();updatePhoto();
  const frame=overlay.querySelector('iframe');frame.addEventListener('load',preview);
  overlay.querySelector('#landing-cancel').onclick=cancel;
  overlay.querySelector('#landing-update').onclick=()=>save('publish');
  examples();
  overlay.querySelector('#landing-open-public').onclick=()=>window.launcher.openExternal('https://efirlive.pro/'+state.published.slug);
  overlay.querySelector('#landing-nickname').oninput=event=>{
   if(!state.draft&&!overlay.querySelector('#landing-slug').dataset.edited){overlay.querySelector('#landing-slug').value=event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,40);}
  };
  overlay.querySelector('#landing-slug').oninput=event=>{event.target.dataset.edited='true';};
  overlay.querySelector('form').addEventListener('input',event=>{if(event.target.type==='file')return;read();dirty=true;updateHints();schedulePreview();});
  overlay.querySelector('#landing-photo').onchange=selectPhoto;
  overlay.querySelector('#landing-rules-enabled').onchange=()=>{read();const enabled=doc.rulesEnabled;overlay.querySelector('#landing-rules-field').hidden=!enabled;overlay.querySelector('#landing-rules-text').required=enabled;dirty=true;preview();};
  overlay.querySelector('#landing-add').onclick=()=>{read();if(doc.items.length>=24)return message('Можно добавить до 24 кнопок.',true);doc.items.push({id:crypto.randomUUID().replaceAll('-',''),type:'link',title:'',subtitle:'',value:''});dirty=true;rows();preview();};
  overlay.querySelector('form').onsubmit=event=>{event.preventDefault();save('draft');};
  overlay.querySelector('#landing-publish').onclick=()=>save('publish');
  overlay.querySelector('#landing-unpublish').onclick=()=>save('unpublish');
 }

 function cancel(){
  if(busy)return;doc=structuredClone(state.draft||blank());pendingPhoto=null;photoPreview='';dirty=false;editing=false;draw();
 }
 function examples(){
  const names=['astral','darisha','sinabon'];let index=0,paused=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show=step=>{index=(index+step+names.length)%names.length;const name=names[index];const img=overlay.querySelector('#landing-example');img.src='https://efirlive.pro/assets/creators/'+name+'.png';img.alt='Пример портрета '+name.toUpperCase();overlay.querySelector('#landing-example-name').textContent=name.toUpperCase();};
  const timer=()=>{clearInterval(slideTimer);if(!paused)slideTimer=setInterval(()=>{if(!document.hidden&&!overlay.hidden)show(1);},5000);const b=overlay.querySelector('#landing-example-pause');b.textContent=paused?'▶':'Ⅱ';b.setAttribute('aria-label',paused?'Запустить слайды':'Остановить слайды');};
  overlay.querySelector('#landing-example-prev').onclick=()=>{show(-1);timer();};overlay.querySelector('#landing-example-next').onclick=()=>{show(1);timer();};overlay.querySelector('#landing-example-pause').onclick=()=>{paused=!paused;timer();};timer();
 }
 function drawOverview(){
  overlay.innerHTML='<header class="landing-top"><div><h1>Мой лендинг</h1><p>'+(state.published?'Опубликован · efirlive.pro/'+L.esc(state.published.slug):state.draft?'Черновик сохранён · страница ещё не опубликована':'Создайте свою страницу в стиле EFIR')+'</p></div><button type="button" id="landing-edit">'+(state.draft?'Редактировать':'Создать лендинг')+'</button></header><div class="landing-workspace"><section class="landing-overview"><button type="button" class="landing-public-link" id="landing-open-public" '+(state.published?'':'hidden')+'>Открыть: efirlive.pro/'+L.esc(state.published?.slug||'')+' ↗</button><div class="landing-stats-heading"><h2>Статистика лендинга</h2><button type="button" id="landing-refresh-stats">Обновить статистику</button></div><p>За последние 30 дней · дни по UTC</p><div id="landing-stats" aria-live="polite">Загружаем статистику…</div><p class="landing-status" role="status"></p></section><aside class="landing-preview-wrap"><p>'+(state.published?'ВАША СТРАНИЦА':'СОХРАНЁННЫЙ ЧЕРНОВИК')+'</p><iframe class="landing-preview-frame" title="Предпросмотр лендинга" src="landing-preview.html" sandbox="allow-scripts allow-same-origin"></iframe></aside></div>';
  overlay.querySelector('#landing-edit').onclick=()=>{doc=structuredClone(state.draft||blank());editing=true;draw();};
  overlay.querySelector('#landing-open-public').onclick=()=>window.launcher.openExternal('https://efirlive.pro/'+state.published.slug);
  overlay.querySelector('#landing-refresh-stats').onclick=loadStats;
  overlay.querySelector('iframe').addEventListener('load',()=>overlay.querySelector('iframe')?.contentWindow.postMessage({type:'efir-landing-preview',document:state.published||state.draft||blank()},'*'));
  loadStats();
 }
 async function loadStats(){
  const id=++statsRequest;const node=overlay.querySelector('#landing-stats'),button=overlay.querySelector('#landing-refresh-stats');if(!node)return;
  button.disabled=true;
  try{
   const {data,error}=await client.rpc('landing_stats');if(error)throw error;if(id!==statsRequest)return;
   const num=n=>Number(n||0).toLocaleString('ru-RU');
   node.innerHTML='<div class="landing-stat-cards"><div><strong>'+num(data.visits)+'</strong><span>Посещения</span></div><div><strong>'+num(data.clicks)+'</strong><span>Клики по кнопкам</span></div></div><p class="landing-stat-note">Повторные открытия в одной вкладке за день считаются одним посещением. Предпросмотр не учитывается. Сбор начался с обновления конструктора.</p><h3>Клики по кнопкам</h3><div class="landing-stat-buttons">'+(data.buttons.length?data.buttons.map(b=>'<div><span>'+L.esc(b.title)+(b.active?'':' <small>Удалена или изменена</small>')+'</span><strong>'+num(b.clicks)+'</strong></div>').join(''):'<p>Кнопки появятся здесь после публикации.</p>')+'</div><p class="landing-stat-note">Всего за всё время: '+num(data.totalVisits)+' посещений · '+num(data.totalClicks)+' кликов</p>';
  }catch{if(id===statsRequest)node.textContent='Не удалось загрузить статистику. Нажмите «Обновить статистику», чтобы повторить.';}
  finally{if(id===statsRequest)button.disabled=false;}
 }

 function read(){
  doc.nickname=overlay.querySelector('#landing-nickname').value.trim();doc.slug=overlay.querySelector('#landing-slug').value.trim().toLowerCase();
  doc.rulesEnabled=overlay.querySelector('#landing-rules-enabled').checked;doc.rulesText=overlay.querySelector('#landing-rules-text').value;
  doc.items=[...overlay.querySelectorAll('.landing-row')].map(row=>({id:row.dataset.id||crypto.randomUUID().replaceAll('-',''),...Object.fromEntries(['type','title','subtitle','value'].map(key=>[key,row.querySelector('[data-field="'+key+'"]').value]))}));
  overlay.querySelector('#landing-slug-hint').textContent=doc.slug||'ваш-ник';
 }
 function rows(){
  overlay.querySelector('#landing-items').innerHTML=doc.items.map((item,i)=>`<article class="landing-row" data-id="${L.esc(item.id||'')}"><div class="landing-row-head"><strong>Кнопка ${i+1}</strong><button type="button" data-move="-1" aria-label="Переместить кнопку ${i+1} вверх" ${i===0?'disabled':''}>↑</button><button type="button" data-move="1" aria-label="Переместить кнопку ${i+1} вниз" ${i===doc.items.length-1?'disabled':''}>↓</button><button type="button" data-remove aria-label="Удалить кнопку ${i+1}">×</button></div><div class="landing-row-body"><label>Действие<select data-field="type"><option value="link" ${item.type==='link'?'selected':''}>Открыть ссылку</option><option value="copy" ${item.type==='copy'?'selected':''}>Скопировать текст</option></select></label><label>Название<input data-field="title" maxlength="80" required value="${L.esc(item.title)}" placeholder="Telegram или название карты"></label><label>Подпись<input data-field="subtitle" maxlength="160" value="${L.esc(item.subtitle)}" placeholder="Необязательно"></label><label>Ссылка или текст для копирования<textarea data-field="value" maxlength="2048" required placeholder="https://t.me/… или текст">${L.esc(item.value)}</textarea></label></div><div class="landing-icon-hint"></div></article>`).join('');
  overlay.querySelectorAll('.landing-row').forEach((row,index)=>{
   row.querySelectorAll('[data-move]').forEach(button=>button.onclick=()=>{read();const target=index+Number(button.dataset.move);[doc.items[index],doc.items[target]]=[doc.items[target],doc.items[index]];dirty=true;rows();preview();});
   row.querySelector('[data-remove]').onclick=()=>{read();doc.items.splice(index,1);dirty=true;rows();preview();};
  });updateHints();
 }
 function updateHints(){overlay.querySelectorAll('.landing-row').forEach((row,i)=>{const item=doc.items[i];const kind=L.iconType(item);const service={donatex:'DonateX',efir:'EFIR',telegram:'Telegram',twitch:'Twitch',youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok',donation:'DonationAlerts',money:'ЮMoney',discord:'Discord'}[kind];row.querySelector('.landing-icon-hint').innerHTML=L.icon(kind)+'<span>'+(kind==='card'?'Банковская карта: 16 цифр':kind==='copy'?'Кнопка копирования':service?service+' · иконка в стиле EFIR':'Иконка ссылки')+'</span>';});}
 function schedulePreview(){clearTimeout(previewTimer);previewTimer=setTimeout(preview,120);}
 function preview(){overlay.querySelector('iframe')?.contentWindow.postMessage({type:'efir-landing-preview',document:doc,photo:photoPreview,editing,busy,hintToken,revision:++previewRevision},'*');}
 window.addEventListener('message',event=>{
  const frame=overlay.querySelector('iframe');
  if(event.source!==frame?.contentWindow||overlay.hidden||!editing||busy||!doc||event.data?.type!=='efir-landing-layout'||event.data.revision!==previewRevision)return;
  const layout=event.data.layout;
  if(!layout||typeof layout!=='object')return;
  // The frame is our own sandboxed editor; only accept bounded numeric geometry.
  const clean={};
  if(Number.isFinite(layout.panelOffset))clean.panelOffset=Math.max(-.55,Math.min(.4,layout.panelOffset));
  const n=layout.identity;
  if(n&&['x','y','scale'].every(k=>Number.isFinite(n[k])))clean.identity={x:Math.max(0,Math.min(1,n.x)),y:Math.max(0,Math.min(1.5,n.y)),scale:Math.max(.5,Math.min(2.5,n.scale))};
  doc.layout=clean;dirty=true;
 });
 function updatePhoto(){
  const photo=photoPreview||L.photoUrl(doc.photo),thumb=overlay.querySelector('#landing-photo-thumb');thumb.hidden=!photo;if(photo)thumb.src=photo;
  overlay.querySelector('#landing-photo-empty').hidden=!!photo;
  overlay.querySelector('#landing-photo-action').textContent=photo?'Заменить фотографию':'Выбрать фотографию';
  overlay.querySelector('#landing-photo-name').textContent=pendingPhoto?.name||(photo?'Текущая фотография лендинга':'Фотография ещё не добавлена');
 }
 function publishedLink(){const b=overlay.querySelector('#landing-open-public');b.hidden=!state.published;b.textContent=state.published?'Открыть: efirlive.pro/'+state.published.slug+' ↗':'';overlay.querySelector('#landing-unpublish').hidden=!state.published;}
 async function selectPhoto(event){
  const file=event.target.files[0];if(!file)return;
  if(file.type!=='image/png'||!file.name.toLowerCase().endsWith('.png')||file.size>5242880){event.target.value='';return message('Выберите файл PNG размером до 5 МБ.',true);}
  const id=requestId;setBusy(true);
  try{
   const signature=new Uint8Array(await file.slice(0,8).arrayBuffer());
   if(signature.length!==8||![137,80,78,71,13,10,26,10].every((v,i)=>signature[i]===v))throw new Error('PNG_REQUIRED');
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
   await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth>0&&image.naturalWidth<=6000&&image.naturalHeight<=6000?resolve():reject();image.onerror=reject;image.src=data;});
   if(id!==requestId)return;pendingPhoto=file;photoPreview=data;hintToken++;dirty=true;updatePhoto();message('Фотография добавлена в предпросмотр. Сохраните или опубликуйте лендинг.');preview();
  }catch(error){message(error?.message==='PNG_REQUIRED'?'Это не PNG. Сохраните фотографию в формате PNG и выберите её снова.':'Не удалось открыть фотографию. Максимальная сторона — 6000 пикселей.',true);event.target.value='';}
  finally{setBusy(false);}
 }
 function setBusy(value){busy=value;const fieldset=overlay.querySelector('fieldset');if(fieldset)fieldset.disabled=value;overlay.querySelectorAll('.landing-top button').forEach(b=>b.disabled=value);overlay.querySelector('iframe')?.contentWindow.postMessage({type:'efir-landing-busy',busy:value},'*');}
 async function save(action){
  if(busy)return;
  const form=overlay.querySelector('form');if(action!=='unpublish'&&!form.reportValidity())return;
  read();
  if(action!=='unpublish'&&doc.items.some(i=>i.type==='link'&&!L.safeUrl(i.value)))return message(errors.INVALID_LINK,true);
  if(action==='publish'&&!doc.photo&&!pendingPhoto)return message(errors.PHOTO_AND_BUTTON_REQUIRED,true);
  const id=requestId;setBusy(true);message('Сохраняем…');
  try{
   const {data:{session}}=await client.auth.getSession();if(!session||session.user.id!==owner)throw new Error('LANDING_ACCESS_REQUIRED');
   if(pendingPhoto&&action!=='unpublish'){
    const extension='png';
    const path=owner+'/'+crypto.randomUUID()+'.'+extension;
    const {error}=await client.storage.from('creator-portraits').upload(path,pendingPhoto,{contentType:pendingPhoto.type,upsert:false});if(error)throw error;
    doc.photo=path;pendingPhoto=null;
   }
   const {data,error}=await client.rpc('landing_save',{p_document:doc,p_revision:state.revision,p_action:action});if(error)throw error;
   if(id!==requestId)return;state=data;doc=structuredClone(data.draft||blank());dirty=false;pendingPhoto=null;photoPreview='';editing=false;draw();
   message(action==='publish'?'Лендинг опубликован. Ссылка готова для ваших зрителей.':action==='unpublish'?'Страница снята с публикации.':'Черновик сохранён.');
  }catch(error){if(id===requestId)message(errorText(error),true);}
  finally{setBusy(false);}
 }
 function leave(){
  if(overlay.hidden)return true;
  if(busy||dirty){
   if(overlay.querySelector('.landing-leave-dialog'))return false;
   const dialog=document.createElement('dialog');dialog.className='landing-leave-dialog';
   dialog.innerHTML='<h2>Есть несохранённые изменения</h2><p>'+(busy?'Дождитесь завершения сохранения.':'Сохраните изменения перед переходом. Чтобы отказаться от них, закройте это окно и нажмите «Отменить» в редакторе.')+'</p><div><button type="button" data-stay>Продолжить редактирование</button>'+(!busy?'<button type="button" data-save>'+ (state.published?'Обновить':'Опубликовать')+'</button>':'')+'</div>';
   overlay.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('[data-stay]').onclick=()=>dialog.close();
   if(!busy)dialog.querySelector('[data-save]').onclick=()=>{dialog.close();save('publish');};dialog.showModal();return false;
  }
  clearInterval(slideTimer);statsRequest++;overlay.hidden=true;nav.classList.remove('nav-active');nav.removeAttribute('aria-current');previousNav?.classList.add('nav-active');return true;
 }
 document.addEventListener('click',event=>{
  const target=event.target.closest('button,a');
  if(!target||overlay.hidden||overlay.contains(target)||target===nav||!target.closest('#store'))return;
  if(!leave()){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 nav.onclick=open;
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')clear();else setTimeout(refreshAccess,0);});
 window.addEventListener('focus',refreshAccess);
 setInterval(()=>{if(!document.hidden)refreshAccess();},30000);
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 refreshAccess();
})();
