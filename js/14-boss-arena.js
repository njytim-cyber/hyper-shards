'use strict';
// ============================================================
// BOSS ARENA + BOSS SELECT
// ============================================================
const BOSS_LIST = [
  { tier:1, key:'harbinger', name:'VOID HARBINGER', color:'#ff66cc', desc:'The first warden. Spinning rings + aimed bursts.' },
  { tier:2, key:'leviathan', name:'VOID LEVIATHAN', color:'#ff8866', desc:'Adds spiral barrages and faster movement.' },
  { tier:3, key:'oblivion',  name:'VOID OBLIVION',  color:'#88ccff', desc:'Cross-laser sweeps + summons UFOs in rage.' },
  { tier:4, key:'sunderer',  name:'VOID SUNDERER',  color:'#ffaa00', desc:'Spawns kamikazes and double summons.' },
  { tier:5, key:'empress',   name:'VOID EMPRESS',   color:'#aa66ff', desc:'Final form — every pattern, max chaos.' },
];

function startBossFight(tier){
  state.diff = 'medium';
  state.mode = 'survival';
  state.lastBossTier = tier;
  Object.assign(state, {
    phase:'play', round:tier*5, enemies:[], bullets:[], ebullets:[],
    particles:[], shards:[], powerups:[], boss:null, score:0,
    earnedThisRun:0, spawnTimer:0, spawnedThisRound:0, weaponIdx:0,
    fx:{rapid:0,dmg:0,slow:0}, ai:null,
    blackHole:null, beam:null, decoy:null, acidCloud:null,
    solarSun:null, drones:null, voidWells:null, hitStop:0,
    combo:{count:0,timer:0,mult:1,killTime:0},
    bossArenaMode:true,
  });
  if(typeof resetKeys==='function') resetKeys();
  player = makePlayer();
  hideOverlay(); showHUD(false);
  document.getElementById('minimap').style.display = 'block';
  ac();
  // Manual boss spawn
  state.toClear = 1;
  state.travel = 0;
  state.travelGoal = Infinity;
  spawnBoss(tier*5);
  document.getElementById('roundTxt').textContent = 'BOSS · '+state.boss.name;
  toast('⚠ '+state.boss.name);
  if(typeof setMusicMode==='function') setMusicMode(tier===5 ? 'final-boss' : 'boss');
}

function renderBossList(){
  const list = document.getElementById('bossList');
  if(!list) return;
  list.innerHTML = '';
  for(const b of BOSS_LIST){
    const btn = document.createElement('button');
    btn.className = 'btnEpic boss';
    btn.style.setProperty('--c1', b.color);
    btn.style.setProperty('--c2', '#ffaa00');
    btn.innerHTML = `
      <span class="ic"><canvas data-bossicon="${b.tier}" width="96" height="96"></canvas></span>
      <span class="lbl"><span class="t">TIER ${b.tier} · ${b.name}</span><span class="s">${b.desc}</span></span>
      <span class="arrow">›</span>`;
    btn.onclick = ()=> startBossFight(b.tier);
    list.appendChild(btn);
    const c = btn.querySelector('canvas');
    drawBossIcon(c.getContext('2d'), b.tier, b.color);
  }
}
// Re-render menu-specific content whenever the hub menus open. Used to
// be inside a 33ms setInterval; now only fires on actual menu entry.
const _showMenuOrig = showMenu;
showMenu = function(id, fade){
  _showMenuOrig(id, fade);
  if(id==='menuBoss') renderBossList();
  if(id==='menuMain' && typeof updateHubInfo === 'function') updateHubInfo();
};

// Draw a chibi 3D boss head for the icon
function drawBossIcon(g, tier, color){
  g.save();
  g.clearRect(0,0,96,96);
  g.translate(48,52);
  const OUTLINE = '#0a0f1c';

  // Drop shadow
  g.save(); g.translate(0,5);
  g.fillStyle = OUTLINE;
  g.beginPath(); g.arc(0,0,30,0,Math.PI*2); g.fill();
  g.restore();

  // Outer ring (rotating)
  g.strokeStyle = color; g.lineWidth = 3;
  for(let i=0;i<3;i++){
    g.beginPath();
    g.arc(0,0, 28-i*4, i*0.8, i*0.8 + Math.PI*1.4);
    g.stroke();
  }

  // Body — multi-pointed star (like the in-game boss)
  function bodyPath(g){
    const pts = 8;
    g.beginPath();
    for(let i=0;i<pts*2;i++){
      const r = i%2===0 ? 24 : 16;
      const a = i/(pts*2)*Math.PI*2;
      const x = Math.cos(a)*r, y=Math.sin(a)*r;
      if(i===0) g.moveTo(x,y); else g.lineTo(x,y);
    }
    g.closePath();
  }
  // Layered depth (multiple offsets to fake 3D)
  for(let z=4;z>=0;z--){
    g.save(); g.translate(0,z*0.8);
    g.fillStyle = z===0 ? color : '#0a0f1c';
    bodyPath(g); g.fill();
    g.restore();
  }
  // Outline
  g.strokeStyle = OUTLINE; g.lineWidth = 2.5; g.lineJoin='round';
  bodyPath(g); g.stroke();
  // Highlight
  g.save(); bodyPath(g); g.clip();
  const hi = g.createLinearGradient(0,-26,0,0);
  hi.addColorStop(0,'#ffffffcc'); hi.addColorStop(1,'#ffffff00');
  g.fillStyle = hi; g.fillRect(-30,-30,60,60);
  g.restore();

  // EYE
  g.fillStyle = '#ffffff';
  g.shadowColor = '#ff3366'; g.shadowBlur = 10;
  g.beginPath(); g.arc(0,0,8,0,Math.PI*2); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#ff2222';
  g.beginPath(); g.arc(2,1,4,0,Math.PI*2); g.fill();
  g.fillStyle = '#000';
  g.beginPath(); g.arc(2,1,1.8,0,Math.PI*2); g.fill();
  // White glint
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(0,-1,1.2,0,Math.PI*2); g.fill();

  // Tier number badge bottom-right
  g.fillStyle = '#ffea00'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
  g.beginPath(); g.arc(20,22,9,0,Math.PI*2); g.fill(); g.stroke();
  g.fillStyle = OUTLINE;
  g.font = 'bold 12px sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  g.fillText(tier, 20, 22);

  g.restore();
}

// boot
showMenu('menuMain');

