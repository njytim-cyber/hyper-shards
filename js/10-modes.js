'use strict';
// ============================================================
// PVP MODE (You vs AI)
// ============================================================
const AI_DIFF = {
  easy:   { reaction:600, accuracy:0.8, dodge:0.4, speed:0.85, fireMul:1.4 },
  medium: { reaction:300, accuracy:0.5, dodge:0.7, speed:1.0,  fireMul:1.0 },
  hard:   { reaction:130, accuracy:0.2, dodge:0.95,speed:1.15, fireMul:0.7 },
};
function startPvp(diff){
  state.mode = 'pvp';
  state.diff = 'medium'; // pvp uses its own diff config
  state.pvpDiff = diff;
  state.pvpYou = 0; state.pvpAi = 0; state.pvpRound = 1;
  state.phase = 'pvp';
  state.enemies = []; state.bullets = []; state.ebullets = []; state.particles = []; state.powerups = []; state.shards = [];
  state.boss = null; state.earnedThisRun = 0; state.weaponIdx = 0;
  state.fx = {rapid:0,dmg:0,slow:0};
  if(typeof resetKeys==='function') resetKeys();
  document.getElementById('youScore').textContent = 0;
  document.getElementById('aiScore').textContent = 0;
  document.getElementById('pvpRound').textContent = `FIRST TO ${state.pvpTarget}`;
  spawnPvpFighters();
  hideOverlay();
  hideHUD();
  showHUD(true);
}
function spawnPvpFighters(){
  player = makePlayer({x:W/2, y:H-120, maxHp: 4 + save.upgrades.hp, facing:-Math.PI/2});
  const cfg = AI_DIFF[state.pvpDiff];
  const aiSkin = SKINS.find(s=>s.id==='crimson');
  state.ai = {
    x:W/2, y:120, vx:0, vy:0,
    hp: player.maxHp, maxHp: player.maxHp,
    cd:0, inv:1500,
    skin: aiSkin,
    speedMul: cfg.speed, dmgMul:1, fireMul: cfg.fireMul,
    multishot:0, magnet:0,
    boostFuel:100, thrust:0,
    facing: Math.PI/2,
    isAi: true,
    ai: { state:'engage', tEnter:0, target:{x:W/2,y:H/2}, retargetCd:0 },
  };
  state.pvpRespawn = 0;
  // Spawn some asteroids as cover
  for(let i=0;i<5;i++){
    const a = spawnAsteroid(2);
    a.x = rand(120, W-120); a.y = rand(220, H-220);
    a.vx *= 0.3; a.vy = 0; a.dmg = 1;
    a.maxHp = a.hp;
    state.enemies.push(a);
  }
}
function updatePvp(dt){
  const slowMul = 1;
  // Player input
  const sp = 0.55*player.speedMul;
  let ax=0, ay=0;
  if(keys['a']||keys['arrowleft']) ax -= sp;
  if(keys['d']||keys['arrowright']) ax += sp;
  if(keys['w']||keys['arrowup']) ay -= sp*0.85;
  if(keys['s']||keys['arrowdown']) ay += sp*0.85;
  let bm = 1;
  if(keys['shift'] && player.boostFuel>0 && (ax||ay)){
    bm = 1.7; player.boostFuel = Math.max(0, player.boostFuel - dt*0.06);
  } else { player.boostFuel = Math.min(100, player.boostFuel + dt*0.02); }
  player.vx += ax*dt*0.04*bm; player.vy += ay*dt*0.04*bm;
  const damp = Math.pow(0.86, dt/16);
  player.vx *= damp; player.vy *= damp;
  if(!ax && Math.abs(player.vx) < 0.05) player.vx = 0;
  if(!ay && Math.abs(player.vy) < 0.05) player.vy = 0;
  player.x += player.vx; player.y += player.vy;
  player.x = Math.max(20, Math.min(W-20, player.x));
  player.y = Math.max(20, Math.min(H-20, player.y));
  player.thrust = (ax||ay) ? Math.min(1,player.thrust+0.1):Math.max(0,player.thrust-0.05);
  // face the AI
  player.facing = Math.atan2(state.ai.y-player.y, state.ai.x-player.x);
  if(keys[' ']) fire(player, curWeapon(), {shooter:'player'});
  if(player.cd>0) player.cd -= dt;
  if(player.inv>0) player.inv -= dt;

  // AI
  updateAI(dt);

  // Asteroids drift
  for(const e of state.enemies){
    if(e.type==='asteroid'){
      e.x += e.vx; e.y += e.vy;
      e.rot += e.vr;
      if(e.x<60||e.x>W-60) e.vx*=-1;
      if(e.y<60||e.y>H-60) e.vy = -e.vy;
    }
  }

  // Bullets
  for(const b of state.bullets){
    if(b.wave){ b.t+=dt; b.x += b.vx + Math.sin(b.t/80)*1.2; b.y += b.vy; }
    else { b.x+=b.vx; b.y+=b.vy; }
    b.life -= dt*0.06;
  }
  for(const b of state.ebullets){ b.x += b.vx; b.y += b.vy; b.life -= dt*0.06; }
  state.bullets = state.bullets.filter(b=> b.x>-30&&b.x<W+30&&b.y>-30&&b.y<H+30&&b.life>0);
  state.ebullets = state.ebullets.filter(b=> b.x>-30&&b.x<W+30&&b.y>-30&&b.y<H+30&&b.life>0);

  // Player bullets hit AI
  for(const b of state.bullets){
    // also can hit asteroids
    for(const e of state.enemies){
      if(e.type==='asteroid' && Math.hypot(b.x-e.x,b.y-e.y)<e.r){
        e.hp -= b.dmg; explode(b.x,b.y,b.col,4);
        if(!b.big) b.life = 0; else b.dmg *= 0.6;
      }
    }
    if(state.ai.inv<=0 && Math.hypot(b.x-state.ai.x,b.y-state.ai.y)<20){
      state.ai.hp -= b.dmg;
      explode(b.x,b.y,b.col,8);
      if(!b.big) b.life = 0; else b.dmg *= 0.6;
      if(state.ai.hp<=0 && state.pvpRespawn===0){
        explode(state.ai.x,state.ai.y,state.ai.skin.glow,60,2);
        state.shake = 14;
        state.pvpYou++;
        document.getElementById('youScore').textContent = state.pvpYou;
        if(state.pvpYou>=state.pvpTarget) endPvp(true);
        else state.pvpRespawn = 1500;
      }
    }
  }
  // AI bullets hit Player
  for(const b of state.ebullets){
    for(const e of state.enemies){
      if(e.type==='asteroid' && Math.hypot(b.x-e.x,b.y-e.y)<e.r){
        e.hp -= b.dmg; explode(b.x,b.y,b.col,3); b.life=0;
      }
    }
    if(player.inv<=0 && Math.hypot(b.x-player.x,b.y-player.y)<20){
      damagePlayerPvp(b.dmg);
      explode(b.x,b.y,b.col,8); b.life=0;
    }
  }

  // dead asteroids respawn occasionally
  for(const e of state.enemies) if(e.hp<=0){ explode(e.x,e.y,'#aa9988',16); }
  state.enemies = state.enemies.filter(e=>e.hp>0);
  if(Math.random()<0.005 && state.enemies.length<6){
    const a = spawnAsteroid(2); a.x = rand(120,W-120); a.y = rand(120,H-120); a.vx*=0.3; a.vy=rand(-0.4,0.4); a.maxHp=a.hp;
    state.enemies.push(a);
  }

  // Respawn AI
  if(state.pvpRespawn>0){
    state.pvpRespawn -= dt;
    if(state.pvpRespawn<=0){
      state.ai.x = rand(120, W-120); state.ai.y = 120;
      state.ai.vx = state.ai.vy = 0;
      state.ai.hp = state.ai.maxHp; state.ai.inv = 1500;
    }
  }

  // particles
  for(const p of state.particles){
    p.x+=p.vx; p.y+=p.vy;
    p.vx*=0.97; p.vy=p.vy*0.97+0.02;
    p.life -= 1;
  }
  state.particles = state.particles.filter(p=>p.life>0);
  for(const s of state.stars){ s.y += s.z * 0.6; if(s.y>H){ s.y=0; s.x=Math.random()*W; } }
  if(state.shake>0) state.shake = Math.max(0, state.shake-0.6);
}
function damagePlayerPvp(dmg){
  if(player.inv>0) return;
  player.hp -= dmg;
  player.inv = 900;
  state.shake = Math.max(state.shake,10);
  if(player.hp<=0){
    explode(player.x,player.y,player.skin.glow,60,2);
    state.shake = 14;
    state.pvpAi++;
    document.getElementById('aiScore').textContent = state.pvpAi;
    if(state.pvpAi>=state.pvpTarget) endPvp(false);
    else {
      // respawn player
      setTimeout(()=>{
        player.x = rand(120, W-120); player.y = H-120;
        player.vx = player.vy = 0;
        player.hp = player.maxHp; player.inv = 1500;
      }, 800);
    }
  }
}
function updateAI(dt){
  const a = state.ai;
  if(state.pvpRespawn>0) return;
  a.t = (a.t||0) + dt;
  const cfg = AI_DIFF[state.pvpDiff];
  a.ai.retargetCd -= dt;
  // Avoid bullets nearby
  let dodgeX=0, dodgeY=0;
  for(const b of state.bullets){
    const dx = a.x-b.x, dy = a.y-b.y;
    const d = Math.hypot(dx,dy);
    if(d<140){
      const w = (140-d)/140 * cfg.dodge;
      dodgeX += dx/d*w; dodgeY += dy/d*w;
    }
  }
  // Move: maintain distance ~280 from player, strafe
  const dx = player.x-a.x, dy = player.y-a.y;
  const dist = Math.hypot(dx,dy);
  const ideal = 280;
  let mx=0, my=0;
  if(dist > ideal+30){ mx += dx/dist; my += dy/dist; }
  else if(dist < ideal-30){ mx -= dx/dist; my -= dy/dist; }
  // strafe
  const tang = Math.sin(a.t/700);
  mx += -dy/dist * tang * 0.8;
  my +=  dx/dist * tang * 0.8;
  mx += dodgeX; my += dodgeY;
  // borders
  if(a.x<80) mx += 0.6; if(a.x>W-80) mx -= 0.6;
  if(a.y<80) my += 0.6; if(a.y>H-80) my -= 0.6;
  // apply
  const sp = 0.5*cfg.speed;
  a.vx += mx*sp*dt*0.04;
  a.vy += my*sp*dt*0.04;
  a.vx *= 0.88; a.vy *= 0.88;
  a.x += a.vx; a.y += a.vy;
  a.x = Math.max(20,Math.min(W-20,a.x));
  a.y = Math.max(20,Math.min(H-20,a.y));
  a.thrust = Math.min(1, Math.hypot(mx,my)*0.6);

  // Aim with prediction + accuracy noise
  const lead = dist/12;
  const aimX = player.x + player.vx*lead;
  const aimY = player.y + player.vy*lead;
  let face = Math.atan2(aimY-a.y, aimX-a.x);
  face += (Math.random()-0.5)*cfg.accuracy;
  a.facing = face;

  // Fire
  a.cd -= dt;
  if(a.cd<=0 && state.pvpRespawn<=0 && a.inv<200){
    fire(a, WEAPONS[0], {shooter:'ai'}); // AI uses plasma
    a.cd = 280*cfg.fireMul;
  }
  if(a.inv>0) a.inv -= dt;
}
function endPvp(youWon){
  state.phase = 'pvpover';
  const reward = youWon ? 200 : 50;
  save.credits += reward;
  state.earnedThisRun = reward;
  persist();
  setTimeout(()=>{
    document.getElementById('matchTitle').textContent = youWon ? 'VICTORY' : 'DEFEAT';
    document.getElementById('matchSummary').textContent = `${state.pvpYou} - ${state.pvpAi}`;
    document.getElementById('matchEarn').textContent = `+${reward} ◈ shards earned`;
    showMenu('menuMatch');
    hideHUD();
  }, 800);
}

