'use strict';
// ============================================================
// HUB (Bloons-style main menu) — scene + hero + nav
// ============================================================
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
  g.clearRect(0,0,w,h);

  // === Deep space gradient (animated hue shift) ===
  const hueShift = Math.sin(t/8000)*15;
  const bg = g.createLinearGradient(0,0,0,h);
  bg.addColorStop(0, `hsl(${260+hueShift}, 70%, 14%)`);
  bg.addColorStop(0.5, `hsl(${290+hueShift}, 70%, 10%)`);
  bg.addColorStop(1, '#02030a');
  g.fillStyle = bg; g.fillRect(0,0,w,h);

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
  nebula(w*0.18 + Math.cos(t/4000)*40, h*0.32, Math.max(w,h)*0.5, '#ff66cc');
  nebula(w*0.78 + Math.sin(t/3500)*40, h*0.45, Math.max(w,h)*0.46, '#3aa0ff');
  nebula(w*0.5, h*0.22, Math.max(w,h)*0.4, '#aa66ff');
  nebula(w*0.3 + Math.sin(t/5000)*60, h*0.7, Math.max(w,h)*0.3, '#ffaa00');

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
    g.strokeStyle = '#00eaff';
    g.lineWidth = 3 + Math.sin(t/100)*2;
    g.shadowColor = '#00eaff'; g.shadowBlur = 20;
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
  // animated platform glow under hero
  const pulse = 0.5 + 0.5*Math.sin(t/600);
  const cgrd = g.createRadialGradient(w/2, h*0.82, 10, w/2, h*0.82, w*0.45);
  cgrd.addColorStop(0,`rgba(0,234,255,${0.35+0.25*pulse})`);
  cgrd.addColorStop(0.5,`rgba(255,0,204,${0.15+0.15*pulse})`);
  cgrd.addColorStop(1,'#00eaff00');
  g.fillStyle = cgrd; g.fillRect(0, h*0.74, w, h*0.26);
  // hexagonal grid lines on platform (perspective)
  g.strokeStyle = '#00eaff33'; g.lineWidth = 1;
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

// Hero astronaut centerpiece (just let the adaptive icon fill the 320x320 canvas)
function drawHubHero(){
  draw3DMenuIcon(hubHeroCtx, 'ship');
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
}

function paintHubNavIcons(){
  document.querySelectorAll('canvas[data-navicon]').forEach(c=>{
    const t = c.getAttribute('data-navicon');
    const map = { ships:'ship', boss:'boss', play:'play', pvp:'pvp', shop:'shop', tut:'tut' };
    draw3DMenuIcon(c.getContext('2d'), map[t]);
  });
}
paintHubNavIcons();
// Static icons used to be redrawn every 33ms — wasteful since they don't
// animate. Paint them once on boot. (Re-paint on resize below.)
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

// All achievements
const ALL_ACHIEVEMENTS = [
  { id:'FIRST BLOOD',          icon:'⚔', desc:'Get your first kill.' },
  { id:'STREAK MASTER',        icon:'🔥', desc:'Reach a 10× kill streak.' },
  { id:'UNSTOPPABLE',          icon:'💥', desc:'Reach a 25× kill streak.' },
  { id:'LEGENDARY KILL CHAIN', icon:'⭐', desc:'Reach a 50× kill streak.' },
  { id:'FIRST BOSS',           icon:'👹', desc:'Reach round 5.' },
  { id:'VETERAN',              icon:'🎖', desc:'Reach round 10.' },
  { id:'ASCENDANT',            icon:'⚡', desc:'Reach round 20.' },
  { id:'VOID WALKER',          icon:'🌌', desc:'Reach round 50.' },
  { id:'FIRST ABILITY',        icon:'✨', desc:'Use a ship special move.' },
  { id:'PHOENIX REBORN',       icon:'🔥', desc:'Revive with a Phoenix Feather.' },
];

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
    <div class="row">
      <span class="label">MUSIC</span>
      <div class="toggle ${save.music?'on':''}" id="optMusic"><div class="swt"></div><span>${save.music?'ON':'OFF'}</span></div>
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
  `);
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
    save.credits += reward;
    safeLSSet('hypershards_daily_day', today);
    safeLSSet('hypershards_daily_streak', String(newStreak));
    persist(); updateHubInfo();
    openHubModal(`
      <h2><span class="ic">★</span>DAILY REWARD</h2>
      <div style="text-align:center;padding:20px;">
        <div style="font-size:48px;">🎁</div>
        <p style="color:#ffea00;font-size:24px;font-weight:900;">+${reward} ◈</p>
        <p style="color:#9ec5ff;">Daily streak: <b style="color:#00ff88">${newStreak} day${newStreak>1?'s':''}</b></p>
        <p style="color:#7ea8d4;font-size:11px;">Tomorrow's reward: ${50 + newStreak*10} ◈</p>
      </div>
    `);
    sfx('achieve');
  }
};

document.getElementById('hubBtnReset').onclick = ()=>{
  openHubModal(`
    <h2><span class="ic">↺</span>RESET SAVE</h2>
    <p style="color:#9ec5ff;text-align:center;margin:14px 0;">This will permanently wipe:</p>
    <div class="stats">
      <div class="stat"><div class="num">◈ ${save.credits}</div><div class="lbl">SHARDS</div></div>
      <div class="stat"><div class="num">${save.best}</div><div class="lbl">BEST SCORE</div></div>
      <div class="stat"><div class="num">${Object.values(save.upgrades).reduce((a,b)=>a+b,0)}</div><div class="lbl">UPGRADE LEVELS</div></div>
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
updateHubInfo();

