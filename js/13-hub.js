'use strict';
// ============================================================
// HUB (Bloons-style main menu) — scene + hero + nav
// ============================================================

// Background theme palettes for the hub menu. Each palette retunes the
// gradient, nebula colors, platform glow, and accent beam in
// drawHubScene(). The animated decorations (stars, comets, asteroids,
// planet, station) stay theme-agnostic so the scene reads consistently.
// `bg` is a 3-stop top→bottom gradient. `nebs` are the four big radial
// clouds in scene-paint order. `glowA`/`glowB` tint the platform pulse.
// `beam` colors the energy beam from the station.
const HUB_BG_THEMES = {
  nebula:  { label:'NEBULA',  cost:0,   bg:['#3a1f6e','#1a103a','#02030a'], nebs:['#ff66cc','#3aa0ff','#aa66ff','#ffaa00'], glowA:'#00eaff', glowB:'#ff00cc', beam:'#00eaff' },
  crimson: { label:'CRIMSON', cost:300, bg:['#5a1020','#2a0810','#0a0204'], nebs:['#ff3344','#ff8844','#ff66aa','#ffcc66'], glowA:'#ff6644', glowB:'#ffaa00', beam:'#ff6644' },
  void:    { label:'VOID',    cost:400, bg:['#0a1430','#050a18','#000004'], nebs:['#1a3a6a','#244a78','#0a2050','#3a8acc'], glowA:'#3a8acc', glowB:'#244a78', beam:'#66aaff' },
  aurora:  { label:'AURORA',  cost:500, bg:['#0a4a3a','#053028','#02100a'], nebs:['#00ffaa','#00eaff','#66ffaa','#aaffcc'], glowA:'#00ffaa', glowB:'#00eaff', beam:'#66ffcc' },
  solar:   { label:'SOLAR',   cost:600, bg:['#5a3010','#2a1a08','#0a0604'], nebs:['#ffaa00','#ffea00','#ff8844','#ffcc66'], glowA:'#ffea00', glowB:'#ff8844', beam:'#ffea00' },
};
function getHubTheme(){
  return HUB_BG_THEMES[(save && save.hubBg) || 'nebula'] || HUB_BG_THEMES.nebula;
}

const hubScene = document.getElementById('hubScene');
const hubSceneCtx = hubScene.getContext('2d');
const hubHeroCanvas = document.getElementById('hubHeroCanvas');
const hubHeroCtx = hubHeroCanvas.getContext('2d');
function fitHubScene(){
  hubScene.width = window.innerWidth;
  hubScene.height = window.innerHeight;
}
fitHubScene();
addEventListener('resize', fitHubScene);

// Decorative hub stars/asteroids — counts scale on every touch device,
// not just small viewports. iPad-sized tablets in landscape are >1024px
// wide so they used to miss the cutoff and pay full desktop fillrate
// cost (300 stars + 60 streaks) on the menu animation loop.
const _hubScale = (typeof isTouch !== 'undefined' && isTouch)
  ? (Math.min(window.innerWidth, window.innerHeight) < 700 ? 0.3 : 0.5)
  : 1;
const hubStars = [];
for(let i=0;i<Math.round(300*_hubScale);i++){
  hubStars.push({x:Math.random(), y:Math.random(), r:Math.random()*2+0.4, tw:Math.random()*Math.PI*2, sp:0.3+Math.random()*0.9, c:Math.random()<0.15?'#ffea00':(Math.random()<0.3?'#ff66cc':'#ffffff')});
}
const hubAsteroids = [];
for(let i=0;i<Math.round(8*_hubScale);i++){
  hubAsteroids.push({x:Math.random(), y:Math.random()*0.7, sz:18+Math.random()*30, vx:0.00004+Math.random()*0.00006, rot:Math.random()*Math.PI, vr:(Math.random()-0.5)*0.0006});
}
const hubComets = [];
function spawnComet(){
  hubComets.push({
    x: -0.1, y: Math.random()*0.6,
    vx: 0.001 + Math.random()*0.0007,
    vy: 0.0003 + Math.random()*0.0005,
    life: 1, len: 80+Math.random()*120,
    col: ['#00eaff','#ffea00','#ff00cc','#66ffaa'][Math.floor(Math.random()*4)],
  });
}
const hubFlyers = [];   // Distant ships zipping by
function spawnFlyer(){
  hubFlyers.push({
    x: Math.random()<0.5 ? -0.05 : 1.05,
    y: 0.3 + Math.random()*0.4,
    dir: 0,
    vx: 0,
    sz: 6+Math.random()*4,
    life: 1,
  });
  const f = hubFlyers[hubFlyers.length-1];
  f.dir = f.x<0 ? 1 : -1;
  f.vx = f.dir * (0.0008+Math.random()*0.0004);
}
const hubShards = [];   // Floating gold shards
for(let i=0;i<Math.round(14*_hubScale);i++){
  hubShards.push({x:Math.random(), y:Math.random()*0.9, t:Math.random()*Math.PI*2, sp:0.5+Math.random(), sz:4+Math.random()*5});
}
const hubStreaks = [];  // Hyperspace radial streaks (faint)
for(let i=0;i<Math.round(60*_hubScale);i++){
  hubStreaks.push({a:Math.random()*Math.PI*2, r0:Math.random(), len:0.1+Math.random()*0.2, sp:0.5+Math.random()*0.8});
}

