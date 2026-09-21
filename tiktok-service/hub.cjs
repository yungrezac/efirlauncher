const net = require('node:net');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const encode = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v) + '\n';

// Only local, authenticated subscribers. Clients cannot control the live connection.
class Hub extends EventEmitter {
  constructor(token) {
    super();
    this.token = token;
    this.clients = new Set();
    this.sequence = 0;
    this.state = { status: 'offline', username: '', roomId: '', message: '', subscribers: 0 };
    this.server = net.createServer(socket => {
      socket.setEncoding('utf8');
      let buffer = '';
      const timeout = setTimeout(() => socket.destroy(), 3000);
      socket.on('error', () => {});
      socket.on('close', () => {
        clearTimeout(timeout);
        if (this.clients.delete(socket)) this.status({ subscribers: this.clients.size });
      });
      socket.on('data', chunk => {
        if (this.clients.has(socket)) return socket.destroy();
        buffer += chunk;
        if (buffer.length > 4096) return socket.destroy();
        if (!buffer.includes('\n')) return;
        try {
          const hello = JSON.parse(buffer.trim());
          const received = Buffer.from(String(hello.token || ''));
          const expected = Buffer.from(this.token);
          if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return socket.destroy();
          clearTimeout(timeout);
          this.clients.add(socket);
          this.status({ subscribers: this.clients.size });
        } catch { socket.destroy(); }
      });
    });
  }
  listen() {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', () => resolve(this.server.address().port));
    });
  }
  broadcast(message) {
    const line = encode(message);
    for (const client of this.clients) {
      // Never silently discard gifts for a slow subscriber: reconnect visibly.
      if (client.writableLength > 4 * 1024 * 1024) client.destroy();
      else client.write(line);
    }
  }
  status(patch) {
    this.state = { ...this.state, ...patch };
    this.broadcast({ type: 'status', state: this.state });
    this.emit('status', this.state);
  }
  event(name, data) {
    this.broadcast({ type: 'event', name, data, sequence: ++this.sequence });
  }
  async close() {
    for (const client of this.clients) client.destroy();
    await new Promise(resolve => this.server.close(resolve));
  }
}
module.exports = { Hub, encode };
