'use strict';
// ============================================================
// SHOP ICONS (procedural, no external assets)
// ============================================================
function drawShopIcon(g, type, id){
  g.clearRect(0,0,60,60);
  g.save();
  g.translate(30,30);
  // background ring
  g.strokeStyle = '#244a78';
  g.lineWidth = 1;
  g.beginPath(); g.arc(0,0,26,0,Math.PI*2); g.stroke();

  if(type==='up'){
    drawUpgradeIcon(g, id);
  } else if(type==='weapon'){
    drawWeaponIcon(g, id);
  } else if(type==='consume'){
    drawConsumeIcon(g, id);
  } else if(type==='special'){
    drawSpecialIcon(g, id);
  }
  g.restore();
}

function _heart(g, col='#ff3366'){
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(0, 8);
  g.bezierCurveTo(0,2, 12,-2, 12,-8);
  g.bezierCurveTo(12,-14, 4,-14, 0,-6);
  g.bezierCurveTo(-4,-14, -12,-14, -12,-8);
  g.bezierCurveTo(-12,-2, 0,2, 0,8);
  g.fill();
}

function drawUpgradeIcon(g,id){
  if(id==='hp'){ _heart(g,'#ff3366'); }
  else if(id==='dmg'){
    g.fillStyle = '#ffea00';
    g.beginPath(); g.moveTo(-2,-14); g.lineTo(8,2); g.lineTo(2,2); g.lineTo(6,14); g.lineTo(-8,-2); g.lineTo(-2,-2); g.closePath(); g.fill();
  } else if(id==='fire'){
    g.fillStyle = '#ffaa00';
    g.beginPath(); g.moveTo(0,-14);
    g.bezierCurveTo(8,-6, 10,4, 0,14);
    g.bezierCurveTo(-10,4, -8,-6, 0,-14); g.closePath(); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(0,4,4,0,Math.PI*2); g.fill();
  } else if(id==='speed'){
    g.fillStyle = '#00eaff';
    for(let i=0;i<3;i++){
      g.fillRect(-12+i*4, -6, 2, 12);
    }
    g.beginPath(); g.moveTo(2,-8); g.lineTo(14,0); g.lineTo(2,8); g.closePath(); g.fill();
  } else if(id==='boost'){
    g.fillStyle = '#00ff88';
    g.beginPath(); g.moveTo(-6,-12); g.lineTo(6,-12); g.lineTo(8,8); g.lineTo(0,14); g.lineTo(-8,8); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.fillRect(-2,-8,4,10);
  } else if(id==='shield'){
    g.fillStyle = '#00aaff';
    g.beginPath(); g.moveTo(0,-14); g.lineTo(12,-8); g.lineTo(10,8); g.lineTo(0,14); g.lineTo(-10,8); g.lineTo(-12,-8); g.closePath(); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-4,-2); g.lineTo(0,4); g.lineTo(6,-4); g.stroke();
  } else if(id==='magnet'){
    g.strokeStyle = '#ff5555'; g.lineWidth = 5;
    g.beginPath(); g.arc(0,0,9,Math.PI*0.15,Math.PI*0.85,true); g.stroke();
    g.fillStyle='#fff'; g.fillRect(-12,-2,4,4); g.fillRect(8,-2,4,4);
  } else if(id==='multishot'){
    g.fillStyle = '#ffea00';
    for(let i=-1;i<=1;i++){ g.beginPath(); g.arc(i*8,-2,3,0,Math.PI*2); g.fill(); g.fillRect(i*8-1,2,2,12); }
  } else if(id==='crit'){
    g.strokeStyle = '#ff66cc'; g.lineWidth=2;
    g.beginPath(); g.arc(0,0,12,0,Math.PI*2); g.stroke();
    g.beginPath(); g.arc(0,0,6,0,Math.PI*2); g.stroke();
    g.fillStyle = '#ff66cc'; g.beginPath(); g.arc(0,0,2,0,Math.PI*2); g.fill();
    g.strokeStyle='#ff66cc'; g.beginPath(); g.moveTo(-14,0); g.lineTo(14,0); g.moveTo(0,-14); g.lineTo(0,14); g.stroke();
  } else if(id==='pierce'){
    g.fillStyle = '#ffaa00';
    g.beginPath(); g.moveTo(-14,-2); g.lineTo(8,-2); g.lineTo(8,-6); g.lineTo(14,0); g.lineTo(8,6); g.lineTo(8,2); g.lineTo(-14,2); g.closePath(); g.fill();
  } else if(id==='lifesteal'){
    _heart(g,'#aa00aa');
    g.fillStyle = '#fff'; g.font='bold 10px monospace'; g.textAlign='center'; g.fillText('V',0,2);
  } else if(id==='luck'){
    g.fillStyle = '#ffea00';
    for(let i=0;i<5;i++){
      const a = i/5*Math.PI*2 - Math.PI/2;
      g.beginPath(); g.arc(Math.cos(a)*8, Math.sin(a)*8, 2, 0, Math.PI*2); g.fill();
    }
    g.beginPath(); g.arc(0,0,3,0,Math.PI*2); g.fill();
  } else if(id==='dodge'){
    g.strokeStyle = '#aa88ff'; g.lineWidth = 2;
    g.beginPath(); g.arc(0,0,12,0,Math.PI*2); g.stroke();
    g.fillStyle='#aa88ff'; g.globalAlpha=0.4;
    g.beginPath(); g.arc(-6,0,9,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc(6,0,9,0,Math.PI*2); g.fill();
    g.globalAlpha=1;
  }
}