function drawHubScene(){
  const g = hubSceneCtx;
  const w = hubScene.width, h = hubScene.height;
  const t = performance.now();
  const theme = getHubTheme();
  g.clearRect(0,0,w,h);

  // === Deep space gradient (theme palette + slow brightness pulse) ===
  // The pulse keeps the previous "alive" feeling without coupling to a
  // hardcoded hue, so all theme presets breathe the same way.
  const pulse = 1 + Math.sin(t/8000)*0.06;
  const bg = g.createLinearGradient(0,0,0,h);
  bg.addColorStop(0, theme.bg[0]);
  bg.addColorStop(0.5, theme.bg[1]);
  bg.addColorStop(1, theme.bg[2]);
  g.fillStyle = bg; g.fillRect(0,0,w,h);
  g.globalAlpha = Math.max(0, pulse-1);
  g.fillStyle = theme.nebs[0]; g.fillRect(0,0,w,h);
  g.globalAlpha = 1;

  // === Hyperspace streaks (radial from screen center) ===
  const cx = w/2, cy = h/2;
  for(const s of hubStreaks){
    s.r0 += 0.001*s.sp;
    if(s.r0 > 1.2) s.r0 = 0;
    const r1 = s.r0 * Math.max(w,h);
    const r2 = (s.r0 + s.len) * Math.max(w,h);
    const x1 = cx + Math.cos(s.a)*r1, y1 = cy + Math.sin(s.a)*r1;
    const x2 = cx + Math.cos(s.a)*r2, y2 = cy + Math.sin(s.a)*r2;
    const grd = g.createLinearGradient(x1,y1,x2,y2);
    grd.addColorStop(0, '#00eaff00');
    grd.addColorStop(0.5, '#00eaff66');
    grd.addColorStop(1, '#ff00cc00');
    g.strokeStyle = grd; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
  }

  // === Big nebula clouds (animated drift + hue) ===
  function nebula(cxn, cyn, r, col){
    const grd = g.createRadialGradient(cxn,cyn,2,cxn,cyn,r);
    grd.addColorStop(0, col+'aa'); grd.addColorStop(0.4, col+'55'); grd.addColorStop(1, col+'00');
    g.fillStyle = grd;
    g.beginPath(); g.arc(cxn,cyn,r,0,Math.PI*2); g.fill();
  }
  nebula(w*0.18 + Math.cos(t/4000)*40, h*0.32, Math.max(w,h)*0.5, theme.nebs[0]);
  nebula(w*0.78 + Math.sin(t/3500)*40, h*0.45, Math.max(w,h)*0.46, theme.nebs[1]);
  nebula(w*0.5, h*0.22, Math.max(w,h)*0.4, theme.nebs[2]);
  nebula(w*0.3 + Math.sin(t/5000)*60, h*0.7, Math.max(w,h)*0.3, theme.nebs[3]);

  // === Stars (twinkle, colored mix) ===
  for(const s of hubStars){
    const x = s.x*w, y = s.y*h;
    const tw = 0.4 + 0.6*Math.sin(t/500*s.sp + s.tw);
    g.globalAlpha = tw;
    g.fillStyle = s.c;
    if(s.r>1.5){
      // bigger stars get a cross sparkle
      g.fillRect(x|0, y|0, s.r, s.r);
      g.fillRect(x|0, (y-s.r-1)|0, 1, s.r*3+2);
      g.fillRect((x-s.r-1)|0, y|0, s.r*3+2, 1);
    } else {
      g.fillRect(x|0, y|0, s.r, s.r);
    }
  }
  g.globalAlpha = 1;

  // === Comets ===
  if(Math.random()<0.012) spawnComet();
  for(let i=hubComets.length-1;i>=0;i--){
    const c = hubComets[i];
    c.x += c.vx; c.y += c.vy;
    if(c.x > 1.1 || c.y > 1.1){ hubComets.splice(i,1); continue; }
    const x = c.x*w, y = c.y*h;
    const ang = Math.atan2(c.vy, c.vx);
    const tx = x - Math.cos(ang)*c.len, ty = y - Math.sin(ang)*c.len;
    const grd = g.createLinearGradient(x,y,tx,ty);
    grd.addColorStop(0, c.col+'ff');
    grd.addColorStop(0.4, c.col+'88');
    grd.addColorStop(1, c.col+'00');
    g.strokeStyle = grd; g.lineWidth = 3; g.lineCap='round';
    g.beginPath(); g.moveTo(x,y); g.lineTo(tx,ty); g.stroke();
    // bright head
    g.fillStyle = '#ffffff'; g.shadowColor = c.col; g.shadowBlur = 16;
    g.beginPath(); g.arc(x,y,3,0,Math.PI*2); g.fill();
    g.shadowBlur = 0;
  }

  // === Distant flyers (tiny ships zipping by) ===
  if(Math.random()<0.005 && hubFlyers.length<3) spawnFlyer();
  for(let i=hubFlyers.length-1;i>=0;i--){
    const f = hubFlyers[i];
    f.x += f.vx;
    if(f.x < -0.1 || f.x > 1.1){ hubFlyers.splice(i,1); continue; }
    const x = f.x*w, y = f.y*h;
    g.save(); g.translate(x,y); g.scale(f.dir, 1);
    // body
    g.fillStyle = '#88aaff'; g.strokeStyle = '#0a1a3a'; g.lineWidth=1.5;
    g.beginPath(); g.ellipse(0,0,f.sz,f.sz*0.4,0,0,Math.PI*2); g.fill(); g.stroke();
    // engine glow trail
    const grd = g.createLinearGradient(0,0,-f.sz*4,0);
    grd.addColorStop(0,'#00eaffaa'); grd.addColorStop(1,'#00eaff00');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(-f.sz,-2); g.lineTo(-f.sz*4, 0); g.lineTo(-f.sz, 2); g.closePath(); g.fill();
    g.restore();
  }

  // === Big planet bottom-right with rings ===
  const pcx = w*0.85, pcy = h*0.82, pr = Math.min(w,h)*0.22;
  // glow halo
  const halo = g.createRadialGradient(pcx,pcy,pr*0.9, pcx,pcy, pr*1.6);
  halo.addColorStop(0, '#ff663366'); halo.addColorStop(1, '#ff663300');
  g.fillStyle = halo;
  g.beginPath(); g.arc(pcx,pcy,pr*1.6,0,Math.PI*2); g.fill();
  const pg = g.createRadialGradient(pcx-pr*0.35, pcy-pr*0.35, pr*0.15, pcx, pcy, pr);
  pg.addColorStop(0,'#ffd28a'); pg.addColorStop(0.45,'#ff7733'); pg.addColorStop(1,'#3a0a0a');
  g.fillStyle = pg;
  g.beginPath(); g.arc(pcx, pcy, pr, 0, Math.PI*2); g.fill();
  // surface bands
  g.save();
  g.beginPath(); g.arc(pcx,pcy,pr,0,Math.PI*2); g.clip();
  for(let i=-4;i<=4;i++){
    g.fillStyle = `rgba(0,0,0,${0.06 + (i%2===0?0.04:0)})`;
    g.fillRect(pcx-pr, pcy + i*pr*0.18, pr*2, pr*0.08);
  }
  g.restore();
  // outer ring
  g.strokeStyle = '#ffaa66cc'; g.lineWidth = 5;
  g.save(); g.translate(pcx,pcy); g.rotate(-0.4); g.scale(1, 0.2);
  g.beginPath(); g.arc(0,0,pr*1.55,0,Math.PI*2); g.stroke();
  g.strokeStyle = '#ffaa6688'; g.lineWidth = 2;
  g.beginPath(); g.arc(0,0,pr*1.85,0,Math.PI*2); g.stroke();
  g.restore();

  // === Drifting asteroids ===
  for(const a of hubAsteroids){
    a.x += a.vx; if(a.x>1) a.x = -0.05;
    a.rot += a.vr;
    g.save();
    g.translate(a.x*w, a.y*h);
    g.rotate(a.rot);
    g.fillStyle = '#3a4050';
    g.strokeStyle = '#0a0f1c'; g.lineWidth = 2;
    g.beginPath();
    const npts = 9;
    for(let i=0;i<npts;i++){
      const ang = i/npts*Math.PI*2;
      const r = a.sz*(0.7 + Math.sin(i*1.7)*0.2);
      const x = Math.cos(ang)*r, y = Math.sin(ang)*r;
      if(i===0) g.moveTo(x,y); else g.lineTo(x,y);
    }
    g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  // === Floating shards (gold gem sparkles drifting) ===
  for(const s of hubShards){
    s.t += 0.02*s.sp;
    const x = s.x*w + Math.sin(t/1200 + s.t)*20;
    const y = s.y*h + Math.cos(t/1500 + s.t)*15;
    const tw = 0.5 + 0.5*Math.sin(t/300 + s.t);
    g.save();
    g.translate(x,y);
    g.rotate(t/800 + s.t);
    g.fillStyle = '#ffea00';
    g.shadowColor = '#ffea00'; g.shadowBlur = 10*tw + 4;
    g.globalAlpha = 0.6 + 0.4*tw;
    g.beginPath();
    g.moveTo(0,-s.sz); g.lineTo(s.sz*0.5,0); g.lineTo(0,s.sz); g.lineTo(-s.sz*0.5,0); g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0,-s.sz*0.5); g.lineTo(s.sz*0.2,0); g.lineTo(0,0); g.closePath(); g.fill();
    g.restore();
  }
  g.globalAlpha = 1;

  // === Space station silhouette top-left ===
  g.save();
  g.translate(w*0.12, h*0.18);
  g.fillStyle = '#0a1a3a';
  g.strokeStyle = '#1a3a6a'; g.lineWidth = 2;
  g.beginPath();
  g.rect(-50,-12,100,24); g.fill(); g.stroke();
  g.beginPath(); g.arc(-50,0,16,0,Math.PI*2); g.fill(); g.stroke();
  g.beginPath(); g.arc(50,0,16,0,Math.PI*2); g.fill(); g.stroke();
  // antenna with blinker
  g.beginPath(); g.moveTo(0,-12); g.lineTo(0,-30); g.stroke();
  g.beginPath(); g.arc(0,-32,3,0,Math.PI*2);
  const blink = Math.sin(t/180)>0;
  g.fillStyle = blink ? '#ff3344' : '#aa1122';
  g.shadowColor = '#ff3344'; g.shadowBlur = blink?12:0;
  g.fill(); g.stroke(); g.shadowBlur = 0;
  // windows
  g.fillStyle = '#ffea00cc';
  for(let i=-3;i<=3;i++){ g.fillRect(i*12-2,-3,4,4); }
  g.restore();

  // === Energy beam from station (dramatic accent) ===
  if(Math.sin(t/2000)>0.7){
    g.save();
    const bx = w*0.12+50, by = h*0.18;
    const ba = Math.atan2(cy-by, cx-bx);
    const beamLen = Math.min(w,h)*0.6;
    g.strokeStyle = theme.beam;
    g.lineWidth = 3 + Math.sin(t/100)*2;
    g.shadowColor = theme.beam; g.shadowBlur = 20;
    g.globalAlpha = (Math.sin(t/2000)-0.7)/0.3;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx+Math.cos(ba)*beamLen, by+Math.sin(ba)*beamLen);
    g.stroke();
    g.restore();
  }

  // === Foreground platform (ground strip at bottom) ===
  const grdGround = g.createLinearGradient(0, h*0.74, 0, h);
  grdGround.addColorStop(0, 'rgba(40,30,80,0)');
  grdGround.addColorStop(0.5, '#1a0f3a');
  grdGround.addColorStop(1, '#0a0520');
  g.fillStyle = grdGround;
  g.fillRect(0, h*0.74, w, h*0.26);
  // animated platform glow under hero — tinted by theme accent colors
  const platPulse = 0.5 + 0.5*Math.sin(t/600);
  const cgrd = g.createRadialGradient(w/2, h*0.82, 10, w/2, h*0.82, w*0.45);
  cgrd.addColorStop(0, theme.glowA + Math.round((0.35+0.25*platPulse)*255).toString(16).padStart(2,'0'));
  cgrd.addColorStop(0.5, theme.glowB + Math.round((0.15+0.15*platPulse)*255).toString(16).padStart(2,'0'));
  cgrd.addColorStop(1, theme.glowA + '00');
  g.fillStyle = cgrd; g.fillRect(0, h*0.74, w, h*0.26);
  // hexagonal grid lines on platform (perspective)
  g.strokeStyle = theme.glowA + '33'; g.lineWidth = 1;
  for(let i=0;i<8;i++){
    const yy = h*0.78 + i*((h*0.22)/8);
    g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy); g.stroke();
  }
  // vertical perspective lines converging at center
  for(let i=-6;i<=6;i++){
    const xs = w/2 + i*60, xe = w/2 + i*220;
    g.beginPath(); g.moveTo(xs, h*0.78); g.lineTo(xe, h); g.stroke();
  }
}

