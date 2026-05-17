'use strict';
// ============================================================
// MULTIPLAYER (BETA) — cloud rooms, PvP deathmatch
// ============================================================
// Networking + new `mp` phase that runs alongside (not on top of) the
// existing single-player loop. The main loop in 07-loop.js dispatches
// to `mpUpdate()` / `mpRender()` when state.phase === 'mp'.
//
// Architecture:
//   • Server  -> mp-server/  (Cloudflare Worker + Durable Object)
//   • Client  -> this file
//   • UI      -> openMpLobby() opens a hub modal; see 13-hub.js
//
// Protocol mirrors mp-server/src/index.js — anything you change here you
// must mirror there (same JSON keys, same `t:` discriminator strings).
//
// Status: PvP deathmatch is end-to-end. Co-op mode intentionally TODO;
// it deserves a design call (shared XP? friendly fire? boss tier?).

// ====== CONFIGURATION ======================================
// Paste the deployed Worker URL here after `wrangler deploy` (see
// mp-server/README.md). Until then MP_WS_BASE is empty, the hub button
// shows "(server offline)", and no connection is ever attempted — so
// shipping this file does not break single-player.
const MP_WS_BASE = '';  // e.g. 'https://hyper-shards-mp.you.workers.dev'

// ====== STATE ==============================================
const MP = {
  ws: null,
  you: null,        // your player id (server assigns)
  room: null,       // room code we're in
  host: null,       // id of room host
  inLobby: false,   // before .start fires
  inGame: false,    // after .start fires
  name: '',
  skin: 'default',
  target: 10,       // kills to win
  // Latest authoritative snapshot from server. We interpolate visually
  // (lerp toward newest pos at ~20 Hz). Bullets are drawn straight from
  // the snapshot; no prediction.
  snap: { players: [], bullets: [], scores: {}, tick: 0, arenaW: 1400, arenaH: 800 },
  prevSnap: null,
  snapAt: 0,
  // What we send each tick — driven by local keyboard/touch in mpUpdate
  in: { ax: 0, ay: 0, fire: false, boost: false, aim: 0 },
  lastSentAt: 0,
  // Lobby player list (server-broadcast)
  lobby: [],
  // UI-side last error
  err: '',
};

function mpAvailable(){ return !!MP_WS_BASE; }

function mpWsUrl(code){
  const base = MP_WS_BASE.replace(/^http/, 'ws');
  return `${base}/rooms/${code}`;
}

async function mpCreateRoom(){
  if(!mpAvailable()) throw new Error('multiplayer server not configured');
  const r = await fetch(`${MP_WS_BASE}/rooms`, { method: 'POST' });
  if(!r.ok) throw new Error('create-room failed: ' + r.status);
  const { code } = await r.json();
  return code;
}

function mpConnect(code, name, skin){
  if(!mpAvailable()) { MP.err = 'server offline'; return; }
  mpDisconnect();
  MP.name = (name || 'PILOT').slice(0,14).toUpperCase();
  MP.skin = skin || 'default';
  MP.room = code.toUpperCase();
  MP.inLobby = true; MP.inGame = false; MP.err = '';
  const ws = new WebSocket(mpWsUrl(code));
  MP.ws = ws;
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ t:'hello', name: MP.name, skin: MP.skin }));
  });
  ws.addEventListener('message', (ev) => mpOnMessage(ev.data));
  ws.addEventListener('close', () => {
    MP.ws = null; MP.inLobby = false; MP.inGame = false;
    // If we were mid-game when the socket died, kick back to hub.
    if(state.phase === 'mp'){
      state.phase = 'menu';
      if(typeof hideHUD === 'function') hideHUD();
      if(typeof showMenu === 'function') showMenu('menuMain');
      if(typeof toast === 'function') toast('Disconnected from room');
    }
    if(typeof mpRefreshLobbyUI === 'function') mpRefreshLobbyUI();
  });
  ws.addEventListener('error', () => {
    MP.err = 'connection error';
    if(typeof mpRefreshLobbyUI === 'function') mpRefreshLobbyUI();
  });
}

