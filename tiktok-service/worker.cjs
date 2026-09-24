const { Hub } = require('./hub.cjs');
const { ConnectionManager } = require('./connection.cjs');
const { resolveProfile } = require('./profile.cjs');
(async () => {
  // Do not inherit a paid key, session, or alternate signer from the environment.
  delete process.env.SIGN_API_KEY;
  delete process.env.SIGN_API_URL;
  const { TikTokLiveConnection, WebcastEvent, RoomIdRouteConfig, IsLiveRouteConfig, SignConfig, RouteConfig } = await import('tiktok-live-connector');
  SignConfig.apiKey = undefined;
  SignConfig.basePath = 'https://api.eulerstream.com';
  SignConfig.baseOptions.timeout = 20000;
  RoomIdRouteConfig.skipFetchRoomIdFromEulerRoute = true;
  IsLiveRouteConfig.skipFetchRoomIdFromEulerRoute = true;
  const hub = new Hub(process.env.NNSI_TIKTOK_TOKEN);
  let metrics=new (require('./metrics.cjs').StreamMetrics)();
  hub.on('status',state=>metrics.status(state));
  hub.on('event',(name,data)=>metrics.event(name,data));
  setInterval(()=>{if(process.connected)process.send({type:'metrics',streams:metrics.snapshot()});},5000).unref();
  hub.on('status', state => { if (process.connected) process.send({ type: 'status', state }); });
  const manager = new ConnectionManager(hub, username => new TikTokLiveConnection(username, {
    fetchRoomInfoOnConnect: false, enableExtendedGiftInfo: false, processInitialData: false,
    webClientOptions: { timeout: { request: 20000 }, retry: { limit: 0 } }
  }), [...new Set([...Object.values(WebcastEvent), 'streamEnd'])], (connection, username) => resolveProfile(connection, username, RouteConfig));
  process.on('message', message => {
    if(message.type==='reset-metrics'){metrics=new (require('./metrics.cjs').StreamMetrics)();metrics.status(hub.state);}
    if (message.type === 'connect') manager.command(message.username).catch(error => hub.status({ status: 'offline', message: error.message }));
  });
  process.on('disconnect', () => process.exit(0));
  const port = await hub.listen();
  process.send({ type: 'ready', port, state: hub.state, version: '2.4.4' });
})().catch(error => { console.error(error); process.exit(1); });
