(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EfirLandingLayout=factory();})(typeof window==='undefined'?this:window,function(){
 'use strict';
 // The mask is in hero coordinates. Every occupied pixel, including hair and clothes,
 // excludes a padded text rectangle; never infer a face from a photograph.
 function place(mask,width,height,boxes){
  const clear=r=>{
   for(let y=Math.max(0,Math.floor(r.y-3));y<Math.min(height,Math.ceil(r.y+r.h+3));y++)
    for(let x=Math.max(0,Math.floor(r.x-3));x<Math.min(width,Math.ceil(r.x+r.w+3));x++)if(mask[y*width+x])return false;
   return true;
  };
  const candidates=boxes.map((b,i)=>{
   const result=[];
   for(let y=8;y+b.h<height*.64;y+=3)for(const x of [width*.04,width*.96-b.w]){
    const r={x,y,w:b.w,h:b.h};if(x>=0&&x+b.w<=width&&clear(r))result.push({...r,score:Math.abs(y-height*.22)+(i===0?x:width-x-b.w)*.15});
   }
   return result.sort((a,b)=>a.score-b.score);
  });
  let best=null,score=Infinity;
  for(const a of candidates[0])for(const b of candidates[1]){
   if(!(a.x+a.w+4<b.x||b.x+b.w+4<a.x||a.y+a.h+4<b.y||b.y+b.h+4<a.y))continue;
   if(a.score+b.score<score){best=[a,b];score=a.score+b.score;}
  }
  return best;
 }
 function mount(scope=document){
  const hero=scope.querySelector('.lp-hero'),img=hero?.querySelector('.lp-photo img');if(!hero||!img)return ()=>{};
  const nodes=[hero.querySelector('.lp-identity'),hero.querySelector('.lp-brand')];
  let disposed=false,queued=false,lastWidth=0;
  function update(){
   queued=false;if(disposed||!hero.isConnected)return;
   hero.classList.add('lp-safe-header');hero.style.removeProperty('--header-height');nodes.forEach(n=>{n.style.left='';n.style.top='';});
   const width=hero.clientWidth;lastWidth=width;
   const headerHeight=Math.ceil(Math.max(...nodes.map(n=>n.getBoundingClientRect().height))+32);
   hero.style.setProperty('--header-height',headerHeight+'px');
   if(!width||!img.complete||!img.naturalWidth)return;
   try{
    const w=180,h=Math.round(w*.86),scale=w/width;
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const ratio=Math.min(w/img.naturalWidth,h*1.75/img.naturalHeight);
    const iw=img.naturalWidth*ratio,ih=img.naturalHeight*ratio;
    ctx.drawImage(img,(w-iw)/2,0,iw,ih);
    const pixels=ctx.getImageData(0,0,w,h).data,mask=new Uint8Array(w*h);
    for(let i=0;i<mask.length;i++)mask[i]=pixels[i*4+3]>8?1:0;
    const boxes=nodes.map(n=>({w:n.getBoundingClientRect().width*scale,h:n.getBoundingClientRect().height*scale}));
    const positions=place(mask,w,h,boxes);if(!positions)return;
    hero.classList.remove('lp-safe-header');hero.style.removeProperty('--header-height');
    nodes.forEach((n,i)=>{n.style.left=(positions[i].x/scale)+'px';n.style.top=(positions[i].y/scale)+'px';});
   }catch{/* Cross-origin/unreadable images keep the safe header above the portrait. */}
  }
  function schedule(){if(!queued&&!disposed){queued=true;requestAnimationFrame(update);}}
  const observer=new ResizeObserver(()=>{if(hero.clientWidth!==lastWidth)schedule();});observer.observe(hero);
  img.addEventListener('load',schedule);img.addEventListener('error',schedule);document.fonts?.ready.then(schedule);schedule();
  return ()=>{disposed=true;observer.disconnect();img.removeEventListener('load',schedule);img.removeEventListener('error',schedule);};
 }
 return {place,mount};
});
