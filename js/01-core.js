'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = window.innerWidth, H = window.innerHeight;
function fitCanvas(){
  const oldW = W, oldH = H;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  // When the viewport changes (mobile address-bar collapse, devtools open,
  // window resize), scale entity positions proportionally instead of letting
  // the per-frame clamp snap them to the new edge — that snap reads as a
  // teleport. Only runs after the first sizing.
  if(oldW > 0 && oldH > 0 && (oldW !== W || oldH !== H)){
    const sx = W/oldW, sy = H/oldH;
    if(typeof player !== 'undefined' && player){ player.x *= sx; player.y *= sy; }
    if(typeof state !== 'undefined' && state){
      if(state.boss){ state.boss.x *= sx; state.boss.y *= sy; }
      if(state.ai)  { state.ai.x   *= sx; state.ai.y   *= sy; }
      if(state.enemies) for(const e of state.enemies){ e.x *= sx; e.y *= sy; }
    }
  }
}
fitCanvas();
addEventListener('resize', fitCanvas);

// ============================================================
// DEVICE DETECTION
// ============================================================
// isTouch: any device with touch input (phones + tablets)
// IS_PHONE: touch device whose smaller viewport dim < 500px
//   - iPhone SE..15 Pro Max → phone (smallest dim 320–430)
//   - iPad Mini and larger  → NOT a phone (smallest dim ≥ 768)
//   Re-evaluated on resize/orientationchange so a tablet held narrow
//   doesn't mis-classify mid-session.
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints>0);
let IS_PHONE = false;
let IS_TABLET = false;
// LOW_FX is the single source of truth for "skip expensive Canvas effects".
// Any touch device qualifies — phones and tablets both share the same
// fillrate/shadowBlur ceiling on iOS Safari.
let LOW_FX = false;
function applyDeviceClass(){
  IS_PHONE  = isTouch && Math.min(window.innerWidth, window.innerHeight) < 500;
  IS_TABLET = isTouch && !IS_PHONE;
  LOW_FX    = isTouch;
  const portrait = window.innerHeight > window.innerWidth;
  document.body.classList.toggle('is-phone',     IS_PHONE);
  document.body.classList.toggle('is-tablet',    IS_TABLET);
  document.body.classList.toggle('is-touch',     isTouch);
  document.body.classList.toggle('is-portrait',  portrait);
  document.body.classList.toggle('is-landscape', !portrait);
}
applyDeviceClass();
addEventListener('resize', applyDeviceClass);
addEventListener('orientationchange', ()=>{
  // Some browsers fire resize before reporting the new dims; wait a tick.
  setTimeout(()=>{ applyDeviceClass(); fitCanvas(); }, 60);
});

// ============================================================
// SAVE
// ============================================================
const SAVE_KEY = 'hypershards_save_v3';
const defaultSave = () => ({
  credits: 0,
  best: 0,
  username: 'PILOT',
  bestRound: 1,
  totalKills: 0,
  totalShards: 0,
  totalRuns: 0,
  bossWins: { 1:0, 2:0, 3:0, 4:0, 5:0 },
  pvpWins: 0,
  pvpLosses: 0,
  audio: true,
  music: true,
  upgrades: {
    dmg:0, fire:0, hp:0, speed:0, shield:0, magnet:0, multishot:0,
    boost:0, crit:0, pierce:0, lifesteal:0, luck:0, dodge:0
  },
  weapons: { single:true, spread:false, rapid:false, heavy:false, wave:false },
  consumables: { heal:0, shield:0, bomb:0, revive:0 },
  specials: { autoRepair:false, drone:false, shockwave:false, magnetMax:false },
  skins: { default:true, crimson:false, void:false, solar:false, prism:false, eclipse:false, phoenix:false, glacier:false, neon:false },
  skin: 'default'
});
let save = loadSave();
function loadSave(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return defaultSave();
    const s = JSON.parse(raw);
    const d = defaultSave();
    return { ...d, ...s, upgrades:{...d.upgrades,...(s.upgrades||{})}, skins:{...d.skins,...(s.skins||{})} };
  }catch(e){ return defaultSave(); }
}
// localStorage failure modes worth handling:
//   - QuotaExceededError on iOS Safari, especially in private browsing
//   - SecurityError when cookies are disabled
//   - DOMException in incognito modes that disable storage
// Without the guard, a single throw inside persist() would propagate up
// through every save trigger (round-clear, achievement, shop buy) and
// halt the game loop. Rate-limit warnings so we don't spam the console.
let _persistFailWarned = false;
function persist(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }catch(e){
    if(!_persistFailWarned){
      console.warn('persist() failed — save will not survive reload:', e && e.name);
      _persistFailWarned = true;
    }
  }
}
// Safe wrappers used by achievements + daily reward + similar low-volume
// callers. Returns null/false instead of throwing.
function safeLSGet(key){
  try{ return localStorage.getItem(key); }catch(e){ return null; }
}
function safeLSSet(key, val){
  try{ localStorage.setItem(key, val); return true; }catch(e){ return false; }
}