// Hero centerpiece — render the actual in-game ship using the player's
// current skin, scaled up. The previous version used the cartoon plane
// mascot with a smiling face peeking through the visor; this replaces
// it with the real spacecraft art so the hub mirrors what the player
// flies and the hero reads as a proper ship instead of a kids-show
// mascot. Soft idle thrust + slow facing rotation give it life.
function drawHubHero(){
  const c = hubHeroCanvas;
  const w = c.width, h = c.height;
  const g = hubHeroCtx;
  g.save();
  g.clearRect(0, 0, w, h);
  // Re-resolve skin every frame in case the player just equipped a new
  // one in the shop and returned to the hub (cheap lookup, ~15 entries).
  const skinId = (save && save.skin) || 'default';
  const sk = SKINS.find(s=>s.id===skinId) || SKINS[0];
  // Soft pulsing thrust so the engines look "idling" but not roaring.
  const t = performance.now();
  const thrust = 0.45 + Math.sin(t/700)*0.15;
  // Slight gimbal tilt so the ship doesn't look statue-still.
  const tilt = Math.sin(t/1100) * 0.08;
  // Re-centre to canvas, scale up — drawShip is designed for ~32px high
  // sprites; multiplying by 6.5 fills the 380x380 hub canvas comfortably.
  g.translate(w/2, h/2);
  g.scale(6.5, 6.5);
  drawShip(g, {
    x: 0, y: 0, vx: 0, vy: 0,
    skin: sk,
    facing: -Math.PI/2 + tilt,
    thrust,
    inv: 0,
    isAi: false,
  }, t);
  g.restore();
}

