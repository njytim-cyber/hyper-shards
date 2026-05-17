'use strict';
// ============================================================
// PLAYER
// ============================================================
function makePlayer(opts={}){
  const u = save.upgrades;
  const skin = SKINS.find(s=>s.id===save.skin) || SKINS[0];
  const baseHp = (DIFFICULTY[state.diff]||DIFFICULTY.medium).hpStart;
  // Prestige perks: +1 starting hull per prestige level (capped) and
  // a flat +5%/lvl damage bonus on top of the PLASMA YIELD upgrade.
  const _hasPerks = (typeof PRESTIGE_PERKS !== 'undefined');
  const prestigeHp  = _hasPerks ? PRESTIGE_PERKS.hpBonus(save.prestige)  : 0;
  const prestigeDmg = _hasPerks ? PRESTIGE_PERKS.dmgBonus(save.prestige) : 0;
  const maxHp = (opts.maxHp != null ? opts.maxHp : baseHp) + u.hp + prestigeHp;
  return {
    x: opts.x ?? W/2, y: opts.y ?? H-110,
    vx:0, vy:0,
    hp:maxHp, maxHp,
    cd:0, inv:0,
    skin,
    speedMul: 1 + 0.08*u.speed,
    dmgMul: 1 + 0.15*u.dmg + prestigeDmg,
    fireMul: 1/(1+0.10*u.fire),
    regen: u.shield,         // hearts per 12 seconds per level
    regenAcc: 0,
    magnet: 90 + 30*u.magnet,
    multishot: u.multishot,
    boostFuel: 100,
    thrust: 0,
    facing: opts.facing ?? -Math.PI/2, // up
    isAi: false,
    abilityCd: 0,
    fxBerserk: 0,
    fxFlame: 0,
    fxCloak: 0,
  };
}

