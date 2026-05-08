'use strict';

// ============================================================
// CORE UPDATE (shared between survival + tutorial)
// ============================================================
function update(dt){
  // Player movement
  const sp = 0.55*player.speedMul;
  let ax = 0, ay = 0;
  if(keys['a']||keys['arrowleft']) ax -= sp;
  if(keys['d']||keys['arrowright']) ax += sp;
  if(keys['w']||keys['arrowup']) ay -= sp*0.8;
  if(keys['s']||keys['arrowdown']) ay += sp*0.8;
  let boostMul = 1;
  const boostMax = 100 + 25*save.upgrades.boost;
  const boostRegen = 0.02*(1 + 0.25*save.upgrades.boost);
  if(player.boostFuel === undefined) player.boostFuel = boostMax;
  if(keys['shift'] && player.boostFuel>0 && (ax||ay)){
    boostMul = 1.85;
    player.boostFuel = Math.max(0, player.boostFuel - dt*0.06);
  } else {
    player.boostFuel = Math.min(boostMax, player.boostFuel + dt*boostRegen);
  }
  player.vx += ax*dt*0.04*boostMul;
  player.vy += ay*dt*0.04*boostMul;
  // dt-scaled damping: at 60fps (dt~16) reproduces the old 0.86/frame feel,
  // but stays consistent at 30fps / 120fps instead of glide-stretching.
  const damp = Math.pow(0.86, dt/16);
  player.vx *= damp; player.vy *= damp;
  // Velocity floor: residual drift below this threshold snaps to zero so
  // the ship doesn't asymptotically creep across the screen with no input.
  if(!ax && Math.abs(player.vx) < 0.05) player.vx = 0;
  if(!ay && Math.abs(player.vy) < 0.05) player.vy = 0;
  player.x += player.vx; player.y += player.vy;
  player.x = Math.max(20, Math.min(W-20, player.x));
  player.y = Math.max(20, Math.min(H-20, player.y));
  player.thrust = (ax||ay) ? Math.min(1,player.thrust+0.1):Math.max(0,player.thrust-0.05);
  // Natural facing: smooth angular lerp toward current velocity direction.
  const vmag = Math.hypot(player.vx, player.vy);
  if(vmag > 0.25){
    const target = Math.atan2(player.vy, player.vx);
    let diff = target - player.facing;
    while(diff >  Math.PI) diff -= 2*Math.PI;
    while(diff < -Math.PI) diff += 2*Math.PI;
    player.facing += diff * 0.18;
  }
  state.travel = (state.travel||0) + vmag;

  if(keys[' ']) fire(player, curWeapon());
  if(player.cd>0) player.cd -= dt;
  if(player.inv>0) player.inv -= dt;
  if(player.abilityCd>0) player.abilityCd -= dt;
  if(player.fxBerserk>0) player.fxBerserk -= dt;
  if(player.fxFlame>0)   player.fxFlame -= dt;
  if(player.fxCloak>0)   player.fxCloak -= dt;

  // Flame trail damage zone
  if(player.fxFlame>0){
    if((player._flameT=(player._flameT||0)+dt) > 80){
      player._flameT = 0;
      state.particles.push({x:player.x,y:player.y,vx:rand(-1,1),vy:rand(-1,1),life:40,col:'#ff6600',size:5});
    }
    for(const e of state.enemies){
      if(Math.hypot(e.x-player.x,e.y-player.y)<60){ e.hp -= dt*0.04; }
    }
  }
  // Acid cloud
  if(state.acidCloud){
    const ac = state.acidCloud;
    ac.life -= dt; ac.t += dt;
    for(const e of state.enemies){
      if(Math.hypot(e.x-ac.x,e.y-ac.y)<ac.r){ e.hp -= dt*0.05; }
    }
    if(ac.life<=0) state.acidCloud = null;
  }
  // Black hole
  if(state.blackHole){
    const bh = state.blackHole;
    bh.life -= dt; bh.t += dt;
    for(const e of state.enemies){
      const dx=bh.x-e.x, dy=bh.y-e.y, d=Math.hypot(dx,dy);
      if(d<400){ e.vx += dx/d*0.4; e.vy += dy/d*0.4; if(d<40) e.hp -= dt*0.08; }
    }
    if(state.boss){
      const dx=bh.x-state.boss.x, dy=bh.y-state.boss.y, d=Math.hypot(dx,dy);
      if(d<400){ state.boss.x += dx/d*0.6; state.boss.y += dy/d*0.6; }
    }
    if(bh.life<=0) state.blackHole = null;
  }
  // Beam
  if(state.beam){ state.beam.life -= dt; state.beam.t += dt; if(state.beam.life<=0) state.beam = null; }
  // Void wells (from VOID CANNON)
  if(state.voidWells && state.voidWells.length){
    for(const v of state.voidWells){
      v.life -= dt; v.t += dt;
      for(const e of state.enemies){
        const dxv = v.x-e.x, dyv = v.y-e.y, dd = Math.hypot(dxv,dyv);
        if(dd < v.r){
          const f = (1 - dd/v.r) * 0.5;
          e.vx += dxv/dd*f; e.vy += dyv/dd*f;
          if(dd < 30) e.hp -= dt*0.06;
        }
      }
      if(state.boss){
        const dxv = v.x-state.boss.x, dyv = v.y-state.boss.y, dd = Math.hypot(dxv,dyv);
        if(dd < v.r){ state.boss.x += dxv/dd*0.3; state.boss.y += dyv/dd*0.3; }
      }
    }
    state.voidWells = state.voidWells.filter(v=>v.life>0);
  }
  // Solar sun damage tick
  if(state.solarSun){
    state.solarSun.life -= dt; state.solarSun.t += dt;
    for(const e of state.enemies){ if(Math.hypot(e.x-state.solarSun.x,e.y-state.solarSun.y)<120){ e.hp -= dt*0.05; } }
    if(state.solarSun.life<=0) state.solarSun = null;
  }
  // Drone swarm
  if(state.drones){
    for(const dr of state.drones){
      dr.life -= dt; dr.t += dt;
      const ang = dr.t/200 + dr.phase*1.2;
      dr.dx = player.x + Math.cos(ang)*60;
      dr.dy = player.y + Math.sin(ang)*60;
      dr.cd = (dr.cd||0) - dt;
      if(dr.cd<=0){
        dr.cd = 400;
        // find nearest enemy to shoot
        let target=null, bestD=400;
        for(const e of state.enemies){ const d = Math.hypot(e.x-dr.dx,e.y-dr.dy); if(d<bestD){ bestD=d; target=e; } }
        if(target){
          const dxx=target.x-dr.dx, dyy=target.y-dr.dy, m=Math.hypot(dxx,dyy)||1;
          const b = B(dr.dx,dr.dy,dxx/m*9,dyy/m*9,18,'#33ff88',3,false);
          b.shooter='player'; state.bullets.push(b);
        }
      }
    }
    state.drones = state.drones.filter(d=>d.life>0);
    if(state.drones.length===0) state.drones = null;
  }
  // Combat drone passive (special)
  if(save.specials.drone){
    state.passiveDroneT = (state.passiveDroneT||0) + dt;
    if(state.passiveDroneT > 600){
      state.passiveDroneT = 0;
      let target=null, bestD=380;
      for(const e of state.enemies){ const d = Math.hypot(e.x-player.x,e.y-player.y); if(d<bestD){ bestD=d; target=e; } }
      if(target){
        const dxx=target.x-player.x, dyy=target.y-player.y, m=Math.hypot(dxx,dyy)||1;
        const b = B(player.x+30,player.y,dxx/m*8,dyy/m*8,12,'#00aaff',3,false);
        b.shooter='player'; state.bullets.push(b);
      }
    }
  }
  // Decoy
  if(state.decoy){ state.decoy.life -= dt; if(state.decoy.life<=0) state.decoy = null; }
  // Frozen enemies
  for(const e of state.enemies){ if(e.frozen>0){ e.frozen-=dt; e.vx*=0.92; e.vy*=0.92; } }

  // Hp regen (1 per (12s/level))
  if(player.regen>0 && player.hp<player.maxHp){
    player.regenAcc += dt*player.regen;
    if(player.regenAcc >= 12000){
      player.regenAcc = 0;
      player.hp = Math.min(player.maxHp, player.hp+1);
    }
  }

  // Spawning
  state.spawnTimer -= dt;
  const r = state.round;
  if(state.phase==='play'){
    if(!state.boss){
      // continuous spawn while traveling
      if(state.spawnTimer<=0){
        // Early rounds: slow spawns, mostly asteroids
        const baseDelay = r<=2 ? 1400 : r<=4 ? 1000 : 800;
        state.spawnTimer = Math.max(300, baseDelay - r*25 - Math.random()*200);
        const roll = Math.random();
        let e;
        const ufoChance = r<=1 ? 0 : Math.min(0.4, 0.04 + r*0.03);
        const kamiChance = r>=4 ? Math.min(0.2, (r-3)*0.04) : 0;
        const mineChance = r>=5 ? Math.min(0.15, (r-4)*0.03) : 0;
        if(roll < kamiChance) e = spawnKamikaze(r);
        else if(roll < kamiChance+mineChance) e = spawnMine(r);
        else if(roll < kamiChance+mineChance+ufoChance) e = spawnUFO(r);
        else e = spawnAsteroid(r);
        e.maxHp = e.hp;
        state.enemies.push(e);
        state.spawnedThisRound++;
      }
      if(state.travel >= state.travelGoal){
        endRound(); return;
      }
    } else {
      updateBoss(dt);
      if(state.boss.hp<=0){
        const b = state.boss;
        explode(b.x,b.y,b.color,90,2.5);
        state.shake = 24;
        for(let i=0;i<40;i++){
          state.shards.push({x:b.x+rand(-40,40),y:b.y+rand(-40,40),vx:rand(-2,2),vy:rand(-3,1),val:5,life:600});
        }
        save.credits += 80 + b.tier*40;
        state.earnedThisRun += 80 + b.tier*40;
        state.score += 500 + b.tier*200;
        state.boss = null;
        document.getElementById('bossBar').style.display='none';
        if(typeof playMusicSting==='function') playMusicSting('victory');
        endRound(); return;
      }
    }
  }

  // Update enemies
  for(const e of state.enemies){
    if(e.type==='asteroid'){
      e.x += e.vx; e.y += e.vy;
      e.rot += e.vr;
      // wrap around
      if(e.x<-e.r-40) e.x = W+e.r;
      if(e.x>W+e.r+40) e.x = -e.r;
      if(e.y<-e.r-40) e.y = H+e.r;
      if(e.y>H+e.r+40) e.y = -e.r;
    } else if(e.type==='kamikaze'){
      e.t += dt;
      const dxk = player.x - e.x, dyk = player.y - e.y;
      const m = Math.hypot(dxk,dyk)||1;
      const sp = 2.5 + state.round*0.05;
      e.vx += dxk/m*0.15; e.vy += dyk/m*0.15;
      const v = Math.hypot(e.vx,e.vy);
      if(v>sp){ e.vx = e.vx/v*sp; e.vy = e.vy/v*sp; }
      e.x += e.vx; e.y += e.vy;
    } else if(e.type==='mine'){
      e.t += dt;
      e.armed = Math.max(0, e.armed - dt);
      e.x += e.vx; e.y += e.vy;
      e.vx *= 0.99; e.vy *= 0.99;
      if(e.x<30||e.x>W-30) e.vx*=-1;
      if(e.y<30||e.y>H-30) e.vy*=-1;
      // proximity detonate
      if(e.armed<=0 && Math.hypot(e.x-player.x,e.y-player.y) < 80){
        explode(e.x,e.y,'#ffaa00',60,3);
        abilityRadialDamage(e.x,e.y,120,40,'#ffaa00');
        if(Math.hypot(e.x-player.x,e.y-player.y)<60) damagePlayer(1);
        e.hp = -1; state.shake = Math.max(state.shake,12); sfx('boom');
      }
    } else if(e.type==='ufo'){
      e.t += dt;
      if(e.shield>0) e.shield -= dt;
      if(e.pattern==='sine'){
        e.x += e.vx + Math.cos(e.t/400+e.phase)*0.6;
      } else {
        e.x += e.vx;
        if(e.x<60||e.x>W-60) e.vx*=-1;
      }
      e.y = Math.min(e.y + e.vy*0.3, 60+Math.sin(e.t/600)*30+200);
      e.cd -= dt;
      if(e.cd<=0 && state.phase==='play' && !(e.frozen>0)){
        e.cd = (1100+Math.random()*600 - r*30) * DIFFICULTY[state.diff].fireRate;
        // target decoy if active, else player (unless cloaked)
        let tx = player.x, ty = player.y;
        if(state.decoy){ tx = state.decoy.x; ty = state.decoy.y; }
        else if(player.fxCloak>0){ tx = player.x + rand(-300,300); ty = player.y + rand(-300,300); }
        const dx = tx-e.x, dy=ty-e.y;
        const m = Math.hypot(dx,dy)||1;
        state.ebullets.push({x:e.x,y:e.y+18,vx:dx/m*5,vy:dy/m*5,r:5,col:'#ff5577',dmg:1,life:300,shooter:'enemy'});
      }
    }
  }

  // Bullets
  for(const b of state.bullets){
    if(b.wave){ b.t+=dt; b.x += b.vx + Math.sin(b.t/80)*1.2; b.y += b.vy; }
    else { b.x+=b.vx; b.y+=b.vy; }
    b.life -= dt*0.06;
    // Cluster pod fuse: split into 6 micro-missiles after fuse expires
    if(b.cluster){
      b.fuse -= dt;
      if(b.fuse<=0){
        clusterSplit(b);
        b.life = 0;
      }
    }
  }
  state.bullets = state.bullets.filter(b=> b.y>-30 && b.y<H+30 && b.x>-30 && b.x<W+30 && b.life>0);
  for(const b of state.ebullets){ b.x += b.vx; b.y += b.vy; b.life -= dt*0.06; }
  state.ebullets = state.ebullets.filter(b => b.x>-30&&b.x<W+30&&b.y>-30&&b.y<H+30&&b.life>0);

  // Bullet hit enemy / boss
  for(const b of state.bullets){
    if(state.boss){
      if(Math.hypot(b.x-state.boss.x,b.y-state.boss.y) < state.boss.r){
        state.boss.hp -= b.dmg;
        explode(b.x,b.y,b.col,4);
        if(b.cluster){ clusterSplit(b); b.life = 0; }
        else if(b.void){ spawnVoidWell(b.x,b.y); b.life = 0; }
        else if(b.shock){ chainLightning(state.boss, b.dmg, [state.boss]); b.life = 0; }
        else if(!b.big) b.life = 0; else b.dmg *= 0.6;
        state.score += 2;
      }
    }
    for(const e of state.enemies){
      if(Math.hypot(b.x-e.x,b.y-e.y) < e.r){
        let dmg = b.dmg;
        // shielded UFO: half damage until shield breaks
        if(e.type==='ufo' && e.shield>0){ dmg *= 0.5; if(b.dmg>=20) e.shield = 0; }
        // crit upgrade
        if(save.upgrades.crit>0 && Math.random() < save.upgrades.crit*0.08) { dmg *= 2; explode(e.x,e.y,'#ffea00',8); }
        e.hp -= dmg;
        explode(b.x,b.y,b.col,5);
        // Special weapon on-hit
        if(b.cluster){ clusterSplit(b); b.life = 0; }
        else if(b.void){ spawnVoidWell(b.x,b.y); b.life = 0; }
        else if(b.shock){ chainLightning(e, b.dmg, [e]); b.life = 0; }
        else if(b.big){ b.dmg *= 0.6; }
        else if((b.pierceLeft||0) > 0) { b.pierceLeft--; }
        else b.life = 0;
        state.score += 1;
        sfx('hit');
      }
    }
  }

  // Enemy bullet hits player
  for(const b of state.ebullets){
    if(Math.hypot(b.x-player.x,b.y-player.y) < 18 && player.inv<=0){
      damagePlayer(b.dmg);
      explode(b.x,b.y,b.col,8);
      b.life = 0;
    }
  }

  // Enemy ram damage
  for(const e of state.enemies){
    if(player.inv<=0 && Math.hypot(e.x-player.x,e.y-player.y) < e.r+18){
      damagePlayer(e.dmg);
      e.hp -= 25;
      explode(player.x,player.y,'#ff5577',12);
      const ang = Math.atan2(player.y-e.y,player.x-e.x);
      player.vx += Math.cos(ang)*4;
      player.vy += Math.sin(ang)*4;
    }
  }
  if(state.boss){
    const bs = state.boss;
    if(player.inv<=0 && Math.hypot(bs.x-player.x,bs.y-player.y)<bs.r+18){
      damagePlayer(1);
      const ang = Math.atan2(player.y-bs.y,player.x-bs.x);
      player.vx += Math.cos(ang)*6;
      player.vy += Math.sin(ang)*6;
    }
  }

  // Dead enemies => shards
  for(const e of state.enemies){
    if(e.hp<=0){
      explode(e.x,e.y,e.color||'#ffaa66',Math.min(40, 12 + e.r/2));
      state.shake = Math.max(state.shake, e.r/8);
      const baseScore = e.type==='ufo' ? 40 : 15;
      state.score += baseScore;
      comboKill(baseScore);
      sfx(e.r>40?'boom':'kill');
      if(e.r>40) state.hitStop = 30;
      // splitter asteroid: spawns smaller chunks
      if(e.type==='asteroid' && e.r>32 && !e.split){
        for(let i=0;i<2;i++){
          const ang = Math.random()*Math.PI*2;
          const a = spawnAsteroid(state.round);
          a.x = e.x; a.y = e.y; a.r = e.r*0.55;
          a.vx = Math.cos(ang)*1.5; a.vy = Math.sin(ang)*1.5;
          a.hp = Math.ceil(e.maxHp*0.4); a.maxHp = a.hp;
          a.pts = genAsteroidPts(a.r);
          a.split = true;
          state.enemies.push(a);
        }
      }
      // lifesteal proc
      if(player && save.upgrades.lifesteal>0 && Math.random() < save.upgrades.lifesteal*0.03){
        if(player.hp < player.maxHp){ player.hp = Math.min(player.maxHp, player.hp+1); toast('+1 HP'); }
      }
      const drops = e.type==='ufo' ? 4 : (e.shardVal||2);
      for(let i=0;i<drops;i++){
        state.shards.push({x:e.x,y:e.y,vx:rand(-2,2),vy:rand(-3,1),val:1,life:600});
      }
      const luckMul = 1 + 0.05*save.upgrades.luck;
      if(Math.random() < 0.10*luckMul && state.phase==='play'){
        const k = POWERUP_KINDS[(Math.random()*POWERUP_KINDS.length)|0];
        state.powerups.push({x:e.x,y:e.y,vy:0.7,kind:k,t:0});
      }
      if(state.phase==='tutorial' && state.tut) tutOnEnemyKilled(e);
    }
  }
  state.enemies = state.enemies.filter(e=>e.hp>0);

  // Shards (magnet)
  for(const s of state.shards){
    s.life -= dt*0.06; s.vy += 0.04;
    s.vx *= 0.99; s.vy *= 0.995;
    const dx = player.x - s.x, dy = player.y - s.y;
    const d = Math.hypot(dx,dy);
    const magR = save.specials.magnetMax ? 99999 : player.magnet;
    if(d < magR){
      const f = save.specials.magnetMax ? 0.3 : (1 - d/player.magnet)*0.6;
      s.vx += dx/d*f; s.vy += dy/d*f;
    }
    s.x += s.vx; s.y += s.vy;
    if(d < 22){
      const xpMul = save.specials.doubleXP ? 1.5 : 1;
      const v = Math.round(s.val*xpMul);
      save.credits += v;
      state.earnedThisRun += v;
      state.score += v*5;
      s.life = 0;
      explode(s.x,s.y,'#ffea00',5,0.5);
      sfx('shard');
      if(state.phase==='tutorial' && state.tut) tutOnShardCollected();
    }
  }
  state.shards = state.shards.filter(s=>s.life>0 && s.y<H+30);

  // Powerups
  for(const p of state.powerups){
    p.y += p.vy; p.t += dt;
    if(Math.hypot(p.x-player.x,p.y-player.y)<24){
      applyPowerup(p.kind);
      sfx('power');
      p.dead = true;
      if(state.phase==='tutorial' && state.tut) tutOnPowerupTaken();
    }
  }
  state.powerups = state.powerups.filter(p=>!p.dead && p.y<H+30);

  // Particles — capped to keep mobile/tablet fillrate sane during heavy
  // boss fights. Without the cap, ability spawns + flame trails + shard
  // bursts can stack to 1000+ particles and tank framerate. Drop oldest
  // first since they're already the most faded visually.
  for(const p of state.particles){
    p.x+=p.vx; p.y+=p.vy;
    p.vx*=0.97; p.vy=p.vy*0.97+0.02;
    p.life -= 1;
  }
  state.particles = state.particles.filter(p=>p.life>0);
  // Three-tier caps: phones (smallest, fillrate-starved), tablets
  // (slightly more headroom), desktop (full). iPads in landscape were
  // hitting the desktop cap and visibly chugging during boss fights.
  const PARTICLE_CAP = IS_PHONE ? 120 : (IS_TABLET ? 180 : 250);
  if(state.particles.length > PARTICLE_CAP)
    state.particles.splice(0, state.particles.length - PARTICLE_CAP);
  const SHARD_CAP = IS_PHONE ? 80 : (IS_TABLET ? 130 : 200);
  if(state.shards.length > SHARD_CAP)
    state.shards.splice(0, state.shards.length - SHARD_CAP);

  // Stars — on touch the offscreen starfield in render() handles scroll
  // via drawImage, so per-star y mutation is wasted work. Skip it.
  if(!LOW_FX){
    for(const s of state.stars){
      s.y += s.z * (1 + (player.thrust||0)*1.5);
      if(s.y>H){ s.y=0; s.x=Math.random()*W; }
    }
  }

  if(state.shake>0) state.shake = Math.max(0, state.shake-0.6);

  if(state.phase==='play'){
    persist();
  }
  updateHud();
}

