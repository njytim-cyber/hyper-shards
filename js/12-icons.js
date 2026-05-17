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
// REAL 3D PLANE MESH (vertex-projected on Canvas2D)
// ============================================================
// Low-poly fighter (~30 verts, ~22 faces). Each frame we rotate every
// vertex, project to 2D via simple perspective, painter's-sort the
// faces by depth and fill them. Per-face Lambert shading against a
// fixed key light gives orientation cues; per-face vertical gradient
// gives the BTD6 "claymation" panel look. Replaces the previous
// cel-shaded fake-3D stack so the icon can actually rotate in space.
//
// Coordinate system: +X right, +Y down (canvas convention), +Z toward
// the viewer. Model fits roughly inside a unit cube; draw scale ≈ 32
// fills the 96-unit design space used by draw3DMenuIcon.
const _P_V = [
  /*  0 */ [ 0.00, -1.00,  0.00],   // nose tip
  /*  1 */ [ 0.00, -0.55, -0.20],   // top spine (forward)
  /*  2 */ [ 0.00,  0.00, -0.20],   // top spine (mid)
  /*  3 */ [ 0.00,  0.60, -0.13],   // top spine (rear)
  /*  4 */ [ 0.00,  0.95,  0.00],   // tail tip
  /*  5 */ [ 0.20, -0.55,  0.00],   // right side (forward)
  /*  6 */ [ 0.22,  0.00,  0.00],   // right side (mid)
  /*  7 */ [ 0.17,  0.60,  0.05],   // right side (rear)
  /*  8 */ [-0.20, -0.55,  0.00],   // left side (forward)
  /*  9 */ [-0.22,  0.00,  0.00],   // left side (mid)
  /* 10 */ [-0.17,  0.60,  0.05],   // left side (rear)
  /* 11 */ [ 0.00, -0.55,  0.18],   // belly spine (forward)
  /* 12 */ [ 0.00,  0.00,  0.18],   // belly spine (mid)
  /* 13 */ [ 0.00,  0.60,  0.14],   // belly spine (rear)
  /* 14 */ [-1.10,  0.45,  0.05],   // L wing tip (leading)
  /* 15 */ [-0.90,  0.62,  0.05],   // L wing tip (trailing)
  /* 16 */ [-0.22,  0.18,  0.05],   // L wing root (leading)
  /* 17 */ [-0.20,  0.55,  0.05],   // L wing root (trailing)
  /* 18 */ [ 1.10,  0.45,  0.05],   // R wing tip (leading)
  /* 19 */ [ 0.90,  0.62,  0.05],   // R wing tip (trailing)
  /* 20 */ [ 0.22,  0.18,  0.05],   // R wing root (leading)
  /* 21 */ [ 0.20,  0.55,  0.05],   // R wing root (trailing)
  /* 22 */ [ 0.00,  0.50, -0.20],   // tail fin base front
  /* 23 */ [ 0.00,  0.30, -0.55],   // tail fin top front
  /* 24 */ [ 0.00,  0.85, -0.50],   // tail fin top back
  /* 25 */ [ 0.00,  0.93, -0.13],   // tail fin base back
  /* 26 */ [ 0.00, -0.30, -0.32],   // canopy front
  /* 27 */ [ 0.00,  0.10, -0.32],   // canopy back
  /* 28 */ [-0.14, -0.10, -0.32],   // canopy left
  /* 29 */ [ 0.14, -0.10, -0.32],   // canopy right
];

// Faces — m: material key (resolved to color per drawPlane call).
const _P_F = [
  // top body — fan from nose, wrap right + left, then mid + tail
  { v:[0, 5, 1],     m:'body' },
  { v:[0, 1, 8],     m:'body' },
  { v:[1, 5, 6, 2],  m:'body' },
  { v:[1, 2, 9, 8],  m:'body' },
  { v:[2, 6, 7, 3],  m:'body' },
  { v:[2, 3, 10, 9], m:'body' },
  { v:[3, 7, 4],     m:'body' },
  { v:[3, 4, 10],    m:'body' },
  // belly — same shape underneath
  { v:[0, 11, 5],    m:'belly' },
  { v:[0, 8, 11],    m:'belly' },
  { v:[5, 11, 12, 6],m:'belly' },
  { v:[8, 9, 12, 11],m:'belly' },
  { v:[6, 12, 13, 7],m:'belly' },
  { v:[9, 10, 13, 12],m:'belly' },
  { v:[7, 13, 4],    m:'belly' },
  { v:[10, 4, 13],   m:'belly' },
  // wings (flat quads) and tail fin (flat quad)
  { v:[16, 14, 15, 17], m:'wing' },
  { v:[20, 21, 19, 18], m:'wing' },
  { v:[22, 23, 24, 25], m:'tail' },
  // canopy top (flat quad)
  { v:[26, 29, 27, 28], m:'canopy' },
];