function drawWeaponIcon(g, id){
  // muzzle line + projectile
  g.fillStyle = '#888';
  g.fillRect(-14,-3,12,6);
  if(id==='single'){
    g.fillStyle = '#00eaff'; g.beginPath(); g.arc(8,0,4,0,Math.PI*2); g.fill();
  } else if(id==='spread'){
    g.fillStyle = '#ffea00';
    for(let i=-1;i<=1;i++){ g.beginPath(); g.arc(8+i*2, i*5, 3, 0, Math.PI*2); g.fill(); }
  } else if(id==='rapid'){
    g.fillStyle = '#00ffaa';
    for(let i=0;i<4;i++) g.beginPath(), g.arc(2+i*4,0,2,0,Math.PI*2), g.fill();
  } else if(id==='wave'){
    g.strokeStyle = '#ff66cc'; g.lineWidth=3;
    g.beginPath(); g.moveTo(0,0);
    for(let x=0;x<=14;x++) g.lineTo(x, Math.sin(x*0.7)*5);
    g.stroke();
  } else if(id==='heavy'){
    g.fillStyle = '#ff66ff';
    g.fillRect(2,-5,12,10);
    g.fillStyle='#fff'; g.fillRect(2,-2,12,4);
  } else if(id==='flame'){
    g.fillStyle = '#ff5500'; g.beginPath(); g.moveTo(0,-6); g.lineTo(14,0); g.lineTo(0,6); g.closePath(); g.fill();
    g.fillStyle = '#ffea00'; g.beginPath(); g.moveTo(2,-3); g.lineTo(10,0); g.lineTo(2,3); g.closePath(); g.fill();
  } else if(id==='lance'){
    g.fillStyle='#88ddff'; g.fillRect(0,-1.5,18,3);
    g.fillStyle='#fff'; g.fillRect(0,-0.5,18,1);
  } else if(id==='cluster'){
    g.fillStyle = '#ffaa00';
    for(let i=0;i<6;i++){
      const a = i/6*Math.PI*2;
      g.beginPath(); g.arc(Math.cos(a)*6, Math.sin(a)*6, 2, 0, Math.PI*2); g.fill();
    }
  } else if(id==='shock'){
    g.fillStyle = '#aaccff';
    g.beginPath(); g.arc(8,0,5,0,Math.PI*2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth=1.5;
    g.beginPath(); g.moveTo(8,-5); g.lineTo(6,-2); g.lineTo(10,0); g.lineTo(7,4); g.stroke();
  } else if(id==='void'){
    const rg = g.createRadialGradient(8,0,1,8,0,8);
    rg.addColorStop(0,'#000'); rg.addColorStop(0.5,'#aa55ff'); rg.addColorStop(1,'#330044');
    g.fillStyle = rg;
    g.beginPath(); g.arc(8,0,8,0,Math.PI*2); g.fill();
  }
}

function drawConsumeIcon(g, id){
  if(id==='heal'){ _heart(g,'#00ff88'); g.fillStyle='#fff'; g.fillRect(-2,-8,4,10); g.fillRect(-6,-4,12,2); }
  else if(id==='shield'){
    g.fillStyle='#ffea00'; g.beginPath(); g.moveTo(0,-12); g.lineTo(10,-6); g.lineTo(8,8); g.lineTo(0,12); g.lineTo(-8,8); g.lineTo(-10,-6); g.closePath(); g.fill();
    g.fillStyle='#000'; g.font='bold 12px monospace'; g.textAlign='center'; g.textBaseline='middle';
    g.fillText('◈',0,1);
  } else if(id==='bomb'){
    g.fillStyle='#444';
    g.beginPath(); g.arc(0,4,10,0,Math.PI*2); g.fill();
    g.strokeStyle='#ff9933'; g.lineWidth=2;
    g.beginPath(); g.moveTo(0,-6); g.lineTo(4,-12); g.stroke();
    g.fillStyle='#ff5500'; g.beginPath(); g.arc(4,-12,2,0,Math.PI*2); g.fill();
  } else if(id==='overdrive'){
    g.fillStyle='#ff3366'; g.beginPath(); g.moveTo(-4,-12); g.lineTo(4,-2); g.lineTo(0,-2); g.lineTo(4,12); g.lineTo(-4,2); g.lineTo(0,2); g.closePath(); g.fill();
  } else if(id==='timefreeze'){
    g.strokeStyle='#aa88ff'; g.lineWidth=2;
    g.beginPath(); g.arc(0,0,11,0,Math.PI*2); g.stroke();
    g.beginPath(); g.moveTo(0,0); g.lineTo(0,-8); g.moveTo(0,0); g.lineTo(6,2); g.stroke();
  } else if(id==='revive'){
    g.fillStyle='#ff8800';
    g.beginPath(); g.moveTo(0,-12); g.lineTo(8,-2); g.lineTo(4,-2); g.lineTo(10,12); g.lineTo(0,4); g.lineTo(-10,12); g.lineTo(-4,-2); g.lineTo(-8,-2); g.closePath(); g.fill();
  } else if(id==='fuelcell'){
    g.fillStyle='#00ffaa'; g.fillRect(-6,-12,12,20);
    g.fillStyle='#003322'; g.fillRect(-4,-2,8,8);
  } else if(id==='shardpack'){
    g.fillStyle='#ffea00';
    for(let i=0;i<3;i++){
      g.save();
      g.translate(rand(-6,6), rand(-6,6));
      g.beginPath(); g.moveTo(0,-6); g.lineTo(4,0); g.lineTo(0,6); g.lineTo(-4,0); g.closePath(); g.fill();
      g.restore();
    }
  } else if(id==='turret'){
    g.fillStyle='#888'; g.fillRect(-8,4,16,8);
    g.fillStyle='#aaa'; g.fillRect(-5,-2,10,8);
    g.fillStyle='#00eaff'; g.fillRect(-1,-12,2,10);
  }
}

function drawSpecialIcon(g, id){
  if(id==='autoRepair'){
    _heart(g,'#00ffaa');
    g.fillStyle='#fff'; g.beginPath(); g.arc(8,-6,3,0,Math.PI*2); g.fill();
  } else if(id==='drone'){
    g.fillStyle='#88ddff'; g.beginPath(); g.arc(0,0,8,0,Math.PI*2); g.fill();
    g.fillStyle='#000'; g.beginPath(); g.arc(0,0,4,0,Math.PI*2); g.fill();
    g.fillStyle='#ff66cc'; g.beginPath(); g.arc(0,0,1.5,0,Math.PI*2); g.fill();
  } else if(id==='shockwave'){
    g.strokeStyle='#ffea00'; g.lineWidth=2;
    for(let i=4;i<=14;i+=4){ g.beginPath(); g.arc(0,0,i,0,Math.PI*2); g.stroke(); }
  } else if(id==='magnetMax'){
    g.strokeStyle='#ff5555'; g.lineWidth=4;
    g.beginPath(); g.arc(0,0,9,0,Math.PI*2); g.stroke();
    g.fillStyle='#ffea00'; g.beginPath(); g.arc(0,0,3,0,Math.PI*2); g.fill();
  } else if(id==='reflect'){
    g.strokeStyle='#88ddff'; g.lineWidth=3;
    g.beginPath(); g.arc(0,0,12,Math.PI*0.2,Math.PI*1.8); g.stroke();
    g.fillStyle='#fff'; g.beginPath(); g.moveTo(8,-2); g.lineTo(2,-6); g.lineTo(2,2); g.closePath(); g.fill();
  } else if(id==='thermal'){
    g.fillStyle='#ff5500';
    g.beginPath(); g.moveTo(-12,-8); g.lineTo(8,-4); g.lineTo(-4,0); g.lineTo(8,4); g.lineTo(-12,8); g.closePath(); g.fill();
  } else if(id==='overcharge'){
    g.fillStyle='#ffea00';
    g.beginPath(); g.moveTo(-4,-12); g.lineTo(4,-2); g.lineTo(0,-2); g.lineTo(4,12); g.lineTo(-4,2); g.lineTo(0,2); g.closePath(); g.fill();
    g.strokeStyle='#fff'; g.lineWidth=1; g.stroke();
  } else if(id==='cryo'){
    g.strokeStyle='#88ddff'; g.lineWidth=2;
    for(let i=0;i<6;i++){
      const a = i/6*Math.PI*2;
      g.beginPath(); g.moveTo(0,0); g.lineTo(Math.cos(a)*12, Math.sin(a)*12); g.stroke();
    }
  } else if(id==='vampPulse'){
    _heart(g,'#aa00aa');
    g.strokeStyle='#fff'; g.lineWidth=2;
    g.beginPath(); g.arc(0,0,14,0,Math.PI*2); g.stroke();
  } else if(id==='shieldAura'){
    g.strokeStyle='#00aaff'; g.lineWidth=2;
    g.beginPath(); g.arc(0,0,13,0,Math.PI*2); g.stroke();
    g.beginPath(); g.arc(0,0,8,0,Math.PI*2); g.stroke();
    g.fillStyle='#00aaff'; g.beginPath(); g.arc(0,0,3,0,Math.PI*2); g.fill();
  } else if(id==='doubleXP'){
    g.fillStyle='#ffea00'; g.font='bold 14px monospace'; g.textAlign='center'; g.textBaseline='middle';
    g.fillText('×1.5',0,0);
  } else if(id==='gravWell'){
    const rg = g.createRadialGradient(0,0,1,0,0,14);
    rg.addColorStop(0,'#fff'); rg.addColorStop(0.4,'#aa55ff'); rg.addColorStop(1,'#000');
    g.fillStyle = rg;
    g.beginPath(); g.arc(0,0,14,0,Math.PI*2); g.fill();
  }
}

// ============================================================
// 3D MENU ICONS — chunky Bloons-style depth
// ============================================================
function draw3DMenuIcon(g, type){
  // Adaptive to any canvas size — icons are designed for 96x96 base coords
  const cw = g.canvas.width, ch = g.canvas.height;
  g.save();
  g.clearRect(0,0,cw,ch);
  // Center horizontally, slight vertical bias so the ship sits visually centered
  g.translate(cw/2, ch/2 + ch*0.04);
  const s = Math.min(cw, ch) / 96;
  g.scale(s, s);
  g.lineJoin='round'; g.lineCap='round';
  const OUTLINE = '#1a1a1a';

  // ===== Cel-shaded helpers (Bloons-style) =====
  function celShape(drawFn, fill, shadowFill, highlightFill, outlineW=3){
    // base flat fill
    g.fillStyle = fill; drawFn(g);
    // shadow on bottom half (clipped to shape)
    if(shadowFill){
      g.save(); drawFn(g); g.clip();
      g.fillStyle = shadowFill;
      g.beginPath();
      g.ellipse(0, 12, 60, 30, 0, 0, Math.PI*2);
      g.fill();
      g.restore();
    }
    // highlight on top half
    if(highlightFill){
      g.save(); drawFn(g); g.clip();
      g.fillStyle = highlightFill;
      g.beginPath();
      g.ellipse(-4, -22, 30, 14, -.3, 0, Math.PI*2);
      g.fill();
      g.restore();
    }
    // thick outline
    g.strokeStyle = OUTLINE; g.lineWidth = outlineW; g.lineJoin='round';
    drawFn(g, true);
  }
  // Old chunky helper kept for backward compat (not used by new mascots)

  // Helper: draw a chunky 3D shape with shadow underneath, gradient fill,
  // outline, and a clipped highlight up top.
  function chunky(drawFn, baseCol, hiCol, shadowDy=4, gradTop=-28, gradBot=28){
    // Real extruded depth — stack 6 darker copies offset down for a chunky 3D look
    const layers = 6;
    for(let z=layers; z>0; z--){
      g.save(); g.translate(0, z*0.7);
      g.fillStyle = OUTLINE; drawFn(g);
      g.restore();
    }
    // Top face fill
    const grd = g.createLinearGradient(0,gradTop,0,gradBot);
    grd.addColorStop(0, hiCol); grd.addColorStop(0.55, baseCol); grd.addColorStop(1, '#0a0f1c');
    g.fillStyle = grd; drawFn(g);
    g.strokeStyle = OUTLINE; g.lineWidth = 2.5; drawFn(g, true);
    // Top clipped sheen
    g.save(); drawFn(g); g.clip();
    const hi = g.createLinearGradient(0,gradTop,0,0);
    hi.addColorStop(0,'#ffffffcc'); hi.addColorStop(1,'#ffffff00');
    g.fillStyle = hi; g.fillRect(-50,-60,100,100);
    g.restore();
  }

  // ===== Astronaut in a space fighter (Bloons-quality, space theme) =====
  // Centered around (0,0). Ship faces right; pilot in cockpit.
  function drawPlane({ body='#3aa0ff', bodyShadow='#1a5a99', wing='#6cc0ff', tail='#ff66cc',
                       prop='#ffea00', boost='#aacfff', boostShadow='#5588cc',
                       hat='#dddddd', hatShadow='#888888',
                       skin='#f0c089', skinShadow='#c98456',
                       goggles='#00eaff', scarf='#ff3344', accent='#ffea00',
                       expression='happy' } = {}){
    const t = performance.now();

    // === Twin engine flames at the back (left side) ===
    function flame(yoff){
      g.save(); g.translate(-30, yoff);
      const wob = Math.sin(t/80 + yoff)*1.5;
      // outer cyan flame
      celShape((g, stroke)=>{
        g.beginPath();
        g.moveTo(0,-4);
        g.quadraticCurveTo(-12, 0, 0, 4);
        g.quadraticCurveTo(-8-wob, 0, 0,-4);
        g.closePath();
        stroke ? g.stroke() : g.fill();
      }, boost, boostShadow, '#ffffff');
      // inner white core
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(0,-2); g.quadraticCurveTo(-6, 0, 0, 2); g.closePath();
      g.fill();
      g.restore();
    }
    flame(-3); flame(3);

    // === Tail fin (small accent fin on top-right) ===
    g.save(); g.translate(18, -8);
    celShape((g, stroke)=>{
      g.beginPath();
      g.moveTo(-6, 4); g.lineTo(-2,-10); g.lineTo(8,-6); g.lineTo(6, 4);
      g.closePath();
      stroke ? g.stroke() : g.fill();
    }, tail, '#aa2266', '#ffaaee');
    g.restore();

    // === Solar-panel wings (front bottom, sweeping out) ===
    g.save(); g.translate(-2, 10);
    celShape((g, stroke)=>{
      g.beginPath();
      g.moveTo(-18, 0);
      g.quadraticCurveTo(-22, 4, -14, 8);
      g.lineTo(16, 8);
      g.quadraticCurveTo(20, 4, 14, 0);
      g.closePath();
      stroke ? g.stroke() : g.fill();
    }, wing, bodyShadow, '#bfeaff');
    // wing panel grid lines
    g.strokeStyle = OUTLINE; g.lineWidth = 1.2;
    for(let i=-12;i<=12;i+=8){
      g.beginPath(); g.moveTo(i, 1); g.lineTo(i, 7); g.stroke();
    }
    g.restore();

    // === Spaceship hull — chunky rounded shape with pointed nose ===
    celShape((g, stroke)=>{
      g.beginPath();
      g.moveTo(-26, 2);
      g.quadraticCurveTo(-30, -4, -16, -10);
      g.lineTo(6, -14);
      g.quadraticCurveTo(22, -12, 30, -2);
      g.lineTo(32, 4);
      g.quadraticCurveTo(28, 10, 18, 12);
      g.lineTo(-22, 12);
      g.quadraticCurveTo(-30, 10, -26, 2);
      g.closePath();
      stroke ? g.stroke() : g.fill();
    }, body, bodyShadow, '#bfeaff', 3.5);

    // hull stripe accent
    g.save();
    celShape((g, stroke)=>{
      g.beginPath();
      g.moveTo(-20, 6); g.lineTo(20, 6); g.lineTo(20, 9); g.lineTo(-20, 9);
      g.closePath();
      stroke ? g.stroke() : g.fill();
    }, accent, '#aa6600', null, 2);
    g.restore();

    // === Cockpit dome (transparent visor area) ===
    celShape((g, stroke)=>{
      g.beginPath();
      g.moveTo(-12, -4);
      g.quadraticCurveTo(-12, -14, 0, -16);
      g.quadraticCurveTo(12, -14, 12, -4);
      g.closePath();
      stroke ? g.stroke() : g.fill();
    }, '#1a3a5a', '#0a1a2a', '#88ccff', 2.5);

    // cockpit reflection sheen
    g.fillStyle = '#ffffff'; g.globalAlpha = 0.5;
    g.beginPath(); g.ellipse(-5,-12,3,5,-0.3,0,Math.PI*2); g.fill();
    g.globalAlpha = 1;

    // === PILOT — astronaut head poking out of cockpit ===
    g.save(); g.translate(0, -10);

    // Helmet shell (white, behind face)
    celShape((g, stroke)=>{
      g.beginPath();
      g.arc(0, 0, 9, 0, Math.PI*2);
      stroke ? g.stroke() : g.fill();
    }, hat, hatShadow, '#ffffff');

    // Visor (curved colored window in the helmet)
    celShape((g, stroke)=>{
      g.beginPath();
      g.moveTo(-7, 1);
      g.quadraticCurveTo(-7, -6, 0, -7);
      g.quadraticCurveTo(7, -6, 7, 1);
      g.quadraticCurveTo(0, 4, -7, 1);
      g.closePath();
      stroke ? g.stroke() : g.fill();
    }, goggles, '#003a55', '#ffffff', 2);

    // Visor reflection (two bright dots)
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(-3, -4, 1.2, 0, Math.PI*2); g.fill();
    g.beginPath(); g.arc( 4, -3, 1.0, 0, Math.PI*2); g.fill();

    // Face hint behind visor (subtle eyes)
    g.fillStyle = '#000000aa';
    if(expression==='happy'){
      g.beginPath(); g.arc(-2, 0, 0.9, 0, Math.PI*2); g.fill();
      g.beginPath(); g.arc( 2, 0, 0.9, 0, Math.PI*2); g.fill();
    } else if(expression==='angry'){
      g.fillRect(-3.5, -1, 2.5, 1);
      g.fillRect( 1, -1, 2.5, 1);
    } else if(expression==='wink'){
      g.fillRect(-3, 0, 2, 0.8);
      g.beginPath(); g.arc( 2, 0, 0.9, 0, Math.PI*2); g.fill();
    }

    // Helmet antenna with red blinker
    g.strokeStyle = OUTLINE; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(6, -8); g.lineTo(9, -13); g.stroke();
    g.fillStyle = '#ff3344'; g.shadowColor='#ff3344'; g.shadowBlur=6;
    g.beginPath(); g.arc(9, -14, 1.5, 0, Math.PI*2); g.fill();
    g.shadowBlur = 0;

    // Helmet rim accent
    g.strokeStyle = accent; g.lineWidth = 1.5;
    g.beginPath(); g.arc(0, 0, 9, Math.PI*0.3, Math.PI*0.7); g.stroke();

    g.restore();

    // === Cape/streamer behind ===
    g.save(); g.translate(-8, -3);
    celShape((g, stroke)=>{
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-12, 0 + Math.sin(t/200)*1.5);
      g.lineTo(-14, 4 + Math.sin(t/200)*1.5);
      g.lineTo(-2, 4);
      g.closePath();
      stroke ? g.stroke() : g.fill();
    }, scarf, '#aa1122', '#ff8888');
    g.restore();

    // Tiny stars sparkling around the ship
    g.fillStyle='#ffffff';
    for(const [sx,sy,sr] of [[-30,-22,1.2],[28,-18,1],[-22,18,0.8],[26,16,1]]){
      const tw = 0.4 + 0.6*Math.abs(Math.sin(t/300 + sx));
      g.globalAlpha = tw;
      g.beginPath(); g.arc(sx,sy,sr,0,Math.PI*2); g.fill();
    }
    g.globalAlpha = 1;
  }

  // ===== Reusable astronaut/pilot mascot (LEGACY — unused now) =====
  // Centered around (0,0) with feet at +30, head at -34
  function drawPilot({ suit='#3aa0ff', suitHi='#a8e4ff', visor='#00eaff', accent='#ffea00', pose='cheer' } = {}){
    // === BACKPACK / oxygen tank ===
    chunky((g, stroke)=>{
      g.beginPath();
      g.roundRect ? g.roundRect(-14,-4,28,28,5) : g.rect(-14,-4,28,28);
      stroke ? g.stroke() : g.fill();
    }, '#666c78', '#cfd6e4', 4, -4, 24);

    // === LEGS (two stubby boots) ===
    chunky((g, stroke)=>{
      g.beginPath();
      g.moveTo(-12, 16); g.lineTo(-12, 28); g.lineTo(-3, 32); g.lineTo(-3, 16);
      g.closePath();
      g.moveTo( 3, 16); g.lineTo( 3, 32); g.lineTo( 12, 28); g.lineTo( 12, 16);
      g.closePath();
      stroke ? g.stroke() : g.fill();
    }, suit, suitHi, 3, 14, 32);

    // Boots dark caps
    g.fillStyle = OUTLINE;
    g.beginPath(); g.ellipse(-7, 30, 6, 3, 0, 0, Math.PI*2); g.fill();
    g.beginPath(); g.ellipse( 7, 30, 6, 3, 0, 0, Math.PI*2); g.fill();

    // === BODY (suit torso) ===
    chunky((g, stroke)=>{
      g.beginPath();
      // chunky barrel torso
      g.moveTo(-15,-2);
      g.lineTo(-13, 18);
      g.lineTo( 13, 18);
      g.lineTo( 15,-2);
      g.quadraticCurveTo(0,-8, -15,-2);
      g.closePath();
      stroke ? g.stroke() : g.fill();
    }, suit, suitHi, 3, -8, 18);

    // Belt
    g.fillStyle = OUTLINE; g.fillRect(-14, 14, 28, 4);
    g.fillStyle = accent;  g.fillRect(-14, 15, 28, 2);
    // Chest emblem (small circle)
    g.fillStyle = accent; g.shadowColor = accent; g.shadowBlur = 6;
    g.beginPath(); g.arc(0, 5, 3.5, 0, Math.PI*2); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = OUTLINE; g.lineWidth = 1.5;
    g.beginPath(); g.arc(0, 5, 3.5, 0, Math.PI*2); g.stroke();

    // === ARMS — pose dependent ===
    function arm(side, ax, ay, hx, hy){
      g.save();
      // arm stripe
      g.strokeStyle = OUTLINE; g.lineWidth = 6.5; g.lineCap='round';
      g.beginPath(); g.moveTo(side*9, 0); g.lineTo(ax, ay); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = suitHi; g.lineWidth = 4;
      g.beginPath(); g.moveTo(side*9, 0); g.lineTo(ax, ay); g.lineTo(hx, hy); g.stroke();
      // glove
      g.fillStyle = OUTLINE;
      g.beginPath(); g.arc(hx, hy, 5, 0, Math.PI*2); g.fill();
      const gg = g.createRadialGradient(hx-1, hy-1, 1, hx, hy, 5);
      gg.addColorStop(0,'#ffffff'); gg.addColorStop(1, suit);
      g.fillStyle = gg;
      g.beginPath(); g.arc(hx, hy, 4, 0, Math.PI*2); g.fill();
      g.restore();
    }

    if(pose==='cheer'){          // both arms up (PLAY)
      arm(-1, -18, -8, -22, -28);
      arm( 1,  18, -8,  22, -28);
      // sparkle bursts above hands
      g.fillStyle='#ffea00'; g.shadowColor='#ffea00'; g.shadowBlur=8;
      for(const [x,y] of [[-22,-32],[22,-32]]){
        g.beginPath();
        for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; const r = i%2===0?5:2;
          const xx = x + Math.cos(a)*r, yy=y+Math.sin(a)*r;
          if(i===0) g.moveTo(xx,yy); else g.lineTo(xx,yy);
        }
        g.closePath(); g.fill();
      }
      g.shadowBlur=0;
    }
    else if(pose==='hold'){       // holding something high (SHOP)
      arm(-1, -16, -10, -8, -28);
      arm( 1,  16, -10,  8, -28);
    }
    else if(pose==='point'){      // one arm pointing (TUTORIAL)
      arm(-1, -16, 4,  -10, 14);
      arm( 1,  18, -8,  26, -22);
    }
    else if(pose==='pilot'){      // cockpit pose, hands forward
      arm(-1, -14, 4, -18, 14);
      arm( 1,  14, 4,  18, 14);
    }
    else if(pose==='gun'){        // both arms forward holding blaster (PVP)
      arm(-1, -10, 6, -8, 16);
      arm( 1,  10, 6,  8, 16);
    }

    // === HELMET (big) ===
    // Helmet shadow
    g.save(); g.translate(0,3); g.fillStyle = OUTLINE;
    g.beginPath(); g.arc(0,-18,20,0,Math.PI*2); g.fill();
    g.restore();
    // Helmet base
    const h = g.createRadialGradient(-6,-26,2,0,-18,22);
    h.addColorStop(0,'#ffffff'); h.addColorStop(0.55,'#cfd6e4'); h.addColorStop(1,'#5a6470');
    g.fillStyle = h;
    g.beginPath(); g.arc(0,-18,20,0,Math.PI*2); g.fill();
    g.strokeStyle = OUTLINE; g.lineWidth = 2.5;
    g.beginPath(); g.arc(0,-18,20,0,Math.PI*2); g.stroke();
    // Visor
    g.save();
    g.beginPath(); g.ellipse(0,-19,15,11,0,0,Math.PI*2); g.clip();
    const v = g.createLinearGradient(0,-30,0,-8);
    v.addColorStop(0, visor); v.addColorStop(0.5, '#0a0f1c'); v.addColorStop(1, visor);
    g.fillStyle = v; g.fillRect(-20,-32,40,28);
    // Eyes (big shiny dots)
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(-6,-19,2.5,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc( 6,-19,2.5,0,Math.PI*2); g.fill();
    // Smile
    g.strokeStyle = '#ffffffaa'; g.lineWidth = 1.5; g.lineCap='round';
    g.beginPath(); g.arc(0,-13,4,0.1*Math.PI,0.9*Math.PI); g.stroke();
    g.restore();
    g.strokeStyle = OUTLINE; g.lineWidth = 2;
    g.beginPath(); g.ellipse(0,-19,15,11,0,0,Math.PI*2); g.stroke();
    // Helmet highlight
    g.fillStyle = '#ffffff'; g.globalAlpha = 0.65;
    g.beginPath(); g.ellipse(-9,-28,5,3,-0.6,0,Math.PI*2); g.fill();
    g.globalAlpha = 1;
    // Antenna
    g.strokeStyle = OUTLINE; g.lineWidth = 2;
    g.beginPath(); g.moveTo(12,-32); g.lineTo(15,-40); g.stroke();
    g.fillStyle = '#ff3366'; g.shadowColor='#ff3366'; g.shadowBlur=8;
    g.beginPath(); g.arc(15,-41,2.5,0,Math.PI*2); g.fill();
    g.shadowBlur=0;
  }

  // ===== Per-button mascots =====
  if(type==='play'){
    drawPlane({ body:'#3aa0ff', bodyShadow:'#1a4477', wing:'#66c8ff', tail:'#00ffaa',
                boost:'#aacfff', boostShadow:'#3377cc', goggles:'#00eaff', accent:'#ffea00',
                scarf:'#ff3344', expression:'happy' });
  }
  else if(type==='shop'){
    drawPlane({ body:'#ffc244', bodyShadow:'#aa6b00', wing:'#ffd966', tail:'#ff8800',
                boost:'#ffea00', boostShadow:'#cc7700', goggles:'#ff8800', accent:'#552200',
                scarf:'#ff5500', expression:'wink' });
    // Floating gold shard above
    g.save(); g.translate(8, -34);
    g.fillStyle='#ffea00'; g.strokeStyle=OUTLINE; g.lineWidth=2;
    g.beginPath(); g.moveTo(0,-9); g.lineTo(6,0); g.lineTo(0,9); g.lineTo(-6,0); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle='#ffffff'; g.beginPath(); g.arc(-2,-3,1.5,0,Math.PI*2); g.fill();
    g.restore();
  }
  else if(type==='tut'){
    drawPlane({ body:'#a08aff', bodyShadow:'#5a3aaa', wing:'#c7b3ff', tail:'#ff66cc',
                boost:'#e0c8ff', boostShadow:'#7755cc', goggles:'#ff66cc', accent:'#ffea00',
                scarf:'#ffea00', expression:'happy' });
    // Star above
    g.save(); g.translate(18, -34);
    g.fillStyle='#ffea00'; g.strokeStyle=OUTLINE; g.lineWidth=2;
    g.beginPath();
    for(let i=0;i<10;i++){ const a=-Math.PI/2 + i/10*Math.PI*2; const r = i%2===0?7:3;
      const x=Math.cos(a)*r, y=Math.sin(a)*r;
      if(i===0) g.moveTo(x,y); else g.lineTo(x,y);
    }
    g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  else if(type==='ship'){
    drawPlane({ body:'#00d977', bodyShadow:'#005a30', wing:'#66ffaa', tail:'#ffea00',
                boost:'#a8ffe0', boostShadow:'#00aa66', goggles:'#00eaff', accent:'#ff3344',
                scarf:'#ff3344', expression:'happy' });
  }
  else if(type==='pvp'){
    // Two pilots facing each other
    g.save(); g.translate(-18, 4); g.scale(0.7,0.7);
    drawPlane({ body:'#3aa0ff', bodyShadow:'#1a4477', wing:'#66c8ff', tail:'#00ffaa',
                goggles:'#00eaff', scarf:'#ffea00', expression:'angry' });
    g.restore();
    g.save(); g.translate(18, 4); g.scale(-0.7, 0.7);
    drawPlane({ body:'#ff3366', bodyShadow:'#992244', wing:'#ff88aa', tail:'#ffea00',
                goggles:'#ff66aa', scarf:'#ffea00', expression:'angry' });
    g.restore();
    // VS spark
    g.fillStyle='#ffea00'; g.shadowColor='#ffea00'; g.shadowBlur=12;
    g.font = 'bold 18px sans-serif'; g.textAlign='center'; g.textBaseline='middle';
    g.fillText('VS', 0, -22);
    g.shadowBlur=0;
    g.strokeStyle = OUTLINE; g.lineWidth = 3;
    g.strokeText('VS', 0, -22);
  }
  else if(type==='boss'){
    // Boss head with horns and glowing red eye
    function bodyPath(g){
      const pts = 8;
      g.beginPath();
      for(let i=0;i<pts*2;i++){
        const r = i%2===0 ? 26 : 17;
        const a = i/(pts*2)*Math.PI*2 - Math.PI/2;
        const x = Math.cos(a)*r, y=Math.sin(a)*r;
        if(i===0) g.moveTo(x,y); else g.lineTo(x,y);
      }
      g.closePath();
    }
    // Layered depth
    for(let z=5;z>=0;z--){
      g.save(); g.translate(0,z*0.9);
      g.fillStyle = z===0 ? '#ff2299' : OUTLINE;
      bodyPath(g); g.fill();
      g.restore();
    }
    // Gradient on top
    g.save(); bodyPath(g); g.clip();
    const grd = g.createLinearGradient(0,-30,0,30);
    grd.addColorStop(0,'#ffaaee'); grd.addColorStop(0.5,'#ff2299'); grd.addColorStop(1,'#440022');
    g.fillStyle = grd; g.fillRect(-30,-30,60,60);
    g.restore();
    g.strokeStyle = OUTLINE; g.lineWidth = 2.5; g.lineJoin='round';
    bodyPath(g); g.stroke();
    // Top sheen
    g.save(); bodyPath(g); g.clip();
    const hi = g.createLinearGradient(0,-26,0,0);
    hi.addColorStop(0,'#ffffffaa'); hi.addColorStop(1,'#ffffff00');
    g.fillStyle = hi; g.fillRect(-30,-30,60,60);
    g.restore();
    // Glowing red eye
    g.fillStyle='#ffffff'; g.shadowColor='#ff2222'; g.shadowBlur=14;
    g.beginPath(); g.arc(0,0,9,0,Math.PI*2); g.fill();
    g.shadowBlur = 0;
    g.fillStyle='#ff2222';
    g.beginPath(); g.arc(0,1,5,0,Math.PI*2); g.fill();
    g.fillStyle='#000';
    g.beginPath(); g.arc(2,2,2.2,0,Math.PI*2); g.fill();
    g.fillStyle='#ffffff';
    g.beginPath(); g.arc(-1,-1,1.4,0,Math.PI*2); g.fill();
    // Outer ring (skull-king vibe)
    g.strokeStyle='#ffea00'; g.lineWidth=2;
    g.beginPath(); g.arc(0,0,30,0.3,Math.PI*0.8); g.stroke();
    g.beginPath(); g.arc(0,0,30,Math.PI*1.3,Math.PI*1.8); g.stroke();
  }

  g.restore();
}
function paintMenuIcons(){
  document.querySelectorAll('canvas[data-icon3d]').forEach(c=>{
    const t = c.getAttribute('data-icon3d');
    draw3DMenuIcon(c.getContext('2d'), t);
  });
}
paintMenuIcons();