function updateHubInfo(){
  document.getElementById('hubShards').textContent = save.credits;
  document.getElementById('hubName').textContent = save.username || 'PILOT';
  const xp = save.best % 1000;
  const lvl = 1 + Math.floor(save.best / 1000);
  document.getElementById('hubLvl').textContent = lvl;
  document.getElementById('hubXpBar').style.width = (xp/1000*100) + '%';
  document.getElementById('hubXpNum').textContent = xp + '/1000';
  // Daily badge — show "!" if reward not claimed today
  const today = new Date().toDateString();
  const claimed = safeLSGet('hypershards_daily_day') === today;
  const db = document.getElementById('hubDailyBadge');
  if(db) db.style.display = claimed ? 'none' : 'block';
  // Achievement badge — show count if any unclaimed (we award immediately, so just count)
  const ab = document.getElementById('hubAchvBadge');
  const got = state.achievements || {};
  const total = Object.keys(got).length;
  if(ab && total>0){ ab.style.display='block'; ab.textContent = total; }
  // Prestige badge — flash "!" when the player can ascend. Side-button
  // label shows the current prestige level so progress is visible at a
  // glance ("PRESTIGE 0" → "PRESTIGE 3" etc).
  const pb = document.getElementById('hubPrestigeBadge');
  const pl = document.getElementById('hubResetLbl');
  if(pl) pl.textContent = 'PRESTIGE ' + (save.prestige || 0);
  const prestigeReady = (typeof prestigeProgress === 'function') ? prestigeProgress().ready : false;
  if(pb) pb.style.display = prestigeReady ? 'block' : 'none';
  // Phone in-badge shard count — mirrors save.credits live so tapping
  // the pilot badge isn't necessary just to read your shard total.
  const ps = document.getElementById('hubPilotShards');
  if(ps) ps.textContent = save.credits;
  // Account-button "!" — flashes when there's anything actionable in
  // the consolidated panel (unclaimed daily, prestige ready, or an
  // unclaimed achievement that wasn't dismissed). Visible only on
  // phone via CSS (.pilotBadge.has-alert .acctBadge).
  const acctEl = document.getElementById('hubAccountBtn');
  if(acctEl){
    const hasAlert = (!claimed) || prestigeReady;
    acctEl.classList.toggle('has-alert', hasAlert);
  }
}

function paintHubNavIcons(){
  document.querySelectorAll('canvas[data-navicon]').forEach(c=>{
    const t = c.getAttribute('data-navicon');
    const map = { ships:'ship', boss:'boss', play:'play', pvp:'pvp', shop:'shop', tut:'tut' };
    draw3DMenuIcon(c.getContext('2d'), map[t]);
  });
}
paintHubNavIcons();
// Re-paint static menu icons (data-icon3d) once at boot. They live in
// menuPlay (which doesn't host an animation loop) so re-painting on
// resize is sufficient to keep them sized to the canvas. The hub nav
// icons (data-navicon) are now repainted every frame inside hubFrame
// below, so the plane mascots can spin in real 3D.
paintMenuIcons();
addEventListener('resize', ()=>{ paintHubNavIcons(); paintMenuIcons(); });

// Hub scene loop — rAF instead of setInterval so it auto-pauses when the
// tab is backgrounded (saves battery on mobile). Skips work entirely when
// the hub menu isn't actually visible. Throttled to ~30fps because the
// scene is decorative.
let _hubLastT = 0;
function hubFrame(now){
  requestAnimationFrame(hubFrame);
  if(now - _hubLastT < 33) return; // ~30fps cap
  _hubLastT = now;
  const ov = document.getElementById('overlay');
  if(!ov || ov.style.display === 'none') return;
  if(!document.getElementById('menuMain').classList.contains('active')) return;
  drawHubScene();
  drawHubHero();
  // Repaint the bottom-row nav plane mascots so the 3D mesh can rotate
  // continuously — drawPlane3D reads performance.now() each call to
  // drive the yaw spin. Cheap (~6 small canvases × ~22 polys each).
  paintHubNavIcons();
}
requestAnimationFrame(hubFrame);
// updateHubInfo runs only when the hub menu is actually shown — wired
// via showMenu in 02-input.js.

// Hub button wiring
document.querySelectorAll('[data-nav]').forEach(b=>{
  b.onclick = ()=>{
    const id = b.getAttribute('data-nav');
    if(id==='play')  showMenu('menuDiff');
    else if(id==='pvp')   showMenu('menuPvp');
    else if(id==='boss')  showMenu('menuBoss');
    else if(id==='shop')  { showMenu('menuShop'); shopTab='up'; document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('active',i===0)); renderShop(); }
    else if(id==='ships') { showMenu('menuShop'); shopTab='skin'; document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.getAttribute('data-tab')==='skin')); renderShop(); }
    else if(id==='tut')   showMenu('menuTut');
    else if(id==='3d')    { if(typeof start3DMode === 'function') start3DMode(); }
    else if(id==='modes') openModesModal();
  };
});
// ===== Hub modal system =====
const hubModal = document.getElementById('hubModal');
const hubModalBox = document.getElementById('hubModalBox');
function openHubModal(html){
  hubModalBox.innerHTML = html + '<button class="close" onclick="this.parentNode.parentNode.classList.remove(\'show\')">✕</button>';
  hubModal.classList.add('show');
}
function closeHubModal(){ hubModal.classList.remove('show'); }
hubModal.addEventListener('click', (e)=>{ if(e.target===hubModal) closeHubModal(); });

