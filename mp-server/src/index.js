// Hyper Shards — multiplayer server.
//
// One Cloudflare Worker fronting a `GameRoom` Durable Object. Each room
// (4-letter code) is a single DO instance: same DO handles every player
// WebSocket for that room, so the server has authoritative state with
// no cross-DO coordination required.
//
// Protocol (JSON over WS, both directions):
//   c->s  {t:'hello', name, skin}
//   c->s  {t:'input', ax, ay, fire, boost, aim}
//   c->s  {t:'start'}
//   c->s  {t:'chat', msg}
//   c->s  {t:'leave'}
//   s->c  {t:'welcome', you, room, mode, target}
//   s->c  {t:'lobby', players, host}
//   s->c  {t:'state', tick, players, bullets, scores, target, arenaW, arenaH}
//   s->c  {t:'event', kind, ...}   // 'start', 'hit', 'kill', 'end'
//   s->c  {t:'chat', from, name, msg, at}
//   s->c  {t:'error', msg}

const TICK_HZ = 20;
const TICK_MS = 1000 / TICK_HZ;
const ROOM_CODE_LEN = 4;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 8;
const KILLS_TO_WIN = 10;
const ARENA_W = 1400;
const ARENA_H = 800;

function corsHeaders(env) {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }
    if (url.pathname === '/') {
      return new Response('hyper-shards-mp ok', {
        headers: { 'content-type': 'text/plain', ...corsHeaders(env) },
      });
    }
    if (url.pathname === '/rooms' && req.method === 'POST') {
      const code = randCode();
      return new Response(JSON.stringify({ code }), {
        headers: { 'content-type': 'application/json', ...corsHeaders(env) },
      });
    }
    const m = url.pathname.match(/^\/rooms\/([A-Z2-9]{2,8})$/i);
    if (m) {
      const code = m[1].toUpperCase();
      const id = env.ROOM.idFromName(code);
      const stub = env.ROOM.get(id);
      return stub.fetch(req);
    }
    return new Response('not found', { status: 404, headers: corsHeaders(env) });
  },
};

function randCode() {
  let s = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    s += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return s;
}