// ============================================================
// SKIN ABILITIES
// ============================================================
function triggerAbility(){
  if(!player) return;
  if(player.abilityCd>0){ toast('Ability on cooldown'); return; }
  const skin = player.skin;
  const ab = skin.ability;
  if(!ab){ return; }
  const id = skin.id;
  const ang = player.facing ?? -Math.PI/2;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  sfx('ability');

  if(id==='default'){            // WARP DASH — long invulnerable dash with shockwave
    player.vx += dx*40; player.vy += dy*40;
    player.inv = Math.max(player.inv, 800);
    abilityRadialDamage(player.x, player.y, 180, 30, skin.glow);
    for(let i=0;i<50;i++) state.particles.push({x:player.x,y:player.y,vx:rand(-4,4),vy:rand(-4,4),life:40,col:skin.glow,size:3});
    state.shake = 10; toast('WARP DASH');
  } else if(id==='crimson'){     // BERSERK + screen-clear of bullets + huge dmg buff
    player.fxBerserk = 8000;
    state.ebullets = [];
    abilityRadialDamage(player.x, player.y, 250, 50, skin.glow);
    state.shake = 14; toast('BLOOD RAGE');
  } else if(id==='void'){        // PHASE SHIFT — 5 teleport strikes
    for(let n=0;n<5;n++){
      setTimeout(()=>{
        if(!player) return;
        // pick nearest enemy
        let target = state.boss;
        let bestD = state.boss ? Math.hypot(state.boss.x-player.x,state.boss.y-player.y) : Infinity;
        for(const e of state.enemies){
          const d = Math.hypot(e.x-player.x,e.y-player.y);
          if(d<bestD){ bestD=d; target=e; }
        }
        if(target){
          for(let i=0;i<20;i++) state.particles.push({x:player.x,y:player.y,vx:rand(-3,3),vy:rand(-3,3),life:30,col:skin.glow,size:2});
          player.x = target.x + rand(-30,30);
          player.y = target.y + rand(-30,30);
          target.hp -= 80;
          explode(target.x,target.y,skin.glow,30,2);
          state.shake = 8;
        }
        player.inv = 1500;
      }, n*120);
    }
    toast('PHASE STRIKE');
  } else if(id==='solar'){       // SOLAR NOVA — massive radial + lingering sun
    abilityRadialDamage(player.x, player.y, 380, 80, skin.glow);
    state.solarSun = { x:player.x, y:player.y, life:4000, t:0 };
    state.shake = 22; toast('SOLAR NOVA');
  } else if(id==='glacier'){     // ABSOLUTE ZERO — freeze ALL enemies + bullets shatter
    for(const e of state.enemies){ e.frozen = 6000; e.vx=0; e.vy=0; e.hp -= 30; }
    if(state.boss){ state.boss.frozen = 4000; state.boss.hp -= 80; }
    state.ebullets = [];
    for(let i=0;i<80;i++){
      state.particles.push({x:player.x+rand(-W/3,W/3),y:player.y+rand(-H/3,H/3),vx:rand(-1,1),vy:rand(-1,1),life:60,col:'#bbeeff',size:rand(2,4)});
    }
    state.shake = 16; toast('ABSOLUTE ZERO');
  } else if(id==='neon'){        // SWARM DRONES — 5 attack drones for 8s
    for(let i=0;i<5;i++){
      state.drones = state.drones||[];
      state.drones.push({x:player.x,y:player.y,t:i*200,life:8000,phase:i});
    }
    toast('DRONE SWARM');
  } else if(id==='toxic'){       // PLAGUE — large acid pool + DoT bullets
    state.acidCloud = { x:player.x, y:player.y, r:280, life:10000, t:0 };
    for(let i=0;i<16;i++){
      const a = i/16*Math.PI*2;
      const b = B(player.x,player.y,Math.cos(a)*9,Math.sin(a)*9,15,'#aaff00',3,false);
      b.shooter='player'; state.bullets.push(b);
    }
    toast('PLAGUE BLOOM');
  } else if(id==='prism'){       // SPECTRUM STORM — 64 bullets in concentric rings
    const w = WEAPONS[0];
    for(let r=0;r<3;r++){
      setTimeout(()=>{
        for(let i=0;i<24;i++){
          const a = i/24*Math.PI*2 + r*0.1;
          const b = B(player.x,player.y,Math.cos(a)*(w.speed+r*2),Math.sin(a)*(w.speed+r*2),16,`hsl(${(i*15+r*60)%360},90%,60%)`,3,false);
          b.shooter='player'; state.bullets.push(b);
        }
      }, r*150);
    }
    toast('SPECTRUM STORM');
  } else if(id==='royal'){       // AEGIS — invuln + reflect + heal
    player.inv = Math.max(player.inv, 8000);
    player.fxReflect = 8000;
    player.hp = Math.min(player.maxHp, player.hp+1);
    state.shake = 8; toast('AEGIS PROTOCOL');
  } else if(id==='phoenix'){     // REBIRTH — heal full, huge explosion, fire trail
    abilityRadialDamage(player.x, player.y, 360, 100, '#ff8800');
    player.hp = player.maxHp;
    player.fxFlame = 6000;
    state.shake = 24;
    explode(player.x,player.y,'#ff8800',120,3);
    toast('REBIRTH — FULL HP');
  } else if(id==='shadow'){      // SHADOW STRIKE — cloak + bonus damage on first hit
    player.fxCloak = 7000;
    player.fxBerserk = 4000;
    state.ebullets = [];
    toast('SHADOW STRIKE');
  } else if(id==='eclipse'){     // SINGULARITY — black hole that absorbs+detonates
    state.blackHole = { x:player.x + dx*200, y:player.y + dy*200, life:5000, t:0, willDetonate:true };
    state.shake = 14; toast('SINGULARITY');
  } else if(id==='aurora'){      // CELESTIAL CLEANSE — full heal + clear screen + damage
    player.hp = player.maxHp;
    state.ebullets = [];
    for(const e of state.enemies){ e.hp -= 60; }
    if(state.boss) state.boss.hp -= 100;
    for(let i=0;i<150;i++){
      state.particles.push({x:player.x,y:player.y,vx:rand(-8,8),vy:rand(-8,8),life:60,col:'#66ffcc',size:rand(2,4)});
    }
    state.shake = 18; toast('CELESTIAL CLEANSE');
  } else if(id==='inferno'){     // METEOR STORM — rains fireballs from sky
    for(let i=0;i<20;i++){
      setTimeout(()=>{
        if(state.phase!=='play') return;
        const tx = rand(0,W), ty = rand(0,H);
        explode(tx,ty,'#ff5500',40,2);
        abilityRadialDamage(tx,ty,140,50,'#ff5500');
        state.shake = Math.max(state.shake, 8);
      }, i*150);
    }
    player.fxFlame = 5000; toast('METEOR STORM');
  } else if(id==='celestial'){   // DIVINE LASER CANNON — 8 omnidirectional beams + full heal + rapid + ×2 dmg
    state.beam = { x:player.x, y:player.y, ang:0, life:2400, t:0, omni:true, beams:8 };
    player.hp = player.maxHp;
    player.inv = Math.max(player.inv, 1500);
    state.fx.rapid = Math.max(state.fx.rapid, 12000);
    state.fx.dmg   = Math.max(state.fx.dmg,   12000);
    player.fxBerserk = Math.max(player.fxBerserk||0, 12000);
    const len = Math.max(W,H)*2;
    // multi-pulse damage in all 8 directions
    for(let pulse=0;pulse<6;pulse++){
      setTimeout(()=>{
        if(!state.beam) return;
        const beams = state.beam.beams || 8;
        const off = state.beam.t*0.0008;
        // Damage anything within any of the beams' lines
        const checkBeams = [];
        for(let i=0;i<beams;i++) checkBeams.push(i/beams*Math.PI*2 + off);
        for(const e of state.enemies){
          for(const a of checkBeams){
            const cdx = Math.cos(a), cdy = Math.sin(a);
            const tx = e.x-state.beam.x, ty = e.y-state.beam.y;
            const proj = tx*cdx + ty*cdy;
            if(proj<0 || proj>len) continue;
            const px = state.beam.x+cdx*proj, py = state.beam.y+cdy*proj;
            if(Math.hypot(e.x-px,e.y-py)<70){
              e.hp -= 130; explode(e.x,e.y,'#fff7c0',20,2);
              break;
            }
          }
        }
        if(state.boss){
          for(const a of checkBeams){
            const cdx = Math.cos(a), cdy = Math.sin(a);
            const tx = state.boss.x-state.beam.x, ty = state.boss.y-state.beam.y;
            const proj = tx*cdx + ty*cdy;
            const px = state.beam.x+cdx*proj, py = state.beam.y+cdy*proj;
            if(Math.hypot(state.boss.x-px,state.boss.y-py)<100){
              state.boss.hp -= 180; break;
            }
          }
        }
      }, pulse*350);
    }
    state.shake = 32;
    toast('DIVINE LAZER · FULL HP · RAPID · ×2 DMG');
  }
  player.abilityCd = ab.cd;
  achievement('FIRST ABILITY');
}
// ============================================================
// LEVEL-UP + SUPER ABILITY
// ============================================================
// Per-run leveling system. Score crossing state.xpGoal triggers a
// level-up burst: gem particles, +10 lifetime gems, screen flash, sting
// SFX, and every 3rd level grants a super-coin. Designed to fire many
// times per run (every ~800 score) so the dopamine hits keep landing.
function tryLevelUp(){
  if(state.phase!=='play' && state.phase!=='tutorial') return;
  // Loop in case a single fat-score event (a boss kill on key:1 super)
  // crosses two thresholds at once — you should still see two pops.
  while(state.score >= state.xpGoal){
    state.level = (state.level||1) + 1;
    // Linear ramp keeps the cadence steady deep into the run.
    state.xpGoal += 800;
    save.gems = (save.gems||0) + 10;
    const wasMilestone = (state.level % 3) === 0;
    if(wasMilestone) save.superCoins = (save.superCoins||0) + 1;
    persist();
    // Visual: gem fountain at the player + brief screen shake
    if(player){
      const cnt = wasMilestone ? 50 : 28;
      for(let i=0;i<cnt;i++){
        const a = Math.random()*Math.PI*2;
        const sp = rand(2, 7);
        state.particles.push({
          x: player.x, y: player.y,
          vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 1,
          life: rand(40, 70),
          col: i%3===0 ? '#ffea00' : (i%3===1 ? '#00f7ff' : '#ff66cc'),
          size: rand(2, 4),
        });
      }
    }
    state.shake = Math.max(state.shake, wasMilestone ? 14 : 8);
    state.hitStop = Math.max(state.hitStop, wasMilestone ? 90 : 40);
    if(typeof sfx === 'function') sfx(wasMilestone ? 'achieve' : 'power');
    if(typeof haptic === 'function') haptic(wasMilestone ? [30,40,30] : 25);
    toast(wasMilestone
      ? '★ LEVEL '+state.level+' · +10 ◆ · +1 ✦ SUPER'
      : '★ LEVEL '+state.level+' · +10 ◆');
  }
}