// All achievements + tiered rewards. Each unlock pays out `shards` AND
// `xp` toward the equipped skin's mastery, scaled with how hard the
// achievement is to earn — see achievement() in 07-loop.js for the
// payout code. The reward is shown inline in the banner so players
// see what they got, not just the title.
const ALL_ACHIEVEMENTS = [
  { id:'FIRST BLOOD',          icon:'⚔', desc:'Get your first kill.',                 reward:{ shards: 50,   xp: 25  } },
  { id:'STREAK MASTER',        icon:'🔥', desc:'Reach a 10× kill streak.',             reward:{ shards: 100,  xp: 50  } },
  { id:'UNSTOPPABLE',          icon:'💥', desc:'Reach a 25× kill streak.',             reward:{ shards: 200,  xp: 100 } },
  { id:'LEGENDARY KILL CHAIN', icon:'⭐', desc:'Reach a 50× kill streak.',             reward:{ shards: 400,  xp: 200 } },
  { id:'FIRST BOSS',           icon:'👹', desc:'Reach round 5.',                       reward:{ shards: 100,  xp: 50  } },
  { id:'VETERAN',              icon:'🎖', desc:'Reach round 10.',                      reward:{ shards: 250,  xp: 150 } },
  { id:'ASCENDANT',            icon:'⚡', desc:'Reach round 20.',                      reward:{ shards: 500,  xp: 300 } },
  { id:'VOID WALKER',          icon:'🌌', desc:'Reach round 50.',                      reward:{ shards: 1000, xp: 800 } },
  { id:'FIRST ABILITY',        icon:'✨', desc:'Use a ship special move.',             reward:{ shards: 75,   xp: 30  } },
  { id:'PHOENIX REBORN',       icon:'🔥', desc:'Revive with a Phoenix Feather.',       reward:{ shards: 300,  xp: 150 } },
];

// === MODES modal — phone consolidates BOSSES / VS AI / LEARN / 3D
// behind a single button. Tapping any option closes this modal and
// routes to the existing menu (or starts 3D mode). Available on every
// form factor but only the MODES button (phone-only via CSS) opens it. ===
function openModesModal(){
  openHubModal(`
    <h2><span class="ic">▶</span>GAME MODES</h2>
    <p style="color:#9ec5ff;text-align:center;margin:6px 0 14px;font-size:11px;letter-spacing:2px;">Pick what to play</p>
    <button class="modalBtn primary" data-mode="boss">👹  BOSS RUSH</button>
    <button class="modalBtn"         data-mode="pvp">⚔  VS AI DUEL</button>
    <button class="modalBtn"         data-mode="tut">★  TUTORIAL · LEARN</button>
    <button class="modalBtn"         data-mode="3d"  style="background:linear-gradient(180deg,#aa66ff,#5533aa);">⬢  3D MODE  (BETA)</button>
  `);
  hubModalBox.querySelectorAll('button[data-mode]').forEach(b=>{
    b.onclick = ()=>{
      const m = b.getAttribute('data-mode');
      closeHubModal();
      if(m === 'boss') showMenu('menuBoss');
      else if(m === 'pvp')  showMenu('menuPvp');
      else if(m === 'tut')  showMenu('menuTut');
      else if(m === '3d' && typeof start3DMode === 'function') start3DMode();
    };
  });
}

// === ACCOUNT modal — phone tap target for the pilot badge. Pulls
// the daily reward + the 5 absorbed side-button actions (settings,
// awards, daily, stats, prestige) into one panel. Shows live shard
// count + pilot stats so the player can read their account state
// without leaving the modal. ===
function openAccountModal(){
  const today = new Date().toDateString();
  const last = safeLSGet('hypershards_daily_day');
  const streak = parseInt(safeLSGet('hypershards_daily_streak')||'0',10);
  const dailyClaimed = (last === today);
  const dailyReward = 50 + (dailyClaimed ? streak : Math.max(streak, 1) - 1)*10;
  const dailyXp     = 30 + (dailyClaimed ? streak : Math.max(streak, 1) - 1)*20;
  const got = state.achievements || {};
  const achvCount = Object.keys(got).length;
  openHubModal(`
    <h2><span class="ic">👤</span>${save.username || 'PILOT'}</h2>
    <div class="stats">
      <div class="stat"><div class="num">${1 + Math.floor((save.best||0)/1000)}</div><div class="lbl">LEVEL</div></div>
      <div class="stat"><div class="num">◈ ${save.credits}</div><div class="lbl">SHARDS</div></div>
      <div class="stat"><div class="num">${save.best||0}</div><div class="lbl">BEST</div></div>
      <div class="stat"><div class="num">${save.prestige||0}</div><div class="lbl">PRESTIGE</div></div>
    </div>
    <div style="margin:14px 0 8px;padding:10px 12px;background:#050a18cc;border:2px solid ${dailyClaimed?'#244a78':'#ffea00'};border-radius:10px;text-align:center;">
      <div style="color:#ffea00;font-size:13px;letter-spacing:2px;font-weight:900;">★ DAILY REWARD</div>
      ${dailyClaimed
        ? `<p style="color:#9ec5ff;margin:6px 0 0;">Already claimed today · streak ${streak}</p>`
        : `<p style="color:#cfe9ff;margin:6px 0 8px;">+${dailyReward} ◈ &nbsp;·&nbsp; +${dailyXp} XP</p>
           <button class="modalBtn primary" id="acctClaimDaily" style="margin-top:0;">CLAIM</button>`
      }
    </div>
    <p style="color:#7ea8d4;text-align:center;font-size:11px;letter-spacing:2px;margin:10px 0 6px;">MORE</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button class="modalBtn" data-acct="settings">⚙  SETTINGS</button>
      <button class="modalBtn" data-acct="awards">🏆  AWARDS  ${achvCount?`<span style="color:#ffea00">·${achvCount}</span>`:''}</button>
      <button class="modalBtn" data-acct="stats">📊  STATS</button>
      <button class="modalBtn" data-acct="prestige">★  PRESTIGE</button>
    </div>
  `);
  // Wire claim button if present
  const claim = document.getElementById('acctClaimDaily');
  if(claim) claim.onclick = ()=>{ closeHubModal(); document.getElementById('hubBtnDaily').click(); };
  // Wire quick-access buttons — closing this modal then opening the
  // corresponding side-button modal keeps each system's existing UI
  // intact (no duplication).
  hubModalBox.querySelectorAll('button[data-acct]').forEach(b=>{
    b.onclick = ()=>{
      const a = b.getAttribute('data-acct');
      closeHubModal();
      if(a === 'settings') document.getElementById('hubBtnSettings').click();
      else if(a === 'awards')   document.getElementById('hubBtnAchv').click();
      else if(a === 'stats')    document.getElementById('hubBtnLeaderboard').click();
      else if(a === 'prestige') document.getElementById('hubBtnReset').click();
    };
  });
}

