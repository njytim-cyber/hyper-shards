'use strict';
// ============================================================
// BOSS AI
// ============================================================
function updateBoss(dt){
  const b = state.boss;
  const d = DIFFICULTY[state.diff];
  b.t += dt;
  if(b.y < b.targetY){ b.y += 1.0; return; }
  const targetX = W/2 + Math.sin(b.t/900)*(W*0.38);
  const targetYY = b.targetY + Math.cos(b.t/1400)*40;
  b.vx += (targetX - b.x)*0.0009*dt;
  b.vy += (targetYY - b.y)*0.0008*dt;
  b.vx *= 0.95; b.vy *= 0.95;
  b.x += b.vx; b.y += b.vy;
  // Per-tier bullet speed factor — T1/T2 are now much more dodgeable
  const sf = b.tier===1 ? 0.55 : b.tier===2 ? 0.7 : 1;
  if(!b.phase2 && b.hp < b.maxHp*0.7){
    b.phase2 = true;
    toast('⚠ PHASE 2');
    for(let i=0;i<32;i++){
      const a = i/32*Math.PI*2;
      state.ebullets.push({x:b.x,y:b.y,vx:Math.cos(a)*5*sf,vy:Math.sin(a)*5*sf,r:6,col:'#ffea00',dmg:1,life:320,shooter:'enemy'});
    }
    for(let i=0;i<3;i++){ const u = spawnUFO(state.round); u.maxHp = u.hp; state.enemies.push(u); }
    state.shake = 18;
  }
  if(!b.rage && b.hp < b.maxHp*0.4){
    b.rage = true; toast('⚠ '+b.name+' ENRAGED'); state.shake = 22;
    if(typeof setMusicMode==='function' && b.tier!==5) setMusicMode('boss-enrage');
    for(let i=0;i<4;i++){ const u = spawnUFO(state.round); u.maxHp = u.hp; state.enemies.push(u); }
    for(let i=0;i<24;i++){
      const a = i/24*Math.PI*2;
      state.ebullets.push({x:b.x,y:b.y,vx:Math.cos(a)*7*sf,vy:Math.sin(a)*7*sf,r:7,col:'#ff3366',dmg:1,life:340,shooter:'enemy'});
    }
  }
  const rage = b.rage ? 0.45 : (b.phase2 ? 0.7 : 1);
  b.cd -= dt; b.cd2 -= dt; b.cd3 -= dt; b.cd4 = (b.cd4||0) - dt;
  if(b.cd<=0){
    b.cd = 600 * rage * d.fireRate;
    const n = 18 + b.tier*3;
    const sp = (4 + b.tier*0.4) * sf;
    for(let i=0;i<n;i++){
      const a = i/n*Math.PI*2 + b.t*0.0015;
      state.ebullets.push({x:b.x,y:b.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:5,col:b.color,dmg:1,life:280,shooter:'enemy'});
    }
  }
  if(b.cd2<=0){
    b.cd2 = 1100 * rage * d.fireRate;
    const n = 5 + b.tier;
    for(let i=-Math.floor(n/2);i<=Math.floor(n/2);i++){
      const ang = Math.atan2(player.y-b.y,player.x-b.x) + i*0.10;
      state.ebullets.push({x:b.x,y:b.y,vx:Math.cos(ang)*7*sf,vy:Math.sin(ang)*7*sf,r:6,col:'#ffffff',dmg:1,life:280,shooter:'enemy'});
    }
  }
  if(b.tier>=2 && b.cd3<=0){
    b.cd3 = 1800 * rage * d.fireRate;
    for(let k=0;k<36;k++){
      setTimeout(()=>{
        if(!state.boss) return;
        const a = k*0.45 + state.boss.t*0.0015;
        state.ebullets.push({x:state.boss.x,y:state.boss.y,vx:Math.cos(a)*5*sf,vy:Math.sin(a)*5*sf,r:5,col:'#ffea00',dmg:1,life:340,shooter:'enemy'});
      }, k*45);
    }
  }
  if(b.tier>=3 && b.phase2 && b.cd4<=0){
    b.cd4 = 2600 * rage * d.fireRate;
    for(let arm=0; arm<4; arm++){
      for(let r=0;r<14;r++){
        setTimeout(()=>{
          if(!state.boss) return;
          const ang = arm*Math.PI/2 + state.boss.t*0.0008;
          state.ebullets.push({x:state.boss.x,y:state.boss.y,vx:Math.cos(ang)*8,vy:Math.sin(ang)*8,r:7,col:'#ff66cc',dmg:1,life:380,shooter:'enemy'});
        }, r*40);
      }
    }
  }
  if(b.tier>=3 && b.rage && Math.random()<0.012*dt){
    state.enemies.push(spawnUFO(state.round));
  }
  if(b.tier>=4 && b.phase2 && Math.random()<0.006*dt){
    const k = spawnKamikaze(state.round); k.maxHp = k.hp; state.enemies.push(k);
  }
}