// === ULTIMATE (E key) — unlocked per-skin via mastery XP ===========
// Mirrors _3d_triggerUltimate() but uses 2D systems: state.enemies,
// state.boss, state.blackHole, player.fxBerserk, player.inv. Same
// four `kind`s defined in ULTIMATES (01-core.js):
//   • nova    — destroys every enemy on screen + chunk-damages the boss
//   • rage    — 8 s of damage+fire-rate boost (reuses fxBerserk)
//   • rift    — spawns a 6 s black hole at the screen centre that
//               pulls + damages everything
//   • rebirth — instant heal-to-full + 6 s invuln
// Cooldown comes from the ultimate's `cd` (typically 25–45 s) and is
// tracked on state.ultCd; ticked down each frame in 08-update.js.
function triggerUltimate(){
  if(!player) return;
  if(state.phase!=='play'){ toast('ULT · only during a run'); return; }
  if(typeof save==='undefined' || !save) return;
  const skinId = save.skin || 'default';
  if(typeof isSkinMastered !== 'function' || !isSkinMastered(skinId)){
    const need = (typeof getSkinMasteryXp==='function') ? getSkinMasteryXp(skinId) : '???';
    toast('ULT LOCKED · master this skin (' + need + ' XP)');
    return;
  }
  if((state.ultCd||0) > 0){
    toast('ULT · ' + (state.ultCd/1000).toFixed(1) + 's');
    return;
  }
  const ult = (typeof getUltimate==='function') ? getUltimate(skinId) : null;
  if(!ult) return;
  state.ultCd = ult.cd;
  sfx('ability');

  switch(ult.kind){
    case 'rage': {
      // 8 s of damage boost (fxBerserk is read by fire() for the dmg+fire-rate buff)
      player.fxBerserk = 8000;
      state.shake = Math.max(state.shake, 18);
      for(let i=0;i<60;i++){
        state.particles.push({x:player.x,y:player.y,vx:rand(-5,5),vy:rand(-5,5),life:50,col:player.skin.glow,size:3});
      }
      toast('★ ' + ult.name + ' · 8s RAGE');
      break;
    }
    case 'rebirth': {
      player.hp = player.maxHp;
      player.inv = Math.max(player.inv, 6000);
      state.shake = Math.max(state.shake, 16);
      // Healing ring particles
      for(let i=0;i<48;i++){
        const ang = (i/48)*Math.PI*2;
        state.particles.push({
          x:player.x + Math.cos(ang)*30, y:player.y + Math.sin(ang)*30,
          vx:Math.cos(ang)*2, vy:Math.sin(ang)*2, life:60, col:'#00ff88', size:3
        });
      }
      toast('★ ' + ult.name + ' · FULL REPAIR + 6s INVULN');
      break;
    }
    case 'rift': {
      // Black hole at the screen centre — existing 2D code in 08-update
      // already handles attraction + damage when state.blackHole is set.
      state.blackHole = { x: W/2, y: H/2 - 80, life: 6000, t: 0, r: 200 };
      state.shake = 24;
      toast('★ ' + ult.name + ' · 6s RIFT');
      break;
    }
    case 'nova':
    default: {
      // Wipe every enemy on screen and chunk-damage the boss.
      state.shake = 32;
      for(const e of state.enemies){
        e.hp = 0;     // dead-enemy loop in 08-update will explode + score them
        for(let i=0;i<8;i++) state.particles.push({x:e.x,y:e.y,vx:rand(-3,3),vy:rand(-3,3),life:40,col:'#'+ult.color.toString(16).padStart(6,'0'),size:2});
      }
      if(state.boss){
        state.boss.hp -= 200;        // big chunk damage (full kills tier-1)
        for(let i=0;i<40;i++) state.particles.push({x:state.boss.x,y:state.boss.y,vx:rand(-6,6),vy:rand(-6,6),life:50,col:'#ffea00',size:3});
      }
      // Big shockwave at the player too — pure visual but sells the moment
      for(let i=0;i<80;i++){
        const ang = Math.random()*Math.PI*2, sp = 4+Math.random()*6;
        state.particles.push({x:player.x,y:player.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:60,col:'#ffea00',size:3});
      }
      toast('★ ' + ult.name + ' · FIELD CLEARED');
      break;
    }
  }
}