// ============================================================
// TUTORIAL
// ============================================================
const TUT_STEPS = [
  { caption:'Welcome, pilot. Press <span class="key">A</span>/<span class="key">D</span> to strafe left/right.',
    check: ()=> tutMoved.lr },
  { caption:'Now press <span class="key">W</span>/<span class="key">S</span> for forward thrust.',
    check: ()=> tutMoved.ud },
  { caption:'Hold <span class="key">SHIFT</span> to boost when you need to dodge fast.',
    check: ()=> player.boostFuel < 90 },
  { caption:'Press <span class="key">SPACE</span> to fire your weapon. Try shooting!',
    check: ()=> tutBulletsFired >= 5 },
  { caption:'Press <span class="key">C</span> to cycle weapons (Plasma, Spread, Pulse, Railgun, Wave).',
    check: ()=> tutWeaponSwitched },
  { caption:'Now destroy this asteroid for ◈ shards.',
    setup: ()=>{ const a = spawnAsteroid(1); a.x=W/2; a.y=120; a.vx=0; a.vy=0.3; a.maxHp=a.hp; state.enemies.push(a); },
    check: ()=> tutEnemiesKilled >= 1 },
  { caption:'Walk over the ◈ shards to collect them — your magnet pulls them in.',
    check: ()=> tutShardsCollected >= 1 },
  { caption:'UFOs shoot back. Take this one out!',
    setup: ()=>{ const u = spawnUFO(1); u.x=W/2; u.y=120; u.cd=2000; u.maxHp=u.hp; state.enemies.push(u); },
    check: ()=> tutEnemiesKilled >= 2 },
  { caption:'Powerups boost you temporarily. Grab one!',
    setup: ()=>{ state.powerups.push({x:W/2,y:80,vy:0.6,kind:'rapid',t:0}); },
    check: ()=> tutPowerupsTaken >= 1 },
  { caption:'Tutorial complete! Press <span class="key">SPACE</span> to return to the menu.',
    check: ()=> tutDone },
];
let tutMoved={lr:false,ud:false}, tutBulletsFired=0, tutWeaponSwitched=false, tutEnemiesKilled=0, tutShardsCollected=0, tutPowerupsTaken=0, tutDone=false;

