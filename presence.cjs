// Token refresh never claims ownership again. Only an explicit password login can replace another device.
function createPresence({rpc,device,snapshot,onBlocked,now=Date.now}){
 let token=null,active=false,epoch=0,lastSuccess=0,pending=null,blocked=false;
 const block=async reason=>{active=false;if(blocked)return;blocked=true;await onBlocked(reason);};
 async function send(claim=false){
  const version=epoch,current=token;if(!current)return false;
  try{const result=await rpc(current,{p_device:await device(),p_claim:claim,p_payload:snapshot()});
   if(version!==epoch)return false;
   if(!result.active){await block('replaced');return false;}
   lastSuccess=now();active=true;blocked=false;return true;
  }catch(error){if(version===epoch&&lastSuccess&&now()-lastSuccess>=60000)await block('connection');throw error;}
 }
 async function setToken(next,{claim=false,initialize=false}={}){
  if(!next){epoch++;token=null;active=false;lastSuccess=0;return false;}
  token=next;
  if(!initialize&&!claim)return active;
  epoch++;blocked=false;lastSuccess=0;return send(claim);
 }
 async function check(){if(!token||blocked)return false;if(pending)return pending;pending=send().finally(()=>pending=null);return pending;}
 const timer=setInterval(()=>check().catch(()=>{}),10000);timer.unref?.();
 return {setToken,check,clear:async()=>{if(token&&active&&!blocked)await rpc(token,{p_device:await device(),p_claim:false,p_payload:{...snapshot(),apps:[],stream:{}}}).catch(()=>{});},ensure:async()=>{if(!active||blocked||!await check())throw Error('Сессия лаунчера завершена. Войдите снова.');},close:()=>clearInterval(timer),isActive:()=>active&&!blocked};
}
module.exports={createPresence};