function mpDisconnect(){
  if(MP.ws){
    try { MP.ws.send(JSON.stringify({ t:'leave' })); } catch {}
    try { MP.ws.close(); } catch {}
  }
  MP.ws = null; MP.you = null; MP.room = null; MP.inLobby = false; MP.inGame = false;
  MP.snap = { players: [], bullets: [], scores: {}, tick: 0, arenaW: 1400, arenaH: 800 };
  MP.prevSnap = null;
  MP.lobby = [];
}

function mpStartGame(){
  if(!MP.ws || MP.you !== MP.host) return;
  MP.ws.send(JSON.stringify({ t:'start' }));
}

function mpOnMessage(raw){
  let m;
  try { m = JSON.parse(raw); } catch { return; }
  if(m.t === 'welcome'){
    MP.you = m.you; MP.target = m.target || 10;
  } else if(m.t === 'lobby'){
    MP.lobby = m.players || [];
    MP.host = m.host;
    if(typeof mpRefreshLobbyUI === 'function') mpRefreshLobbyUI();
  } else if(m.t === 'state'){
    MP.prevSnap = MP.snap;
    MP.snap = {
      players: m.players, bullets: m.bullets, scores: m.scores,
      tick: m.tick, arenaW: m.arenaW, arenaH: m.arenaH,
    };
    MP.snapAt = performance.now();
  } else if(m.t === 'event'){
    if(m.kind === 'start'){
      MP.inLobby = false; MP.inGame = true;
      mpEnterPhase();
    } else if(m.kind === 'kill'){
      if(typeof toast === 'function'){
        const by = mpNameOf(m.by), tgt = mpNameOf(m.target);
        toast(`${by} eliminated ${tgt}`);
      }
      if(typeof sfx === 'function') sfx('hit');
    } else if(m.kind === 'end'){
      MP.inGame = false;
      if(typeof toast === 'function') toast(`★ ${m.winnerName} wins`);
      // Linger 2s on the final state, then back to lobby.
      setTimeout(() => {
        MP.inLobby = true;
        state.phase = 'menu';
        if(typeof hideHUD === 'function') hideHUD();
        if(typeof openMpLobby === 'function') openMpLobby();
      }, 2000);
    }
  } else if(m.t === 'error'){
    MP.err = String(m.msg || 'server error');
    if(typeof toast === 'function') toast('MP: ' + MP.err);
    if(typeof mpRefreshLobbyUI === 'function') mpRefreshLobbyUI();
  }
}

function mpNameOf(id){
  const p = MP.snap.players.find(x => x.id === id) || MP.lobby.find(x => x.id === id);
  return p ? p.name : '?';
}

function mpEnterPhase(){
  state.phase = 'mp';
  if(typeof hideOverlay === 'function') hideOverlay();
  if(typeof showHUD === 'function') showHUD(true);
  if(typeof toast === 'function') toast(`★ MATCH START — first to ${MP.target}`);
}

// ====== PER-FRAME UPDATE ===================================
// Called from 07-loop.js's main loop when state.phase === 'mp'.
// Reads local input → sends to server (rate-limited to ~30Hz so we
// don't flood the socket). Position interpolation happens at render
// time, not here.
const MP_INPUT_HZ = 30;
const MP_INPUT_MIN_MS = 1000 / MP_INPUT_HZ;
function mpUpdate(dt){
  if(!MP.ws || MP.ws.readyState !== 1) return;
  let ax = 0, ay = 0;
  if(keys['a'] || keys['arrowleft'])  ax -= 1;
  if(keys['d'] || keys['arrowright']) ax += 1;
  if(keys['w'] || keys['arrowup'])    ay -= 1;
  if(keys['s'] || keys['arrowdown'])  ay += 1;
  if(typeof joy !== 'undefined' && joy && joy.active){
    ax = joy.x; ay = joy.y;
  }
  const fire = !!keys[' '] || (typeof joy !== 'undefined' && joy && joy.fire) || mpTouchFire;
  const boost = !!keys['shift'];
  // Aim: face the cursor if we have one, else lock to facing-up.
  let aim = -Math.PI / 2;
  const me = MP.snap.players.find(p => p.id === MP.you);
  if(me && typeof _mouseX === 'number'){
    aim = Math.atan2(_mouseY - me.y, _mouseX - me.x);
  }
  MP.in = { ax, ay, fire, boost, aim };
  const now = performance.now();
  if(now - MP.lastSentAt >= MP_INPUT_MIN_MS){
    MP.lastSentAt = now;
    try {
      MP.ws.send(JSON.stringify({ t:'input', ax, ay, fire, boost, aim }));
    } catch { /* socket closing */ }
  }
}

