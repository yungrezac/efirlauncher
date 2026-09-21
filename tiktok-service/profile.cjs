function profileFromRoom(room, username) {
  const user = room?.data?.owner || room?.data?.user || room?.owner || room?.user;
  const url = value => typeof value === 'string' ? value : value?.url_list?.[0] || value?.urlList?.[0] || '';
  return {
    nickname: user?.nickname || username,
    avatar: url(user?.avatar_large || user?.avatarLarger || user?.avatar_medium || user?.avatarMedium || user?.avatar_thumb || user?.avatarThumb),
    userId: String(user?.id_str || user?.id || '')
  };
}
module.exports = { profileFromRoom };

async function resolveProfile(connection, username, routes) {
  let profile = {nickname:username,avatar:'',userId:''};
  for(const fetchRoom of [
    () => connection.fetchRoomInfo(),
    () => routes.fetchRoomInfoFromHtml({webClient:connection.webClient,uniqueId:username}),
    () => routes.fetchRoomInfoFromApiLive({webClient:connection.webClient,uniqueId:username})
  ]) {
    try {
      const room=await fetchRoom();
      const next=profileFromRoom(room,username);
      profile={...profile,...Object.fromEntries(Object.entries(next).filter(([,value])=>value))};
      const user=room?.data?.owner||room?.data?.user||room?.owner||room?.user||{};
      const candidates=[user.avatar_medium,user.avatarMedium,user.avatar_large,user.avatarLarger,user.avatar_thumb,user.avatarThumb]
        .flatMap(value=>typeof value==='string'?[value]:value?.url_list||value?.urlList||[]);
      // Use the supplied CDN alternatives. One unavailable host must not stall
      // every app, and every app receives the same already downloaded image.
      const hosts=new Map();
      for(const value of candidates.filter(value=>/^https:\/\//.test(value))) {
        const host=new URL(value).hostname;if(!hosts.has(host))hosts.set(host,value);
      }
      const urls=[...hosts.values()].slice(0,3);
      const abort=new AbortController();
      const timeout=setTimeout(()=>abort.abort(),8000);
      try {
        profile.avatar=await Promise.any(urls.map(async url=>{
          const response=await fetch(url,{signal:abort.signal});
          const type=(response.headers.get('content-type')||'').split(';')[0];
          if(!response.ok||!/^image\/(png|jpeg|webp|gif)$/.test(type))throw new Error('Invalid avatar');
          let size=0;const chunks=[];
          for await(const chunk of response.body){size+=chunk.length;if(size>512*1024)throw new Error('Avatar too large');chunks.push(chunk);}
          if(!size)throw new Error('Empty avatar');
          return 'data:'+type+';base64,'+Buffer.concat(chunks).toString('base64');
        }));
        return profile;
      } catch (_) {} finally {clearTimeout(timeout);abort.abort();}
    } catch (_) {}
  }
  return profile;
}
module.exports.resolveProfile=resolveProfile;
