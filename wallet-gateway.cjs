const http=require('node:http'),crypto=require('node:crypto');
function startWalletGateway({url,key,getToken}) {
 const sessions=new Map();
 const subject=token=>{try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub||'';}catch{return '';}};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  try {
   const leaderboard=req.url==='/flappy-leaderboard';
   const widget=req.url==='/immwiget';
   if(req.method!=='POST'||(!leaderboard&&!widget&&req.url!=='/wallet')||!sessions.has(req.headers.authorization)||req.headers.origin)throw Error('Нет доступа');
   let body='';for await(const chunk of req){body+=chunk;if(body.length>(leaderboard?900000:200000))throw Error('Слишком большой запрос');}
   const args=JSON.parse(body),accessToken=getToken(),session=sessions.get(req.headers.authorization);if(!accessToken||subject(accessToken)!==session.owner)throw Error('Аккаунт изменился: перезапустите приложение через лаунчер');
   if(widget&&session.appId!=='immwiget')throw Error('Нет доступа');
   if(!(widget?['list','save','toggle','rotate','delete']:leaderboard?['list','report']:['list','credit','reserve','commit','cancel','profile']).includes(args.p_action))throw Error('Неизвестная операция');
   const response=await fetch(url+'/rest/v1/rpc/'+(widget?'immwiget_manage':leaderboard?'flappy_leaderboard':'timer_wallet'),{method:'POST',headers:{apikey:key,Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
   const data=await response.json();if(!response.ok)throw Error(data.code==='PGRST202'?'Балансы пока недоступны. Попробуйте позже.':data.message||'Ошибка баланса');
   res.end(JSON.stringify({data}));
  }catch(error){res.statusCode=400;res.end(JSON.stringify({error:error.message}));}
 });
 const ready=new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));server.unref();
 return {environment:async(appId='')=>{await ready;const token=crypto.randomBytes(32).toString('hex'),owner=subject(getToken()||'');sessions.set('Bearer '+token,{owner,appId});return {NNSI_WALLET_PORT:String(server.address().port),NNSI_WALLET_TOKEN:token,NNSI_WALLET_OWNER:crypto.createHash('sha256').update(owner||'local').digest('hex').slice(0,40)};},close:()=>server.close()};
}
module.exports={startWalletGateway};