// =====================================================================
// GameRoom — one Durable Object per room code. Holds the WebSockets, the
// authoritative entity state, and runs a 20Hz tick via setTimeout chains
// (DOs don't have setInterval, so we self-reschedule).
// =====================================================================
export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.code = null;
    this.sockets = new Map();
    this.players = new Map();
    this.bullets = [];
    this.scores = {};
    this.tick = 0;
    this.running = false;
    this.host = null;
    this.target = KILLS_TO_WIN;
    this.timer = null;
    this.lastTickAt = 0;
  }

  async fetch(req) {
    const url = new URL(req.url);
    const code = url.pathname.split('/').pop().toUpperCase();
    this.code = code;
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    const server = pair[1];
    const client = pair[0];
    server.accept();
    const id = crypto.randomUUID().slice(0, 8);
    this.onOpen(id, server);
    server.addEventListener('message', (ev) => this.onMessage(id, ev.data));
    server.addEventListener('close', () => this.onClose(id));
    server.addEventListener('error', () => this.onClose(id));
    return new Response(null, { status: 101, webSocket: client });
  }

  onOpen(id, ws) {
    if (this.sockets.size >= MAX_PLAYERS) {
      ws.send(JSON.stringify({ t: 'error', msg: 'room full' }));
      ws.close(1000, 'full');
      return;
    }
    this.sockets.set(id, ws);
    if (!this.host) this.host = id;
    this.scores[id] = 0;
    ws.send(JSON.stringify({
      t: 'welcome',
      you: id,
      room: this.code,
      mode: 'pvp',
      target: this.target,
    }));
    this.broadcastLobby();
  }

  onMessage(id, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'hello') {
      const name = String(msg.name || 'PILOT').slice(0, 14);
      const skin = String(msg.skin || 'default').slice(0, 16);
      this.players.set(id, this.makePlayer(id, name, skin));
      this.broadcastLobby();
      return;
    }
    if (msg.t === 'input') {
      const p = this.players.get(id);
      if (!p || !this.running) return;
      p.in.ax = clamp(+msg.ax || 0, -1, 1);
      p.in.ay = clamp(+msg.ay || 0, -1, 1);
      p.in.fire = !!msg.fire;
      p.in.boost = !!msg.boost;
      if (Number.isFinite(+msg.aim)) p.facing = +msg.aim;
      return;
    }
    if (msg.t === 'start' && id === this.host && !this.running) {
      this.startGame();
      return;
    }
    if (msg.t === 'chat') {
      const p = this.players.get(id);
      if (!p) return;
      const now = Date.now();
      p.chatLog = (p.chatLog || []).filter((t) => now - t < 10000);
      if (p.chatLog.length >= 6) return; // 6 msgs / 10s spam cap
      p.chatLog.push(now);
      // Strip ASCII control chars + DEL; everything printable allowed.
      const ctrlRe = new RegExp('[\\x00-\\x1f\\x7f]', 'g');
      const text = String(msg.msg || '').slice(0, 80).replace(ctrlRe, '');
      if (!text) return;
      this.broadcast({ t: 'chat', from: id, name: p.name, msg: text, at: now });
      return;
    }
    if (msg.t === 'leave') {
      const sock = this.sockets.get(id);
      if (sock) sock.close(1000, 'left');
      this.onClose(id);
    }
  }

  onClose(id) {
    this.sockets.delete(id);
    this.players.delete(id);
    delete this.scores[id];
    if (this.host === id) this.host = this.sockets.keys().next().value || null;
    this.broadcastLobby();
    if (this.sockets.size === 0) {
      this.stopGame();
    }
  }

  makePlayer(id, name, skin) {
    const ang = Math.random() * Math.PI * 2;
    const r = 220;
    return {
      id, name, skin,
      x: ARENA_W / 2 + Math.cos(ang) * r,
      y: ARENA_H / 2 + Math.sin(ang) * r,
      vx: 0, vy: 0,
      hp: 5, maxHp: 5,
      facing: 0,
      cd: 0,
      respawn: 0,
      alive: true,
      in: { ax: 0, ay: 0, fire: false, boost: false },
      chatLog: [],
    };
  }

  startGame() {
    if (this.players.size < 2) {
      this.broadcast({ t: 'error', msg: 'need 2+ players' });
      return;
    }
    this.running = true;
    this.tick = 0;
    this.bullets = [];
    for (const id of this.players.keys()) this.scores[id] = 0;
    for (const p of this.players.values()) {
      p.hp = p.maxHp; p.alive = true; p.respawn = 0;
    }
    this.broadcast({ t: 'event', kind: 'start' });
    this.lastTickAt = Date.now();
    this.scheduleTick();
  }

  stopGame() {
    this.running = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  scheduleTick() {
    if (!this.running) return;
    this.timer = setTimeout(() => this.doTick(), TICK_MS);
  }

  doTick() {
    if (!this.running) return;
    const now = Date.now();
    const dt = Math.min(80, now - this.lastTickAt);
    this.lastTickAt = now;
    this.tick++;
    this.simulate(dt);
    this.broadcastState();
    this.scheduleTick();
  }

  simulate(dt) {
    const SPD = 0.32;
    const FIRE_CD = 240;
    const BULLET_SPD = 0.6;
    const BULLET_TTL = 1400;
    for (const p of this.players.values()) {
      if (!p.alive) {
        p.respawn -= dt;
        if (p.respawn <= 0) this.respawn(p);
        continue;
      }
      const boost = p.in.boost ? 1.7 : 1;
      p.vx += p.in.ax * SPD * dt * 0.04 * boost;
      p.vy += p.in.ay * SPD * dt * 0.04 * boost;
      const damp = Math.pow(0.86, dt / 16);
      p.vx *= damp; p.vy *= damp;
      p.x = clamp(p.x + p.vx, 20, ARENA_W - 20);
      p.y = clamp(p.y + p.vy, 20, ARENA_H - 20);
      p.cd = Math.max(0, p.cd - dt);
      if (p.in.fire && p.cd <= 0) {
        this.bullets.push({
          owner: p.id,
          x: p.x + Math.cos(p.facing) * 22,
          y: p.y + Math.sin(p.facing) * 22,
          vx: Math.cos(p.facing) * BULLET_SPD,
          vy: Math.sin(p.facing) * BULLET_SPD,
          ttl: BULLET_TTL,
          dmg: 1,
        });
        p.cd = FIRE_CD;
      }
    }
    const live = [];
    for (const b of this.bullets) {
      b.ttl -= dt;
      if (b.ttl <= 0) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) continue;
      let hit = false;
      for (const p of this.players.values()) {
        if (!p.alive || p.id === b.owner) continue;
        const dx = p.x - b.x, dy = p.y - b.y;
        if (dx * dx + dy * dy < 22 * 22) {
          p.hp -= b.dmg;
          this.broadcast({ t: 'event', kind: 'hit', target: p.id, by: b.owner });
          if (p.hp <= 0) {
            p.alive = false; p.respawn = 2500;
            this.scores[b.owner] = (this.scores[b.owner] || 0) + 1;
            this.broadcast({
              t: 'event', kind: 'kill',
              by: b.owner, target: p.id,
              scores: this.scores,
            });
            if (this.scores[b.owner] >= this.target) this.endGame(b.owner);
          }
          hit = true; break;
        }
      }
      if (!hit) live.push(b);
    }
    this.bullets = live;
  }

  respawn(p) {
    const ang = Math.random() * Math.PI * 2;
    const r = 220;
    p.x = ARENA_W / 2 + Math.cos(ang) * r;
    p.y = ARENA_H / 2 + Math.sin(ang) * r;
    p.vx = 0; p.vy = 0;
    p.hp = p.maxHp; p.alive = true;
  }

  endGame(winnerId) {
    const winner = this.players.get(winnerId);
    this.broadcast({
      t: 'event', kind: 'end',
      winner: winnerId,
      winnerName: winner ? winner.name : '?',
      scores: this.scores,
    });
    this.running = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  broadcastLobby() {
    const list = [];
    for (const [id, p] of this.players) {
      list.push({ id, name: p.name, skin: p.skin, host: id === this.host });
    }
    this.broadcast({ t: 'lobby', players: list, host: this.host });
  }

  broadcastState() {
    const players = [];
    for (const p of this.players.values()) {
      players.push({
        id: p.id, name: p.name, skin: p.skin,
        x: p.x | 0, y: p.y | 0,
        vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2),
        facing: +p.facing.toFixed(2),
        hp: p.hp, maxHp: p.maxHp,
        alive: p.alive,
        respawn: p.respawn > 0 ? Math.ceil(p.respawn / 1000) : 0,
      });
    }
    const bullets = this.bullets.map((b) => ({
      x: b.x | 0, y: b.y | 0, vx: +b.vx.toFixed(2), vy: +b.vy.toFixed(2),
      owner: b.owner,
    }));
    this.broadcast({
      t: 'state', tick: this.tick,
      players, bullets, scores: this.scores,
      arenaW: ARENA_W, arenaH: ARENA_H,
      target: this.target,
    });
  }

  broadcast(msg) {
    const s = JSON.stringify(msg);
    for (const ws of this.sockets.values()) {
      try { ws.send(s); } catch { /* socket closing */ }
    }
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