// MP doesn't use the standard mouse path (which targets the 2D canvas's
// world coords). We add our own listeners to track raw screen pos and
// translate to arena coords during render.
let _mouseX = 0, _mouseY = 0;
let mpTouchFire = false;
addEventListener('mousemove', (e) => {
  if(state.phase !== 'mp') return;
  const r = canvas.getBoundingClientRect();
  // Translate from screen to arena coords using the same fit math as render.
  const a = mpArenaFit();
  _mouseX = (e.clientX - r.left - a.ox) / a.s;
  _mouseY = (e.clientY - r.top  - a.oy) / a.s;
});
addEventListener('mousedown', (e) => { if(state.phase === 'mp') mpTouchFire = true; });
addEventListener('mouseup',   ()  => { mpTouchFire = false; });
addEventListener('touchstart',(e) => { if(state.phase === 'mp') mpTouchFire = true; }, { passive: true });
addEventListener('touchend',  ()  => { mpTouchFire = false; }, { passive: true });

// ====== RENDER =============================================
// Compute "fit" — how the (arenaW × arenaH) authoritative arena maps
// into the actual canvas size. Letterboxes if aspect ratios differ.
function mpArenaFit(){
  const aw = MP.snap.arenaW || 1400, ah = MP.snap.arenaH || 800;
  const s = Math.min(W / aw, H / ah);
  return { s, ox: (W - aw * s) / 2, oy: (H - ah * s) / 2, aw, ah };
}

function mpRender(){
  const now = performance.now();
  ctx.fillStyle = '#02030a';
  ctx.fillRect(0, 0, W, H);
  // Stars (cheap parallax, reuse main starfield)
  if(state.stars){
    ctx.save();
    for(const s of state.stars){
      ctx.globalAlpha = s.z;
      ctx.fillStyle = s.c;
      ctx.fillRect(s.x | 0, s.y | 0, s.s, s.s);
    }
    ctx.restore();
  }
  const fit = mpArenaFit();
  ctx.save();
  ctx.translate(fit.ox, fit.oy);
  ctx.scale(fit.s, fit.s);
  // Arena border
  ctx.strokeStyle = '#3a8acc66';
  ctx.lineWidth = 2 / fit.s;
  ctx.strokeRect(0, 0, fit.aw, fit.ah);
  // Bullets
  for(const b of MP.snap.bullets){
    const skin = mpSkinFor(b.owner);
    ctx.fillStyle = skin.color;
    ctx.shadowColor = skin.glow; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  // Players — reuse drawShip from 11-render.js by adapting the snapshot
  // player into the player-shape it expects.
  for(const p of MP.snap.players){
    if(!p.alive){
      // Render a faint X with respawn timer where they died (best-known)
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#ff6666'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-14,-14); ctx.lineTo(14,14);
      ctx.moveTo(14,-14); ctx.lineTo(-14,14); ctx.stroke();
      ctx.globalAlpha = 1;
      if(p.respawn > 0){
        ctx.fillStyle = '#ffea00'; ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.respawn + '', 0, -22);
      }
      ctx.restore();
      continue;
    }
    const adapter = {
      x: p.x, y: p.y, vx: p.vx, vy: p.vy,
      facing: p.facing,
      thrust: Math.min(1, Math.hypot(p.vx, p.vy) * 1.2),
      skin: mpSkinFor(p.id),
      inv: 0,
      // drawShip reads p.skin.id for mastery checks; that's already in skin.
    };
    if(typeof drawShip === 'function'){
      drawShip(ctx, adapter, now);
    }
    // Nameplate + HP pips
    ctx.save();
    ctx.translate(p.x, p.y - 36);
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = p.id === MP.you ? '#00ffaa' : '#ffffff';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
    ctx.fillText(p.name, 0, 0);
    ctx.shadowBlur = 0;
    // hp pips
    const w = 4, gap = 2;
    const total = p.maxHp * (w + gap) - gap;
    let x = -total / 2;
    for(let i = 0; i < p.maxHp; i++){
      ctx.fillStyle = i < p.hp ? '#ff3366' : '#333';
      ctx.fillRect(x, 6, w, 4);
      x += w + gap;
    }
    ctx.restore();
  }
  ctx.restore();
  // Scoreboard (top-center, screen space)
  mpRenderScoreboard();
}

