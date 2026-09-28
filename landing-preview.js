(() => {
 'use strict';
 let dispose=()=>{},hintToken=0,step=-1,locked=false,cancelDrag=()=>{};
 const steps=[
  ['Найдите место для ника','Потяните рамку с ником — «На связи» переместится вместе с ним.','↔'],
  ['Настройте размер','Потяните круглый уголок рамки наружу или внутрь.','⤢'],
  ['Поднимите ссылки','Потяните ручку над карточкой вверх или вниз. Подпись EFIR последует за ней.','↕'],
  ['Всё на своих местах','Можно продолжить настройку. Нажмите «Обновить», чтобы зрители увидели изменения.','✓']
 ];
 window.addEventListener('message',event=>{
  if(event.source!==parent)return;
  if(event.data?.type==='efir-landing-busy'){
   locked=!!event.data.busy;if(locked)cancelDrag();document.body.classList.toggle('le-locked',locked);return;
  }
  if(event.data?.type!=='efir-landing-preview')return;
  dispose();
  const data=event.data;locked=!!data.busy;
  document.body.innerHTML=EfirLanding.render(data.document,{logo:'assets/efir-logo.svg',photoOverride:data.photo||''});
  document.body.className=locked?'le-locked':'';
  const hasPhoto=!!document.querySelector('.lp-photo img');
  if(!data.editing||!hasPhoto){dispose=EfirLandingLayout.mount();return;}
  if(data.hintToken&&data.hintToken!==hintToken){hintToken=data.hintToken;step=0;}
  let layout=EfirLandingLayout.normalize(data.document.layout),drag=null;
  const hero=document.querySelector('.lp-hero'),identity=document.querySelector('.lp-identity'),panel=document.querySelector('.lp-panel');
  const toolbar=document.createElement('div');toolbar.className='le-toolbar';
  toolbar.innerHTML='<span><i></i> Живой редактор</span><button type="button" data-help>Как настроить</button><button type="button" data-reset>Сбросить</button>';
  const hint=document.createElement('section');hint.className='le-hint';hint.setAttribute('aria-label','Подсказка по настройке');hint.setAttribute('aria-live','polite');
  document.body.prepend(toolbar,hint);
  const frame=document.createElement('div');frame.className='le-selection';
  frame.innerHTML='<span class="le-label">НИК И «НА СВЯЗИ»</span><button class="le-move" type="button" aria-label="Переместить ник и На связи. Используйте мышь или стрелки клавиатуры"></button><button class="le-resize" type="button" aria-label="Изменить размер ника. Используйте мышь или стрелки клавиатуры">⤢</button>';
  hero.append(frame);
  const move=frame.querySelector('.le-move'),resize=frame.querySelector('.le-resize');
  const lift=document.createElement('button');lift.type='button';lift.className='le-lift';lift.setAttribute('aria-label','Поднять или опустить блок ссылок. Используйте мышь или стрелки вверх и вниз');lift.innerHTML='<span>⠿</span> Блок ссылок <b>↕</b>';panel.append(lift);
  function sync(){
   const a=identity.getBoundingClientRect(),b=hero.getBoundingClientRect();
   Object.assign(frame.style,{left:(a.left-b.left)+'px',top:(a.top-b.top)+'px',width:a.width+'px',height:a.height+'px'});
  }
  const mounted=EfirLandingLayout.mount(document,{onUpdate:sync});
  function commit(){mounted.setLayout(layout);parent.postMessage({type:'efir-landing-layout',layout,revision:data.revision},'*');}
  function showHint(){
   hint.hidden=step<0;frame.classList.toggle('le-glow',step===0||step===1);resize.classList.toggle('le-glow',step===1);lift.classList.toggle('le-glow',step===2);
   if(step<0){hint.replaceChildren();return;}
   const [title,description,symbol]=steps[step];
   hint.innerHTML='<div class="le-gesture" data-step="'+step+'" aria-hidden="true">'+symbol+'</div><div class="le-hint-copy"><small>'+(step===3?'ГОТОВО':'ПОПРОБУЙТЕ · '+(step+1)+' ИЗ 3')+'</small><h2>'+title+'</h2><p>'+description+'</p><div class="le-steps">'+steps.slice(0,3).map((_,i)=>'<button type="button" data-step="'+i+'" aria-label="Шаг '+(i+1)+'" aria-current="'+(i===step?'step':'false')+'">'+(i<step?'✓':i+1)+'</button>').join('')+'<button type="button" data-next>'+(step===3?'Понятно':'Далее →')+'</button></div></div><button class="le-close" type="button" aria-label="Закрыть подсказку">×</button>';
   hint.querySelector('.le-close').onclick=()=>{step=-1;showHint();};
   hint.querySelector('[data-next]').onclick=()=>{step=step===3?-1:step+1;showHint();};
   hint.querySelectorAll('button[data-step]').forEach(b=>b.onclick=()=>{step=Number(b.dataset.step);showHint();});
  }
  function complete(kind){if(step===({move:0,resize:1,panel:2}[kind])){step++;showHint();}}
  toolbar.querySelector('[data-help]').onclick=()=>{step=0;showHint();};
  toolbar.querySelector('[data-reset]').onclick=()=>{if(locked)return;layout={};commit();};
  function snapshot(){
   const a=identity.getBoundingClientRect(),b=hero.getBoundingClientRect(),w=hero.clientWidth;
   return {x:(a.left-b.left)/w,y:(a.top-b.top)/w,scale:a.width/identity.offsetWidth};
  }
  function change(kind,start,dx,dy){
   const w=hero.clientWidth;
   if(kind==='panel')layout.panelOffset=Math.max(-.55,Math.min(.4,start.panelOffset+dy/w));
   else{
    const n={...start.identity};
    if(kind==='move'){n.x+=dx/w;n.y+=dy/w;}
    else n.scale+=(dx*identity.offsetWidth+dy*identity.offsetHeight)/(identity.offsetWidth**2+identity.offsetHeight**2);
    const normal=EfirLandingLayout.normalize({identity:n}).identity;
    const g=EfirLandingLayout.identityGeometry(normal,w,{w:identity.offsetWidth,h:identity.offsetHeight});
    layout.identity={x:g.x/w,y:g.y/w,scale:g.scale};
   }
   commit();
  }
  function end(event,cancel=false){
   if(!drag||event&&event.pointerId!==drag.id)return;
   const current=drag;drag=null;document.body.classList.remove('le-dragging');
   if(current.button.hasPointerCapture(current.id))current.button.releasePointerCapture(current.id);
   if(cancel){layout=current.before;commit();}else if(current.moved)complete(current.kind);
  }
  cancelDrag=()=>end(null);
  function bind(button,kind){
   button.onpointerdown=event=>{
    if(locked||event.button!==0||drag)return;event.preventDefault();button.focus({preventScroll:true});
    drag={id:event.pointerId,button,kind,x:event.clientX,y:event.clientY,scroll:scrollY,before:structuredClone(layout),identity:snapshot(),panelOffset:layout.panelOffset||0,moved:false};
    button.setPointerCapture(event.pointerId);document.body.classList.add('le-dragging');
   };
   button.onpointermove=event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y+scrollY-drag.scroll;
    if(!drag.moved&&Math.hypot(dx,dy)<2)return;drag.moved=true;change(kind,drag,dx,dy);
   };
   button.onpointerup=event=>end(event);button.onpointercancel=event=>end(event,true);button.onlostpointercapture=event=>end(event,true);
   button.onkeydown=event=>{
    if(locked)return;
    if(event.key==='Escape'&&drag){event.preventDefault();end(null,true);return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const amount=event.shiftKey?10:2;
    const direction=['ArrowLeft','ArrowUp'].includes(event.key)?-amount:amount;
    const dx=kind==='resize'?direction:['ArrowLeft','ArrowRight'].includes(event.key)?direction:0;
    const dy=kind==='resize'?0:['ArrowUp','ArrowDown'].includes(event.key)?direction:0;
    if(kind==='panel'&&!dy)return;
    change(kind,{identity:snapshot(),panelOffset:layout.panelOffset||0},dx,dy);complete(kind);
   };
  }
  bind(move,'move');bind(resize,'resize');bind(lift,'panel');showHint();
  dispose=()=>{drag=null;cancelDrag=()=>{};mounted();};
 });
 document.addEventListener('click',event=>{if(event.target.closest('a,[data-copy-value]'))event.preventDefault();});
})();
