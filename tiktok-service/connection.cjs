// Exactly one upstream connection. A generation prevents old attempts from
// publishing events after the user disconnects or changes the streamer.
const { profileFromRoom } = require('./profile.cjs');
class ConnectionManager {
  constructor(hub, createConnection, events, fetchProfile) {
    this.hub = hub;
    this.createConnection = createConnection;
    this.events = events;
    this.fetchProfile = fetchProfile;
    this.generation = 0;
    this.queue = Promise.resolve();
    this.current = null;
    this.retry = null;
    this.attempt = 0;
  }
  command(username) {
    clearTimeout(this.retry);
    this.retry = null;
    const generation = ++this.generation;
    this.attempt = 0;
    // Publish cancellation immediately; await any in-flight connect before
    this.profileRequested = false;
    // starting another one so two handshakes never run concurrently.
    const previous=this.hub.state;
    this.hub.status({ status: username ? 'connecting' : 'offline', username, nickname: previous.username===username ? previous.nickname||username : username, avatar:previous.username===username ? previous.avatar||'' : '', userId: '', roomId: '', message: '', retryIn: 0 });
    this.queue = this.queue.catch(() => {}).then(async () => {
      if (this.current) { await this.current.disconnect().catch(() => {}); this.current = null; }
      if (generation === this.generation && username) await this.connect(username, generation);
    });
    return this.queue;
  }
  async connect(username, generation) {
    if (generation !== this.generation) return;
    const current = this.createConnection(username);
    this.current = current;
    const active = () => generation === this.generation && current === this.current;
    if (this.fetchProfile && !this.profileRequested) {
      this.profileRequested = true;
      Promise.resolve().then(() => this.fetchProfile(current, username)).then(profile => {
        if (generation === this.generation && profile) {
          const patch=Object.fromEntries(Object.entries(profile).filter(([key,value])=>value && !(key==='nickname'&&value===username&&this.hub.state.nickname!==username)));
          this.hub.status(patch);
        }
      }).catch(() => {});
    }
    let ended = false;
    for (const name of this.events) current.on(name, data => {
      if (active()) this.hub.event(name, data);
      if (name === 'streamEnd' && active()) { ended = true; retry('Эфир завершён. Ожидаем следующий эфир.'); }
    });
    const retry = message => {
      if (!active() || this.retry) return;
      // An offline channel can go live at any moment. Keep checking at a
      // predictable interval instead of backing off to two minutes: otherwise
      // applications stay attached to the old/offline room for too long.
      const seconds = 15;
      this.attempt++;
      this.hub.status({ status: 'offline', roomId: '', message, retryIn: seconds });
      this.retry = setTimeout(() => {
        this.retry = null;
        this.queue = this.queue.catch(() => {}).then(async () => {
          if (!active()) return;
          this.current = null;
          await current.disconnect().catch(() => {});
          this.hub.status({ status: 'connecting', retryIn: 0, message: '' });
          await this.connect(username, generation);
        });
      }, seconds * 1000);
    };
    current.on('error', error => {
      if (!active()) return;
      const detail = error?.exception?.message || error?.message || error?.info || 'Ошибка TikTok';
      this.hub.status({ message: String(detail).slice(0, 1200) });
    });
    current.on('disconnected', () => retry('Соединение потеряно. Повторное подключение выполняет лаунчер.'));
    try {
      // A websocket can still be opened for a stale TikTok room after the
      // streamer has ended the broadcast. Verify the public live status first
      // so that such a socket is never exposed to applications as "live".
      if (typeof current.fetchIsLive === 'function' && await current.fetchIsLive() !== true) {
        throw new Error('Стример сейчас не в эфире. Лаунчер проверит эфир снова автоматически.');
      }
      const state = await current.connect();
      if (!active()) { await current.disconnect().catch(() => {}); return; }
      if (!state?.isConnected) throw new Error('TikTok не подтвердил подключение к эфиру');
      clearTimeout(this.retry); this.retry = null; this.attempt = 0;
      this.hub.status({ status: 'live', username, roomId: String(state.roomId || current.roomId), message: '', retryIn: 0 });
      // Profile loading must not delay events or reconnect a healthy stream.
      const known = profileFromRoom(state.roomInfo || current.roomInfo, username);
      if (known.avatar || known.nickname !== username) this.hub.status(Object.fromEntries(Object.entries(known).filter(([,value])=>value)));
      if (this.fetchProfile && !known.avatar) {
        Promise.resolve().then(() => this.fetchProfile(current, username)).then(profile => {
          if (active() && !ended && this.hub.state.status === 'live') this.hub.status(Object.fromEntries(Object.entries(profile).filter(([key,value])=>value && !(key==='nickname'&&value===username&&this.hub.state.nickname!==username))));
        }).catch(() => {});
      }
    } catch (error) {
      retry(String(error?.message || error).slice(0, 1200));
    }
  }
}
module.exports = { ConnectionManager };
