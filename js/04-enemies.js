'use strict';
// ============================================================
// ENEMIES
// ============================================================
function spawnAsteroid(round){
  const d = DIFFICULTY[state.diff];
  const sz = 18 + Math.random()*30 + Math.min(round,15)*1.2;
  // Spawn from random edge, aim toward general player area
  const side = (Math.random()*4)|0;
  let x,y;
  if(side===0){ x=-sz; y=Math.random()*H; }
  else if(side===1){ x=W+sz; y=Math.random()*H; }
  else if(side===2){ x=Math.random()*W; y=-sz; }
  else { x=Math.random()*W; y=H+sz; }
  const tx = (player ? player.x : W/2) + rand(-200,200);
  const ty = (player ? player.y : H/2) + rand(-200,200);
  const dx = tx-x, dy = ty-y, m = Math.hypot(dx,dy)||1;
  const speed = (0.8+Math.random()*1.4+round*0.05)*d.enemySpd;
  return {
    type:'asteroid', x, y,
    vx: dx/m*speed, vy: dy/m*speed,
    r: sz, hp: Math.ceil((sz*0.4 + round*1.2)*d.enemyHp), maxHp:0,
    rot:Math.random()*Math.PI, vr:(Math.random()-0.5)*0.04,
    pts: genAsteroidPts(sz),
    color:'#8a7e6e', dmg: 1,
    shardVal: Math.max(2, Math.round(sz/10)),
  };
}
function genAsteroidPts(r){
  // More vertices + sharper jagged variation for a rocky silhouette
  const n = 14+Math.floor(Math.random()*5);
  const arr=[];
  for(let i=0;i<n;i++){
    const a = i/n*Math.PI*2 + (Math.random()-0.5)*0.15;
    const sharp = Math.random() < 0.3 ? 0.55 : 1; // occasional inset spikes
    const rr = r * sharp * (0.78 + Math.random()*0.34);
    arr.push({a, r:rr});
  }
  // Generate cached craters
  const craters = [];
  const nc = 3 + Math.floor(Math.random()*4);
  for(let i=0;i<nc;i++){
    craters.push({
      a: Math.random()*Math.PI*2,
      d: Math.random()*r*0.55,
      s: r*(0.10 + Math.random()*0.16),
    });
  }
  // Surface cracks
  const cracks = [];
  const ncr = 2 + Math.floor(Math.random()*2);
  for(let i=0;i<ncr;i++){
    const a1 = Math.random()*Math.PI*2;
    const a2 = a1 + (Math.random()-0.5)*1.4;
    cracks.push({
      x1: Math.cos(a1)*r*0.7, y1: Math.sin(a1)*r*0.7,
      x2: Math.cos(a2)*r*0.7, y2: Math.sin(a2)*r*0.7,
      mx: (Math.random()-0.5)*r*0.5, my: (Math.random()-0.5)*r*0.5,
    });
  }
  // Mineral specks (ore)
  const specks = [];
  if(Math.random() < 0.5){
    const ns = 2 + Math.floor(Math.random()*3);
    const col = ['#66ccff','#ffaa00','#aa66ff','#88ff88'][Math.floor(Math.random()*4)];
    for(let i=0;i<ns;i++){
      specks.push({
        x: (Math.random()-0.5)*r*1.2,
        y: (Math.random()-0.5)*r*1.2,
        s: r*0.04 + Math.random()*r*0.04,
        col,
      });
    }
  }
  arr._craters = craters;
  arr._cracks  = cracks;
  arr._specks  = specks;
  return arr;
}
function spawnUFO(round){
  const d = DIFFICULTY[state.diff];
  // From round 4+, chance to be a shielded variant
  const shielded = round>=4 && Math.random()<0.25;
  return {
    type:'ufo',
    x: Math.random()*W, y: -40,
    vx: (Math.random()<0.5?-1:1)*(1+Math.random()*0.5)*d.enemySpd,
    vy: (0.6+Math.random()*0.4)*d.enemySpd,
    r:24, hp: Math.ceil((30+round*4)*d.enemyHp)*(shielded?1.8:1), maxHp:0,
    cd: (800+Math.random()*600)*d.fireRate, t:0,
    dmg:1,
    pattern: Math.random()<0.5?'sine':'zig',
    phase: Math.random()*Math.PI*2,
    shardVal: 3,
    shield: shielded ? 1500 : 0,
  };
}
function spawnKamikaze(round){
  const d = DIFFICULTY[state.diff];
  const side = (Math.random()*4)|0;
  let x,y;
  if(side===0){ x=-30; y=Math.random()*H; }
  else if(side===1){ x=W+30; y=Math.random()*H; }
  else if(side===2){ x=Math.random()*W; y=-30; }
  else { x=Math.random()*W; y=H+30; }
  return {
    type:'kamikaze', x, y, vx:0, vy:0,
    r:14, hp:Math.ceil(15*d.enemyHp), maxHp:0,
    dmg:1, shardVal:2, t:0,
    color:'#ff3366'
  };
}
function spawnMine(round){
  const d = DIFFICULTY[state.diff];
  return {
    type:'mine',
    x: rand(60,W-60), y: rand(60,H-60),
    vx: rand(-0.3,0.3), vy: rand(-0.3,0.3),
    r:18, hp:Math.ceil(20*d.enemyHp), maxHp:0,
    dmg:1, t:0, armed:1500, shardVal:2,
    color:'#ffaa00'
  };
}
function spawnBoss(round){
  const tier = Math.max(1, Math.floor(round/5));
  const types = ['HARBINGER','LEVIATHAN','OBLIVION','SUNDERER','EMPRESS'];
  const name = 'VOID '+types[(tier-1)%types.length];
  const d = DIFFICULTY[state.diff];
  // SUPER HARD: tripled base HP and stronger tier scaling
  const boss = {
    type:'boss', name,
    x:W/2, y:-120, vx:0, vy:0,
    targetY:130,
    r: 90+tier*8,
    hp: Math.ceil((1800 + tier*1200)*d.enemyHp),
    maxHp: 0,
    phase:0, cd:0, cd2:0, cd3:0, t:0, tier,
    rage:false, phase2:false,
    color: ['#ff66cc','#ff8866','#88ccff','#ffaa00','#aa66ff'][(tier-1)%5],
  };
  boss.maxHp = boss.hp;
  state.boss = boss;
  document.getElementById('bossName').textContent = name+' — TIER '+tier;
  document.getElementById('bossBar').style.display='block';
}