function mpSkinFor(id){
  const p = MP.snap.players.find(x => x.id === id) || MP.lobby.find(x => x.id === id);
  const skinId = p ? p.skin : 'default';
  if(typeof SKINS !== 'undefined'){
    return SKINS.find(s => s.id === skinId) || SKINS[0];
  }
  return { id: 'default', color: '#00eaff', accent: '#ffea00', glow: '#00f7ff' };
}

function mpRenderScoreboard(){
  if(!MP.snap.players.length) return;
  // Sort highest-first
  const entries = MP.snap.players.map(p => ({
    p, k: MP.snap.scores[p.id] || 0,
  })).sort((a, b) => b.k - a.k);
  const lineH = 18, pad = 10;
  const w = 260, h = pad * 2 + entries.length * lineH + 22;
  const x = W / 2 - w / 2, y = 12;
  ctx.save();
  ctx.fillStyle = '#0a1430cc';
  ctx.strokeStyle = '#244a78';
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#9ec5ff';
  ctx.textAlign = 'left';
  ctx.fillText(`ROOM ${MP.room}  ·  FIRST TO ${MP.target}`, x + pad, y + 14);
  let cy = y + 28;
  for(const { p, k } of entries){
    const me = p.id === MP.you;
    ctx.fillStyle = me ? '#00ffaa' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(p.name, x + pad, cy + 12);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffea00';
    ctx.fillText(k + '', x + w - pad, cy + 12);
    cy += lineH;
  }
  ctx.restore();
}

// ====== LOBBY UI ===========================================
// The lobby modal is rendered into #hubModalBox (reusing the existing
// account/settings modal mechanism in 13-hub.js). openMpLobby() is the
// entry point called by the hub button.
function openMpLobby(){
  if(typeof openHubModal !== 'function'){
    if(typeof toast === 'function') toast('Lobby UI not ready');
    return;
  }
  if(!mpAvailable()){
    openHubModal(`
      <h2><span class="ic">★</span>MULTIPLAYER (BETA)</h2>
      <div style="text-align:center;padding:20px 10px;">
        <p style="color:#ff6688;font-weight:900;letter-spacing:2px;">SERVER NOT CONFIGURED</p>
        <p style="color:#9ec5ff;font-size:13px;line-height:1.5;margin-top:14px;">
          Deploy the multiplayer Worker (see <b>mp-server/README.md</b>)
          and paste its URL into <b>MP_WS_BASE</b> in
          <b>js/16-multiplayer.js</b>.
        </p>
      </div>
    `);
    return;
  }
  if(MP.inLobby && MP.room){ mpRenderLobbyView(); return; }
  const defName = (save && save.username) || 'PILOT';
  openHubModal(`
    <h2><span class="ic">★</span>MULTIPLAYER (BETA)</h2>
    <div class="row"><span class="label">PILOT NAME</span>
      <input id="mpName" type="text" maxlength="14" value="${defName}"
             style="background:#02030a;color:#00ffaa;border:1px solid #1f4d7a;border-radius:6px;padding:8px 10px;font-family:inherit;letter-spacing:2px;width:160px;text-align:center;text-transform:uppercase;"/>
    </div>
    <div style="height:8px"></div>
    <button class="modalBtn primary" id="mpCreate">★ CREATE ROOM</button>
    <div class="row" style="margin-top:14px;"><span class="label">ROOM CODE</span>
      <input id="mpJoinCode" type="text" maxlength="4" placeholder="ABCD"
             style="background:#02030a;color:#ffea00;border:1px solid #1f4d7a;border-radius:6px;padding:8px 10px;font-family:inherit;letter-spacing:6px;width:120px;text-align:center;text-transform:uppercase;font-weight:900;"/>
    </div>
    <button class="modalBtn" id="mpJoin">⟶ JOIN ROOM</button>
    <p style="color:#7ea8d4;font-size:11px;line-height:1.5;margin-top:18px;text-align:center;">
      Cloud PvP deathmatch — first to <b>${MP.target}</b> kills wins.<br>
      Co-op mode coming soon.
    </p>
  `);
  document.getElementById('mpCreate').onclick = async () => {
    const name = document.getElementById('mpName').value.trim() || 'PILOT';
    try {
      const code = await mpCreateRoom();
      mpConnect(code, name, (save && save.skin) || 'default');
      mpRenderLobbyView();
    } catch(e){
      if(typeof toast === 'function') toast('Create failed: ' + e.message);
    }
  };
  document.getElementById('mpJoin').onclick = () => {
    const name = document.getElementById('mpName').value.trim() || 'PILOT';
    const code = (document.getElementById('mpJoinCode').value || '').trim().toUpperCase();
    if(code.length !== 4){
      if(typeof toast === 'function') toast('Enter a 4-letter room code');
      return;
    }
    mpConnect(code, name, (save && save.skin) || 'default');
    mpRenderLobbyView();
  };
}

