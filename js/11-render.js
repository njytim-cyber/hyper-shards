'use strict';
// ============================================================
// RENDERING
// ============================================================
// Module-level gradient cache keyed by quantised position so the nebula
// drift doesn't allocate 5 fresh gradients per frame.
const _nebCache = new Map();

// Offscreen starfield (touch path). Built once per resize, scrolled
// vertically each frame via drawImage. Replaces ~260 per-frame fillRects
// with 2 drawImage calls.
let _starCanvas = null, _starCanvasW = 0, _starCanvasH = 0;
let _starScroll = 0;
function _ensureStarCache(){
  if(_starCanvas && _starCanvasW === W && _starCanvasH === H) return;
  _starCanvas = document.createElement('canvas');
  _starCanvas.width = W; _starCanvas.height = H;
  _starCanvasW = W; _starCanvasH = H;
  const sg = _starCanvas.getContext('2d');
  if(!sg) return;
  sg.clearRect(0,0,W,H);
  for(const s of state.stars){
    sg.globalAlpha = s.z;
    sg.fillStyle = s.c;
    // Skip the cross-sparkle on the offscreen path — on touch it was
    // already barely visible and the savings stack with the offscreen win.
    sg.fillRect(s.x|0, s.y|0, s.s, s.s);
  }
  sg.globalAlpha = 1;
}
function render(){
  ctx.save();
  if(state.shake>0) ctx.translate(rand(-state.shake,state.shake)*0.6,rand(-state.shake,state.shake)*0.6);
  ctx.clearRect(0,0,W,H);
  // On touch devices, neutralise shadowBlur for the rest of this frame.
  // Canvas2D's blur step is the single biggest cost on iOS Safari and
  // most Android tablets — disabling it for the in-game frame nearly
  // doubles framerate during heavy fights without changing the look much
  // (bullets already use a translucent halo fallback in drawBullet).
  // The original 'shadowBlur' setter is intercepted by overwriting the
  // property on this canvas's context for the duration of render().
  let __origBlurDescriptor = null;
  if (LOW_FX) {
    __origBlurDescriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(ctx), 'shadowBlur'
    );
    Object.defineProperty(ctx, 'shadowBlur', {
      configurable: true, get(){ return 0; }, set(){ /* no-op */ }
    });
  }

  // ===== Animated multi-layer nebula =====
  const tt = performance.now();
  const t = tt/8000;
  // Boss mode → red/orange nebula; otherwise purple/blue
  const isBoss = !!state.boss;
  // Memoise the nebula radial gradients by quantised (color,cx,cy,r).
  // The animation drifts cos(t)*40 → ~0.04 px/frame, so 16px bucketing
  // is invisible to the eye but reduces gradient allocations from 5/frame
  // to a handful for the whole game session. Cache is bounded.
  function neb(cxn, cyn, r, col){
    const kx = (cxn/16)|0, ky = (cyn/16)|0, kr = (r/16)|0;
    const key = col+'|'+kx+'|'+ky+'|'+kr;
    let g = _nebCache.get(key);
    if(!g){
      g = ctx.createRadialGradient(cxn,cyn,4,cxn,cyn,r);
      g.addColorStop(0, col+'44'); g.addColorStop(0.4, col+'22'); g.addColorStop(1, col+'00');
      _nebCache.set(key, g);
      if(_nebCache.size > 80) _nebCache.clear();
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cxn,cyn,r,0,Math.PI*2); ctx.fill();
  }
  if(isBoss){
    neb(W*0.3 + Math.cos(t)*40, H*0.4, Math.max(W,H)*0.5, '#ff3366');
    neb(W*0.7 + Math.sin(t*0.7)*40, H*0.6, Math.max(W,H)*0.45, '#ff8800');
  } else {
    neb(W*0.25 + Math.cos(t)*40, H*0.35, Math.max(W,H)*0.45, '#aa66ff');
    neb(W*0.75 + Math.sin(t*0.7)*40, H*0.65, Math.max(W,H)*0.45, '#3aa0ff');
    neb(W*0.5 + Math.sin(t*0.5)*30, H*0.2, Math.max(W,H)*0.3, '#ff66cc');
  }

  // ===== Hyperspace streaks (radiating from screen center) =====
  // Decorative parallax — ~30 line strokes with a fresh linear gradient
  // each. Skipped entirely on touch devices because it's nearly invisible
  // during fights but costs real fillrate.
  if(!LOW_FX){
    const cx0 = W/2, cy0 = H/2;
    if(!state.gameStreaks){
      state.gameStreaks = [];
      for(let i=0;i<30;i++) state.gameStreaks.push({a:Math.random()*Math.PI*2, r0:Math.random(), len:0.08+Math.random()*0.15, sp:0.5+Math.random()*0.7});
    }
    for(const s of state.gameStreaks){
      s.r0 += 0.0006*s.sp;
      if(s.r0 > 1.2) s.r0 = 0;
      const r1 = s.r0 * Math.max(W,H);
      const r2 = (s.r0 + s.len) * Math.max(W,H);
      const x1 = cx0 + Math.cos(s.a)*r1, y1 = cy0 + Math.sin(s.a)*r1;
      const x2 = cx0 + Math.cos(s.a)*r2, y2 = cy0 + Math.sin(s.a)*r2;
      const grd = ctx.createLinearGradient(x1,y1,x2,y2);
      grd.addColorStop(0, isBoss?'#ff336600':'#00eaff00');
      grd.addColorStop(0.5, isBoss?'#ff336644':'#00eaff44');
      grd.addColorStop(1, isBoss?'#ffaa0000':'#ff00cc00');
      ctx.strokeStyle = grd; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
  }

  // ===== Stars =====
  // On touch: pre-render the entire starfield to an offscreen canvas
  // once and scroll it by drawing twice for vertical wrap. Replaces
  // ~260 per-star fillRect calls (with cross-sparkles up to ~520) with
  // 2 drawImage calls per frame. Loses per-depth parallax as a tradeoff
  // — on touch the cross-sparkles + animations are already simplified
  // so the visual cost is small. Desktop keeps the original loop.
  if(LOW_FX){
    _ensureStarCache();
    const speed = 1 + (player && player.thrust || 0)*1.5;
    _starScroll = (_starScroll + speed*0.5) % H;
    ctx.drawImage(_starCanvas, 0, _starScroll - H);
    ctx.drawImage(_starCanvas, 0, _starScroll);
  } else {
    for(const s of state.stars){
      ctx.globalAlpha = s.z;
      ctx.fillStyle = s.c;
      if(s.s > 1.4){
        ctx.fillRect(s.x|0, s.y|0, s.s, s.s);
        ctx.fillRect(s.x|0, (s.y-s.s-1)|0, 1, s.s*3+2);
        ctx.fillRect((s.x-s.s-1)|0, s.y|0, s.s*3+2, 1);
      } else {
        ctx.fillRect(s.x|0, s.y|0, s.s, s.s);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ===== Random comets across the playfield =====
  // Decorative parallax — skipped on touch (each comet does shadowBlur
  // already neutered there, but the gradient + line stroke still costs).
  if(!state.gameComets) state.gameComets = [];
  if(!LOW_FX && state.phase==='play' && Math.random()<0.005 && state.gameComets.length<3){
    state.gameComets.push({
      x:Math.random()*W, y:-30,
      vx:rand(-1,1)*2, vy:rand(2,4),
      life:200, len:60+Math.random()*40,
      col:['#00eaff','#ffea00','#ff00cc'][Math.floor(Math.random()*3)],
    });
  }
  for(let i=state.gameComets.length-1;i>=0;i--){
    const c = state.gameComets[i];
    c.x += c.vx; c.y += c.vy; c.life--;
    if(c.life<=0 || c.y>H+50){ state.gameComets.splice(i,1); continue; }
    const ang = Math.atan2(c.vy, c.vx);
    const tx = c.x - Math.cos(ang)*c.len, ty = c.y - Math.sin(ang)*c.len;
    const grd = ctx.createLinearGradient(c.x, c.y, tx, ty);
    grd.addColorStop(0, c.col+'ff');
    grd.addColorStop(0.4, c.col+'88');
    grd.addColorStop(1, c.col+'00');
    ctx.strokeStyle = grd; ctx.lineWidth = 2.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.shadowColor = c.col; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(c.x, c.y, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.lineCap = 'butt';

  // Particles (under)
  for(const p of state.particles){
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life/40));
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
  }
  ctx.globalAlpha = 1;

  // Shards
  for(const s of state.shards){
    ctx.save();
    ctx.translate(s.x,s.y);
    ctx.rotate(s.life/20);
    ctx.fillStyle = '#ffea00';
    ctx.shadowColor = '#ffea00'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0,-5); ctx.lineTo(4,0); ctx.lineTo(0,5); ctx.lineTo(-4,0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Powerups
  for(const p of state.powerups){
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(p.t/300);
    const col = powerupColor(p.kind);
    ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.fillStyle = col;
    ctx.fillRect(-10,-10,20,20);
    ctx.fillStyle = '#000a';
    ctx.fillRect(-7,-7,14,14);
    ctx.fillStyle = col;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(powerupGlyph(p.kind),0,1);
    ctx.restore();
  }

  // Black hole
  if(state.blackHole){
    const bh = state.blackHole;
    const r = 60 + Math.sin(bh.t/100)*4;
    const rg = ctx.createRadialGradient(bh.x,bh.y,2,bh.x,bh.y,r);
    rg.addColorStop(0,'#000'); rg.addColorStop(0.5,'#aa55ff'); rg.addColorStop(1,'#aa55ff00');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(bh.x,bh.y,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#aa55ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bh.x,bh.y,r*0.7,bh.t/200,bh.t/200+Math.PI*1.5); ctx.stroke();
  }
  // Acid cloud
  if(state.acidCloud){
    const ac = state.acidCloud;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#aaff00';
    ctx.beginPath(); ctx.arc(ac.x,ac.y,ac.r+Math.sin(ac.t/200)*4,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Decoy
  if(state.decoy){
    ctx.save();
    ctx.globalAlpha = 0.6 + Math.sin(performance.now()/100)*0.2;
    drawShip(ctx, {skin: state.decoy.skin, thrust:0.2, facing:-Math.PI/2, x:state.decoy.x, y:state.decoy.y}, performance.now());
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // Void wells
  if(state.voidWells){
    for(const v of state.voidWells){
      const r = v.r * (v.life/1500);
      const rg = ctx.createRadialGradient(v.x,v.y,2,v.x,v.y,r);
      rg.addColorStop(0,'#000');
      rg.addColorStop(0.4,'#aa55ff');
      rg.addColorStop(1,'#aa55ff00');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(v.x,v.y,r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#aa55ff'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(v.x,v.y,r*0.6, v.t/120, v.t/120+Math.PI*1.4); ctx.stroke();
    }
  }
  // Solar sun
  if(state.solarSun){
    const ss = state.solarSun;
    const r = 80 + Math.sin(ss.t/120)*8;
    const rg = ctx.createRadialGradient(ss.x,ss.y,4,ss.x,ss.y,r);
    rg.addColorStop(0,'#ffffff'); rg.addColorStop(0.4,'#ffaa00'); rg.addColorStop(1,'#ff550000');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(ss.x,ss.y,r,0,Math.PI*2); ctx.fill();
  }
  // Drones (combat swarm)
  if(state.drones){
    for(const dr of state.drones){
      const ang = dr.t/200 + dr.phase*1.2;
      dr.dx = player.x + Math.cos(ang)*60;
      dr.dy = player.y + Math.sin(ang)*60;
      ctx.fillStyle='#33ff88'; ctx.shadowColor='#33ff88'; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(dr.dx,dr.dy,5,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    }
  }
  // Beam (with optional sweep / omnidirectional)
  if(state.beam){
    const bm = state.beam;
    // Anchor omni beams to the player
    if(bm.omni && player){ bm.x = player.x; bm.y = player.y; }
    if(bm.sweep) bm.ang += 0.0006*16;
    const len = Math.max(W,H)*2;
    ctx.save();
    ctx.globalAlpha = Math.min(1, bm.life/1500);
    if(bm.omni){
      const beams = bm.beams || 8;
      const off = bm.t*0.0008;
      // Outer halo glow
      const haloR = 80 + Math.sin(bm.t/120)*6;
      const halo = ctx.createRadialGradient(bm.x,bm.y,4,bm.x,bm.y,haloR);
      halo.addColorStop(0,'#ffffff'); halo.addColorStop(0.4,'#fff7c0'); halo.addColorStop(1,'#fff7c000');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(bm.x,bm.y,haloR,0,Math.PI*2); ctx.fill();
      for(let i=0;i<beams;i++){
        const a = i/beams*Math.PI*2 + off;
        const dx = Math.cos(a), dy = Math.sin(a);
        ctx.strokeStyle = '#fff7c0'; ctx.lineWidth = 60;
        ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(bm.x+dx*len,bm.y+dy*len); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(bm.x+dx*len,bm.y+dy*len); ctx.stroke();
      }
      ctx.restore();
      // outer ring expansion (visual punch)
      const ring = (1 - bm.life/2400) * 600;
      ctx.save();
      ctx.globalAlpha = Math.max(0, bm.life/2400);
      ctx.strokeStyle = '#fff7c0'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(bm.x, bm.y, ring, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    } else {
      const dx = Math.cos(bm.ang), dy = Math.sin(bm.ang);
      ctx.strokeStyle = '#fff7c0'; ctx.lineWidth = 80;
      ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(bm.x+dx*len, bm.y+dy*len); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 28;
      ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(bm.x+dx*len, bm.y+dy*len); ctx.stroke();
      ctx.restore();
    }
  }

  for(const e of state.enemies) drawEnemy(e);
  if(state.boss) drawBoss(state.boss);

  if(player && player.hp>0) drawShip(ctx, player, performance.now());
  if(state.ai && state.pvpRespawn<=0) drawShip(ctx, state.ai, performance.now());

  for(const b of state.bullets) drawBullet(b);
  for(const b of state.ebullets) drawBullet(b, true);

  ctx.restore();
  // Restore the real shadowBlur setter so non-game canvases (hub, icons,
  // shop) still get full visual fidelity.
  if (__origBlurDescriptor) {
    delete ctx.shadowBlur;
  }
}

function drawBullet(b, enemy){
  // Trail
  if(b.trail !== undefined){
    if(!b.trail) b.trail = [];
    b.trail.push(b.x); b.trail.push(b.y);
    if(b.trail.length>10) b.trail.splice(0,2);
    if(b.trail.length>=4){
      ctx.strokeStyle = b.col; ctx.globalAlpha = 0.5;
      ctx.lineWidth = (b.size||3)*0.6; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(b.trail[0],b.trail[1]);
      for(let i=2;i<b.trail.length;i+=2) ctx.lineTo(b.trail[i],b.trail[i+1]);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = b.col;
  if(b.big){
    ctx.save();
    ctx.shadowColor = b.col; ctx.shadowBlur = 10;
    ctx.translate(b.x,b.y);
    ctx.rotate(Math.atan2(b.vy,b.vx));
    ctx.fillRect(-b.size*2,-b.size, b.size*4, b.size*2);
    ctx.restore();
  } else {
    const r = enemy ? b.r : b.size;
    // outer faint glow circle (cheaper than shadowBlur)
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(b.x,b.y,r*2,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(b.x,b.y,r,0,Math.PI*2); ctx.fill();
  }
}

function drawEnemy(e){
  if(e.type==='asteroid'){
    // Motion-blur trail (meteor effect)
    const sp = Math.hypot(e.vx,e.vy);
    if(sp > 1.2){
      const trailAng = Math.atan2(e.vy, e.vx);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(trailAng);
      const tg = ctx.createLinearGradient(0,0,-e.r*3.5, 0);
      tg.addColorStop(0, '#ffaa3355');
      tg.addColorStop(0.5, '#ff552222');
      tg.addColorStop(1, '#00000000');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.moveTo(0,-e.r*0.55);
      ctx.lineTo(-e.r*3.5, 0);
      ctx.lineTo(0, e.r*0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(e.x,e.y); ctx.rotate(e.rot);
    // Body — slate gray with metallic shading (light from upper-left)
    const grd = ctx.createRadialGradient(-e.r*0.45,-e.r*0.45,e.r*0.05,0,0,e.r*1.1);
    grd.addColorStop(0,'#aab2bc');
    grd.addColorStop(0.45,'#5a6470');
    grd.addColorStop(0.85,'#2a323c');
    grd.addColorStop(1,'#15191f');
    ctx.fillStyle = grd;
    ctx.strokeStyle = '#0d1218'; ctx.lineWidth = 2; ctx.lineJoin='round';
    ctx.beginPath();
    for(let i=0;i<e.pts.length;i++){
      const p = e.pts[i];
      const x = Math.cos(p.a)*p.r, y = Math.sin(p.a)*p.r;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Shadow side darkening
    ctx.save();
    ctx.clip();
    const shade = ctx.createRadialGradient(e.r*0.5, e.r*0.5, e.r*0.1, e.r*0.2, e.r*0.2, e.r*1.5);
    shade.addColorStop(0,'#00000000');
    shade.addColorStop(1,'#000000aa');
    ctx.fillStyle = shade;
    ctx.fillRect(-e.r*1.5,-e.r*1.5,e.r*3,e.r*3);
    ctx.restore();
    // Craters with rim highlight + shadow
    const craters = e.pts._craters || [];
    for(const c of craters){
      const cx = Math.cos(c.a)*c.d;
      const cy = Math.sin(c.a)*c.d;
      // Rim highlight
      ctx.fillStyle = '#c8cfd8';
      ctx.beginPath();
      ctx.arc(cx-c.s*0.18, cy-c.s*0.18, c.s*1.06, 0, Math.PI*2);
      ctx.fill();
      // Crater shadow
      ctx.fillStyle = '#0e1318';
      ctx.beginPath();
      ctx.arc(cx, cy, c.s, 0, Math.PI*2);
      ctx.fill();
      // Inner glint
      ctx.fillStyle = '#3b424a';
      ctx.beginPath();
      ctx.arc(cx+c.s*0.25, cy+c.s*0.25, c.s*0.55, 0, Math.PI*2);
      ctx.fill();
    }
    // Surface cracks
    const cracks = e.pts._cracks || [];
    if(cracks.length){
      ctx.strokeStyle = '#0d1117';
      ctx.lineWidth = 1.2;
      for(const cr of cracks){
        ctx.beginPath();
        ctx.moveTo(cr.x1, cr.y1);
        ctx.quadraticCurveTo(cr.mx, cr.my, cr.x2, cr.y2);
        ctx.stroke();
      }
    }
    // Mineral specks (glowing ore)
    const specks = e.pts._specks || [];
    for(const s of specks){
      ctx.fillStyle = s.col;
      ctx.shadowColor = s.col; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // Top-edge rim light
    ctx.strokeStyle = '#dde1e6';
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.4;
    for(let i=0;i<e.pts.length;i++){
      const p = e.pts[i];
      if(p.a > Math.PI*0.55 && p.a < Math.PI*1.6) continue;
      const np = e.pts[(i+1)%e.pts.length];
      if(np.a > Math.PI*0.55 && np.a < Math.PI*1.6) continue;
      ctx.beginPath();
      ctx.moveTo(Math.cos(p.a)*p.r, Math.sin(p.a)*p.r);
      ctx.lineTo(Math.cos(np.a)*np.r, Math.sin(np.a)*np.r);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // HP bar
    if(e.hp<e.maxHp){
      ctx.rotate(-e.rot);
      ctx.fillStyle='#000a'; ctx.fillRect(-e.r,-e.r-10,e.r*2,4);
      ctx.fillStyle='#ff7755'; ctx.fillRect(-e.r,-e.r-10,e.r*2*(e.hp/e.maxHp),4);
    }
    ctx.restore();
  } else if(e.type==='kamikaze'){
    ctx.save();
    ctx.translate(e.x,e.y);
    ctx.rotate(Math.atan2(e.vy,e.vx) + Math.PI/2);
    ctx.shadowColor = '#ff3366'; ctx.shadowBlur = 16;
    ctx.fillStyle='#ff3366'; ctx.strokeStyle='#fff';
    ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(10,8); ctx.lineTo(-10,8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffea00';
    ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
    // pulsing warning
    const p = (Math.sin(performance.now()/100)+1)/2;
    ctx.globalAlpha = p; ctx.strokeStyle='#ff3366'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,16,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  } else if(e.type==='mine'){
    ctx.save();
    ctx.translate(e.x,e.y);
    const armed = e.armed<=0;
    ctx.shadowColor = armed?'#ff3300':'#ffaa00'; ctx.shadowBlur=12;
    ctx.fillStyle = '#444'; ctx.strokeStyle = armed?'#ff3300':'#ffaa00';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0,0,e.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
    // spikes
    for(let i=0;i<6;i++){
      const a = i/6*Math.PI*2 + e.t/300;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*e.r,Math.sin(a)*e.r);
      ctx.lineTo(Math.cos(a)*(e.r+8),Math.sin(a)*(e.r+8));
      ctx.stroke();
    }
    // light
    ctx.fillStyle = armed && Math.floor(e.t/200)%2===0 ? '#ff3300' : '#ffaa00';
    ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
    ctx.restore();
  } else if(e.type==='ufo'){
    ctx.save();
    ctx.translate(e.x,e.y);
    ctx.shadowColor='#ff5577'; ctx.shadowBlur=18;
    ctx.fillStyle='#88ddff';
    ctx.beginPath(); ctx.arc(0,-6,12,Math.PI,0); ctx.fill();
    const g = ctx.createLinearGradient(0,-4,0,8);
    g.addColorStop(0,'#bbb'); g.addColorStop(1,'#444');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.ellipse(0,4,26,9,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#222'; ctx.lineWidth=2; ctx.stroke();
    for(let i=-2;i<=2;i++){
      ctx.fillStyle = (Math.floor(performance.now()/200+i)%2===0)?'#ff5577':'#ffea00';
      ctx.beginPath(); ctx.arc(i*7,7,1.8,0,Math.PI*2); ctx.fill();
    }
    if(e.hp<e.maxHp){
      ctx.shadowBlur=0;
      ctx.fillStyle='#000'; ctx.fillRect(-26,-22,52,3);
      ctx.fillStyle='#00ff99'; ctx.fillRect(-26,-22,52*(e.hp/e.maxHp),3);
    }
    // shield ring for shielded UFO
    if(e.shield>0){
      ctx.strokeStyle='#88ddff'; ctx.lineWidth=2; ctx.globalAlpha=0.6;
      ctx.beginPath(); ctx.arc(0,0,32,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
    ctx.restore();
  }
}

function drawBoss(b){
  ctx.save();
  ctx.translate(b.x,b.y);
  // Charge telegraph — pulsing white-on-color halo during the brief
  // wind-up before each attack fires. Pulse amplitude scales with how
  // close we are to "now" so the visual rises into the impact.
  if(b.charge > 0){
    const k = 1 - b.charge/380; // 0 → 1 over the telegraph window
    const r = b.r * (1.05 + k*0.35);
    const op = 0.25 + k*0.55;
    ctx.save();
    ctx.globalAlpha = op;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 + k*4;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = LOW_FX ? 0 : 30;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.stroke();
    // Inner color ring picks up the boss accent so the player can read
    // direction even on the brightest white-out frames.
    ctx.globalAlpha = op*0.7;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r*0.92, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
  ctx.shadowColor = b.color; ctx.shadowBlur = 40;
  const t = b.t/600;
  ctx.strokeStyle = b.color; ctx.lineWidth = 4;
  for(let i=0;i<3;i++){
    ctx.beginPath();
    ctx.arc(0,0,b.r-i*8, t+i, t+i+Math.PI*1.4);
    ctx.stroke();
  }
  const grd = ctx.createRadialGradient(0,0,4,0,0,b.r);
  grd.addColorStop(0,'#fff'); grd.addColorStop(0.4,b.color); grd.addColorStop(1,'#0a0a1a');
  ctx.fillStyle = grd;
  ctx.beginPath();
  const pts = 8;
  for(let i=0;i<pts*2;i++){
    const r = i%2===0 ? b.r : b.r*0.7;
    const a = i/(pts*2)*Math.PI*2 + t*0.3;
    const x = Math.cos(a)*r, y=Math.sin(a)*r;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur=20;
  ctx.fillStyle = b.rage ? '#ff2222' : '#fff';
  ctx.beginPath(); ctx.arc(0,0,b.r*0.32,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#000';
  ctx.beginPath(); ctx.arc(Math.cos(t)*b.r*0.1, Math.sin(t)*b.r*0.1, b.r*0.16, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// (dead drawShopIcon block removed — superseded by the dispatcher in 12-icons.js)

function drawShipPreview(c, skin, w=200, h=80){
  c.save();
  c.clearRect(0,0,w,h);
  c.translate(w/2, h/2+6);
  const scl = Math.min(w/80, h/55);
  c.scale(scl, scl);
  drawShip(c, {skin, thrust:0.6, facing:-Math.PI/2}, performance.now());
  c.restore();
}

function drawShip(g, p, now){
  const skin = p.skin;
  g.save();
  g.translate(p.x|0, p.y|0);
  // facing rotation: ship art points "up" by default; rotate so up = facing
  const rot = (p.facing ?? -Math.PI/2) + Math.PI/2;
  g.rotate(rot);

  // banking from velocity perpendicular to facing
  const fx = Math.cos(p.facing ?? -Math.PI/2);
  const fy = Math.sin(p.facing ?? -Math.PI/2);
  const sideways = (p.vx||0)*(-fy) + (p.vy||0)*fx;
  g.rotate(sideways*0.04);

  // Engine plume (behind ship)
  if(p.thrust!==undefined){
    const tt = p.thrust;
    const flick = 0.7 + Math.sin(now/40)*0.3;
    g.save();
    g.translate(0, 22);
    g.shadowColor = skin.glow; g.shadowBlur = 22;
    const grd = g.createLinearGradient(0,0,0,30+tt*30);
    grd.addColorStop(0,'#fff');
    grd.addColorStop(0.4,skin.glow);
    grd.addColorStop(1,'#00000000');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(-7,0); g.lineTo(0, 28+tt*30*flick); g.lineTo(7,0);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(-14,-2); g.lineTo(-10, 18+tt*16*flick); g.lineTo(-7,-2);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(14,-2); g.lineTo(10, 18+tt*16*flick); g.lineTo(7,-2);
    g.closePath(); g.fill();
    g.restore();
  }

  // Shield ring
  if(p.inv && p.inv>0 && p.inv<10000){
    g.save();
    g.strokeStyle = '#00f7ffaa';
    g.lineWidth = 2;
    g.shadowColor='#00f7ff'; g.shadowBlur=14;
    g.beginPath(); g.arc(0,0,28+Math.sin(now/100)*2,0,Math.PI*2); g.stroke();
    g.restore();
  }

  let baseColor = skin.color;
  if(skin.rainbow) baseColor = `hsl(${(now/8)%360},90%,60%)`;
  let accent = skin.accent;
  // === MASTERY GOLD: when the equipped skin has been mastered, the
  // whole 2D ship turns glittery gold — base + accent + glow all
  // overridden, and a small sparkle particle is emitted each frame
  // around the ship for the "glitter" feel. Mirrors the 3D mode's
  // glittery-gold mastered ship treatment.
  const masteredHere = (typeof isSkinMastered === 'function') && isSkinMastered(skin.id);
  if(masteredHere){
    baseColor = '#ffd700';                 // pure gold body
    accent    = '#ffea00';                 // brighter gold accent
    g.shadowColor = '#ffea00'; g.shadowBlur = 22;
    // Glitter — 6 sparkles at fixed angles around the ship, each
    // twinkling at its own sin-phase. Reads as a halo of stars, not
    // a single dot teleporting (which playtesters called out as
    // looking like a graphics glitch). Cheap: 6 small plus-shapes,
    // skipped entirely when their twinkle value drops below 0.15.
    g.save();
    g.shadowBlur = 0;  // sparkles don't need the hull's gold blur
    for(let i = 0; i < 6; i++){
      const ang = (i / 6) * Math.PI * 2 + 0.3;     // fixed positions
      const r   = 30;                               // orbit radius
      const sx  = Math.cos(ang) * r;
      const sy  = Math.sin(ang) * r;
      // Each sparkle has its own phase so they don't all blink in sync.
      // 0.78 phase offset = ~45° around the circle in twinkle-time.
      const tw  = (Math.sin(now / 320 + i * 0.78) + 1) / 2;   // 0..1
      if(tw < 0.15) continue;
      const size = 1 + tw * 2.5;
      g.globalAlpha = tw;
      g.fillStyle = '#ffffff';
      g.fillRect(sx - size/2, sy - 0.5, size, 1);
      g.fillRect(sx - 0.5, sy - size/2, 1, size);
    }
    g.globalAlpha = 1;
    g.restore();
    g.shadowColor = '#ffea00'; g.shadowBlur = 22;   // restore for hull
  } else {
    g.shadowColor = skin.glow; g.shadowBlur = 14;
  }

  // Wing back-glow
  g.fillStyle = baseColor;
  g.globalAlpha = 0.25;
  g.beginPath();
  g.moveTo(-26, 14); g.lineTo(-12, 6); g.lineTo(-18, 22); g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(26, 14); g.lineTo(12, 6); g.lineTo(18, 22); g.closePath(); g.fill();
  g.globalAlpha = 1;

  // Hull
  const hull = g.createLinearGradient(0,-26,0,22);
  hull.addColorStop(0,'#ffffff');
  hull.addColorStop(0.3, baseColor);
  hull.addColorStop(1, skin.dark ? '#080820' : shade(baseColor,-0.5));
  g.fillStyle = hull;
  g.strokeStyle = skin.dark ? '#88aaff' : '#0a1a2a';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0,-26);
  g.lineTo(7,-10);
  g.lineTo(20, 8);
  g.lineTo(14, 18);
  g.lineTo(7, 14);
  g.lineTo(0, 22);
  g.lineTo(-7,14);
  g.lineTo(-14,18);
  g.lineTo(-20, 8);
  g.lineTo(-7,-10);
  g.closePath();
  g.fill(); g.stroke();

  // Wings
  g.fillStyle = shade(baseColor,-0.2);
  g.beginPath();
  g.moveTo(-7,-2); g.lineTo(-26, 12); g.lineTo(-18, 14); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke();
  g.beginPath();
  g.moveTo(7,-2); g.lineTo(26, 12); g.lineTo(18, 14); g.lineTo(7, 8); g.closePath(); g.fill(); g.stroke();

  // Cockpit
  const ck = g.createRadialGradient(0,-8,1,0,-8,9);
  ck.addColorStop(0,'#ffffff');
  ck.addColorStop(0.4, accent);
  ck.addColorStop(1, '#0a0a2a');
  g.fillStyle = ck;
  g.beginPath();
  g.ellipse(0,-8,5,9,0,0,Math.PI*2); g.fill();

  // Accent stripes
  g.fillStyle = accent;
  g.fillRect(-1.5,-22,3,8);
  g.fillRect(-12, 10, 3, 5);
  g.fillRect(9, 10, 3, 5);

  // Nose tip glow
  g.shadowBlur = 20;
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(0,-26,2.2,0,Math.PI*2); g.fill();

  if(p.inv && p.inv<10000 && Math.floor(now/60)%2===0){
    g.globalAlpha = 0.4;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0,-26); g.lineTo(20,8); g.lineTo(0,22); g.lineTo(-20,8); g.closePath();
    g.fill();
    g.globalAlpha = 1;
  }

  g.restore();

  // AI nameplate
  if(p.isAi){
    g.save();
    g.font = 'bold 11px monospace';
    g.textAlign = 'center';
    g.fillStyle = '#ff66cc';
    g.shadowColor = '#ff00cc'; g.shadowBlur = 6;
    g.fillText('▼ ENEMY AI', p.x, p.y - 36);
    g.restore();
  }
}
function shade(hex, p){
  if(hex.startsWith('hsl')) return hex;
  const c = hex.replace('#','');
  const n = parseInt(c.length===3 ? c.split('').map(x=>x+x).join('') : c, 16);
  let r = (n>>16)&255, g=(n>>8)&255, b=n&255;
  if(p<0){ r=Math.max(0,r*(1+p)); g=Math.max(0,g*(1+p)); b=Math.max(0,b*(1+p)); }
  else { r=Math.min(255,r+(255-r)*p); g=Math.min(255,g+(255-g)*p); b=Math.min(255,b+(255-b)*p); }
  return '#'+[r,g,b].map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
}