function startTutorial(){
  state.mode='tutorial'; state.phase='tutorial';
  state.diff='easy';
  Object.assign(state, {
    enemies:[], bullets:[], ebullets:[], particles:[], shards:[], powerups:[], boss:null,
    score:0, earnedThisRun:0, weaponIdx:0, fx:{rapid:0,dmg:0,slow:0}
  });
  if(typeof resetKeys==='function') resetKeys();
  player = makePlayer({maxHp:6});
  player.inv = 99999; // invincible during tutorial
  tutMoved={lr:false,ud:false}; tutBulletsFired=0; tutWeaponSwitched=false; tutEnemiesKilled=0; tutShardsCollected=0; tutPowerupsTaken=0; tutDone=false;
  state.tut = { idx:0 };
  hideOverlay(); showHUD(false);
  showTutCaption();
  if(TUT_STEPS[0].setup) TUT_STEPS[0].setup();
  _ensureTutPoll();
}
function showTutCaption(){
  const c = document.getElementById('tutCaption');
  const step = TUT_STEPS[state.tut.idx];
  if(!step){ c.style.display='none'; return; }
  c.innerHTML = `<div>${step.caption}</div><span class="next">▼ continue automatically</span>`;
  c.style.display = 'block';
}
function tutAdvance(){
  if(!state.tut) return;
  if(state.tut.idx >= TUT_STEPS.length-1 && tutDone){
    state.phase='menu'; state.tut=null; hideHUD();
    showMenu('menuMain'); return;
  }
}
// hooks for tutorial
function tutOnEnemyKilled(e){ tutEnemiesKilled++; }
function tutOnShardCollected(){ tutShardsCollected++; }
function tutOnPowerupTaken(){ tutPowerupsTaken++; }
// Tutorial polling — only active when in tutorial phase
let lastBulletCount = 0;
function tutPoll(){
  if(state.phase!=='tutorial' || !state.tut){
    // Self-clean when we've left the tutorial — no caller needed.
    if(_tutPollTimer){ clearInterval(_tutPollTimer); _tutPollTimer = null; }
    return;
  }
  if(keys['a']||keys['d']||keys['arrowleft']||keys['arrowright']) tutMoved.lr=true;
  if(keys['w']||keys['s']||keys['arrowup']||keys['arrowdown']) tutMoved.ud=true;
  const cur = state.bullets.length;
  if(cur > lastBulletCount) tutBulletsFired += (cur-lastBulletCount);
  lastBulletCount = cur;
  const step = TUT_STEPS[state.tut.idx];
  if(step && step.check && step.check()){
    state.tut.idx++;
    if(state.tut.idx>=TUT_STEPS.length){ tutDone = true; state.tut.idx = TUT_STEPS.length-1; }
    const next = TUT_STEPS[state.tut.idx];
    if(next && next.setup) next.setup();
    showTutCaption();
    if(state.tut.idx === TUT_STEPS.length-1) tutDone = true;
  }
}
// Tutorial polling timer — gated on the tutorial phase. Idle savings of
// ~6 wakeups/sec while the player is in any other mode (menu, survival,
// boss arena, pvp). Started by startTutorial; cleared on phase exit.
let _tutPollTimer = null;
function _ensureTutPoll(){
  if(state && state.phase==='tutorial'){
    if(!_tutPollTimer) _tutPollTimer = setInterval(tutPoll, 150);
  } else if(_tutPollTimer){
    clearInterval(_tutPollTimer); _tutPollTimer = null;
  }
}
// Run once on boot in case we ever land in tutorial phase from a saved
// state. Otherwise only triggered by phase transitions in startTutorial
// (and the showMenu hook below).
_ensureTutPoll();
// hook weapon cycle
const origCycle = cycleWeapon;
window._cycleHook = ()=>{ if(state.phase==='tutorial') tutWeaponSwitched = true; };
const _cw = cycleWeapon;
cycleWeapon = function(){ _cw(); if(state.phase==='tutorial') tutWeaponSwitched = true; };

