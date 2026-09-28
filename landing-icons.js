(() => {
 'use strict';
 function update(img,loaded){if(img.matches?.('img[data-site-icon]'))img.parentElement.classList.toggle('lp-site-icon-loaded',loaded);}
 document.addEventListener('load',event=>update(event.target,true),true);
 document.addEventListener('error',event=>update(event.target,false),true);
 document.querySelectorAll('img[data-site-icon]').forEach(img=>{if(img.complete)update(img,img.naturalWidth>0);});
})();
