'use strict';
// ============================================================
// SURVIVAL FLOW
// ============================================================
function startSurvival(diff){
  state.diff = diff;
  state.mode = 'survival';
  state.lastBossTier = null;
  state.bossArenaMode = false;
  Object.assign(state, {
    phase:'play', round:1, enemies:[], bullets:[], ebullets:[],
    particles:[], shards:[], powerups:[], boss:null, score:0,
    earnedThisRun:0, spawnTimer:0, spawnedThisRound:0, weaponIdx:0,
    fx:{rapid:0,dmg:0,slow:0}, ai:null,
    blackHole:null, beam:null, decoy:null, acidCloud:null,
    solarSun:null, drones:null, voidWells:null, hitStop:0,
    combo:{count:0,timer:0,mult:1,killTime:0},
  });
  if(typeof resetKeys==='function') resetKeys();
  player = makePlayer();
  hideOverlay();
  showHUD(false);
  document.getElementById('minimap').style.display = 'block';
  ac();
  beginRound(1);
}
function beginRound(r){
  state.round = r;
  state.spawnedThisRound = 0;
  state.spawnTimer = 60;
  state.travel = 0;
  // Quick rounds early, ramp up later
  state.travelGoal = r<=3 ? (1200 + r*300) : (2200 + r*500);
  if(r===5) achievement('FIRST BOSS');
  if(r===10) achievement('VETERAN');
  if(r===20) achievement('ASCENDANT');
  if(r===50) achievement('VOID WALKER');
  document.getElementById('roundTxt').textContent = 'ROUND '+r;
  if(r%5===0){
    state.toClear = 1;
    state.travelGoal = Infinity;
    spawnBoss(r);
    toast('⚠ BOSS WAVE');
    if(typeof setMusicMode==='function'){
      const tier = state.boss && state.boss.tier;
      setMusicMode(tier===5 ? 'final-boss' : 'boss');
    }
  } else {
    document.getElementById('bossBar').style.display='none';
    state.boss = null;
    state.toClear = 6 + r*2;
    if(typeof setMusicMode==='function') setMusicMode('play');
  }
}
function endRound(){
  const d = DIFFICULTY[state.diff];
  const reward = Math.round((50 + state.round*12)*d.shardMul);
  save.credits += reward;
  state.earnedThisRun += reward;
  if(state.score>save.best) save.best = state.score;
  persist();
  // Boss arena: end the run with a victory screen (gated to bossArenaMode).
  if(state.bossArenaMode){
    state.phase = 'between';
    setTimeout(()=>{
      document.getElementById('overSummary').textContent = `BOSS DEFEATED · TIER ${state.lastBossTier}`;
      document.getElementById('overEarn').textContent = `+${state.earnedThisRun} ◈ shards earned`;
      document.querySelector('#menuOver h1').textContent = 'VICTORY';
      showMenu('menuOver');
      hideHUD();
    }, 800);
    return;
  }
  // Seamless: no pause, no phase flip, no setTimeout. The toast appears,
  // explosion particles keep rendering, and the next wave's spawn timer
  // (state.spawnTimer = 60 in beginRound) gives a natural ~1s breath
  // before new enemies arrive.
  toast('ROUND '+state.round+' CLEARED · +'+reward+' ◈');
  beginRound(state.round + 1);
}

function pause(){
  if(state.phase!=='play') return;
  state.phase='paused';
  showMenu('menuPause');
  hideHUD();
}
function resume(){
  if(state.phase!=='paused') return;
  state.phase='play';
  hideOverlay();
  showHUD(state.mode==='pvp');
}
function quitToMenu(){
  state.phase='menu';
  hideHUD();
  showMenu('menuMain');
  if(typeof setMusicMode==='function') setMusicMode('menu');
}