// ============================================================
// NEW-VERSION CHECK
// ============================================================
// Cloudflare Pages serves index.html with a short cache TTL. If the page
// stays open across a deploy, the in-memory JS keeps running the old
// version forever. Snapshot the served HTML on boot and re-poll every
// few minutes; if the bytes differ, surface a clickable banner so the
// player can refresh when it's safe (between rounds, not mid-boss).
// Zero infrastructure required — works against the existing static
// deploy. The banner stays visible until tap; we don't auto-reload
// because that would yank the player out of an active run.
let _bootHtml = null;
let _updateNotified = false;
(async () => {
  try {
    const r = await fetch(location.pathname || '/', {cache:'no-store'});
    if(r.ok) _bootHtml = await r.text();
  } catch(e) { /* offline / first boot — ignore, never check */ }
})();
async function _checkForUpdate(){
  if(_updateNotified || !_bootHtml) return;
  try {
    const r = await fetch(location.pathname || '/', {cache:'no-store'});
    if(!r.ok) return;
    const cur = await r.text();
    if(cur === _bootHtml) return;
    _updateNotified = true;
    const el = document.getElementById('updateBanner');
    if(el){
      el.classList.remove('hidden');
      el.addEventListener('click', ()=>location.reload(), {once:true});
    }
  } catch(e) { /* transient — try again next interval */ }
}
// First check 30s after load (give the deploy CDN cache time to settle if
// the user opened during a deploy), then every 10 min. Variable assignment
// satisfies the static-audit "no bare setInterval" rule.
const _updateCheckTimer = setInterval(_checkForUpdate, 600_000);
setTimeout(_checkForUpdate, 30_000);