// Press 9 (or tap SUPER button). Spends one super-coin to grant the
// player a 15-second mega-buff: 2× damage, 2× fire rate, 1.4× speed,
// full boost fuel, +1 heart, and a golden aura in render(). The buff
// is applied via state.fx.super which existing fire()/movement code
// reads alongside rapid/dmg fx.
function triggerSuperAbility(){
  if(!player) return;
  if(state.phase!=='play'){ toast('SUPER · only during a run'); return; }
  if(state.fx.super > 0){ toast('SUPER · already active'); return; }
  if((save.superCoins||0) <= 0){ toast('SUPER · need ✦ super-coin'); return; }
  save.superCoins--;
  persist();
  state.fx.super = 15000;          // 15s
  // Quality-of-life: top off boost fuel + give 1 heart back.
  player.boostFuel = 100 + 25*save.upgrades.boost;
  if(player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + 1);
  // Big radial burst at the player so the activation reads visually.
  for(let i=0;i<80;i++){
    const a = Math.random()*Math.PI*2, sp = rand(3, 9);
    state.particles.push({
      x: player.x, y: player.y,
      vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
      life: rand(40, 80),
      col: i%2 ? '#ffea00' : '#fff7c0',
      size: rand(2, 4),
    });
  }
  state.shake = Math.max(state.shake, 18);
  state.hitStop = Math.max(state.hitStop, 70);
  if(typeof sfx === 'function') sfx('achieve');
  if(typeof haptic === 'function') haptic([40, 60, 40, 80]);
  toast('✦ SUPER · 15s · 2× DMG · 2× FIRE · BOOSTED');
  achievement('SUPER PILOT');
}