let _hudCache = { hp:-1, maxHp:-1, score:-1, credits:-1, ammo:'', round:'', skinId:'', abilityName:'', abilityPct:-1, fxKey:'', fxBarHTML:'' };
let _hudThrottle = 0;
// Cached DOM nodes — getElementById in a 15Hz HUD path is cheap-but-not-
// free (~0.05ms each on midrange hardware × 8 nodes × 15Hz = ~6ms/sec
// that we just give back to the game loop on tablets).
let _hudEls = null;
function _ensureHudEls(){
  if(_hudEls) return _hudEls;
  _hudEls = {
    hearts: document.getElementById('hearts'),
    score:  document.getElementById('scoreTxt'),
    credits:document.getElementById('creditsTxt'),
    ammo:   document.getElementById('ammoTxt'),
    round:  document.getElementById('roundTxt'),
    bossHp: document.getElementById('bossHp'),
    fxBar:  document.getElementById('fxBar'),
    abName: document.getElementById('abilityName'),
    abBar:  document.getElementById('abilityBar'),
  };
  return _hudEls;
}
function updateHud(){
  if(!player) return;
  // Throttle DOM writes to ~15Hz
  const now = performance.now();
  if(now - _hudThrottle < 60) return;
  _hudThrottle = now;
  const $ = _ensureHudEls();

  // Hearts — only rebuild when hp/maxHp changes
  if(_hudCache.hp !== player.hp || _hudCache.maxHp !== player.maxHp){
    _hudCache.hp = player.hp; _hudCache.maxHp = player.maxHp;
    if($.hearts){
      let html = '';
      for(let i=0;i<player.maxHp;i++){
        const filled = i<player.hp;
        html += `<svg class="heart" viewBox="0 0 18 16" width="18" height="16"><path d="M9 14 C9 11 17 9 17 5 C17 2 13 1 9 4 C5 1 1 2 1 5 C1 9 9 11 9 14 Z" fill="${filled?'#ff3366':'#33203a'}" stroke="${filled?'#ffaaaa':'#552040'}" stroke-width="1"/>${filled?'<circle cx="6" cy="5" r="1.5" fill="#ffffff88"/>':''}</svg>`;
      }
      $.hearts.innerHTML = html;
    }
  }
  if(_hudCache.score !== state.score){ _hudCache.score = state.score; if($.score) $.score.textContent = state.score; }
  if(_hudCache.credits !== save.credits){ _hudCache.credits = save.credits; if($.credits) $.credits.textContent = save.credits; }
  const wn = curWeapon().name;
  if(_hudCache.ammo !== wn){ _hudCache.ammo = wn; if($.ammo) $.ammo.textContent = wn; }
  // travel progress
  if($.round && state.mode==='survival' && !state.boss && state.travelGoal && isFinite(state.travelGoal)){
    const pct = Math.min(100, (state.travel/state.travelGoal)*100);
    const newRound = `ROUND ${state.round} <span style="color:#7ea8d4;font-size:11px;">${pct.toFixed(0)}%</span>`;
    if(_hudCache.round !== newRound){ _hudCache.round = newRound; $.round.innerHTML = newRound; }
  }
  if(state.boss && $.bossHp){
    $.bossHp.style.width = Math.max(0,state.boss.hp)/state.boss.maxHp*100+'%';
  }
  // FX bar — build the full HTML string in a buffer then assign once.
  // Previous version did up to 8 sequential `innerHTML +=` writes per
  // tick, each forcing a parse+layout. Also dedupe-cached so an FX-free
  // HUD doesn't re-blank the element 15× per second.
  if($.fxBar){
    let fxHtml = '';
    if(player.inv>0 && player.inv<10000) fxHtml += `<span class="fx shield">SHIELD ${(player.inv/1000).toFixed(1)}s</span>`;
    if(state.fx.rapid>0) fxHtml += `<span class="fx rapid">RAPID ${(state.fx.rapid/1000).toFixed(1)}s</span>`;
    if(state.fx.dmg>0)   fxHtml += `<span class="fx dmg">×2 DMG ${(state.fx.dmg/1000).toFixed(1)}s</span>`;
    if(state.fx.slow>0)  fxHtml += `<span class="fx slow">SLOW ${(state.fx.slow/1000).toFixed(1)}s</span>`;
    if(player.fxBerserk>0) fxHtml += `<span class="fx dmg">BERSERK ${(player.fxBerserk/1000).toFixed(1)}s</span>`;
    if(player.fxFlame>0)   fxHtml += `<span class="fx dmg">FLAME ${(player.fxFlame/1000).toFixed(1)}s</span>`;
    if(player.fxCloak>0)   fxHtml += `<span class="fx slow">CLOAK ${(player.fxCloak/1000).toFixed(1)}s</span>`;
    if(_hudCache.fxBarHTML !== fxHtml){
      _hudCache.fxBarHTML = fxHtml;
      $.fxBar.innerHTML = fxHtml;
    }
  }
  // Ability cooldown display — only writes when name or % bucket changes.
  const ab = player.skin && player.skin.ability;
  if(ab && $.abName && $.abBar){
    if(_hudCache.abilityName !== ab.name){
      _hudCache.abilityName = ab.name;
      $.abName.textContent = ab.name;
    }
    const ready = player.abilityCd<=0;
    const pct = ready ? 100 : (1 - player.abilityCd/ab.cd)*100;
    const pctBucket = Math.round(pct); // 1% buckets is more than enough
    if(_hudCache.abilityPct !== pctBucket){
      _hudCache.abilityPct = pctBucket;
      $.abBar.style.width = pctBucket + '%';
      $.abBar.style.background = ready
        ? 'linear-gradient(90deg,#ffea00,#00ffaa)'
        : 'linear-gradient(90deg,#3a8acc,#1a4a7a)';
    }
  }
}
function makeHeart(filled){
  const c = document.createElement('canvas');
  c.width = 18; c.height = 16; c.className='heart';
  const g = c.getContext('2d');
  g.fillStyle = filled ? '#ff3366' : '#33203a';
  g.strokeStyle = filled ? '#ffaaaa' : '#552040';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(9, 14);
  g.bezierCurveTo(9,11, 17,9, 17,5);
  g.bezierCurveTo(17,2, 13,1, 9,4);
  g.bezierCurveTo(5,1, 1,2, 1,5);
  g.bezierCurveTo(1,9, 9,11, 9,14);
  g.fill(); g.stroke();
  if(filled){
    g.fillStyle = '#ffffff88';
    g.beginPath(); g.arc(6,5,1.5,0,Math.PI*2); g.fill();
  }
  return c;
}

