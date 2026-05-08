'use strict';
// --- Combo / streak ---
state.combo = { count:0, timer:0, mult:1, killTime:0 };
function comboKill(value=1){
  state.combo.count++;
  state.combo.timer = 3500;
  state.combo.killTime = performance.now();
  const c = state.combo.count;
  const prevMult = state.combo.mult;
  state.combo.mult = c>=50?8 : c>=25?4 : c>=10?2 : 1;
  if(state.stats && c > (state.stats.maxCombo||0)) state.stats.maxCombo = c;
  if(c===10) achievement('STREAK MASTER');
  if(c===25) achievement('UNSTOPPABLE');
  if(c===50) achievement('LEGENDARY KILL CHAIN');
  // Tactile bump every time the multiplier ticks up — gives the
  // 10/25/50-streak milestones an analog "kick" beyond the SFX.
  if(state.combo.mult !== prevMult && typeof haptic==='function') haptic(20);
  state.score += value * state.combo.mult;
  sfx('combo');
}
function comboTick(dt){
  if(state.combo.timer>0){
    state.combo.timer -= dt;
    if(state.combo.timer<=0){ state.combo.count=0; state.combo.mult=1; }
  }
}

// --- Achievements ---
state.achievements = (() => {
  try { return JSON.parse(safeLSGet('hypershards_achv')||'{}'); }
  catch(e){ return {}; }
})();
function achievement(name){
  if(state.achievements[name]) return;
  state.achievements[name] = true;
  safeLSSet('hypershards_achv', JSON.stringify(state.achievements));
  const el = document.getElementById('achievement');
  document.getElementById('achName').textContent = name;
  el.style.opacity = 1;
  sfx('achieve');
  save.credits += 50;
  persist();
  clearTimeout(achievement._t);
  achievement._t = setTimeout(()=>{ el.style.opacity = 0; }, 2500);
}

// --- Hit-stop ---
state.hitStop = 0;

// --- Throttled HUD ---
let hudThrottle = 0;
function maybeUpdateHud(dt){
  hudThrottle += dt;
  if(hudThrottle < 100) return;
  hudThrottle = 0;
  updateHud();
  // combo HUD
  const cm = document.getElementById('combo');
  if(state.combo.count>0){
    cm.style.display = 'block';
    document.getElementById('comboMult').textContent = '×'+state.combo.mult;
    document.getElementById('comboCount').textContent = state.combo.count;
    document.getElementById('comboTimer').style.width = (state.combo.timer/3500*100)+'%';
  } else { cm.style.display = 'none'; }
  drawMinimap();
}
function drawMinimap(){
  const mm = document.getElementById('minimap');
  if(!mm || mm.style.display==='none') return;
  const g = mm.getContext('2d');
  g.clearRect(0,0,160,120);
  g.fillStyle='#02030acc'; g.fillRect(0,0,160,120);
  const sx = 160/W, sy = 120/H;
  g.fillStyle='#00eaff';
  if(player) g.fillRect(player.x*sx-2, player.y*sy-2, 4, 4);
  g.fillStyle='#ff5577';
  for(const e of state.enemies){
    g.fillRect(e.x*sx-1, e.y*sy-1, 2, 2);
  }
  if(state.boss){
    g.fillStyle='#ff00cc';
    g.fillRect(state.boss.x*sx-3, state.boss.y*sy-3, 6, 6);
  }
  g.fillStyle='#ffea00';
  for(const s of state.shards){ g.fillRect(s.x*sx,s.y*sy,1,1); }
}

// --- Disable old tutorial setIntervals (rebound to no-op if active) ---
// Tutorial polling intervals are still active from earlier code. Set a guard:
state._tutPollDisabled = false;

// ============================================================
let lastT = performance.now();
const ACTIVE_PHASES = new Set(['play','tutorial','pvp','dead']);
let _loopErrorCount = 0;
// Fixed-timestep physics. Position updates throughout the codebase use raw
// per-frame velocity (`x += vx`), so a phone running at 30fps used to advance
// the world at half the speed of a 60fps desktop — players reported the game
// "felt slow on phones." Now we accumulate real elapsed time and drive
// update() at a constant FIXED_STEP, so the game logic ticks at a consistent
// rate regardless of render frame rate.
const FIXED_STEP = 16;       // ms per physics tick (≈ 60Hz)
const MAX_SUBSTEPS = 4;      // cap to avoid spiral-of-death on a slow phone
let _physicsAcc = 0;
function loop(now){
  // Error boundary: a single throw inside update()/render() must NOT
  // tear down the rAF chain — the player would be stuck on a frozen
  // frame with no recourse but to refresh. Log the first few, then go
  // quiet so we don't spam the console.
  try {
    let dt = Math.min(40, now-lastT);
    lastT = now;
    if(state.hitStop > 0){
      state.hitStop = Math.max(0, state.hitStop - (dt||16));
      render();
      requestAnimationFrame(loop);
      return;
    }
    const slowMul = state.fx.slow>0 ? 0.4 : 1;
    const playing = state.phase==='play' || state.phase==='tutorial';
    if(playing || state.phase==='pvp'){
      // Accumulate real time. slowMul applies on play (slow-time effect)
      // by feeding the accumulator a fraction of real-time, so the world
      // advances slower while wall-clock cooldowns/HUD still tick at 1×.
      const playSlow = (state.phase==='play') ? slowMul : 1;
      _physicsAcc += dt * playSlow;
      let steps = 0;
      while(_physicsAcc >= FIXED_STEP && steps < MAX_SUBSTEPS){
        if(playing) update(FIXED_STEP);
        else updatePvp(FIXED_STEP);
        _physicsAcc -= FIXED_STEP;
        steps++;
      }
      // If we capped sub-steps (very slow render, e.g. tab-out), drop the
      // backlog so we don't fast-forward when focus returns.
      if(steps >= MAX_SUBSTEPS) _physicsAcc = 0;
      // HUD/effect timers tick on real wall-clock dt (not slow-mul'd) so
      // a 10s rapid powerup is always 10 real seconds.
      if(state.phase==='play'){
        state.fx.rapid = Math.max(0, state.fx.rapid-dt);
        state.fx.dmg   = Math.max(0, state.fx.dmg-dt);
        state.fx.slow  = Math.max(0, state.fx.slow-dt);
        comboTick(dt);
      }
      maybeUpdateHud(dt);
    } else {
      // Reset accumulator while in menus so the first frame of a new run
      // doesn't burn a leftover backlog into instant motion.
      _physicsAcc = 0;
    }
    // Only paint the in-game canvas when the player can actually see it.
    // In menus the overlay covers the canvas; drawing nebula/streaks/etc.
    // into a hidden layer is the single biggest mobile/tablet perf leak.
    if(ACTIVE_PHASES.has(state.phase)) render();
  } catch (err) {
    if (_loopErrorCount < 3) {
      console.error('Game loop error (continuing):', err);
      _loopErrorCount++;
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