// Pilot badge → ACCOUNT modal. Visible on every form factor but
// only the phone CSS gives the badge the obvious cursor + hides the
// alternate entry points. Desktop/tablet players can still tap it.
const _hubAccountBtn = document.getElementById('hubAccountBtn');
if(_hubAccountBtn){
  _hubAccountBtn.onclick = ()=> openAccountModal();
  _hubAccountBtn.onkeydown = (e)=>{ if(e.key==='Enter' || e.key===' ') openAccountModal(); };
}

document.getElementById('hubBtnSettings').onclick = ()=>{
  openHubModal(`
    <h2><span class="ic">⚙</span>SETTINGS</h2>
    <div class="row">
      <span class="label">PILOT NAME</span>
      <input type="text" id="optName" maxlength="14" value="${(save.username||'PILOT').replace(/"/g,'')}" />
    </div>
    <div class="row">
      <span class="label">SOUND EFFECTS</span>
      <div class="toggle ${save.audio?'on':''}" id="optAudio"><div class="swt"></div><span>${save.audio?'ON':'OFF'}</span></div>
    </div>
    <div class="row volRow">
      <span class="label">SFX VOLUME</span>
      <input type="range" id="optSfxVol" min="0" max="100" step="5" value="${save.sfxVol|0}" />
      <span class="val" id="optSfxVolNum">${save.sfxVol|0}</span>
    </div>
    <div class="row">
      <span class="label">MUSIC</span>
      <div class="toggle ${save.music?'on':''}" id="optMusic"><div class="swt"></div><span>${save.music?'ON':'OFF'}</span></div>
    </div>
    <div class="row volRow">
      <span class="label">MUSIC VOLUME</span>
      <input type="range" id="optMusicVol" min="0" max="100" step="5" value="${save.musicVol|0}" />
      <span class="val" id="optMusicVolNum">${save.musicVol|0}</span>
    </div>
    <div class="row">
      <span class="label">HAPTICS</span>
      <div class="toggle ${save.haptics?'on':''}" id="optHaptics"><div class="swt"></div><span>${save.haptics?'ON':'OFF'}</span></div>
    </div>
    <div class="row">
      <span class="label">CREDITS</span>
      <span class="val">◈ ${save.credits}</span>
    </div>
    <div class="row">
      <span class="label">ACHIEVEMENTS</span>
      <span class="val">${Object.keys(state.achievements||{}).length} / ${ALL_ACHIEVEMENTS.length}</span>
    </div>
    <button class="modalBtn primary" id="optSave">SAVE</button>
    <button class="modalBtn" id="optReset">↺ WIPE SAVE DATA</button>
    <button class="modalBtn" id="optForceReload" style="background:linear-gradient(180deg,#3aa0ff,#1a4477);">⟲ FORCE RELOAD (clear cache)</button>
    <!-- Secret pixel — top-left of the modal. 12×12, fully transparent
         so it reads as a smudge in the corner. Discoverable by sweep,
         not obvious. Reward grants once via save.foundSecrets.cornerPixel. -->
    <button id="optSecret" aria-label="" title="" style="position:absolute;top:6px;left:6px;width:12px;height:12px;padding:0;border:0;background:transparent;cursor:default;opacity:0;"></button>
  `);
  document.getElementById('optAudio').onclick = (e)=>{
    save.audio = !save.audio;
    e.currentTarget.classList.toggle('on', save.audio);
    e.currentTarget.querySelector('span').textContent = save.audio?'ON':'OFF';
    persist();
  };
  document.getElementById('optMusic').onclick = (e)=>{
    save.music = !save.music;
    e.currentTarget.classList.toggle('on', save.music);
    e.currentTarget.querySelector('span').textContent = save.music?'ON':'OFF';
    if(typeof setMusicVolume==='function') setMusicVolume(save.music);
    persist();
  };
  // Volume sliders — live-apply so the player can hear/feel the level
  // before committing. The numeric badge mirrors the slider value.
  const sfxSlider = document.getElementById('optSfxVol');
  const sfxNum = document.getElementById('optSfxVolNum');
  sfxSlider.oninput = ()=>{
    save.sfxVol = sfxSlider.valueAsNumber|0;
    sfxNum.textContent = save.sfxVol;
    persist();
    sfx('hit'); // audible preview at the new level
  };
  const musSlider = document.getElementById('optMusicVol');
  const musNum = document.getElementById('optMusicVolNum');
  musSlider.oninput = ()=>{
    save.musicVol = musSlider.valueAsNumber|0;
    musNum.textContent = save.musicVol;
    persist();
    if(typeof refreshMusicVolume==='function') refreshMusicVolume();
  };
  document.getElementById('optHaptics').onclick = (e)=>{
    save.haptics = !save.haptics;
    e.currentTarget.classList.toggle('on', save.haptics);
    e.currentTarget.querySelector('span').textContent = save.haptics?'ON':'OFF';
    if(save.haptics && typeof haptic==='function') haptic(20); // preview pulse
    persist();
  };
  document.getElementById('optSave').onclick = ()=>{
    // Defensive sanitizer — even though the only renders of save.username
    // currently use textContent or a "-stripped attribute, this is the
    // single user-controlled string in the codebase and worth hardening
    // at the source. Allow only printable ASCII (no control chars, no
    // markup, no unicode tricks), uppercase, max 14 chars.
    const raw = document.getElementById('optName').value || '';
    const v = raw.replace(/[^\x20-\x7E]/g, '')
                 .replace(/[<>"'`&]/g, '')
                 .trim().toUpperCase().slice(0,14) || 'PILOT';
    save.username = v;
    persist(); updateHubInfo();
    toast('Saved · welcome '+v);
    closeHubModal();
  };
  document.getElementById('optReset').onclick = ()=>{
    if(confirm('Wipe ALL save data? Cannot be undone.')){
      save = defaultSave(); persist();
      try{ localStorage.removeItem('hypershards_achv'); }catch(e){}
      state.achievements = {};
      updateHubInfo(); closeHubModal();
      toast('Save wiped.');
    }
  };
  // Force-reload — the recurring "I don't see my changes" complaint is
  // always the PWA service worker serving a stale shell. This button
  // unregisters every SW for the origin, drops every cache bucket, and
  // hard-reloads bypassing the HTTP cache. One click guaranteed-fresh.
  document.getElementById('optForceReload').onclick = async ()=>{
    try{
      if('serviceWorker' in navigator){
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r=> r.unregister()));
      }
      if('caches' in window){
        const keys = await caches.keys();
        await Promise.all(keys.map(k=> caches.delete(k)));
      }
    }catch(e){ /* best-effort; reload still bypasses HTTP cache */ }
    location.reload();
  };
  // Secret pixel (top-left, transparent). First discovery grants 100 ◈
  // and a hidden achievement-style toast. Subsequent clicks are no-ops
  // (tracked in save.foundSecrets so it can't be farmed).
  const sec = document.getElementById('optSecret');
  if(sec){
    sec.onclick = ()=>{
      if(!save.foundSecrets) save.foundSecrets = {};
      if(save.foundSecrets.cornerPixel){
        toast('Already found this one ✦');
        return;
      }
      save.foundSecrets.cornerPixel = true;
      save.credits += 100;
      persist(); updateHubInfo(); syncCurrencyDisplays();
      toast('✦ SECRET FOUND  +100 ◈');
      sfx('achieve');
    };
  }
};