function abilityRadialDamage(x,y,r,dmg,col){
  for(const e of state.enemies){
    if(Math.hypot(e.x-x,e.y-y) < r){
      e.hp -= dmg;
      const ang = Math.atan2(e.y-y, e.x-x);
      e.vx += Math.cos(ang)*4; e.vy += Math.sin(ang)*4;
    }
  }
  if(state.boss && Math.hypot(state.boss.x-x,state.boss.y-y) < r) state.boss.hp -= dmg;
  for(let i=0;i<60;i++){
    const a = Math.random()*Math.PI*2, sp=rand(2,6);
    state.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:40,col,size:rand(2,4)});
  }
}
let player = null;

// ============================================================
// WEAPONS
// ============================================================
function ownedWeapons(){ return WEAPONS.filter(w => save.weapons[w.id]); }
function cycleWeapon(){
  const list = ownedWeapons();
  if(list.length===0){ state.weaponIdx = 0; return; }
  // find current in WEAPONS, cycle to next owned
  let cur = WEAPONS[state.weaponIdx];
  let i = WEAPONS.indexOf(cur);
  for(let n=0;n<WEAPONS.length;n++){
    i = (i+1)%WEAPONS.length;
    if(save.weapons[WEAPONS[i].id]){ state.weaponIdx = i; break; }
  }
  toast('Weapon: '+WEAPONS[state.weaponIdx].name);
  document.getElementById('ammoTxt').textContent = WEAPONS[state.weaponIdx].name;
}
function curWeapon(){
  const w = WEAPONS[state.weaponIdx];
  if(save.weapons[w.id]) return w;
  // fall back to first owned
  return ownedWeapons()[0] || WEAPONS[0];
}

