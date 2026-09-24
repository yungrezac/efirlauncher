const {randomUUID}=require('node:crypto');
class StreamMetrics {
 constructor(now=()=>performance.now()){this.now=now;this.rows=[];this.current=null;this.live=false;this.last=now();this.viewers=null;this.seen=new Map();this.combos=new Map();}
 tick(){const now=this.now(),dt=this.live?Math.min(30,Math.max(0,(now-this.last)/1000)):0;this.last=now;if(this.current){this.current.seconds+=dt;if(this.viewers!==null){this.current.sampledSeconds+=dt;this.current.viewerSeconds+=dt*this.viewers;}}}
 status(s){this.tick();const live=s.status==='live'&&s.roomId;if(live&&(!this.current||this.current.roomId!==s.roomId||this.current.username!==s.username)){
  this.current={id:randomUUID(),username:s.username,roomId:s.roomId,nickname:s.nickname||s.username,avatar:s.avatar||'',seconds:0,viewerSeconds:0,sampledSeconds:0,peakViewers:0,diamonds:0,gifts:0,likes:0,follows:0};this.rows.push(this.current);this.rows=this.rows.slice(-20);this.seen.clear();this.combos.clear();this.viewers=null;
 }if(this.current&&this.current.username===s.username){this.current.nickname=s.nickname||this.current.nickname;this.current.avatar=s.avatar||this.current.avatar;}this.live=!!live;}
 event(name,d={}){this.tick();const row=this.current;if(!row||!this.live)return;
  const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Math.max(0,Number(v)):fallback;
  const gift=d.giftDetails||d.gift||{};
  const end=d.repeatEnd===undefined?true:![false,0,'0','false'].includes(d.repeatEnd);
  if(name==='roomUser'){const count=Number(d.viewerCount);if(Number.isFinite(count)&&count>=0){this.viewers=count;row.peakViewers=Math.max(row.peakViewers,count);}return;}
  const id=String(d.msgId||d.common?.msgId||'');const key=name+':'+id+(name==='gift'?':'+d.repeatCount+':'+!!d.repeatEnd:'');
  if(id){if(this.seen.has(key))return;this.seen.set(key,true);if(this.seen.size>10000)this.seen.delete(this.seen.keys().next().value);}
  if(name==='gift'){
   const count=Math.max(1,finite(d.repeatCount,1)),cost=finite(d.diamondCount??gift.diamondCount);let delta=count;
   if(Number(d.giftType??gift.giftType??gift.type??1)===1){const group=d.groupId||d.repeatId; if(group){const combo=[d.user?.id||d.userId||d.uniqueId,d.giftId??gift.id,group].join(':');delta=Math.max(0,count-(this.combos.get(combo)||0));this.combos.set(combo,count);if(this.combos.size>10000)this.combos.delete(this.combos.keys().next().value);}else if(!end)return;}
   row.gifts+=delta;row.diamonds+=delta*cost;
  }else if(name==='like')row.likes+=finite(d.likeCount??d.count);else if(name==='follow')row.follows++;
 }
 snapshot(){this.tick();return this.rows.map(x=>({...x}));}
}
module.exports={StreamMetrics};
