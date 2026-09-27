(() => {
 'use strict';
 const client=window.efirLandingClient;if(!client)return;
 const L=window.EfirLanding;
 const nav=document.createElement('button');nav.id='landing-nav';nav.textContent='Мой лендинг';nav.hidden=true;
 document.querySelector('#store .topbar nav').append(nav);
 const overlay=document.createElement('section');overlay.className='landing-overlay';overlay.hidden=true;overlay.setAttribute('aria-label','Конструктор лендинга');document.body.append(overlay);
 let owner=null,state=null,doc=null,pendingPhoto=null,photoPreview='',dirty=false,busy=false,requestId=0,previewTimer;
 const blank=()=>({nickname:'',slug:'',photo:'',items:[]});
 const message=(text,error=false)=>{const node=overlay.querySelector('.landing-status');if(node){node.textContent=text;node.classList.toggle('error',error);}};
 const errors={LANDING_ACCESS_REQUIRED:'Доступ к лендингу отозван. Обратитесь к администратору.',LANDING_CHANGED:'Лендинг изменён в другом окне. Закройте редактор и откройте его снова перед сохранением.',SLUG_TAKEN:'Этот адрес уже занят. Выберите другой.',INVALID_NICKNAME:'Введите ник от 1 до 32 символов.',INVALID_SLUG:'Адрес: от 3 до 40 латинских букв, цифр, дефисов или подчёркиваний.',INVALID_LINK:'Укажите полную ссылку, начинающуюся с https:// или http://.',PHOTO_AND_BUTTON_REQUIRED:'Для публикации добавьте фотографию и хотя бы одну кнопку.',INVALID_PHOTO:'Фотография не загрузилась. Выберите её снова.',INVALID_BUTTON:'Проверьте название и содержимое каждой кнопки.',TOO_MANY_BUTTONS:'Можно добавить до 24 кнопок.'};
 function errorText(error){return Object.entries(errors).find(([key])=>String(error.message).includes(key))?.[1]||'Не удалось сохранить. Проверьте подключение и повторите попытку.';}
 function clear(){requestId++;owner=null;state=null;doc=null;pendingPhoto=null;photoPreview='';dirty=false;nav.hidden=true;overlay.hidden=true;overlay.replaceChildren();}
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
   draw();overlay.hidden=false;overlay.querySelector('#landing-nickname').focus();
  }catch(error){window.alert('Не удалось открыть лендинг. Проверьте интернет и попробуйте снова.');}
  finally{nav.disabled=false;}
 }
 function draw(){
  overlay.innerHTML=`<header class="landing-top"><div><h1>Мой лендинг</h1><p>Ваш ник, фотография и все ссылки в стиле EFIR.</p></div><button type="button" id="landing-close">Закрыть</button></header><div class="landing-workspace"><form class="landing-form"><fieldset style="border:0;padding:0;margin:0"><div class="landing-fields"><label>Ник<input id="landing-nickname" maxlength="32" required value="${L.esc(doc.nickname)}" placeholder="VIOLLA"></label><label>Адрес страницы<input id="landing-slug" minlength="3" maxlength="40" pattern="[a-z0-9][a-z0-9_-]{2,39}" required value="${L.esc(doc.slug)}" placeholder="violla"><small>efirlive.pro/u/<span id="landing-slug-hint">${L.esc(doc.slug||'ваш-ник')}</span></small></label></div><label class="landing-photo">Фотография<input id="landing-photo" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG с прозрачным фоном выглядит как наши лендинги. Также подойдут JPG и WebP, до 5 МБ. Ник и логотип EFIR разместятся автоматически.</small></label><h2>Кнопки и ссылки</h2><div id="landing-items"></div><button type="button" class="landing-add" id="landing-add">+ Добавить кнопку</button><div class="landing-actions"><button type="submit">Сохранить черновик</button><button type="button" class="landing-publish" id="landing-publish">Опубликовать</button><button type="button" id="landing-unpublish" ${state.published?'':'hidden'}>Снять с публикации</button></div></fieldset><p class="landing-status" role="status" aria-live="polite"></p><button type="button" class="landing-public-link" id="landing-open-public" ${state.published?'':'hidden'}></button><small>Изменения черновика появятся на странице только после публикации.</small></form><aside class="landing-preview-wrap"><p>ПРЕДПРОСМОТР</p><iframe class="landing-preview-frame" title="Предпросмотр лендинга" src="landing-preview.html" sandbox="allow-scripts allow-same-origin"></iframe></aside></div>`;
  rows();publishedLink();
  const frame=overlay.querySelector('iframe');frame.addEventListener('load',preview);
  overlay.querySelector('#landing-close').onclick=()=>{if(!busy&&(!dirty||window.confirm('Закрыть без сохранения изменений?'))){overlay.hidden=true;dirty=false;}};
  overlay.querySelector('#landing-open-public').onclick=()=>window.launcher.openExternal('https://efirlive.pro/u/'+state.published.slug);
  overlay.querySelector('#landing-nickname').oninput=event=>{
   if(!state.draft&&!overlay.querySelector('#landing-slug').dataset.edited){overlay.querySelector('#landing-slug').value=event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,40);}
  };
  overlay.querySelector('#landing-slug').oninput=event=>{event.target.dataset.edited='true';};
  overlay.querySelector('form').addEventListener('input',event=>{if(event.target.type==='file')return;read();dirty=true;updateHints();schedulePreview();});
  overlay.querySelector('#landing-photo').onchange=selectPhoto;
  overlay.querySelector('#landing-add').onclick=()=>{read();if(doc.items.length>=24)return message('Можно добавить до 24 кнопок.',true);doc.items.push({type:'link',title:'',subtitle:'',value:''});dirty=true;rows();preview();};
  overlay.querySelector('form').onsubmit=event=>{event.preventDefault();save('draft');};
  overlay.querySelector('#landing-publish').onclick=()=>save('publish');
  overlay.querySelector('#landing-unpublish').onclick=()=>save('unpublish');
 }
 function read(){
  doc.nickname=overlay.querySelector('#landing-nickname').value.trim();doc.slug=overlay.querySelector('#landing-slug').value.trim().toLowerCase();
  doc.items=[...overlay.querySelectorAll('.landing-row')].map(row=>Object.fromEntries(['type','title','subtitle','value'].map(key=>[key,row.querySelector('[data-field="'+key+'"]').value])));
  overlay.querySelector('#landing-slug-hint').textContent=doc.slug||'ваш-ник';
 }
 function rows(){
  overlay.querySelector('#landing-items').innerHTML=doc.items.map((item,i)=>`<article class="landing-row"><div class="landing-row-head"><strong>Кнопка ${i+1}</strong><button type="button" data-move="-1" aria-label="Переместить кнопку ${i+1} вверх" ${i===0?'disabled':''}>↑</button><button type="button" data-move="1" aria-label="Переместить кнопку ${i+1} вниз" ${i===doc.items.length-1?'disabled':''}>↓</button><button type="button" data-remove aria-label="Удалить кнопку ${i+1}">×</button></div><div class="landing-row-body"><label>Действие<select data-field="type"><option value="link" ${item.type==='link'?'selected':''}>Открыть ссылку</option><option value="copy" ${item.type==='copy'?'selected':''}>Скопировать текст</option></select></label><label>Название<input data-field="title" maxlength="80" required value="${L.esc(item.title)}" placeholder="Telegram или название карты"></label><label>Подпись<input data-field="subtitle" maxlength="160" value="${L.esc(item.subtitle)}" placeholder="Необязательно"></label><label>Ссылка или текст для копирования<textarea data-field="value" maxlength="2048" required placeholder="https://t.me/… или текст">${L.esc(item.value)}</textarea></label></div><div class="landing-icon-hint"></div></article>`).join('');
  overlay.querySelectorAll('.landing-row').forEach((row,index)=>{
   row.querySelectorAll('[data-move]').forEach(button=>button.onclick=()=>{read();const target=index+Number(button.dataset.move);[doc.items[index],doc.items[target]]=[doc.items[target],doc.items[index]];dirty=true;rows();preview();});
   row.querySelector('[data-remove]').onclick=()=>{read();doc.items.splice(index,1);dirty=true;rows();preview();};
  });updateHints();
 }
 function updateHints(){overlay.querySelectorAll('.landing-row').forEach((row,i)=>{const item=doc.items[i];const kind=L.iconType(item);row.querySelector('.landing-icon-hint').innerHTML=L.icon(kind)+'<span>'+(kind==='card'?'Банковская карта: 16 цифр':kind==='copy'?'Кнопка копирования':'Иконка определяется по ссылке')+'</span>';});}
 function schedulePreview(){clearTimeout(previewTimer);previewTimer=setTimeout(preview,120);}
 function preview(){overlay.querySelector('iframe')?.contentWindow.postMessage({type:'efir-landing-preview',document:doc,photo:photoPreview},'*');}
 function publishedLink(){const b=overlay.querySelector('#landing-open-public');b.hidden=!state.published;b.textContent=state.published?'Открыть: efirlive.pro/u/'+state.published.slug+' ↗':'';overlay.querySelector('#landing-unpublish').hidden=!state.published;}
 async function selectPhoto(event){
  const file=event.target.files[0];if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5242880){event.target.value='';return message('Выберите PNG, JPG или WebP размером до 5 МБ.',true);}
  const id=requestId;setBusy(true);
  try{
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
   await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth>0&&image.naturalWidth<=6000&&image.naturalHeight<=6000?resolve():reject();image.onerror=reject;image.src=data;});
   if(id!==requestId)return;pendingPhoto=file;photoPreview=data;dirty=true;message('Фотография добавлена в предпросмотр. Сохраните или опубликуйте лендинг.');preview();
  }catch{message('Не удалось открыть фотографию. Максимальная сторона — 6000 пикселей.',true);event.target.value='';}
  finally{setBusy(false);}
 }
 function setBusy(value){busy=value;const fieldset=overlay.querySelector('fieldset');if(fieldset)fieldset.disabled=value;const close=overlay.querySelector('#landing-close');if(close)close.disabled=value;}
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
    const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[pendingPhoto.type];
    const path=owner+'/'+crypto.randomUUID()+'.'+extension;
    const {error}=await client.storage.from('creator-portraits').upload(path,pendingPhoto,{contentType:pendingPhoto.type,upsert:false});if(error)throw error;
    doc.photo=path;pendingPhoto=null;
   }
   const {data,error}=await client.rpc('landing_save',{p_document:doc,p_revision:state.revision,p_action:action});if(error)throw error;
   if(id!==requestId)return;state=data;if(action!=='unpublish'){doc=structuredClone(data.draft);dirty=false;}publishedLink();
   message(action==='publish'?'Лендинг опубликован. Ссылка готова для ваших зрителей.':action==='unpublish'?'Страница снята с публикации.':'Черновик сохранён.');
  }catch(error){if(id===requestId)message(errorText(error),true);}
  finally{setBusy(false);}
 }
 nav.onclick=open;
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')clear();else setTimeout(refreshAccess,0);});
 window.addEventListener('focus',refreshAccess);
 setInterval(()=>{if(!document.hidden)refreshAccess();},30000);
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 refreshAccess();
})();
