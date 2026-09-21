(() => {
 const wrap=document.createElement('div');wrap.className='tiktok-control';
 wrap.innerHTML=`<button type="button" id="tiktok-button" aria-expanded="false" aria-controls="tiktok-popover"><span class="tiktok-avatar"><span>♪</span><img hidden alt=""></span><span id="tiktok-name">TikTok</span></button><section id="tiktok-popover" class="hidden"><form id="tiktok-form"><label for="tiktok-username">Аккаунт TikTok</label><div class="tiktok-input-row"><span>@</span><input id="tiktok-username" placeholder="username" maxlength="32" autocomplete="off" spellcheck="false"><button type="submit" title="Подключить">→</button></div></form><div class="tiktok-footer"><span id="tiktok-status" role="status"></span><button id="tiktok-disconnect" type="button">Отключить</button></div></section>`;
 document.querySelector('#subscription-badge').before(wrap);
 const button=wrap.querySelector('#tiktok-button'),panel=wrap.querySelector('section'),input=wrap.querySelector('input'),status=wrap.querySelector('#tiktok-status'),avatar=wrap.querySelector('img'),fallback=wrap.querySelector('.tiktok-avatar span');
 let debounce,state={};
 const open=value=>{panel.classList.toggle('hidden',!value);button.setAttribute('aria-expanded',String(value));if(value)input.focus();};
 button.onclick=()=>open(panel.classList.contains('hidden'));
 document.addEventListener('click',e=>{if(!wrap.contains(e.target))open(false);});
 wrap.addEventListener('keydown',e=>{if(e.key==='Escape'){open(false);button.focus();}});
 const render=next=>{
  state=next;if(document.activeElement!==input)input.value=state.username||'';
  button.dataset.live=String(state.status==='live');wrap.querySelector('#tiktok-name').textContent=state.nickname||state.username||'TikTok';
  button.title=state.username?'@'+state.username+' · '+(state.status==='live'?'В эфире':'Не в эфире'):'TikTok';
  const url=typeof state.avatar==='string'&&/^(https:\/\/|data:image\/)/.test(state.avatar)?state.avatar:'';
  if(avatar.getAttribute('src')!==url){if(url)avatar.src=url;else avatar.removeAttribute('src');}
  avatar.hidden=!url;fallback.hidden=!!url;fallback.textContent=state.username?(state.nickname||state.username).slice(0,1).toUpperCase():'♪';
  status.textContent=state.status==='live'?'В эфире':state.status==='connecting'?'Проверяем эфир…':state.username?'Не в эфире · автопроверка':'Введите имя стримера';
  wrap.querySelector('#tiktok-disconnect').hidden=!state.username;
 };
 avatar.onerror=()=>{avatar.hidden=true;fallback.hidden=false;};
 const connect=async()=>{clearTimeout(debounce);const name=input.value.trim().replace(/^@/,'');if(!/^[a-zA-Z0-9_.]{1,32}$/.test(name)){status.textContent='Введите username без ссылки';return;}if(name===state.username&&['live','connecting'].includes(state.status))return;try{await window.launcher.connectTikTok(name);}catch(error){status.textContent=error.message;}};
 input.oninput=()=>{clearTimeout(debounce);if(input.value.trim())debounce=setTimeout(connect,900);};
 wrap.querySelector('form').onsubmit=e=>{e.preventDefault();connect();};
 wrap.querySelector('#tiktok-disconnect').onclick=()=>{clearTimeout(debounce);window.launcher.disconnectTikTok().catch(error=>status.textContent=error.message);};
 window.launcher.onTikTokState(render);window.launcher.getTikTokState().then(render).catch(()=>status.textContent='TikTok недоступен');
})();