// ============================================================
// SHOP
// ============================================================
function openShop(midRun){
  state.shopMidRun = !!midRun;
  showMenu('menuShop');
  renderShop();
}
function renderShop(){
  document.getElementById('shopCredits').textContent = save.credits;
  const grid = document.getElementById('shopGrid');
  grid.innerHTML = '';
  const iconBox = ()=> '<div class="iconBox"><canvas width="60" height="60"></canvas></div>';
  const drawIcon = (div, type, id)=>{
    const c = div.querySelector('.iconBox canvas');
    if(c) drawShopIcon(c.getContext('2d'), type, id);
  };
  if(shopTab==='up'){
    for(const u of UPGRADES){
      const lvl = save.upgrades[u.id]||0;
      const maxed = lvl>=u.max;
      const c = maxed?0:u.cost(lvl);
      const dots = Array.from({length:u.max},(_,i)=>`<div class="dot ${i<lvl?'on':''}"></div>`).join('');
      const div = document.createElement('div');
      div.className='item';
      div.innerHTML = `
        ${iconBox()}
        <div class="info">
          <h3>${u.name}</h3>
          <div class="lvl">${dots}</div>
          <p>${u.desc}</p>
        </div>
        <div class="actions">
          <span class="price">${maxed?'MAX':'◈ '+c}</span>
          <button class="btn buy small" ${maxed||save.credits<c?'disabled':''} data-up="${u.id}">${maxed?'MAXED':'BUY'}</button>
        </div>`;
      grid.appendChild(div);
      drawIcon(div, 'up', u.id);
    }
  } else if(shopTab==='weapon'){
    for(const w of SHOP_WEAPONS){
      const owned = !!save.weapons[w.id];
      const div = document.createElement('div');
      div.className='item';
      div.innerHTML = `
        ${iconBox()}
        <div class="info">
          <h3 style="color:#00eaff">${w.name}</h3>
          <p>${w.desc}</p>
        </div>
        <div class="actions">
          <span class="price">${owned?'OWNED':'◈ '+w.cost}</span>
          <button class="btn buy small" ${owned?'disabled':''} ${(!owned&&save.credits<w.cost)?'disabled':''} data-weapon="${w.id}">
            ${owned?'OWNED':'BUY'}
          </button>
        </div>`;
      grid.appendChild(div);
      drawIcon(div, 'weapon', w.id);
    }
  } else if(shopTab==='skin'){
    for(const s of SKINS){
      const owned = save.skins[s.id];
      const equipped = save.skin===s.id;
      const div = document.createElement('div');
      div.className='item skin';
      div.innerHTML = `
        <canvas width="120" height="70"></canvas>
        <div class="info">
          <h3 style="color:${s.color}">${s.name}</h3>
          <p>${s.tagline||'Custom hull plating &amp; engine glow.'}</p>
          <p style="color:${s.color}">Glow: ${s.glow} · Accent: ${s.accent}${s.rainbow?' · ✦ Rainbow':''}${s.dark?' · ☾ Stealth':''}</p>
        </div>
        <div class="actions">
          <span class="price">${owned?(equipped?'EQUIPPED':'OWNED'):'◈ '+s.cost}</span>
          <button class="btn buy small" ${equipped?'disabled':''} ${(!owned&&save.credits<s.cost)?'disabled':''} data-skin="${s.id}">
            ${equipped?'EQUIPPED':(owned?'EQUIP':'BUY')}
          </button>
        </div>`;
      grid.appendChild(div);
      drawShipPreview(div.querySelector('canvas').getContext('2d'), s, 120, 70);
    }
  } else if(shopTab==='consume'){
    for(const it of SHOP_CONSUMABLES){
      const owned = save.consumables[it.id]||0;
      const full = owned>=it.cap;
      const div = document.createElement('div');
      div.className='item';
      div.innerHTML = `
        ${iconBox()}
        <div class="info">
          <h3 style="color:#00ffaa">${it.name} <span class="pill">${owned}/${it.cap}</span></h3>
          <p>${it.desc}</p>
        </div>
        <div class="actions">
          <span class="price">${full?'FULL':'◈ '+it.cost}</span>
          <button class="btn buy small" ${full||save.credits<it.cost?'disabled':''} data-consume="${it.id}">${full?'FULL':'BUY'}</button>
        </div>`;
      grid.appendChild(div);
      drawIcon(div, 'consume', it.id);
    }
  } else if(shopTab==='special'){
    for(const sp of SHOP_SPECIALS){
      const owned = !!save.specials[sp.id];
      const div = document.createElement('div');
      div.className='item';
      div.innerHTML = `
        ${iconBox()}
        <div class="info">
          <h3 style="color:#ff66cc">${sp.name}</h3>
          <p>${sp.desc}</p>
        </div>
        <div class="actions">
          <span class="price">${owned?'OWNED':'◈ '+sp.cost}</span>
          <button class="btn buy small" ${owned?'disabled':''} ${(!owned&&save.credits<sp.cost)?'disabled':''} data-special="${sp.id}">
            ${owned?'OWNED':'BUY'}
          </button>
        </div>`;
      grid.appendChild(div);
      drawIcon(div, 'special', sp.id);
    }
  }
  grid.querySelectorAll('button[data-up]').forEach(b=>{
    b.onclick = ()=>{
      const id = b.getAttribute('data-up');
      const u = UPGRADES.find(x=>x.id===id);
      const lvl = save.upgrades[id]||0;
      if(lvl>=u.max) return;
      const c = u.cost(lvl);
      if(save.credits<c) return;
      save.credits -= c; save.upgrades[id] = lvl+1;
      if(player && id==='hp'){ player.maxHp++; player.hp++; }
      persist(); renderShop(); toast(u.name+' upgraded');
    };
  });
  grid.querySelectorAll('button[data-skin]').forEach(b=>{
    b.onclick = ()=>{
      const id = b.getAttribute('data-skin');
      const s = SKINS.find(x=>x.id===id);
      if(!save.skins[id]){
        if(save.credits<s.cost) return;
        save.credits -= s.cost; save.skins[id]=true;
      }
      save.skin = id;
      if(player) player.skin = s;
      persist(); renderShop(); toast('Equipped '+s.name);
    };
  });
  grid.querySelectorAll('button[data-weapon]').forEach(b=>{
    b.onclick = ()=>{
      const id = b.getAttribute('data-weapon');
      const w = SHOP_WEAPONS.find(x=>x.id===id);
      if(save.weapons[id]) return;
      if(save.credits<w.cost) return;
      save.credits -= w.cost; save.weapons[id]=true;
      persist(); renderShop(); toast(w.name+' unlocked');
    };
  });
  grid.querySelectorAll('button[data-consume]').forEach(b=>{
    b.onclick = ()=>{
      const id = b.getAttribute('data-consume');
      const it = SHOP_CONSUMABLES.find(x=>x.id===id);
      const owned = save.consumables[id]||0;
      if(owned>=it.cap) return;
      if(save.credits<it.cost) return;
      save.credits -= it.cost; save.consumables[id] = owned+1;
      persist(); renderShop(); toast('+1 '+it.name);
    };
  });
  grid.querySelectorAll('button[data-special]').forEach(b=>{
    b.onclick = ()=>{
      const id = b.getAttribute('data-special');
      const sp = SHOP_SPECIALS.find(x=>x.id===id);
      if(save.specials[id]) return;
      if(save.credits<sp.cost) return;
      save.credits -= sp.cost; save.specials[id]=true;
      persist(); renderShop(); toast(sp.name+' acquired');
    };
  });
}

