'use strict';
// ============================================================
// MAIN LOOP
// ============================================================
// ENHANCEMENT SYSTEMS (sfx, combo, achievements, hit-stop, minimap)
// ============================================================
// --- SFX (WebAudio synth, no assets) ---
let audioCtx;
function ac(){ try{ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} return audioCtx; }

// ============================================================
// BACKGROUND MUSIC — looping <audio> tracks with crossfade
// ============================================================
// Track files live in /audio. Loops are gapless via 'ended' relisten.
// 'menu' and 'play' eager-load on first interaction; the heavier
// boss/enrage/final/victory/gameover tracks lazy-load on demand so
// the initial page weight stays small.
const MUSIC_TRACKS = {
  menu:       { src:'audio/01_The_Slow_Descent.mp3',          loop:true,  vol:0.55, eager:true  },
  play:       { src:'audio/02_Glass_Horizon.mp3',             loop:true,  vol:0.55, eager:true  },
  boss:       { src:'audio/03_Remnants_of_a_Fallen_Star.mp3', loop:true,  vol:0.60, eager:false },
  'boss-enrage':{src:'audio/04_Gravity_Well_Ascent.mp3',      loop:true,  vol:0.65, eager:false },
  'final-boss':{src:'audio/05_The_Last_Warden.mp3',           loop:true,  vol:0.65, eager:false },
  victory:    { src:'audio/06_Beyond_The_High_Score.mp3',     loop:false, vol:0.70, eager:false },
  gameover:   { src:'audio/07_Where_the_Sound_Ends.mp3',      loop:true,  vol:0.50, eager:false },
};

const music = {
  mode: 'menu',          // last requested mode
  current: null,         // currently audible Audio element
  elements: {},          // mode -> Audio
  enabled: true,         // mirrors save.music
  fadeMs: 700,
  _fadeTimers: new WeakMap(),
};

function _ensureTrack(mode){
  const def = MUSIC_TRACKS[mode]; if(!def) return null;
  let el = music.elements[mode];
  if(!el){
    el = new Audio(def.src);
    el.loop = def.loop;
    el.preload = def.eager ? 'auto' : 'none';
    el.volume = 0;
    // Defensive: some mobile browsers don't honour loop reliably.
    if(def.loop){
      el.addEventListener('ended', ()=>{ try{ el.currentTime = 0; el.play(); }catch(e){} });
    }
    music.elements[mode] = el;
  }
  return el;
}

function _fadeTo(el, target, ms){
  if(!el) return;
  const prev = music._fadeTimers.get(el);
  if(prev) clearInterval(prev);
  const start = el.volume;
  const t0 = performance.now();
  const tick = setInterval(()=>{
    const p = Math.min(1, (performance.now()-t0)/ms);
    el.volume = start + (target-start)*p;
    if(p>=1){
      clearInterval(tick);
      music._fadeTimers.delete(el);
      if(target===0){ try{ el.pause(); }catch(e){} }
    }
  }, 20);
  music._fadeTimers.set(el, tick);
}

function startMusic(){
  // Eager-load the lightweight tracks so first transitions are instant.
  for(const m in MUSIC_TRACKS){
    if(MUSIC_TRACKS[m].eager) _ensureTrack(m);
  }
  setMusicMode(music.mode);
}

function setMusicMode(mode){
  mode = mode || 'menu';
  music.mode = mode;
  const next = _ensureTrack(mode);
  if(!next) return;
  const prev = music.current;
  if(prev === next){
    if(music.enabled && next.paused){ try{ next.play(); }catch(e){} }
    return;
  }
  const def = MUSIC_TRACKS[mode];
  const targetVol = music.enabled ? def.vol : 0;
  if(prev) _fadeTo(prev, 0, music.fadeMs);
  music.current = next;
  if(music.enabled){
    try{
      next.currentTime = 0;
      const p = next.play();
      if(p && p.catch) p.catch(()=>{}); // autoplay block; will retry on next interaction
    }catch(e){}
    _fadeTo(next, targetVol, music.fadeMs);
  } else {
    next.volume = 0;
  }
}

// Fire-and-forget one-shot stinger (e.g. victory). Doesn't replace current bed.
function playMusicSting(mode){
  const el = _ensureTrack(mode); if(!el || !music.enabled) return;
  try{
    el.currentTime = 0;
    el.volume = MUSIC_TRACKS[mode].vol;
    const p = el.play();
    if(p && p.catch) p.catch(()=>{});
  }catch(e){}
}

function setMusicVolume(on){
  music.enabled = !!on;
  const cur = music.current;
  if(!cur) return;
  if(on){
    try{ if(cur.paused) cur.play(); }catch(e){}
    _fadeTo(cur, MUSIC_TRACKS[music.mode].vol, 300);
  } else {
    _fadeTo(cur, 0, 300);
  }
}

// Boot music on first user interaction (browsers block autoplay)
function _firstInteract(){
  startMusic();
  if(!save.music) setMusicVolume(false);
  document.removeEventListener('click', _firstInteract);
  document.removeEventListener('keydown', _firstInteract);
  document.removeEventListener('touchstart', _firstInteract);
}
document.addEventListener('click', _firstInteract);
document.addEventListener('keydown', _firstInteract);
document.addEventListener('touchstart', _firstInteract);
function sfx(type){
  const a = ac(); if(!a || a.state==='suspended') { try{ a && a.resume(); }catch(e){} }
  if(!a) return;
  const t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.connect(g); g.connect(a.destination);
  let f0=440, f1=220, dur=0.08, type2='square', vol=0.06;
  if(type==='shoot'){ f0=900; f1=400; dur=0.06; type2='square'; vol=0.04; }
  else if(type==='hit'){ f0=300; f1=120; dur=0.05; type2='square'; vol=0.05; }
  else if(type==='kill'){ f0=200; f1=60;  dur=0.18; type2='sawtooth'; vol=0.08; }
  else if(type==='boom'){ f0=100; f1=30;  dur=0.4;  type2='sawtooth'; vol=0.1; }
  else if(type==='shard'){f0=1400;f1=2200;dur=0.08; type2='triangle'; vol=0.05; }
  else if(type==='hurt'){ f0=180; f1=80;  dur=0.18; type2='sawtooth'; vol=0.08; }
  else if(type==='power'){f0=600; f1=1400;dur=0.18; type2='triangle'; vol=0.06; }
  else if(type==='ability'){f0=200;f1=1600;dur=0.3; type2='sawtooth'; vol=0.08; }
  else if(type==='combo'){f0=800; f1=1200;dur=0.06; type2='square'; vol=0.04; }
  else if(type==='achieve'){f0=400;f1=1800;dur=0.4; type2='triangle'; vol=0.07; }
  o.type = type2;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20,f1), t+dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t+dur);
  o.start(t); o.stop(t+dur);
}