// ============================================================
// CONFIG
// ============================================================
const UPGRADES = [
  { id:'hp',        name:'HULL PLATING',     desc:'+1 max heart per level.',           max:6, cost:l=>50+l*70 },
  { id:'dmg',       name:'PLASMA YIELD',     desc:'+15% damage per level.',            max:8, cost:l=>40+l*40 },
  { id:'fire',      name:'TRIGGER HARMONICS',desc:'+10% fire rate per level.',         max:8, cost:l=>50+l*45 },
  { id:'speed',     name:'ION THRUSTERS',    desc:'+8% movement speed per level.',     max:6, cost:l=>40+l*35 },
  { id:'boost',     name:'AFTERBURNER',      desc:'+25% boost fuel & regen per level.',max:5, cost:l=>60+l*45 },
  { id:'shield',    name:'AETHER REGEN',     desc:'Regen 1 heart per 12s per level.',  max:5, cost:l=>120+l*80 },
  { id:'magnet',    name:'GRAV MAGNET',      desc:'Pulls shards from farther.',        max:5, cost:l=>40+l*40 },
  { id:'multishot', name:'SPLIT BARREL',     desc:'+1 bullet to spread modes.',        max:3, cost:l=>180+l*150 },
  { id:'crit',      name:'PRECISION CORE',   desc:'+8% crit chance (×2 dmg) per lvl.', max:5, cost:l=>100+l*80 },
  { id:'pierce',    name:'PIERCE ROUNDS',    desc:'Bullets pierce +1 enemy per level.',max:3, cost:l=>200+l*180 },
  { id:'lifesteal', name:'VAMPIRIC CORE',    desc:'3% chance to heal on kill / lvl.',  max:5, cost:l=>250+l*180 },
  { id:'luck',      name:'FORTUNE FIELD',    desc:'+5% powerup drop chance per lvl.',  max:5, cost:l=>120+l*90 },
  { id:'dodge',     name:'PHASE GENERATOR',  desc:'+5% chance to phase through hits.', max:5, cost:l=>200+l*150 },
];
const SHOP_WEAPONS = [
  { id:'single', name:'PLASMA',      cost:0,    desc:'Standard rapid plasma bolt — owned by default.' },
  { id:'spread', name:'SPREAD',      cost:200,  desc:'Wide cone of bullets, great for crowds.' },
  { id:'rapid',  name:'PULSE',       cost:300,  desc:'High fire rate, lower per-shot damage.' },
  { id:'wave',   name:'AETHER WAVE', cost:500,  desc:'Sine-wave shots that weave around cover.' },
  { id:'heavy',  name:'RAILGUN',     cost:600,  desc:'Heavy piercing slug. High damage, slow rate.' },
  { id:'flame',  name:'PLASMA FLAME',cost:800,  desc:'Short-range stream that melts through targets.' },
  { id:'lance',  name:'ION LANCE',   cost:1100, desc:'Continuous beam that locks on. Drains energy.' },
  { id:'cluster',name:'CLUSTER POD', cost:1400, desc:'Fires a pod that splits into 6 micro-missiles.' },
  { id:'shock',  name:'SHOCK ORB',   cost:1700, desc:'Slow orb that chains lightning between enemies.' },
  { id:'void',   name:'VOID CANNON', cost:2400, desc:'Devastating black-hole shot. Sucks enemies in.' },
];
const SHOP_CONSUMABLES = [
  { id:'heal',     name:'NANO REPAIR KIT',  cost:60,  cap:9, desc:'Use (key 1) — restores 2 hearts.' },
  { id:'shield',   name:'AEGIS CHARGE',     cost:90,  cap:9, desc:'Use (key 2) — 6s of shielding.' },
  { id:'bomb',     name:'NOVA BOMB',        cost:120, cap:9, desc:'Use (key 3) — clears the screen.' },
  { id:'overdrive',name:'OVERDRIVE STIM',   cost:140, cap:9, desc:'Use (key 4) — 8s rapid + double damage.' },
  { id:'timefreeze',name:'CHRONO INHIBITOR',cost:180, cap:9, desc:'Use (key 5) — 5s slow time on enemies.' },
  { id:'revive',   name:'PHOENIX FEATHER',  cost:400, cap:3, desc:'Auto-revive on death with full HP.' },
  { id:'fuelcell', name:'FUEL CELL',        cost:50,  cap:9, desc:'Use (key 6) — fully refills boost fuel.' },
  { id:'shardpack',name:'SHARD CACHE',      cost:200, cap:5, desc:'Use anytime — instantly grants 100 ◈.' },
  { id:'turret',   name:'DEPLOYABLE TURRET',cost:260, cap:5, desc:'Use (key 7) — drops a turret for 15s.' },
];
const SHOP_SPECIALS = [
  { id:'autoRepair', name:'AUTO-REPAIR DRONE', cost:1500, desc:'Doubles regen rate when standing still 3s.' },
  { id:'drone',      name:'COMBAT DRONE',      cost:1800, desc:'A small drone fires alongside you.' },
  { id:'shockwave',  name:'IMPACT SHOCKWAVE',  cost:1200, desc:'Take damage = release a shockwave.' },
  { id:'magnetMax',  name:'OMNI MAGNET',       cost:900,  desc:'Shards seek you regardless of distance.' },
  { id:'reflect',    name:'KINETIC REFLECTOR', cost:1600, desc:'Shielded hits reflect bullets back.' },
  { id:'thermal',    name:'THERMAL EXHAUST',   cost:1100, desc:'Boosting damages enemies behind you.' },
  { id:'overcharge', name:'OVERCHARGE CORE',   cost:2200, desc:'Every 5th shot is a free crit.' },
  { id:'cryo',       name:'CRYO ROUNDS',       cost:1400, desc:'Bullets briefly freeze hit enemies.' },
  { id:'vampPulse',  name:'VAMP PULSE',        cost:2000, desc:'Killing 5 in a row triggers a heal pulse.' },
  { id:'shieldAura', name:'KINETIC AURA',      cost:2600, desc:'Permanent passive damage reduction (15%).' },
  { id:'doubleXP',   name:'PRIME PROCESSOR',   cost:1800, desc:'+50% score and shard rewards.' },
  { id:'gravWell',   name:'GRAV WELL',         cost:2400, desc:'On heavy hit, pulls enemies briefly.' },
];
const SKINS = [
  { id:'default', name:'NOVA',     cost:0,    color:'#00eaff', accent:'#ffea00', glow:'#00f7ff', tagline:'Standard pilot livery. Cyan neon trim.',
    ability:{ name:'WARP DASH',     cd:8000,  desc:'Instant burst of speed.' } },
  { id:'crimson', name:'CRIMSON',  cost:300,  color:'#ff3355', accent:'#ffea00', glow:'#ff3355', tagline:'Aggressive red plating, scarlet exhaust.',
    ability:{ name:'BERSERK',       cd:18000, desc:'5s of doubled damage.' } },
  { id:'void',    name:'VOID',     cost:500,  color:'#aa55ff', accent:'#ff00cc', glow:'#aa55ff', tagline:'Twilight purple with magenta engines.',
    ability:{ name:'PHASE SHIFT',   cd:14000, desc:'Teleport forward, brief invuln.' } },
  { id:'solar',   name:'SOLAR',    cost:700,  color:'#ffaa00', accent:'#ff5500', glow:'#ffcc55', tagline:'Sun-flare gold and ember orange.',
    ability:{ name:'SOLAR FLARE',   cd:16000, desc:'Radial burst, damages all near.' } },
  { id:'glacier', name:'GLACIER',  cost:850,  color:'#88ddff', accent:'#ffffff', glow:'#bbeeff', tagline:'Frozen white-blue with icy contrails.',
    ability:{ name:'CRYO BLAST',    cd:18000, desc:'Freezes nearby enemies for 4s.' } },
  { id:'neon',    name:'NEON',     cost:950,  color:'#33ff88', accent:'#ff33aa', glow:'#33ff88', tagline:'Loud neon green/magenta arcade vibes.',
    ability:{ name:'HOLO DECOY',    cd:14000, desc:'Spawns a decoy that draws fire.' } },
  { id:'toxic',   name:'TOXIC',    cost:1000, color:'#aaff00', accent:'#66ff44', glow:'#aaff00', tagline:'Chemical green with hazard stripes.',
    ability:{ name:'ACID CLOUD',    cd:16000, desc:'Drops a poison field at your spot.' } },
  { id:'prism',   name:'PRISM',    cost:1100, color:'#00ffaa', accent:'#aa00ff', glow:'#00ffaa', rainbow:true, tagline:'Color-shifting hull. Hypnotic.',
    ability:{ name:'SPECTRUM BURST',cd:20000, desc:'Fires 24 bullets in all directions.' } },
  { id:'royal',   name:'ROYAL',    cost:1200, color:'#3355ff', accent:'#ffd700', glow:'#5577ff', tagline:'Deep sapphire with gold filigree.',
    ability:{ name:'AEGIS GUARD',   cd:22000, desc:'6s of full invulnerability.' } },
  { id:'phoenix', name:'PHOENIX',  cost:1500, color:'#ff6600', accent:'#ffee00', glow:'#ff8800', tagline:'Reborn flame plating. Eternal.',
    ability:{ name:'PHOENIX DIVE',  cd:25000, desc:'Explosive dive that heals you 1.' } },
  { id:'shadow',  name:'SHADOW',   cost:1700, color:'#444466', accent:'#ff0066', glow:'#993366', dark:true, tagline:'Pitch-black assassin frame.',
    ability:{ name:'CLOAK',         cd:18000, desc:'Invisible to enemies for 5s.' } },
  { id:'eclipse', name:'ECLIPSE',  cost:1800, color:'#222244', accent:'#ffffff', glow:'#88aaff', dark:true, tagline:'Lunar matte black with halo glow.',
    ability:{ name:'BLACK HOLE',    cd:24000, desc:'Pulls all enemies into a singularity.' } },
  { id:'aurora',  name:'AURORA',   cost:2200, color:'#66ffcc', accent:'#cc99ff', glow:'#88ffdd', tagline:'Polar light shimmer across the hull.',
    ability:{ name:'HEALING WAVE',  cd:25000, desc:'+2 hearts and clears all bullets.' } },
  { id:'inferno', name:'INFERNO',  cost:2500, color:'#ff2200', accent:'#ffaa00', glow:'#ff4400', tagline:'Magma core. Engines burn white-hot.',
    ability:{ name:'FLAME TRAIL',   cd:14000, desc:'8s of burning trail behind ship.' } },
  { id:'celestial',name:'CELESTIAL',cost:3000,color:'#ffeebb', accent:'#ffd700', glow:'#fff7c0', tagline:'Legendary divine plating. Glows softly.',
    ability:{ name:'DIVINE BEAM',   cd:28000, desc:'A massive forward beam vaporizes all in a line.' } },
];
// extend save defaults for new specials/weapons
function ensureSaveCompat(){
  for(const w of SHOP_WEAPONS) if(save.weapons[w.id]===undefined) save.weapons[w.id] = (w.id==='single');
  for(const sp of SHOP_SPECIALS) if(save.specials[sp.id]===undefined) save.specials[sp.id] = false;
  for(const c of SHOP_CONSUMABLES) if(save.consumables[c.id]===undefined) save.consumables[c.id] = 0;
  for(const s of SKINS) if(save.skins[s.id]===undefined) save.skins[s.id] = (s.id==='default');
}
ensureSaveCompat();
const WEAPONS = [
  { id:'single',  name:'PLASMA',      cd:240, dmg:10, speed:11, draw:'#00eaff' },
  { id:'spread',  name:'SPREAD',      cd:320, dmg:8,  speed:10, draw:'#ffea00' },
  { id:'rapid',   name:'PULSE',       cd:95,  dmg:5,  speed:13, draw:'#00ffaa' },
  { id:'wave',    name:'AETHER WAVE', cd:380, dmg:6,  speed:9,  draw:'#ff66cc', wave:true },
  { id:'heavy',   name:'RAILGUN',     cd:540, dmg:35, speed:16, draw:'#ff66ff', big:true },
  { id:'flame',   name:'PLASMA FLAME',cd:60,  dmg:4,  speed:10, draw:'#ff5500' },
  { id:'lance',   name:'ION LANCE',   cd:140, dmg:14, speed:24, draw:'#ffffff' },
  { id:'cluster', name:'CLUSTER POD', cd:600, dmg:12, speed:8,  draw:'#ffaa00' },
  { id:'shock',   name:'SHOCK ORB',   cd:520, dmg:14, speed:6,  draw:'#ffea00' },
  { id:'void',    name:'VOID CANNON', cd:900, dmg:30, speed:7,  draw:'#aa55ff' },
];
const DIFFICULTY = {
  easy:   { enemyHp:0.5, enemyDmg:1, enemySpd:0.6, fireRate:1.6, shardMul:1.0, hpStart:8 },
  medium: { enemyHp:0.8, enemyDmg:1, enemySpd:0.85,fireRate:1.2, shardMul:1.2, hpStart:6 },
  hard:   { enemyHp:1.2, enemyDmg:1, enemySpd:1.1, fireRate:0.9, shardMul:1.6, hpStart:4 },
};