// Close-shop: mid-run shop is now opened from the pause menu, so return there.
document.getElementById('closeShop').onclick = ()=>{
  if(state.shopMidRun){
    state.shopMidRun = false;
    showMenu('menuPause');
  } else if(state.phase==='dead'){
    showMenu('menuOver');
  } else {
    showMenu('menuMain');
  }
};

// ============================================================
// POWERUPS
// ============================================================
const POWERUP_KINDS = ['heal','shield','weapon','rapid','dmg','slow','bomb'];
function powerupColor(k){ return ({heal:'#00ffaa',shield:'#ffea00',weapon:'#ff66cc',rapid:'#66bbff',dmg:'#ff5566',slow:'#aa88ff',bomb:'#ff9933'})[k]; }
function powerupGlyph(k){ return ({heal:'+',shield:'◈',weapon:'⚙',rapid:'»',dmg:'!',slow:'⏱',bomb:'✕'})[k]; }
function useConsumable(id){
  if(!save.consumables[id] || save.consumables[id]<=0){ toast('No '+id+' left'); return; }
  save.consumables[id]--;
  if(id==='heal'){ player.hp = Math.min(player.maxHp, player.hp+2); toast('+2 HEARTS'); }
  else if(id==='shield'){ player.inv = Math.max(player.inv,6000); toast('SHIELD 6s'); }
  else if(id==='bomb'){
    state.shake = 24;
    for(const e of state.enemies){ e.hp = -1; explode(e.x,e.y,'#ff9933',30,1.5); }
    for(const b of state.ebullets){ b.life = 0; }
    if(state.boss) state.boss.hp = Math.max(1, state.boss.hp-150);
    toast('NOVA BOMB!');
  }
  persist();
}
function applyPowerup(k){
  if(k==='heal'){ player.hp = Math.min(player.maxHp, player.hp+1); toast('+1 HEART'); }
  else if(k==='shield'){ player.inv = 4500; toast('SHIELD 4.5s'); }
  else if(k==='weapon'){ cycleWeapon(); }
  else if(k==='rapid'){ state.fx.rapid = 10000; toast('RAPID FIRE'); }
  else if(k==='dmg'){ state.fx.dmg = 10000; toast('DOUBLE DAMAGE'); }
  else if(k==='slow'){ state.fx.slow = 5000; toast('SLOW TIME'); }
  else if(k==='bomb'){
    state.shake = 24;
    for(const e of state.enemies){ e.hp = -1; explode(e.x,e.y,'#ff9933',30,1.5); }
    for(const b of state.ebullets){ b.life = 0; }
    if(state.boss) state.boss.hp = Math.max(1, state.boss.hp-100);
    toast('BOMB!');
  }
}

