const crypto=require('node:crypto');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function uploadRaster({args,owner,url,key,accessToken}){
 if(!uuid.test(args?.id)||!uuid.test(owner)||typeof args.revision!=='string'||!Number.isFinite(Date.parse(args.revision)))throw Error('Invalid raster revision');
 if(typeof args.webp!=='string'||args.webp.length>5600000||!/^[A-Za-z0-9+/]+={0,2}$/.test(args.webp))throw Error('Invalid WebP');
 const bytes=Buffer.from(args.webp,'base64');
 if(bytes.length<20||bytes.length>4194304||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||bytes.readUInt32LE(4)!==bytes.length-8)throw Error('Invalid WebP');
 const bounds=args.bounds;if(!bounds||!Number.isFinite(bounds.x)||!Number.isFinite(bounds.width)||bounds.x<0||bounds.width<1||bounds.x+bounds.width>800)throw Error('Invalid raster bounds');
 const headers={apikey:key,Authorization:'Bearer '+accessToken};
 // Each save gets a new immutable version, including when reverting to older artwork.
 const name=owner+'/'+args.id+'/'+crypto.randomBytes(32).toString('hex')+'.webp';
 const uploaded=await fetch(url+'/storage/v1/object/immwiget-renders/'+name,{method:'POST',headers:{...headers,'Content-Type':'image/webp','cache-control':'max-age=31536000','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(30000)});
 if(!uploaded.ok){const error=await uploaded.json().catch(()=>({}));if(!(uploaded.status===409||String(error.statusCode)==='409'||error.error==='Duplicate'))throw Error(error.message||'WebP upload failed');}
 const response=await fetch(url+'/rest/v1/rpc/immwiget_raster_register',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_id:args.id,p_revision:args.revision,p_path:name,p_bounds:bounds}),signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(!response.ok)throw Error(result.message||'WebP registration failed');
 const candidates=Array.isArray(result.raster_cleanup)?result.raster_cleanup:[];
 const prefixes=[...new Set(candidates.filter(p=>typeof p==='string'&&p!==name&&p.startsWith(owner+'/')&&/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f]{64}\.webp$/.test(p)))].slice(0,100);
 delete result.raster_cleanup;
 if(prefixes.length){
  try{
   const removed=await fetch(url+'/storage/v1/object/immwiget-renders',{method:'DELETE',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({prefixes}),signal:AbortSignal.timeout(10000)});
   const data=await removed.json();const names=new Set(Array.isArray(data)?data.map(item=>item.name):[]);
   result.raster_cleanup_pending=!removed.ok||prefixes.some(p=>!names.has(p));
  }catch{result.raster_cleanup_pending=true;}
 }
 return result;
}
module.exports={uploadRaster};
