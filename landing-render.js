(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EfirLanding=factory();})(typeof window==='undefined'?this:window,function(){
 'use strict';
 const origin='https://qpoyojxupblhjeqbvqfr.supabase.co/storage/v1/object/public/creator-portraits/';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const paths={
  // DonateX's official logo.svg silhouette, recolored with the landing accent.
  donatex:'<circle cx="12" cy="12" r="10.7" stroke-width=".8"/><g fill="currentColor" stroke="none" transform="translate(.5 .5) scale(.01468)"><path d="M783.5 634.3 553.8 346.4c-7.6-9.5-19.1-15-31.3-15.1l-225-.1 364.4 455.4 121.6 152 232.6 290.7c7.7 9.6 19.3 15.1 31.6 15l221.2-2-363.7-455.6-121.7-152.4Z"/><path d="M908.6 746.5c4.1 4.8 18.3 3.5 22.3-1.3l344.2-414.9-216.4.1c-11.7 0-22.8 5.5-30.1 15.1L811.3 613.3c-3.5 4.3-3.4 10.5.2 14.8l97.1 118.4Z"/><path d="M640.5 819.9c-6.3-7.6-18-7.7-24.4-.1l-355.6 423.3 216.4-.3c11.8.1 26.5-9.1 33.9-18.6l223.9-269.6c3.4-4.2 6.6-12.7 3.2-16.9l-97.4-117.8Z"/></g>',
  efir:'<path fill="currentColor" stroke="none" d="M4 3h16v4H9v4h9v4H9v2h11v4H4Z"/>',
  timer:'<path d="M8 3h8M12 3v3m6-1 2 2M12 10v4l2 1"/><circle cx="12" cy="14" r="7"/>',
  link:'<path d="m10 13 4-4m-7 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m0 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(3 -1)"/>',
  telegram:'<path d="m21 3-5 18-5-7-8-4 18-7Zm0 0L11 14m0 0-1 6 3-3"/>',
  twitch:'<path d="M4 3h17v12l-5 5h-5l-4 3v-3H3V7Zm4 0v13h4v3l3-3h3l3-3M12 7v5m5-5v5"/>',
  youtube:'<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/>',
  instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/>',
  tiktok:'<path d="M14 3v12a4 4 0 1 1-4-4M14 3c1 4 3 5 6 5"/>',
  donation:'<path d="M9 20a3 3 0 0 0 6 0M6 9a6 6 0 0 1 12 0c0 5 3 6 3 7H3c0-1 3-2 3-7Zm6-8v2"/>',
  card:'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M6 15h4m4 0h2"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>',
  money:'<path d="M7 21V3h6a5 5 0 0 1 0 10H4m0 4h11"/>',
  discord:'<path d="M8 5 4 6 2 17l5 2 1-3m8-11 4 1 2 11-5 2-1-3M7 16c3 2 7 2 10 0M8 5c3-1 5-1 8 0"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/>'
 };
 function cardNumber(value){const digits=String(value).replace(/[\s-]/g,'');return /^\d{16}$/.test(digits)?digits:null;}
 function safeUrl(value){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
 function iconType(item){
  if(item.type==='copy')return cardNumber(item.value)?'card':'copy';
  const u=safeUrl(item.value);if(!u)return 'link';const h=new URL(u).hostname.toLowerCase().replace(/^www\./,'');
  const match=d=>h===d||h.endsWith('.'+d);
  if(['t.me','telegram.me','telegram.org'].some(match))return 'telegram';
  for(const [d,k] of [['donatex.gg','donatex'],['efirlive.pro','efir'],['twitch.tv','twitch'],['youtube.com','youtube'],['youtu.be','youtube'],['instagram.com','instagram'],['tiktok.com','tiktok'],['donationalerts.com','donation'],['dalink.to','donation'],['yoomoney.ru','money'],['discord.gg','discord'],['discord.com','discord']])if(match(d))return k;
  return 'link';
 }
 const icon=type=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+(paths[type]||paths.link)+'</svg>';
 function linkIcon(item){
  const kind=iconType(item),url=safeUrl(item.value);
  if(!['link','donation','money'].includes(kind)||item.type==='copy'||!url)return icon(kind);
  const host=new URL(url).hostname;
  return '<span class="lp-site-icon" aria-hidden="true">'+icon('link')+'<img data-site-icon src="https://efirlive.pro/api/link-icon?host='+esc(encodeURIComponent(host))+'" alt="" decoding="async" referrerpolicy="no-referrer"></span>';
 }
 function photoUrl(photo){if(/^\/assets\/creators\/(astral|sinabon|darisha|violla)\.png$/.test(photo||''))return 'https://efirlive.pro'+photo;return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(photo||'')?origin+photo:'';}
 function render(doc,{logo='/assets/favicon.svg',photoOverride=''}={}){
  const nickname=String(doc.nickname||'NIKNAME').toUpperCase();
  const photo=/^data:image\/(png|jpeg|webp);base64,/.test(photoOverride)?photoOverride:photoUrl(doc.photo);
  const cards=(Array.isArray(doc.items)?doc.items:[]).map(item=>{
   const type=iconType(item),number=item.type==='copy'?cardNumber(item.value):null;
   const subtitle=number?number.replace(/(.{4})(?=.)/g,'$1 '):item.subtitle||(item.type==='copy'?item.value:'');
   const content='<span class="lp-icon">'+linkIcon(item)+'</span><span class="lp-copy"><strong>'+esc(item.title)+'</strong><small>'+esc(subtitle)+'</small>'+(number?'<em>Банковская карта · скопировать номер</em>':'')+'</span><span class="lp-arrow" aria-hidden="true">'+(item.type==='copy'?icon('copy'):'↗')+'</span>';
   if(item.type==='copy')return '<button class="lp-card" data-button-id="'+esc(item.id||'')+'" type="button" data-copy-value="'+esc(number||item.value)+'">'+content+'</button>';
   const url=safeUrl(item.value);return url?'<a class="lp-card" data-button-id="'+esc(item.id||'')+'" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+content+'</a>':'';
  }).join('');
  const rules=doc.rulesEnabled===true&&String(doc.rulesText||'').trim()?'<details class="lp-rules"><summary>'+icon('timer')+'<span>Правила таймера</span><b aria-hidden="true">+</b></summary><div class="lp-rules-text">'+esc(doc.rulesText)+'</div></details>':'';
  return '<main class="lp-page" data-layout="'+esc(JSON.stringify(doc.layout||{}))+'"><section class="lp-hero"><div class="lp-halo"></div><div class="lp-orbit"></div><div class="lp-photo">'+(photo?'<img crossorigin="anonymous" src="'+esc(photo)+'" alt="'+esc(nickname)+'" fetchpriority="high">':'<div class="lp-photo-placeholder">Добавьте фотографию</div>')+'</div><header class="lp-identity"><span>НА СВЯЗИ</span><h1 style="--name-size:'+Math.max(15,Math.min(38,210/Math.max(nickname.length,6)))+'px">'+esc(nickname)+'<b>.</b></h1><i></i></header><a class="lp-brand" href="https://efirlive.pro/" target="_blank" rel="noopener noreferrer" aria-label="EFIR launcher"><img src="'+esc(logo)+'" alt=""><span><strong>EFIR</strong><small>launcher</small></span></a></section><section class="lp-panel"><div class="lp-heading">ВСЁ НУЖНОЕ — ЗДЕСЬ <span aria-hidden="true">✳</span></div><div class="lp-list">'+(cards||'<p class="lp-empty">Здесь появятся ваши кнопки</p>')+'</div>'+rules+'<p class="lp-status" role="status" aria-live="polite"></p></section><footer class="lp-footer"><a href="https://efirlive.pro/" target="_blank" rel="noopener noreferrer">СОЗДАНО С <strong>EFIR</strong> ↗</a></footer></main>';
 }
 return {esc,cardNumber,safeUrl,iconType,icon,linkIcon,photoUrl,render};
});