document.getElementById('hubBtnAchv').onclick = ()=>{
  const got = state.achievements || {};
  const html = ALL_ACHIEVEMENTS.map(a=>{
    const ok = !!got[a.id];
    return `<div class="achv ${ok?'unlocked':'locked'}">
      <div class="icon">${a.icon}</div>
      <div class="info">
        <div class="name">${a.id}</div>
        <div class="desc">${a.desc}</div>
      </div>
      <div style="color:${ok?'#00ff88':'#7ea8d4'};font-weight:900;letter-spacing:2px;">${ok?'★':'—'}</div>
    </div>`;
  }).join('');
  const count = Object.keys(got).length;
  openHubModal(`
    <h2><span class="ic">🏆</span>ACHIEVEMENTS</h2>
    <div style="text-align:center;color:#9ec5ff;margin-bottom:10px;">${count} / ${ALL_ACHIEVEMENTS.length} unlocked · +50 ◈ each</div>
    ${html}
  `);
};

document.getElementById('hubBtnLeaderboard').onclick = ()=>{
  // Open immediately with local stats; fetch the global leaderboard
  // async and slot it in when (if) it arrives. This way the modal
  // never blocks on network — offline / no-DB shows the local stats
  // and a "leaderboard unavailable" line.
  openHubModal(`
    <h2><span class="ic">📊</span>STATS</h2>
    <div class="stats">
      <div class="stat"><div class="num">${save.best}</div><div class="lbl">BEST SCORE</div></div>
      <div class="stat"><div class="num">${save.bestRound||1}</div><div class="lbl">BEST ROUND</div></div>
      <div class="stat"><div class="num">${save.totalKills||0}</div><div class="lbl">TOTAL KILLS</div></div>
      <div class="stat"><div class="num">◈ ${save.totalShards||save.credits}</div><div class="lbl">SHARDS GAINED</div></div>
      <div class="stat"><div class="num">${save.totalRuns||0}</div><div class="lbl">RUNS PLAYED</div></div>
      <div class="stat"><div class="num">${save.pvpWins||0}–${save.pvpLosses||0}</div><div class="lbl">VS AI W–L</div></div>
    </div>
    <h2 style="margin-top:18px;font-size:18px;">BOSS WINS</h2>
    <div class="stats">
      ${[1,2,3,4,5].map(t=>`<div class="stat"><div class="num">${(save.bossWins&&save.bossWins[t])||0}</div><div class="lbl">TIER ${t}</div></div>`).join('')}
    </div>
    <h2 style="margin-top:18px;font-size:18px;">★ TOP PILOTS</h2>
    <div id="lbBoard" class="lbBoard"><div class="lbLoad">Loading…</div></div>
  `);
  if(typeof fetchTopScores==='function'){
    fetchTopScores().then(scores=>{
      const el = document.getElementById('lbBoard');
      if(!el) return;
      if(!scores.length){
        el.innerHTML = '<div class="lbLoad">Leaderboard offline</div>';
        return;
      }
      // Show top 25 to keep the modal scrollable but useful.
      const rows = scores.slice(0,25).map((s,i)=>{
        const rank = i+1;
        const me = (save.username||'PILOT')===s.name && rank<=3 ? ' me' : '';
        return `<div class="lbRow${me}">
          <span class="r">${rank}</span>
          <span class="n">${String(s.name||'').replace(/[<>&]/g,'')}</span>
          <span class="v">${s.score|0}</span>
          <span class="rd">R${s.round|0}</span>
        </div>`;
      }).join('');
      el.innerHTML = rows;
    });
  }
};

document.getElementById('hubBtnDaily').onclick = ()=>{
  const today = new Date().toDateString();
  const last = safeLSGet('hypershards_daily_day');
  const streak = parseInt(safeLSGet('hypershards_daily_streak')||'0',10);
  if(last === today){
    openHubModal(`
      <h2><span class="ic">★</span>DAILY REWARD</h2>
      <div style="text-align:center;padding:20px;">
        <div style="font-size:40px;color:#00ff88;">✓</div>
        <p style="color:#9ec5ff;">Already claimed today.</p>
        <p style="color:#ffea00;font-size:18px;font-weight:900;">Streak: ${streak} days</p>
        <p style="color:#7ea8d4;font-size:11px;">Come back tomorrow for +${50+streak*10} ◈</p>
      </div>
    `);
  } else {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    const newStreak = (last === yesterday.toDateString()) ? streak+1 : 1;
    const reward = 50 + (newStreak-1)*10;
    // XP reward scales with streak the same way shards do, so long
    // streaks meaningfully advance skin mastery (day-30 streak → 350
    // XP / day toward the equipped skin's threshold).
    const xpReward = 30 + (newStreak-1)*20;
    save.credits += reward;
    if(typeof addSkinXp === 'function'){
      addSkinXp(save.skin || 'default', xpReward);
    }
    safeLSSet('hypershards_daily_day', today);
    safeLSSet('hypershards_daily_streak', String(newStreak));
    persist(); updateHubInfo();
    openHubModal(`
      <h2><span class="ic">★</span>DAILY REWARD</h2>
      <div style="text-align:center;padding:20px;">
        <div style="font-size:48px;">🎁</div>
        <p style="color:#ffea00;font-size:24px;font-weight:900;">+${reward} ◈</p>
        <p style="color:#00ff88;font-size:18px;font-weight:900;">+${xpReward} XP</p>
        <p style="color:#9ec5ff;">Daily streak: <b style="color:#00ff88">${newStreak} day${newStreak>1?'s':''}</b></p>
        <p style="color:#7ea8d4;font-size:11px;">Tomorrow: ${50 + newStreak*10} ◈ &nbsp;·&nbsp; ${30 + newStreak*20} XP</p>
      </div>
    `);
    sfx('achieve');
  }
};