function fire(p, weapon, opts={}){
  if(p.cd>0) return;
  // GOLDENISE the weapon's bullet colour when the firing player's
  // equipped skin is mastered. Clone the weapon def with a gold
  // `draw` colour so every push(B(... w.draw ...)) below uses gold
  // without a single-site edit per weapon type. Damage / cooldown /
  // speed are untouched — purely cosmetic. AI shooters are skipped.
  const _isMaster = (p === player)
    && typeof save !== 'undefined' && save
    && typeof isSkinMastered === 'function'
    && isSkinMastered(save.skin || 'default');
  const w = _isMaster ? Object.assign({}, weapon, { draw: '#ffea00' }) : weapon;
  let cdMul = p.fireMul;
  if(state.fx.rapid>0 && p===player) cdMul *= 0.45;
  if(state.fx.super>0 && p===player) cdMul *= 0.5;
  p.cd = w.cd * cdMul;
  // Track shots-fired for end-of-run accuracy. One trigger pull counts
  // as one shot, regardless of multishot/spread/cluster — we want the
  // ratio of "tap to register a hit somewhere" not "bullets in flight."
  if(p===player && state.stats) state.stats.shotsFired++;
  let dmg = w.dmg * (p.dmgMul||1);
  if(state.fx.dmg>0 && p===player) dmg *= 2;
  if(state.fx.super>0 && p===player) dmg *= 2;
  if(p===player && p.fxBerserk>0) dmg *= 2;

  const ang = p.facing ?? -Math.PI/2;
  const dirX = Math.cos(ang), dirY = Math.sin(ang);
  const fx = p.x + dirX*22, fy = p.y + dirY*22;
  const ms = p.multishot||0;
  const shooter = opts.shooter || (p===player ? 'player' : 'ai');

  function push(b){ b.shooter=shooter; (shooter==='ai' ? state.ebullets : state.bullets).push(b); }

  if(w.id==='single'){
    push(B(fx,fy,dirX*w.speed,dirY*w.speed,dmg,w.draw,3,false));
    if(ms>=1){ const a=ang+0.1; push(B(fx,fy,Math.cos(a)*w.speed,Math.sin(a)*w.speed,dmg*0.8,w.draw,3,false)); }
    if(ms>=2){ const a=ang-0.1; push(B(fx,fy,Math.cos(a)*w.speed,Math.sin(a)*w.speed,dmg*0.8,w.draw,3,false)); }
  } else if(w.id==='spread'){
    const n = 3 + ms;
    for(let i=0;i<n;i++){
      const a = ang + (i-(n-1)/2)*0.18;
      push(B(fx,fy,Math.cos(a)*w.speed,Math.sin(a)*w.speed,dmg,w.draw,3,false));
    }
  } else if(w.id==='rapid'){
    const off = (Math.random()-0.5)*0.06;
    push(B(fx-dirY*8,fy+dirX*8,Math.cos(ang+off)*w.speed,Math.sin(ang+off)*w.speed,dmg,w.draw,2,false));
    push(B(fx+dirY*8,fy-dirX*8,Math.cos(ang-off)*w.speed,Math.sin(ang-off)*w.speed,dmg,w.draw,2,false));
    if(ms>=2) push(B(fx,fy,Math.cos(ang)*w.speed,Math.sin(ang)*w.speed,dmg,w.draw,2,false));
  } else if(w.id==='heavy'){
    push(B(fx,fy,Math.cos(ang)*w.speed,Math.sin(ang)*w.speed,dmg,w.draw,7,true));
    if(p===player) state.shake = Math.max(state.shake,8);
  } else if(w.id==='wave'){
    for(let i=-1;i<=1;i++){
      const a = ang + i*0.2;
      const b = B(fx,fy,Math.cos(a)*w.speed,Math.sin(a)*w.speed,dmg,w.draw,4,false);
      b.wave = true; b.t=0;
      push(b);
    }
  } else if(w.id==='flame'){
    // Wide cone of short-lived flame particles, very high fire rate.
    // Two-tone (red+amber by default, gold pair when mastered) so the
    // stream has visible variation. The hardcoded #ff5500/#ffaa00 in
    // the old code bypassed the mastery goldenise override at the top
    // of fire() — that's why PLASMA FLAME stayed orange while every
    // other weapon went gold on a mastered ship.
    const flameA = w.draw === '#ffea00' ? '#ffea00' : '#ff5500';
    const flameB = w.draw === '#ffea00' ? '#ffd700' : '#ffaa00';
    const n = 4 + (ms||0);
    for(let i=0;i<n;i++){
      const a = ang + (Math.random()-0.5)*0.55;
      const sp = w.speed*(0.7+Math.random()*0.5);
      const b = B(fx,fy,Math.cos(a)*sp,Math.sin(a)*sp,dmg,Math.random()<0.5?flameA:flameB,rand(2,4),false);
      b.life = 30; // short range
      b.flame = true;
      push(b);
    }
  } else if(w.id==='lance'){
    // High-speed piercing lance (penetrates many enemies)
    const b = B(fx,fy,Math.cos(ang)*w.speed,Math.sin(ang)*w.speed,dmg,w.draw,5,false);
    b.pierceLeft = 99; b.lance = true;
    push(b);
    if(p===player) state.shake = Math.max(state.shake, 4);
  } else if(w.id==='cluster'){
    // Slow pod that splits into 6 micro-missiles after a delay or on impact
    const b = B(fx,fy,Math.cos(ang)*w.speed,Math.sin(ang)*w.speed,dmg,w.draw,6,false);
    b.cluster = true; b.fuse = 700; // ms before auto-split
    b.size = 6;
    push(b);
  } else if(w.id==='shock'){
    // Slow chain-lightning orb
    const b = B(fx,fy,Math.cos(ang)*w.speed,Math.sin(ang)*w.speed,dmg,w.draw,7,false);
    b.shock = true; b.size = 6;
    push(b);
  } else if(w.id==='void'){
    // Black-hole projectile that creates a gravity well on impact
    const b = B(fx,fy,Math.cos(ang)*w.speed,Math.sin(ang)*w.speed,dmg,w.draw,8,false);
    b.void = true; b.size = 8;
    push(b);
    if(p===player) state.shake = Math.max(state.shake, 6);
  }
  for(let i=0;i<6;i++){
    state.particles.push({x:fx,y:fy,vx:dirX*rand(0.5,2)+rand(-1,1),vy:dirY*rand(0.5,2)+rand(-1,1),life:14,col:w.draw,size:2});
  }
  if(p===player){ sfx('shoot');
    // recoil kick
    p.vx -= dirX*0.4*(w.id==='heavy'?3:1);
    p.vy -= dirY*0.4*(w.id==='heavy'?3:1);
  }
}
function B(x,y,vx,vy,dmg,col,size,big){ return {x,y,vx,vy,dmg,col,size,big,life:120,trail:[],pierceLeft: save.upgrades.pierce||0}; }

