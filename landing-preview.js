let disposeLandingLayout=()=>{};
window.addEventListener('message',event=>{
 if(event.source!==parent||event.data?.type!=='efir-landing-preview')return;
 disposeLandingLayout();
 document.body.innerHTML=EfirLanding.render(event.data.document,{logo:'assets/efir-logo.svg',photoOverride:event.data.photo||''});
 disposeLandingLayout=EfirLandingLayout.mount();
});
document.addEventListener('click',event=>{if(event.target.closest('a,[data-copy-value]'))event.preventDefault();});