// === Tiny 3D math helpers (no deps; inline matrices would just bloat) ===
function _vrotXY(p, ax, ay){
  const cx=Math.cos(ax), sx=Math.sin(ax);
  const cy=Math.cos(ay), sy=Math.sin(ay);
  // Pitch (X) then yaw (Y).
  const y1 = p[1]*cx - p[2]*sx;
  const z1 = p[1]*sx + p[2]*cx;
  const x2 = p[0]*cy + z1*sy;
  const z2 = -p[0]*sy + z1*cy;
  return [x2, y1, z2];
}
function _vsub(a, b){ return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function _vcross(a, b){
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function _vlen(v){ return Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]); }
function _vdot(a, b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
// Perspective project — camera is positioned at +DIST along Z (in our
// convention +Z is toward viewer), so a vertex with Z near +1 is close
// and Z near -1 is far. Returns [x, y].
function _vproject(p, scale, dist){
  const z = dist - p[2];
  const k = scale * 4 / Math.max(z, 0.5);
  return [p[0]*k, p[1]*k];
}
// Multiply a #rrggbb hex by a brightness factor (Lambert shading).
function _shadeHex(hex, f){
  const h = (hex||'#888888').replace('#','');
  const r = Math.min(255, Math.max(0, parseInt(h.slice(0,2),16)*f|0));
  const g = Math.min(255, Math.max(0, parseInt(h.slice(2,4),16)*f|0));
  const b = Math.min(255, Math.max(0, parseInt(h.slice(4,6),16)*f|0));
  return 'rgb('+r+','+g+','+b+')';
}

// === The render itself ===
// `g` is a Canvas2D context already centered at (0,0). `opts` is the
// same params object that the legacy drawPlane accepted; we only use
// the colors. Caller is responsible for clearing the canvas.
function drawPlane3D(g, opts){
  opts = opts || {};
  const tt = (typeof performance !== 'undefined' ? performance.now() : Date.now())/1000;
  // Yaw OSCILLATION (not full spin) — rotates between roughly -35° and
  // +35° so the wing tip never points straight at the camera (which
  // would render as just a thin edge). Pitch stands the plane up so
  // it reads as a 3/4 side view: π/2 of rotation gets us to a pure
  // side profile (camera looking at the plane horizontally), and we
  // back off by 15° (≈0.262 rad) so the top is just slightly visible.
  const yaw   = Math.sin(tt * 0.6) * 0.62;
  const pitch = -Math.PI/2 + 0.262;   // ≈ -1.309 rad → 15° tilt from side-on

  const mat = {
    body:   opts.body        || '#3aa0ff',
    belly:  opts.bodyShadow  || '#1a5a99',
    wing:   opts.wing        || '#6cc0ff',
    tail:   opts.tail        || '#ff66cc',
    canopy: opts.goggles     || '#88e8ff',
  };
  const accent = opts.accent || '#ffea00';

  // Key light direction (from upper-left, into screen).
  const lx=-0.4, ly=-0.9, lz=-0.5, lL=Math.sqrt(lx*lx+ly*ly+lz*lz);
  const light = [lx/lL, ly/lL, lz/lL];

  // Transform every vertex (rotate + project) once.
  const SCALE = 30;
  const DIST  = 3.5;
  const v3 = _P_V.map(v => _vrotXY(v, pitch, yaw));
  const v2 = v3.map(p => _vproject(p, SCALE, DIST));

  // === Ground patch — warm cream ellipse below the plane (BTD6 style) ===
  g.save();
  const gp = g.createRadialGradient(2, 36, 6, 2, 36, 44);
  gp.addColorStop(0,    '#f6e7c2');     // bright centre
  gp.addColorStop(0.55, '#d9c69266');   // mid alpha
  gp.addColorStop(1,    '#d9c69200');   // feathered edge
  g.fillStyle = gp;
  g.beginPath(); g.ellipse(2, 36, 44, 11, 0, 0, Math.PI*2); g.fill();
  // Hard contact shadow on top of the patch
  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.beginPath(); g.ellipse(3, 35, 26, 6, 0, 0, Math.PI*2); g.fill();
  g.restore();

  // === Build face render list (sort by depth, painter's algorithm) ===
  const faces = [];
  for(const f of _P_F){
    const pts3 = f.v.map(i => v3[i]);
    const pts2 = f.v.map(i => v2[i]);
    // Face normal from first three vertices (assumes face is roughly
    // planar — true for our quads, fine for tris).
    const a = _vsub(pts3[1], pts3[0]);
    const b = _vsub(pts3[2], pts3[0]);
    const n = _vcross(a, b);
    const nLen = _vlen(n) || 1;
    // |dot| keeps shading winding-order-agnostic (saves debugging).
    const lambert = Math.abs(_vdot(n, light)) / nLen;
    const shade = 0.40 + 0.65 * lambert;     // ambient .40 + diffuse up to ~1.05
    // Average Z for sort (smaller Z = farther in our convention → drawn first).
    const avgZ = pts3.reduce((s, p) => s + p[2], 0) / pts3.length;
    // Per-face vertical extent for the chunky top-light gradient.
    let yMin=+Infinity, yMax=-Infinity;
    for(const p of pts2){ if(p[1]<yMin) yMin=p[1]; if(p[1]>yMax) yMax=p[1]; }
    faces.push({ pts2, mat:f.m, color: _shadeHex(mat[f.m], shade), avgZ, yMin, yMax });
  }
  faces.sort((a, b) => a.avgZ - b.avgZ);

  // === Draw each face: filled with vertical gradient + thick outline ===
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for(const f of faces){
    g.beginPath();
    g.moveTo(f.pts2[0][0], f.pts2[0][1]);
    for(let i=1;i<f.pts2.length;i++) g.lineTo(f.pts2[i][0], f.pts2[i][1]);
    g.closePath();
    // Vertical gradient: top vertex of face = brighter, bottom = darker.
    // Approximates the rim-light look the BTD6 reference uses without
    // needing per-vertex normals.
    if(f.yMax - f.yMin > 1){
      const gr = g.createLinearGradient(0, f.yMin, 0, f.yMax);
      gr.addColorStop(0,   _shadeHex(f.color.replace('rgb(','#').replace(/[(),]/g,''), 1));
      gr.addColorStop(0.0, '#ffffffaa');   // top rim light
      gr.addColorStop(0.45, f.color);      // base color mid
      gr.addColorStop(1,   '#0a0a1455');   // dark wash bottom
      g.fillStyle = gr;
    } else {
      g.fillStyle = f.color;
    }
    g.fill();
    g.strokeStyle = '#0a0a14'; g.lineWidth = 2.2;
    g.stroke();
  }

  // === Gold racing trim along the body sides (visible only when those
  // faces face the viewer enough) — drawn over the body as accent lines.
  // Connects right-side mid vertices and left-side mid vertices.
  g.strokeStyle = accent; g.lineWidth = 1.8; g.lineCap='round';
  g.beginPath();
  g.moveTo(v2[5][0], v2[5][1]); g.lineTo(v2[6][0], v2[6][1]); g.lineTo(v2[7][0], v2[7][1]);
  g.stroke();
  g.beginPath();
  g.moveTo(v2[8][0], v2[8][1]); g.lineTo(v2[9][0], v2[9][1]); g.lineTo(v2[10][0], v2[10][1]);
  g.stroke();

  // === Wing-tip nav lights (port-red, starboard-green) ===
  for(const [vIdx, col] of [[14, '#ff3344'], [18, '#00ffaa']]){
    const p = v2[vIdx];
    g.save();
    g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 9;
    g.beginPath(); g.arc(p[0], p[1], 2.2, 0, Math.PI*2); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(p[0]-0.6, p[1]-0.5, 0.9, 0, Math.PI*2); g.fill();
    g.restore();
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

  // ===== 3/4-view space fighter (BTD6-style chunky 3D) =====
  // Centered around (0,0). Plane points "up and toward viewer" at ~45°
  // — top of the fuselage and the underside of the wings are both
  // visible, like a paper-toy fighter on a glass shelf. Solid black
  // outline, stacked extruded depth, hard cel-shading, drop-shadow
  // disc beneath. No background — caller's canvas is transparent.
  //
  // The legacy cartoon-pilot plane (with the smiley face peeking
  // through the visor and a dangly cape) has been retired; this is
  // its replacement and uses the same parameter shape so the per-type
  // theme calls below don't have to change.
  function drawPlane(opts){
    // Delegates to the real 3D engine (drawPlane3D, top of file). The
    // ~270-line cel-shaded body that used to live here has been retired
    // in favour of vertex projection — every frame the model is rotated
    // and faces are sorted + filled with Lambert shading + per-face
    // gradient. Same parameter shape kept for the per-type theme calls
    // below.
    drawPlane3D(g, opts || {});
  }
  // === DEAD CODE: legacy cel-shaded drawPlane body, scheduled for delete
  //     once the 3D version is shipped to all icon sizes. Wrapped in an
  //     `if(false)` so the parser keeps validating it but it never runs.
  if(false){
    const tt = performance.now();
    const bob = Math.sin(tt/650) * 1.6;

    // 1. Ground "footprint" — bigger neon halo + dual drop-shadow disc.
    // Halo radius bumped from 38 → 48 and intensity raised so it reads
    // clearly even at 50 px nav-button size. Two stacked dark discs (a
    // soft outer + a harder inner) give the contact shadow a real
    // falloff instead of a flat ellipse.
    g.save();
    const glowG = g.createRadialGradient(2, 32, 6, 2, 32, 48);
    glowG.addColorStop(0,    body+'00');
    glowG.addColorStop(0.30, body+'aa');
    glowG.addColorStop(0.60, body+'66');
    glowG.addColorStop(1,    body+'00');
    g.fillStyle = glowG;
    g.beginPath(); g.ellipse(2, 32, 48, 14, 0, 0, Math.PI*2); g.fill();
    // Soft outer dark shadow
    g.globalAlpha = 0.30;
    g.fillStyle = '#000000';
    g.beginPath(); g.ellipse(4, 32, 30, 8, 0, 0, Math.PI*2); g.fill();
    // Hard inner contact shadow
    g.globalAlpha = 0.60;
    g.beginPath(); g.ellipse(4, 30, 22, 5, 0, 0, Math.PI*2); g.fill();
    g.restore();

    g.save();
    g.translate(0, bob);
    // 2. Perspective transform — vertical squash + horizontal skew so
    // the plane reads as a 3/4 isometric view (camera looking down at
    // ~45°), not a flat top-down. This is the change that most clearly
    // separates the new design from the old chibi-pilot mascot. The
    // skew shifts the top of the silhouette right and the bottom left,
    // producing the same parallax cue as a die-cast model on a shelf.
    g.transform(1, 0, -0.12, 0.86, 0, 0);

    // Helper: stacked-layer extrude (BTD6 chunky depth). Draws `layers`
    // copies of the path offset down-left in pure black, then the
    // top-face fill, then a clipped highlight on the upper edge.
    function chunky3d(drawFn, baseCol, hiCol, depth=5, lightOff=-10, lightAmt=0.55){
      // Depth slabs (back to front, darker to base color). Bumped from
      // 0.85 → 1.1 px-per-layer so the extruded depth reads clearly even
      // at the 50 px phone-portrait nav-button size.
      for(let z=depth; z>0; z--){
        g.save(); g.translate(0, z*1.1);
        g.fillStyle = OUTLINE; drawFn(g);
        g.restore();
      }
      // Top face — gradient from highlight near top to base mid to a
      // shaded base-shadow at the bottom.
      g.save(); drawFn(g); g.clip();
      const grd = g.createLinearGradient(0, lightOff-12, 0, 18);
      grd.addColorStop(0, hiCol);
      grd.addColorStop(0.55, baseCol);
      grd.addColorStop(1, '#0a0f1c');
      g.fillStyle = grd; g.fillRect(-50,-60,100,100);
      // Top sheen — clipped soft white wash on the upper third.
      const sh = g.createLinearGradient(0, lightOff-10, 0, 4);
      sh.addColorStop(0, `rgba(255,255,255,${lightAmt})`);
      sh.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sh; g.fillRect(-50,-60,100,100);
      g.restore();
      // Outline on top of everything.
      g.strokeStyle = OUTLINE; g.lineWidth = 2.5; g.lineJoin='round'; drawFn(g, true);
    }

    // 2. Vertical tail fin — sits at back-top of fuselage, partly behind
    // the cockpit dome. Drawn first so the dome paints over its base.
    chunky3d((g, stroke)=>{
      g.beginPath();
      g.moveTo(-2, -4); g.lineTo(-3, -18);
      g.lineTo(7, -14); g.lineTo(6, -4);
      g.closePath();
      stroke ? g.stroke() : g.fill();
    }, tail, '#ffffff', 3);

    // 3. Wings — symmetric swept-back delta from the middle of the
    // fuselage. Pointed back and out. Drawn before the body so the
    // body's outline sits on top.
    chunky3d((g, stroke)=>{
      g.beginPath();
      g.moveTo(-26, 8);   // far-left wingtip
      g.lineTo(-6, -2);   // root, top
      g.lineTo( 6, -2);
      g.lineTo(26, 8);    // far-right wingtip
      g.lineTo(20, 14);   // trailing edge right
      g.lineTo( 6,  6);
      g.lineTo(-6,  6);
      g.lineTo(-20, 14);  // trailing edge left
      g.closePath();
      stroke ? g.stroke() : g.fill();
    }, wing, '#ffffff', 4, -6, 0.45);
    // Wing accent — bold chrome two-tone (thicker gold band + white
    // racing-stripe shine). Drawn at full 3 px height instead of the
    // previous hairline so the dripped look reads at icon scale.
    g.save();
    g.fillStyle = accent;
    g.beginPath();
    g.moveTo(-22, 8.5); g.lineTo(-7, 0.5); g.lineTo(7, 0.5); g.lineTo(22, 8.5);
    g.lineTo(20, 12);   g.lineTo(7, 4);    g.lineTo(-7, 4);  g.lineTo(-20, 12);
    g.closePath(); g.fill();
    g.strokeStyle = OUTLINE; g.lineWidth = 1.5; g.stroke();
    // White racing-stripe shine running along the top of the gold band
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(-20, 9.2); g.lineTo(-7, 1.5); g.lineTo(7, 1.5); g.lineTo(20, 9.2);
    g.lineTo(19, 10.4); g.lineTo(7, 2.7);  g.lineTo(-7, 2.7); g.lineTo(-19, 10.4);
    g.closePath(); g.fill();
    g.restore();
    // Wingtip nav lights — bigger, brighter, with a hard outline so they
    // pop even at 50 px button size. Port-red / starboard-green per real
    // aircraft convention.
    g.save();
    g.shadowColor = '#ff3344'; g.shadowBlur = 12;
    g.fillStyle = '#ff3344';
    g.beginPath(); g.arc(-26, 9, 2.6, 0, Math.PI*2); g.fill();
    g.fillStyle = '#ffffff'; g.globalAlpha = 0.85;
    g.beginPath(); g.arc(-26.5, 8.5, 1, 0, Math.PI*2); g.fill();
    g.globalAlpha = 1;
    g.shadowColor = '#00ffaa';
    g.fillStyle = '#00ffaa';
    g.beginPath(); g.arc( 26, 9, 2.6, 0, Math.PI*2); g.fill();
    g.fillStyle = '#ffffff'; g.globalAlpha = 0.85;
    g.beginPath(); g.arc( 25.5, 8.5, 1, 0, Math.PI*2); g.fill();
    g.globalAlpha = 1;
    g.shadowBlur = 0;
    g.strokeStyle = OUTLINE; g.lineWidth = 1.4;
    g.beginPath(); g.arc(-26, 9, 2.6, 0, Math.PI*2); g.stroke();
    g.beginPath(); g.arc( 26, 9, 2.6, 0, Math.PI*2); g.stroke();
    g.restore();

    // 4. Fuselage — chunky teardrop pointed up, viewer sees top + a
    // sliver of right side via the cel-shading gradient.
    chunky3d((g, stroke)=>{
      g.beginPath();
      g.moveTo( 0, -22);          // nose tip
      g.quadraticCurveTo( 9, -14,  10,  4);
      g.quadraticCurveTo( 9,  18,  0,  20);  // tail
      g.quadraticCurveTo(-9,  18, -10,  4);
      g.quadraticCurveTo(-9, -14,  0, -22);
      g.closePath();
      stroke ? g.stroke() : g.fill();
    }, body, '#ffffff', 6, -16, 0.6);

    // Side-fuselage shadow band — clipped dark gradient on the right side
    // so the body reads as a curved 3D form, not a flat top-down silhouette.
    g.save();
    g.beginPath();
    g.moveTo( 0, -22);
    g.quadraticCurveTo( 9, -14,  10,  4);
    g.quadraticCurveTo( 9,  18,  0,  20);
    g.quadraticCurveTo(-9,  18, -10,  4);
    g.quadraticCurveTo(-9, -14,  0, -22);
    g.closePath(); g.clip();
    const sf = g.createLinearGradient(2, 0, 11, 0);
    sf.addColorStop(0, '#00000000');
    sf.addColorStop(1, '#00000055');
    g.fillStyle = sf; g.fillRect(0, -22, 12, 44);
    g.restore();
    // Chrome belly stripe — thicker (3.5 px gold + 1.2 px white shine)
    // so it reads as a proper racing decal rather than a hairline.
    g.save();
    g.strokeStyle = accent; g.lineWidth = 3.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -19); g.lineTo(0, 17); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, -19); g.lineTo(0, 17); g.stroke();
    g.restore();
    // Panel rivets along the stripe — bigger so they're visible at icon scale.
    g.fillStyle = OUTLINE;
    for(const ry of [-13, -5, 3, 11]){
      g.beginPath(); g.arc(-4, ry, 1.0, 0, Math.PI*2); g.fill();
      g.beginPath(); g.arc( 4, ry, 1.0, 0, Math.PI*2); g.fill();
    }

    // 5. Cockpit canopy — bigger bubble with a thick black frame so it
    // reads as a proper fighter-jet windshield, not a tinted blob.
    function canopyPath(g){
      g.beginPath();
      g.moveTo(-6, -10);
      g.quadraticCurveTo(-6, -17, 0, -17);
      g.quadraticCurveTo( 6, -17, 6, -10);
      g.lineTo( 5, -1);
      g.lineTo(-5, -1);
      g.closePath();
    }
    chunky3d(canopyPath, goggles, '#ffffff', 2, -17, 0.78);
    // Frame outline (thick black border around the windshield)
    g.strokeStyle = OUTLINE; g.lineWidth = 2.2; canopyPath(g); g.stroke();
    // Twin sheen highlights — bigger, brighter so the glass reads.
    g.save();
    g.fillStyle = '#ffffff';
    g.globalAlpha = 0.92;
    g.beginPath();
    g.ellipse(-2.5, -12, 2, 4, -0.3, 0, Math.PI*2);
    g.fill();
    g.globalAlpha = 0.55;
    g.beginPath();
    g.ellipse(3, -5, 1, 1.8, 0.2, 0, Math.PI*2);
    g.fill();
    g.globalAlpha = 1;
    g.restore();
    // Center frame strip down the canopy (the real-world window divider).
    g.strokeStyle = OUTLINE; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, -16); g.lineTo(0, -2); g.stroke();

    // 6. Twin engine nozzles + flames — two short cylinders at the rear,
    // each with a cel-shaded flame trailing down.
    const nozzleY = 18;
    for(const xOff of [-5, 5]){
      // Nozzle ring
      g.save(); g.translate(xOff, nozzleY);
      g.fillStyle = OUTLINE;
      g.beginPath(); g.ellipse(0, 0, 3, 1.6, 0, 0, Math.PI*2); g.fill();
      g.fillStyle = '#1a1a1a';
      g.beginPath(); g.ellipse(0, -0.4, 2, 0.9, 0, 0, Math.PI*2); g.fill();
      g.restore();

      // Flame — outer (boost color), inner white core. Wobbles slightly.
      const wob = Math.sin(tt/90 + xOff)*1.2;
      g.save(); g.translate(xOff, nozzleY + 1);
      celShape((g, stroke)=>{
        g.beginPath();
        g.moveTo(-2.5, 0);
        g.quadraticCurveTo(-1 + wob*0.2, 6, 0, 9 + wob*0.4);
        g.quadraticCurveTo( 1 - wob*0.2, 6, 2.5, 0);
        g.closePath();
        stroke ? g.stroke() : g.fill();
      }, boost, boostShadow, '#ffffff', 1.5);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(-1, 0); g.quadraticCurveTo(0, 4, 0, 6.5);
      g.quadraticCurveTo(0, 4, 1, 0);
      g.closePath(); g.fill();
      g.restore();
    }

    // 7. Vapor contrails behind the wing tips — soft white tapers fading
    // into the shadow zone. Adds motion + fills the negative space below.
    g.save();
    for(const wx of [-25, 25]){
      const trailG = g.createLinearGradient(wx, 14, wx, 30);
      trailG.addColorStop(0, '#ffffff66');
      trailG.addColorStop(1, '#ffffff00');
      g.fillStyle = trailG;
      g.beginPath();
      g.moveTo(wx-1.4, 14);
      g.lineTo(wx+1.4, 14);
      g.lineTo(wx+0.5, 30);
      g.lineTo(wx-0.5, 30);
      g.closePath(); g.fill();
    }
    g.restore();

    // 8. Tiny twinkling stars around the plane for theme flavour.
    g.fillStyle='#ffffff';
    for(const [sx,sy,sr] of [[-32,-18,1],[30,-14,1.2],[-26,22,0.8],[28,20,0.9]]){
      const tw = 0.35 + 0.65*Math.abs(Math.sin(tt/300 + sx));
      g.globalAlpha = tw;
      g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI*2); g.fill();
    }
    g.globalAlpha = 1;

    g.restore();
  }
  // Original cartoon-pilot drawPlane has been retained as a reference
  // helper but is no longer the plane mascot — the function above
  // shadows it by name. Body of the legacy implementation kept below
  // for any callers that explicitly want a chibi pilot in the future
  // (search "drawPilotMascot"). We don't currently call it anywhere.
  function _drawPilotMascot_legacy({ body='#3aa0ff', bodyShadow='#1a5a99', wing='#6cc0ff', tail='#ff66cc',
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

    // Visor reflection — clean diagonal sheen instead of a face peek.
    // The previous version drew tiny eyes/mouth behind the visor which
    // read as a children's-cartoon mascot; a simple gloss highlight
    // looks like a real reflective helmet.
    g.save();
    g.beginPath();
    g.moveTo(-7, 1);
    g.quadraticCurveTo(-7, -6, 0, -7);
    g.quadraticCurveTo(7, -6, 7, 1);
    g.quadraticCurveTo(0, 4, -7, 1);
    g.closePath();
    g.clip();
    const sheen = g.createLinearGradient(-7, -6, 7, 4);
    sheen.addColorStop(0,    '#ffffff00');
    sheen.addColorStop(0.35, '#ffffffaa');
    sheen.addColorStop(0.55, '#ffffff00');
    sheen.addColorStop(0.7,  '#ffffff44');
    sheen.addColorStop(1,    '#ffffff00');
    g.fillStyle = sheen;
    g.fillRect(-10, -10, 20, 20);
    g.restore();

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

    // (Removed the old fluttering "cape" streamer — it read like a
    // crayon flag and didn't fit a spacecraft. Engine flames + the
    // tail accent fin are enough silhouette punctuation.)

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

  // ===== Per-button icons =====
  // PLAY / SHOP / LEARN / VS AI no longer use the plane mascot —
  // each gets its own purpose-built icon so the bottom nav reads
  // like a familiar app shelf. The plane mascot still lives under
  // "ships" (the 3D button) and "ship" (hub hero) types.

  // ---- PLAY: chunky green play triangle ▶ with BTD6-style depth ----
  if(type==='play'){
    function triPath(g){
      g.beginPath();
      g.moveTo(-16, -22);
      g.lineTo( 24,   0);
      g.lineTo(-16,  22);
      g.closePath();
    }
    // Stacked-depth slabs offset down-right
    for(let z = 6; z > 0; z--){
      g.save(); g.translate(z*0.4, z*0.9);
      g.fillStyle = OUTLINE; triPath(g); g.fill();
      g.restore();
    }
    // Top face — green gradient (matches the playClr ring outside)
    const grd = g.createLinearGradient(0, -22, 0, 22);
    grd.addColorStop(0,    '#aaffd4');
    grd.addColorStop(0.55, '#00d977');
    grd.addColorStop(1,    '#005a30');
    g.fillStyle = grd; triPath(g); g.fill();
    g.strokeStyle = OUTLINE; g.lineWidth = 3; g.lineJoin = 'round';
    triPath(g); g.stroke();
    // Top sheen — clipped soft white wash on the upper half
    g.save(); triPath(g); g.clip();
    const sh = g.createLinearGradient(0, -22, 0, 0);
    sh.addColorStop(0, '#ffffffcc'); sh.addColorStop(1, '#ffffff00');
    g.fillStyle = sh; g.fillRect(-30, -30, 60, 60);
    g.restore();
  }

  // ---- SHOP: shopping bag with rope handles + gold trim + ◈ logo ----
  else if(type==='shop'){
    function bagPath(g){
      g.beginPath();
      g.moveTo(-18, -6);
      g.lineTo( 18, -6);
      g.quadraticCurveTo( 22, -6,  22, -2);
      g.lineTo( 22,  20);
      g.quadraticCurveTo( 22,  24,  18,  24);
      g.lineTo(-18,  24);
      g.quadraticCurveTo(-22,  24, -22,  20);
      g.lineTo(-22, -2);
      g.quadraticCurveTo(-22, -6, -18, -6);
      g.closePath();
    }
    // Depth slabs
    for(let z = 5; z > 0; z--){
      g.save(); g.translate(z*0.4, z*0.9);
      g.fillStyle = OUTLINE; bagPath(g); g.fill();
      g.restore();
    }
    // Bag face — warm gold gradient
    const grd = g.createLinearGradient(0, -6, 0, 24);
    grd.addColorStop(0,    '#ffea66');
    grd.addColorStop(0.5,  '#ffc244');
    grd.addColorStop(1,    '#aa6b00');
    g.fillStyle = grd; bagPath(g); g.fill();
    g.strokeStyle = OUTLINE; g.lineWidth = 3; g.lineJoin = 'round';
    bagPath(g); g.stroke();
    // Gold trim band along the bag's top edge
    g.fillStyle = '#ffea00';
    g.fillRect(-18, -4, 36, 3);
    g.fillStyle = '#aa7700';
    g.fillRect(-18, -1, 36, 1);
    // Rope handles — two arches above the bag
    g.strokeStyle = OUTLINE; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-12, -6); g.bezierCurveTo(-12, -22, -2, -22, -2, -6);
    g.moveTo( 12, -6); g.bezierCurveTo( 12, -22,  2, -22,  2, -6);
    g.stroke();
    g.strokeStyle = '#c9a050'; g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(-12, -6); g.bezierCurveTo(-12, -22, -2, -22, -2, -6);
    g.moveTo( 12, -6); g.bezierCurveTo( 12, -22,  2, -22,  2, -6);
    g.stroke();
    // ◈ shard logo centered on the bag face
    g.save();
    g.fillStyle = '#ffea00'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 4); g.lineTo(7, 12); g.lineTo(0, 20); g.lineTo(-7, 12);
    g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(-2, 9, 1.5, 0, Math.PI*2); g.fill();
    g.restore();
  }

  // ---- LEARN: open book with center spine + bookmark + page lines ----
  else if(type==='tut'){
    // Each page is a tilted quad. Draw left and right pages, with the
    // center "spine" line between them. Bookmark hangs off the right page.
    function leftPagePath(g){
      g.beginPath();
      g.moveTo(-22, -16);
      g.lineTo(  0, -12);
      g.lineTo(  0,  20);
      g.lineTo(-22,  16);
      g.closePath();
    }
    function rightPagePath(g){
      g.beginPath();
      g.moveTo(  0, -12);
      g.lineTo( 22, -16);
      g.lineTo( 22,  16);
      g.lineTo(  0,  20);
      g.closePath();
    }
    // Depth slabs for the whole book silhouette
    for(let z = 5; z > 0; z--){
      g.save(); g.translate(z*0.4, z*0.9);
      g.fillStyle = OUTLINE;
      leftPagePath(g); g.fill();
      rightPagePath(g); g.fill();
      g.restore();
    }
    // Left page — cream gradient
    const lp = g.createLinearGradient(-22, 0, -4, 0);
    lp.addColorStop(0, '#fffaee'); lp.addColorStop(1, '#d8c89a');
    g.fillStyle = lp; leftPagePath(g); g.fill();
    g.strokeStyle = OUTLINE; g.lineWidth = 2.5; g.lineJoin = 'round';
    leftPagePath(g); g.stroke();
    // Right page — same cream
    const rp = g.createLinearGradient(4, 0, 22, 0);
    rp.addColorStop(0, '#d8c89a'); rp.addColorStop(1, '#fffaee');
    g.fillStyle = rp; rightPagePath(g); g.fill();
    rightPagePath(g); g.stroke();
    // Page text lines (six short strokes per page, sized to the tilt)
    g.strokeStyle = '#8a7a4a'; g.lineWidth = 1;
    for(let i = -6; i < 14; i += 3.5){
      g.beginPath(); g.moveTo(-18, i); g.lineTo(-5, i + 0.6); g.stroke();
      g.beginPath(); g.moveTo(  5, i + 0.6); g.lineTo(18, i); g.stroke();
    }
    // Center spine line (re-drawn over the join)
    g.strokeStyle = OUTLINE; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 20); g.stroke();
    // Red bookmark ribbon hanging from the top-right
    g.fillStyle = '#ff3344';
    g.beginPath();
    g.moveTo( 8, -16); g.lineTo(15, -16);
    g.lineTo(15,  10); g.lineTo(11.5,  6); g.lineTo( 8, 10);
    g.closePath();
    g.fill();
    g.strokeStyle = OUTLINE; g.lineWidth = 1.5; g.stroke();
  }

  // ---- 3D mode + hub hero: use the plane mascot ----
  else if(type==='ship'){
    drawPlane({ body:'#00d977', bodyShadow:'#005a30', wing:'#66ffaa', tail:'#ffea00',
                boost:'#a8ffe0', boostShadow:'#00aa66', goggles:'#00eaff', accent:'#ff3344',
                scarf:'#ff3344', expression:'happy' });
  }

  // ---- VS AI: two 2D top-down planes firing at each other ----
  // Flat side-view planes (not the 3D mascot) — reads as "two aircraft
  // dogfighting" at a glance. Bullets traverse the centre toward each
  // ship; "VS" floats above.
  else if(type==='pvp'){
    function plane2D(cx, cy, body, accent, flip){
      g.save();
      g.translate(cx, cy);
      if(flip) g.scale(-1, 1);
      // shadow under plane
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(2, 12, 14, 3, 0, 0, Math.PI*2); g.fill();
      // wings (drawn first so fuselage covers root)
      g.fillStyle = accent;
      g.strokeStyle = OUTLINE; g.lineWidth = 1.5; g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(-14, 2); g.lineTo(6, 0); g.lineTo(4, 5); g.lineTo(-12, 7);
      g.closePath();
      g.fill(); g.stroke();
      // tail fin
      g.beginPath();
      g.moveTo(-12, -2); g.lineTo(-4, -2); g.lineTo(-4, -8); g.closePath();
      g.fill(); g.stroke();
      // fuselage
      g.fillStyle = body;
      g.beginPath();
      g.moveTo(14, 0);
      g.lineTo(2, -5); g.lineTo(-12, -3); g.lineTo(-12, 3); g.lineTo(2, 5);
      g.closePath();
      g.fill(); g.stroke();
      // cockpit
      g.fillStyle = '#88e8ff';
      g.beginPath(); g.ellipse(2, 0, 4, 2.5, 0, 0, Math.PI*2); g.fill();
      g.strokeStyle = OUTLINE; g.lineWidth = 1; g.stroke();
      // nose tip glow
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(14, 0, 1.4, 0, Math.PI*2); g.fill();
      g.restore();
    }
    // Left plane — blue, points RIGHT (nose toward right-hand enemy)
    plane2D(-22, -6, '#3aa0ff', '#1a4477', false);
    // Right plane — red, points LEFT (mirrored so its nose faces left)
    plane2D( 22,  6, '#ff3366', '#992244', true);
    // Tracer bullets crossing the middle. Yellow toward right, cyan
    // toward left — same convention as the 3D mode's wing-tip lights.
    g.shadowBlur = 8;
    g.fillStyle = '#ffea00'; g.shadowColor = '#ffea00';
    for(const [x, y] of [[-6, -4], [4, -2], [14, 0]]){
      g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI*2); g.fill();
    }
    g.fillStyle = '#00eaff'; g.shadowColor = '#00eaff';
    for(const [x, y] of [[6, 4], [-4, 2], [-14, 0]]){
      g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI*2); g.fill();
    }
    g.shadowBlur = 0;
    // "VS" floating above
    g.fillStyle = '#ffffff'; g.shadowColor = '#ff0066'; g.shadowBlur = 14;
    g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('VS', 0, -28);
    g.shadowBlur = 0;
    g.strokeStyle = OUTLINE; g.lineWidth = 2.5;
    g.strokeText('VS', 0, -28);
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