// ===== Special weapon helpers =====
function clusterSplit(b){
  for(let i=0;i<6;i++){
    const a = i/6*Math.PI*2 + Math.random()*0.2;
    const sub = B(b.x,b.y,Math.cos(a)*8,Math.sin(a)*8,b.dmg*0.7,'#ffaa00',3,false);
    sub.shooter = b.shooter; sub.life = 60;
    state.bullets.push(sub);
  }
  explode(b.x,b.y,'#ffaa00',24,1.5);
  sfx('boom');
}
function spawnVoidWell(x,y){
  state.voidWells = state.voidWells || [];
  state.voidWells.push({ x, y, life:1500, t:0, r:120 });
  explode(x,y,'#aa55ff',30,2);
  sfx('boom');
}
function chainLightning(firstTarget, baseDmg, hit){
  // Chain to up to 4 nearby enemies, each chain does 70% of previous
  let prev = firstTarget;
  let dmg = baseDmg * 0.7;
  for(let n=0;n<4;n++){
    let next=null, bestD=220;
    for(const e of state.enemies){
      if(hit.includes(e)) continue;
      const d = Math.hypot(e.x-prev.x, e.y-prev.y);
      if(d<bestD){ bestD=d; next=e; }
    }
    if(state.boss && !hit.includes(state.boss)){
      const d = Math.hypot(state.boss.x-prev.x, state.boss.y-prev.y);
      if(d<bestD){ bestD=d; next=state.boss; }
    }
    if(!next) break;
    next.hp -= dmg;
    hit.push(next);
    // Lightning particle line
    const segs = 8;
    for(let i=0;i<segs;i++){
      const t1=i/segs, t2=(i+1)/segs;
      const x1 = prev.x + (next.x-prev.x)*t1 + rand(-8,8);
      const y1 = prev.y + (next.y-prev.y)*t1 + rand(-8,8);
      state.particles.push({x:x1,y:y1,vx:0,vy:0,life:14,col:'#ffea00',size:3});
    }
    explode(next.x,next.y,'#ffea00',8);
    prev = next; dmg *= 0.7;
  }
}

function rand(a,b){ return a + Math.random()*(b-a); }

const MAX_PARTICLES = 280;
function explode(x,y,col,n=20,power=1){
  // Skip if we're already saturated to keep frame rate up
  if(state.particles.length > MAX_PARTICLES) n = Math.min(n, 6);
  for(let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2;
    const sp = rand(0.5,4)*power;
    state.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(20,50),col,size:rand(1.5,3.2)});
  }
  // Trim if we went over
  if(state.particles.length > MAX_PARTICLES*1.4){
    state.particles.splice(0, state.particles.length - MAX_PARTICLES);
  }
}

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.opacity = 1;
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>{t.style.opacity=0;}, 1300);
}