// ============================================================
// STATE
// ============================================================
const keys = {};
function resetKeys(){
  // Snap every tracked key back to false. Called on phase changes,
  // window blur, and visibility loss so a "stuck key" can't survive
  // a menu transition or alt-tab and silently drive the ship.
  for(const k in keys) keys[k] = false;
}
addEventListener('keydown', e => {
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  const k = e.key.toLowerCase();
  // Only register movement/fire/boost keys when the game is actually
  // running. Menu interactions (Enter to confirm, etc.) used to leak
  // their keydown into the play phase and wedge the ship.
  const playing = state && (state.phase==='play' || state.phase==='pvp' || state.phase==='tutorial');
  if(playing) keys[k] = true;
  if(state.phase==='play'){
    if(k==='c') cycleWeapon();
    if(k==='q') triggerAbility();
    if(k==='p') pause();
    if(k==='escape') pause();
    if(k==='1') useConsumable('heal');
    if(k==='2') useConsumable('shield');
    if(k==='3') useConsumable('bomb');
  } else if(state.phase==='paused'){
    if(k==='p' || k==='escape') resume();
  } else if(state.phase==='tutorial'){
    if(k==='c') cycleWeapon();
    if(k==='enter' || k===' ') tutAdvance();
  }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
// Defensive: on focus loss the OS won't deliver the keyup, so keys
// can wedge "true" forever. Drop them all when we lose focus.
addEventListener('blur', resetKeys);
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) resetKeys(); });

