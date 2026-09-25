const https=require('node:https'),fs=require('node:fs');
const {pipeline}=require('node:stream/promises');
function response(url,{timeout=12000,redirects=8,transport=https}={}){
 return new Promise((resolve,reject)=>{
  const req=transport.get(url,{headers:{'User-Agent':'EFIR-Launcher'}},res=>{
   if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();if(!redirects)return reject(Error('Слишком много перенаправлений'));return response(new URL(res.headers.location,url).href,{timeout,redirects:redirects-1,transport}).then(resolve,reject);}
   if(res.statusCode!==200){res.resume();return reject(Error('HTTP '+res.statusCode));}
   resolve(res);
  });
  // Covers DNS/connect/TLS as well as waiting for response headers.
  const deadline=setTimeout(()=>req.destroy(Error('Сервер загрузки не ответил вовремя')),timeout);
  req.once('response',()=>clearTimeout(deadline));req.once('error',e=>{clearTimeout(deadline);reject(e)});
  req.setTimeout(timeout,()=>req.destroy(Error('Соединение с сервером загрузки прервано по тайм-ауту')));
 });
}
async function json(url,options){const res=await response(url,options);let body='';for await(const part of res){body+=part;if(body.length>2000000){res.destroy();throw Error('Слишком большой ответ сервера')}}return JSON.parse(body)}
async function download(url,target,onProgress,options={}){
 for(let attempt=0;attempt<2;attempt++){
  try{const res=await response(url,{timeout:30000,...options});const total=Number(res.headers['content-length'])||0;let received=0,last=0;
   onProgress({received,total});res.on('data',part=>{received+=part.length;if(Date.now()-last>150){last=Date.now();onProgress({received,total})}});
   await pipeline(res,fs.createWriteStream(target));if(total&&received!==total)throw Error('Файл скачан не полностью');onProgress({received,total});return;
  }catch(error){await fs.promises.rm(target,{force:true}).catch(()=>{});if(attempt||/HTTP 4\d\d/.test(error.message))throw error;}
 }
}
module.exports={response,json,download};