function damagePlayer(dmg){
  if(player.inv>0) return;
  // dodge upgrade
  if(save.upgrades.dodge>0 && Math.random() < save.upgrades.dodge*0.05){
    toast('PHASED'); player.inv = 600; return;
  }
  // shieldAura passive: 15% damage reduction → 1 in ~7 hits ignored
  if(save.specials.shieldAura && Math.random()<0.15){ toast('AURA'); player.inv = 500; return; }
  player.hp -= dmg;
  player.inv = 1600; // i-frames (longer for breathing room)
  state.shake = Math.max(state.shake, 12);
  state.hitStop = 60;
  sfx('hurt');
  // reset combo on damage
  state.combo.count = 0; state.combo.mult = 1; state.combo.timer = 0;
  // shockwave special
  if(save.specials.shockwave){
    for(const e of state.enemies){
      const d = Math.hypot(e.x-player.x,e.y-player.y);
      if(d < 220){ e.hp -= 30; const a=Math.atan2(e.y-player.y,e.x-player.x); e.vx+=Math.cos(a)*4; e.vy+=Math.sin(a)*4; }
    }
    explode(player.x,player.y,'#ffea00',40,2);
  }
  if(player.hp<=0){
    // PHOENIX FEATHER auto-revive
    if((save.consumables.revive||0) > 0 && state.mode==='survival'){
      save.consumables.revive--;
      persist();
      player.hp = player.maxHp;
      player.inv = 2500;
      // clear all enemy bullets and push enemies back
      state.ebullets = [];
      for(const e of state.enemies){
        const ax = Math.atan2(e.y-player.y, e.x-player.x);
        e.vx += Math.cos(ax)*6; e.vy += Math.sin(ax)*6;
      }
      // big visual + sound
      explode(player.x, player.y, '#ff8844', 120, 3);
      for(let i=0;i<60;i++){
        const a = Math.random()*Math.PI*2, sp = rand(2,8);
        state.particles.push({x:player.x,y:player.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:60,col:'#ffaa00',size:rand(2,4)});
      }
      state.shake = 24;
      sfx('achieve');
      toast('★ PHOENIX FEATHER · REVIVED');
      achievement('PHOENIX REBORN');
      return;
    }
    explode(player.x,player.y,player.skin.glow||'#fff',80,2);
    if(state.mode==='survival'){
      state.phase='dead';
      if(typeof setMusicMode==='function') setMusicMode('gameover');
      setTimeout(()=>{
        const title = state.bossArenaMode ? 'DEFEATED' : 'GAME OVER';
        document.querySelector('#menuOver h1').textContent = title;
        const summary = state.bossArenaMode
          ? `Try Tier ${state.lastBossTier} again — almost had it!`
          : `ROUND ${state.round} · SCORE ${state.score}`;
        document.getElementById('overSummary').textContent = summary;
        document.getElementById('overEarn').textContent = `+${state.earnedThisRun} ◈ shards earned`;
        showMenu('menuOver');
        hideHUD();
      }, 700);
    } else if(state.mode==='tutorial'){
      // restart tutorial player
      player.hp = player.maxHp;
      player.inv = 1500;
      toast('TUTORIAL RESPAWN');
    }
  }
}

