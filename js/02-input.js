'use strict';
// ============================================================
// STATE — declared before setupTouch() because setupTouch's
// checkOrient() initial call below reads `state.phase` and would
// ReferenceError on touch devices if state weren't yet bound.
// (Desktop never hit this because setupTouch early-returns on !isTouch.)
// ============================================================
const state = {
  phase: 'menu',           // menu, play, paused, between, dead, tutorial, pvp, pvpover
  mode:  'survival',       // survival, pvp, tutorial
  diff:  'medium',
  round: 1,
  enemies: [],
  bullets: [],
  ebullets: [],
  particles: [],
  shards: [],
  powerups: [],
  stars: [],
  boss: null,
  score: 0,
  earnedThisRun: 0,
  spawnTimer: 0,
  spawnedThisRound: 0,
  toClear: 0,
  shake: 0,
  weaponIdx: 0,
  fx: { rapid:0, dmg:0, slow:0 },
  tut: null,
  ai: null,
  pvpYou: 0,
  pvpAi: 0,
  pvpTarget: 5,
  pvpRound: 1,
  pvpRespawn: 0,
};

// ============================================================
// TOUCH CONTROLS
// ============================================================
// `isTouch` and `IS_PHONE` are declared in 01-core.js.
function setupTouch(){
  if(!isTouch) return;
  document.getElementById('touch').classList.add('on');
  document.getElementById('hudBottom').style.display = 'none';

  // Floating-origin joystick.
  // The visible pad at left:edge bottom:edge is the "rest" position; any
  // touch that starts in the LEFT HALF of the screen (and isn't on a
  // tBtn) re-centres the pad to the touch point and uses that as the
  // origin. This is more forgiving than a fixed pad — the player doesn't
  // have to look at their thumb, and one-handed grips that don't reach
  // the corner still work. Releases snap the pad back to its rest spot.
  const stick = document.getElementById('stick');
  const nub = stick.querySelector('.nub');
  let stickActive = false, stickId = null, sx0=0, sy0=0;
  const stickRadius = 50;
  // Cache the rest position so we can restore on release. Computed once
  // so a window resize that re-flows the layout still hits the new spot
  // (which is fine — getBoundingClientRect re-reads on the next press).
  function stickRestRect(){ return stick.getBoundingClientRect(); }
  function setStick(dx, dy){
    const len = Math.hypot(dx,dy);
    if(len > stickRadius){ dx = dx/len*stickRadius; dy = dy/len*stickRadius; }
    nub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const ax = dx/stickRadius, ay = dy/stickRadius;
    keys['a'] = ax < -0.25;
    keys['d'] = ax >  0.25;
    keys['w'] = ay < -0.25;
    keys['s'] = ay >  0.25;
  }
  function placeStickAt(cx, cy){
    // Re-anchor the visible pad. Use !important via inline style to
    // override the calc() positioning from CSS.
    const r = stick.getBoundingClientRect();
    stick.style.left   = (cx - r.width/2) + 'px';
    stick.style.top    = (cy - r.height/2) + 'px';
    stick.style.right  = 'auto';
    stick.style.bottom = 'auto';
    stick.classList.add('floating');
    sx0 = cx; sy0 = cy;
  }
  function returnStickToRest(){
    stick.style.left = '';
    stick.style.top = '';
    stick.style.right = '';
    stick.style.bottom = '';
    stick.classList.remove('floating');
  }
  function resetStick(){
    nub.style.transform = `translate(-50%,-50%)`;
    keys['a']=keys['d']=keys['w']=keys['s']=false;
    returnStickToRest();
  }
  // Document-level touchstart so the entire left half is a "wake the
  // stick" hot zone. We skip if the press lands on an interactive
  // element (a tBtn) or in the right half of the screen, since those
  // belong to fire/ability/weapon/cons.
  document.addEventListener('touchstart', (e)=>{
    if(stickActive) return;
    if(state.phase!=='play' && state.phase!=='pvp' && state.phase!=='tutorial') return;
    const t = e.changedTouches[0];
    if(t.clientX > window.innerWidth * 0.5) return;
    // Don't hijack taps that landed on a button (fire/ability/etc. live
    // bottom-right but cons buttons live top-left — the closest()-walk
    // covers anything wired with tBtn).
    if(e.target && e.target.closest && e.target.closest('.tBtn')) return;
    e.preventDefault();
    stickActive = true; stickId = t.identifier;
    placeStickAt(t.clientX, t.clientY);
    setStick(0, 0);
  }, {passive:false});
  document.addEventListener('touchmove', (e)=>{
    if(!stickActive) return;
    for(const t of e.changedTouches){
      if(t.identifier===stickId){ setStick(t.clientX-sx0, t.clientY-sy0); break; }
    }
  }, {passive:true});
  function endJoystick(e){
    if(!stickActive) return;
    for(const t of e.changedTouches){
      if(t.identifier===stickId){ stickActive=false; stickId=null; resetStick(); break; }
    }
  }
  document.addEventListener('touchend',    endJoystick, {passive:true});
  document.addEventListener('touchcancel', endJoystick, {passive:true});

  // Generic hold-to-press button
  function holdBtn(id, onDown, onUp){
    const el = document.getElementById(id);
    if(!el) return;
    const down = (e)=>{ e.preventDefault(); el.classList.add('held'); onDown && onDown(); };
    const up   = (e)=>{ e.preventDefault(); el.classList.remove('held'); onUp && onUp(); };
    el.addEventListener('touchstart', down, {passive:false});
    el.addEventListener('touchend', up, {passive:false});
    el.addEventListener('touchcancel', up, {passive:false});
    // also support mouse/click for desktop testing
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
  }
  holdBtn('tFire', ()=>{ keys[' ']=true; }, ()=>{ keys[' ']=false; });
  holdBtn('tBoost', ()=>{ keys['shift']=true; }, ()=>{ keys['shift']=false; });

  // Tap-to-trigger buttons
  function tapBtn(id, fn){
    const el = document.getElementById(id);
    if(!el) return;
    const handle = (e)=>{ e.preventDefault(); fn(); };
    el.addEventListener('touchstart', handle, {passive:false});
    el.addEventListener('click', handle);
  }
  tapBtn('tWeapon', ()=>{ if(state.phase==='play'||state.phase==='pvp') cycleWeapon(); });
  tapBtn('tAbility',()=>{ if(state.phase==='play') triggerAbility(); });
  tapBtn('tPause',  ()=>{ if(state.phase==='play') pause(); else if(state.phase==='paused') resume(); });
  tapBtn('cons1',   ()=>{ if(state.phase==='play') useConsumable('heal'); });
  tapBtn('cons2',   ()=>{ if(state.phase==='play') useConsumable('shield'); });
  tapBtn('cons3',   ()=>{ if(state.phase==='play') useConsumable('bomb'); });

  // Touch UI visibility — used to be a 200ms setInterval that ran
  // forever. Now driven by the same showHUD/hideHUD calls that toggle
  // the rest of the in-game chrome. Cached element + state.phase check.
  const _touchUI = document.getElementById('touch');
  function refreshTouchUI(){
    const playing = (state.phase==='play' || state.phase==='pvp' || state.phase==='tutorial');
    _touchUI.style.opacity = playing ? '1' : '0';
    _touchUI.style.pointerEvents = playing ? '' : 'none';
  }
  refreshTouchUI();
  // Hook the global so showHUD/hideHUD/quitToMenu/etc. can poke us.
  window.__refreshTouchUI = refreshTouchUI;

  // Orientation: the game now has dedicated portrait CSS for both
  // phones (#hud restacks, hub bottom-bar wraps) and tablets (existing
  // layout already works). Forcing rotation felt dated in 2026 and
  // fights the genre — this is a vertical-scrolling shooter, where
  // portrait is arguably the more natural orientation. The
  // body.is-portrait class is set by applyDeviceClass in 01-core.js.
  const rotateEl = document.getElementById('rotateMsg');
  if (rotateEl) rotateEl.style.display = 'none';

  // Try to lock fullscreen + landscape on first user gesture
  document.body.addEventListener('touchend', tryLock, {once:true});
  function tryLock(){
    const el = document.documentElement;
    if(el.requestFullscreen) el.requestFullscreen().catch(()=>{});
    if(screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(()=>{});
  }
}
setupTouch();

for(let i=0;i<260;i++){
  state.stars.push({
    x:Math.random()*W, y:Math.random()*H,
    z:Math.random()*0.7+0.3,
    s:Math.random()*1.6+0.3,
    c: Math.random()<0.1 ? '#ffd1ff' : (Math.random()<0.3 ? '#bff' : '#fff')
  });
}

// ============================================================
// MENU NAVIGATION
// ============================================================
function showMenu(id, fade=false){
  document.getElementById('overlay').style.display='flex';
  document.querySelectorAll('.menu').forEach(m=>m.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById('saveBar').classList.remove('hidden');
  document.getElementById('sbCredits').textContent = save.credits;
  document.getElementById('sbBest').textContent = save.best;
  if(window.__refreshTouchUI) window.__refreshTouchUI();
}
function hideOverlay(){
  document.getElementById('overlay').style.display='none';
  document.getElementById('saveBar').classList.add('hidden');
  if(window.__refreshTouchUI) window.__refreshTouchUI();
}
function showHUD(showPvp=false){
  document.getElementById('hud').style.display = showPvp ? 'none' : 'flex';
  document.getElementById('hudBottom').style.display = 'flex';
  document.getElementById('pvpScore').style.display = showPvp ? 'block' : 'none';
  if(window.__refreshTouchUI) window.__refreshTouchUI();
}
function hideHUD(){
  document.getElementById('hud').style.display = 'none';
  document.getElementById('hudBottom').style.display = 'none';
  document.getElementById('pvpScore').style.display = 'none';
  document.getElementById('bossBar').style.display = 'none';
  document.getElementById('tutCaption').style.display = 'none';
  document.getElementById('minimap').style.display = 'none';
  document.getElementById('combo').style.display = 'none';
  if(window.__refreshTouchUI) window.__refreshTouchUI();
}

// click handlers for [data-go]
document.querySelectorAll('[data-go]').forEach(b=>{
  b.onclick = ()=> {
    const id = b.getAttribute('data-go');
    if(id==='menuShop') openShop();
    else showMenu(id);
  };
});
document.querySelectorAll('[data-diff]').forEach(b=>{
  b.onclick = ()=> startSurvival(b.getAttribute('data-diff'));
});
document.querySelectorAll('[data-pvp]').forEach(b=>{
  b.onclick = ()=> startPvp(b.getAttribute('data-pvp'));
});
{ const rb = document.getElementById('resetBtn'); if(rb) rb.onclick = ()=>{
  if(confirm('Wipe all save data?')){ save = defaultSave(); persist(); showMenu('menuMain'); toast('Save wiped.'); }
}; }
// All handlers wrapped in arrow funcs so the function reference resolves
// at *click* time. Otherwise this script (which loads before 05-flow.js
// and 10-modes.js) would ReferenceError on `resume`, `quitToMenu`,
// `startTutorial` and silently skip every assignment after the first.
document.getElementById('closeShop').onclick = ()=> showMenu('menuMain');
document.getElementById('resumeBtn').onclick = ()=> resume();
document.getElementById('quitBtn').onclick = ()=> quitToMenu();
document.getElementById('pauseShopBtn').onclick = ()=> openShop(true);
document.getElementById('retryBtn').onclick = ()=>{
  if(state.lastBossTier){ startBossFight(state.lastBossTier); }
  else startSurvival(state.diff);
};
document.getElementById('rematchBtn').onclick = ()=> startPvp(state.pvpDiff);
document.getElementById('tutStart').onclick = ()=> startTutorial();

// shop tabs
let shopTab = 'up';
document.querySelectorAll('.tab').forEach(t=>{
  t.onclick = ()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    shopTab = t.getAttribute('data-tab');
    renderShop();
  };
});