function mpRenderLobbyView(){
  if(typeof openHubModal !== 'function') return;
  const isHost = MP.you && MP.you === MP.host;
  const list = MP.lobby.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border:1px solid #1f4d7a;border-radius:6px;margin-top:4px;background:#0a1430aa;">
      <span style="color:${p.id === MP.you ? '#00ffaa' : '#ffffff'};font-weight:900;letter-spacing:1px;">${p.name}</span>
      <span style="color:#9ec5ff;font-size:11px;">${p.host ? 'HOST' : ''}</span>
    </div>
  `).join('');
  openHubModal(`
    <h2><span class="ic">⚑</span>ROOM ${MP.room || '----'}</h2>
    <div style="text-align:center;margin-bottom:8px;">
      <p style="color:#ffea00;letter-spacing:6px;font-weight:900;font-size:24px;">${MP.room || '----'}</p>
      <p style="color:#7ea8d4;font-size:11px;">Share this code with friends to join</p>
    </div>
    <div id="mpLobbyList">${list || '<p style="color:#9ec5ff;text-align:center;">Waiting for players…</p>'}</div>
    <div style="height:14px"></div>
    ${isHost
      ? `<button class="modalBtn primary" id="mpStartBtn" ${MP.lobby.length < 2 ? 'disabled' : ''}>${MP.lobby.length < 2 ? 'WAITING FOR 2+ PLAYERS' : '▶ START MATCH'}</button>`
      : `<p style="color:#9ec5ff;text-align:center;letter-spacing:2px;">WAITING FOR HOST…</p>`}
    <button class="modalBtn" id="mpLeaveBtn">◀ LEAVE ROOM</button>
    ${MP.err ? `<p style="color:#ff6688;text-align:center;font-size:11px;margin-top:8px;">${MP.err}</p>` : ''}
  `);
  if(isHost){
    const btn = document.getElementById('mpStartBtn');
    if(btn) btn.onclick = () => mpStartGame();
  }
  document.getElementById('mpLeaveBtn').onclick = () => {
    mpDisconnect();
    if(typeof closeHubModal === 'function') closeHubModal();
  };
}

// Called by mpOnMessage when the lobby roster changes — re-renders the
// modal in place so new joiners appear without the host clicking refresh.
function mpRefreshLobbyUI(){
  if(MP.inLobby && document.getElementById('mpLobbyList')){
    mpRenderLobbyView();
  }
}
