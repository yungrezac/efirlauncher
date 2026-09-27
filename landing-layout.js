(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EfirLandingLayout=factory();})(typeof window==='undefined'?this:window,function(){
 'use strict';
 // Alpha excludes the whole padded label rectangle, including hair and clothing.
 function headLevel(mask,width,height){
  let top=-1,bottom=0;
  for(let y=0;y<height;y++){
   let occupied=0;for(let x=0;x<width;x++)occupied+=mask[y*width+x]?1:0;
   if(occupied>=3){if(top<0)top=y;bottom=y;}
  }
  return top<0?width*.22:top+Math.min((bottom-top)*.2,width*.25);
 }
 function place(mask,width,height,boxes){
  const target=headLevel(mask,width,height),margin=width*.04;
  const clear=r=>{
   if(r.x<0||r.y<0||r.x+r.w>width||r.y+r.h>height)return false;
   for(let y=Math.max(0,Math.floor(r.y-3));y<Math.min(height,Math.ceil(r.y+r.h+3));y++)
    for(let x=Math.max(0,Math.floor(r.x-3));x<Math.min(width,Math.ceil(r.x+r.w+3));x++)if(mask[y*width+x])return false;
   return true;
  };
  // Opposite sides, with both label centres anchored to the upper silhouette.
  for(const offset of [0,-3,3,-6,6]){
   const positions=boxes.map((b,i)=>({x:i===0?margin:width-margin-b.w,y:target+offset-b.h/2,w:b.w,h:b.h}));
   if(positions[0].x+positions[0].w+4<positions[1].x&&positions.every(clear))return positions;
  }
  return null;
 }
 function mount(scope=document){
  const hero=scope.querySelector('.lp-hero'),img=hero?.querySelector('.lp-photo img');if(!hero||!img)return ()=>{};
  const nodes=[hero.querySelector('.lp-identity'),hero.querySelector('.lp-brand')];
  let disposed=false,queued=false,lastWidth=0;
  function update(){
   queued=false;if(disposed||!hero.isConnected)return;
   const width=hero.clientWidth;lastWidth=width;
   nodes.forEach(n=>{n.style.transform='';n.style.left='';n.style.top='';});img.style.transform='';
   if(!width||!img.complete||!img.naturalWidth)return;
   const w=180,h=Math.round(w*.86*1.75),scale=w/width;
   const boxes=nodes.map(n=>({w:n.getBoundingClientRect().width*scale,h:n.getBoundingClientRect().height*scale}));
   const ratio=Math.min(w/img.naturalWidth,w*.86*1.75/img.naturalHeight);
   const iw=img.naturalWidth*ratio,ih=img.naturalHeight*ratio;
   function apply(positions,portraitScale,shift,textScale){
    img.style.transform='translateX('+(shift/scale)+'px) scale('+portraitScale+')';
    nodes.forEach((n,i)=>{n.style.left=(positions[i].x/scale)+'px';n.style.top=(positions[i].y/scale)+'px';n.style.transform='scale('+textScale+')';});
   }
   try{
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    for(const portraitScale of [1,.94,.88,.82,.76,.7,.64,.58,.52,.46,.4]){
     for(const shift of [0,-w*.04,w*.04,-w*.08,w*.08,-w*.12,w*.12]){
      ctx.clearRect(0,0,w,h);ctx.drawImage(img,(w-iw*portraitScale)/2+shift,0,iw*portraitScale,ih*portraitScale);
      const pixels=ctx.getImageData(0,0,w,h).data,mask=new Uint8Array(w*h);
      for(let i=0;i<mask.length;i++)mask[i]=pixels[i*4+3]>8?1:0;
      for(const textScale of [1,.9,.8]){
       const positions=place(mask,w,h,boxes.map(b=>({w:b.w*textScale,h:b.h*textScale})));
       if(positions){apply(positions,portraitScale,shift,textScale);return;}
      }
     }
    }
   }catch{/* Unreadable alpha uses a narrow portrait with reserved side columns. */}
   const portraitScale=.4,textScale=.8,target=Math.max(ih*portraitScale*.2,...boxes.map(b=>b.h*textScale/2+6));
   apply(boxes.map((b,i)=>({x:i===0?w*.04:w*.96-b.w*textScale,y:target-b.h*textScale/2})),portraitScale,0,textScale);
  }
  function schedule(){if(!queued&&!disposed){queued=true;requestAnimationFrame(update);}}
  const observer=new ResizeObserver(()=>{if(hero.clientWidth!==lastWidth)schedule();});observer.observe(hero);
  img.addEventListener('load',schedule);img.addEventListener('error',schedule);document.fonts?.ready.then(schedule);schedule();
  return ()=>{disposed=true;observer.disconnect();img.removeEventListener('load',schedule);img.removeEventListener('error',schedule);};
 }
 return {place,headLevel,mount};
});