document.getElementById('hubBtnReset').onclick = ()=>{
  // PRESTIGE-or-RESET — the side button now leads with prestige (the
  // intended mid-game wipe-with-rewards) and demotes the destructive
  // hard-reset to a small link at the bottom of the modal.
  const pp = prestigeProgress();
  const lvl = save.prestige || 0;
  const next = lvl + 1;
  // Each metric gets a check or × so the player can see at a glance
  // what's still missing.
  const row = (label, have, need)=>{
    const ok = have >= need;
    return `<div class="row"><span class="label">${label}</span>
      <span class="val" style="color:${ok?'#00ff88':'#ff6677'}">
        ${ok?'✓':'✗'} ${have} / ${need}
      </span></div>`;
  };
  // Preview of perks at the next level (so the player sees what they'd
  // gain rather than abstract "+1 PRESTIGE").
  const previewMul = Math.round((PRESTIGE_PERKS.shardMul(next) - 1) * 100);
  const previewHp  = PRESTIGE_PERKS.hpBonus(next);
  const previewDmg = Math.round(PRESTIGE_PERKS.dmgBonus(next) * 100);
  const previewElite = PRESTIGE_PERKS.eliteUnlocked(next) && !PRESTIGE_PERKS.eliteUnlocked(lvl);
  openHubModal(`
    <h2><span class="ic">★</span>PRESTIGE</h2>
    <p style="color:#9ec5ff;text-align:center;margin:6px 0 14px;">
      Current level: <b style="color:#ffea00">${lvl}</b> &nbsp;→&nbsp; <b style="color:#00ff88">${next}</b>
    </p>
    <div style="margin-bottom:10px;">
      ${row('SHARDS',     pp.have.shards,    pp.need.shards)}
      ${row('SKINS OWNED',pp.have.skins,     pp.need.skins)}
      ${row('BEST ROUND', pp.have.bestRound, pp.need.bestRound)}
    </div>
    <p style="color:#ffea00;text-align:center;margin:14px 0 6px;font-size:12px;letter-spacing:2px;">↓ NEXT-LEVEL PERKS ↓</p>
    <div class="stats">
      <div class="stat"><div class="num">+${previewMul}%</div><div class="lbl">SHARDS PER PICKUP</div></div>
      <div class="stat"><div class="num">+${previewHp}</div><div class="lbl">STARTING HULL</div></div>
      <div class="stat"><div class="num">+${previewDmg}%</div><div class="lbl">DAMAGE</div></div>
      <div class="stat"><div class="num" style="color:${previewElite?'#ff3344':'#3a8acc'}">${previewElite?'NEW ⚡':'✓'}</div><div class="lbl">ELITE DIFFICULTY</div></div>
    </div>
    <p style="color:#7ea8d4;text-align:center;font-size:11px;margin:12px 0;">
      Prestiging wipes shards, upgrades, weapons (except Plasma) and consumables.
      <b style="color:#cfe9ff;">Skins, themes, achievements and lifetime stats are preserved.</b>
    </p>
    <button class="modalBtn primary" id="optConfirmPrestige" ${pp.ready?'':'disabled style="opacity:.45;cursor:not-allowed;"'}>
      ${pp.ready ? '★ ASCEND  →  PRESTIGE '+next : '🔒 REQUIREMENTS NOT MET'}
    </button>
    <p style="text-align:center;margin:18px 0 4px;">
      <a href="#" id="optShowReset" style="color:#7ea8d4;font-size:11px;letter-spacing:2px;text-decoration:underline;">↺ hard reset save (advanced)</a>
    </p>
  `);
  // Prestige confirm — gated on requirements; on success: wipes
  // gameplay progress, preserves cosmetics + lifetime stats, increments
  // prestige counter, and re-opens the hub fresh.
  document.getElementById('optConfirmPrestige').onclick = ()=>{
    const p = prestigeProgress();
    if(!p.ready) return;
    if(!confirm('PRESTIGE to level '+next+'?\n\nWipes: shards, upgrades, weapons, consumables.\nKeeps: skins, themes, achievements, stats, prestige perks.')) return;
    const keep = {
      prestige: next,
      best: save.best, bestRound: save.bestRound,
      totalKills: save.totalKills, totalShards: save.totalShards,
      totalRuns: save.totalRuns, bossWins: save.bossWins,
      pvpWins: save.pvpWins, pvpLosses: save.pvpLosses,
      audio: save.audio, music: save.music, sfxVol: save.sfxVol, musicVol: save.musicVol, haptics: save.haptics,
      username: save.username,
      skins: save.skins, skin: save.skin,
      hubBg: save.hubBg, hubBgs: save.hubBgs,
      foundSecrets: save.foundSecrets,
    };
    save = { ...defaultSave(), ...keep };
    persist(); updateHubInfo(); closeHubModal();
    toast('★ ASCENDED to PRESTIGE '+next);
    sfx('achieve');
  };
  // Hard-reset opt-in — same destructive flow as before, just demoted
  // behind a deliberate click so the prestige path is the easy one.
  document.getElementById('optShowReset').onclick = (e)=>{
    e.preventDefault();
    openHubModal(`
      <h2><span class="ic">↺</span>HARD RESET SAVE</h2>
      <p style="color:#9ec5ff;text-align:center;margin:14px 0;">Permanently wipes EVERYTHING — including prestige, skins, themes and achievements:</p>
      <div class="stats">
        <div class="stat"><div class="num">◈ ${save.credits}</div><div class="lbl">SHARDS</div></div>
        <div class="stat"><div class="num">${save.best}</div><div class="lbl">BEST SCORE</div></div>
        <div class="stat"><div class="num">${save.prestige||0}</div><div class="lbl">PRESTIGE</div></div>
        <div class="stat"><div class="num">${Object.keys(state.achievements||{}).length}</div><div class="lbl">ACHIEVEMENTS</div></div>
      </div>
      <button class="modalBtn" id="optConfirmReset">⚠ YES, WIPE EVERYTHING</button>
      <button class="modalBtn primary" onclick="document.getElementById('hubModal').classList.remove('show')">CANCEL</button>
    `);
    document.getElementById('optConfirmReset').onclick = ()=>{
      save = defaultSave(); persist();
      try{ localStorage.removeItem('hypershards_achv'); }catch(e){}
      try{ localStorage.removeItem('hypershards_daily_day'); }catch(e){}
      try{ localStorage.removeItem('hypershards_daily_streak'); }catch(e){}
      state.achievements = {};
      updateHubInfo(); closeHubModal();
      toast('Save wiped.');
    };
  };
};
updateHubInfo();

