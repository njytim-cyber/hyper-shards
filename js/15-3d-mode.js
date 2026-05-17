'use strict';
// ============================================================
// 3D MODE — real WebGL via Three.js (CDN)
// ============================================================
// Self-contained 3D third-person shooter that runs alongside the 2D
// game. Boot order in index.html guarantees `THREE` is loaded first,
// but every call guards against a missing THREE so a CDN outage
// degrades gracefully.
//
// Integrated with the rest of the game:
//   • Equipped skin's color/glow/accent paint the 3D ship materials,
//     so all 9 SKINS visibly affect the 3D fighter.
//   • Owned weapons (save.weapons) are cycled via C — single, spread,
//     rapid, heavy each behave differently in 3D.
//   • Q triggers a 3-second invulnerability + halo (mirrors the 2D
//     ability slot's "burst dodge" feel without skin-specific logic).
//   • Mouse moves a crosshair in screen space; bullets fire toward the
//     world point under it (true mouse-aim).
//   • Touch: drag anywhere strafes; tap (no drag) fires.
//   • Score persists on game-over: save.best, totalKills, totalRuns.
//
// The 2D game's `keys[]` map drives keyboard input. ESC / QUIT button
// calls stop3DMode() to tear down the renderer + return to the hub.

let _3D = {
  active: false,
  scene: null,
  camera: null,
  renderer: null,
  ship: null,
  shipParts: null,        // refs to body/wing/canopy/engine meshes for skin updates
  shipHalo: null,         // glow ring shown during ability invuln
  starField: null,
  asteroids: [],
  bullets: [],
  particles: [],
  hp: 5, maxHp: 5,
  score: 0,
  kills: 0,
  fireCooldown: 0,
  spawnCooldown: 0,
  rafId: 0,
  lastT: 0,
  // Private input map — the global keys[] in 01-core.js only populates
  // when state.phase is one of the 2D play phases, so the 3D mode has
  // its own listeners that bypass that gate. This is the single bug
  // that made W/A/S/D/SPACE feel completely dead in 3D mode.
  ks: {},
  // Mouse-aim — normalized device coords [-1,1] for the pointer + a
  // pixel-space copy used to drive the visible crosshair element.
  aimNDC: { x: 0, y: 0 },
  aimPx:  { x: 0, y: 0 },
  // Visible aim crosshair (DOM element, follows the mouse).
  crosshairEl: null,
  // Q ability VFX — expanding shockwave rings spawned when the ability
  // fires; each one fades + grows over its lifetime.
  shockwaves: [],
  // Touch state — first finger drags the ship (delta from start);
  // a quick tap with no drag fires.
  touch: { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, dragged: false, fired: false },
  // Weapons — cycle index into the player's owned weapons.
  weapons: [],
  weaponIdx: 0,
  // Q ability — invuln timer (ms) + cooldown (ms).
  invuln: 0,
  abilityCd: 0,
  // === Juice pass ===
  // Camera shake — { amp, ms } where amp is peak displacement units
  // and ms ticks down each frame; produces decaying jitter on the cam.
  shake: null,
  // Combo: each kill bumps `combo` and resets `comboTimer` to ~1.5s.
  // When the timer expires the streak collapses back to 0. Score is
  // multiplied by 1 + 0.1*combo (capped 5×) — visible in HUD.
  combo: 0,
  comboTimer: 0,
  // Boss state — { mesh, hp, maxHp, fireCd } when active, else null.
  // Spawned every BOSS_INTERVAL_KILLS kills.
  boss: null,
  bossNextKills: 25,
  // Incremented every time a boss spawns. The 1-based number maps to a
  // tier via BOSS_XP_BY_TIER (cycling 1→5 after every 5 bosses), which
  // drives the XP reward + HP + score scaling.
  bossNumber: 0,
  // Ultimate ability cooldown (ms). Triggered on E when the equipped
  // skin has reached its mastery XP threshold. Cooldown comes from the
  // skin's ULTIMATES entry (typically 25–45s).
  ultCd: 0,
  // RAGE state — when active, fire cooldown shrinks to 1/3 and bullet
  // damage doubles for ragingMs milliseconds.
  ragingMs: 0,
  // DIVINE WRATH state — celestial-specific 5-second visual where the
  // ship body briefly turns brilliant platinum-white-gold (brighter
  // than the base mastered gold). Ticked down each frame in the loop.
  divineWrathMs: 0,
  // Remembered base colours for the ship hull / wings, so we can
  // restore them after divineWrathMs expires.
  shipBaseColors: null,
  // Bookkeeping
  resizeHandler: null,
  escHandler: null,
  keyHandler: null,
  mouseHandler: null,
  touchStartHandler: null,
  touchMoveHandler: null,
  touchEndHandler: null,
};

// Per-tier boss reward tables come from 01-core.js — they're shared
// with the 2D survival mode now so a tier-5 kill in either mode gives
// the same XP. Bosses in 3D cycle through tiers 1→5 by spawn count
// (see _3d_spawnBoss), wrapping after the 5th.

// Weapon defs in the 3D world. dmg is in "asteroid HP units" (small
// asteroids start at 1 HP, large at 2). cd is firing cooldown in ms.
// `kind` selects firing/impact behaviour:
//   • 'normal'  — straight-line projectile that damages on first hit
//   • 'wave'    — projectile whose path sin-waves around the aim line
//   • 'beam'    — instant cylinder beam, raycast-damages every asteroid
//                 within radius along the firing line
//   • 'split'   — projectile that bursts into N micro-bolts after a
//                 short fuse (cluster pod)
//   • 'chain'   — on hit, also damages the 2 nearest asteroids inside
//                 a chain radius (shock orb)
//   • 'aoe'     — on hit, spawns a short-lived attractor zone that
//                 pulls + damages everything inside its radius (void)
const _3D_WEAPONS = {
  single:  { name:'PLASMA',      cd:140, dmg:1, bolts:1, spread:0,    color:0x00eaff, size:0.18, kind:'normal' },
  spread:  { name:'SPREAD',      cd:200, dmg:1, bolts:3, spread:0.18, color:0xffea00, size:0.16, kind:'normal' },
  rapid:   { name:'PULSE',       cd:75,  dmg:1, bolts:1, spread:0,    color:0x00ff88, size:0.14, kind:'normal' },
  heavy:   { name:'RAILGUN',     cd:380, dmg:3, bolts:1, spread:0,    color:0xff66cc, size:0.32, kind:'normal' },
  wave:    { name:'AETHER WAVE', cd:200, dmg:2, bolts:1, spread:0,    color:0xaa66ff, size:0.22, kind:'wave'   },
  flame:   { name:'PLASMA FLAME',cd:55,  dmg:1, bolts:2, spread:0.05, color:0xff5500, size:0.13, kind:'normal' },
  lance:   { name:'ION LANCE',   cd:160, dmg:1, bolts:1, spread:0,    color:0xffffff, size:0,    kind:'beam'   },
  cluster: { name:'CLUSTER POD', cd:600, dmg:1, bolts:1, spread:0,    color:0xffaa00, size:0.26, kind:'split'  },
  shock:   { name:'SHOCK ORB',   cd:520, dmg:1, bolts:1, spread:0,    color:0xaaccff, size:0.24, kind:'chain'  },
  void:    { name:'VOID CANNON', cd:900, dmg:2, bolts:1, spread:0,    color:0x6622aa, size:0.30, kind:'aoe'    },
};

function _3d_canvas(){ return document.getElementById('game3d'); }
function _3d_hud()    { return document.getElementById('hud3d'); }

// Resolve a CSS hex string ('#3aa0ff') to a Three.js-friendly number.
function _hex(c, fallback){
  if(typeof c !== 'string') return fallback;
  const m = c.replace('#','');
  if(m.length !== 6) return fallback;
  return parseInt(m, 16);
}

// Multiply a numeric (0xRRGGBB) colour by `factor` channel-wise. Used
// to derive the hull's belly / side / wing shades from the main body
// colour so they read as the SAME material in shadow, not arbitrary
// dark greys. factor < 1 darkens; factor > 1 lightens (clamped to 255).
function _darken(c, factor){
  const r = Math.min(255, Math.max(0, ((c >> 16) & 0xff) * factor | 0));
  const g = Math.min(255, Math.max(0, ((c >>  8) & 0xff) * factor | 0));
  const b = Math.min(255, Math.max(0, ( c        & 0xff) * factor | 0));
  return (r << 16) | (g << 8) | b;
}

// Resolve the equipped skin → the colour palette the 3D ship uses.
// Looks up SKINS from 01-core.js if available; falls back to a sensible
// default so the 3D mode still boots if SKINS isn't loaded yet.
//
// MASTERY OVERLAY: when the player has enough XP with this skin to
// unlock its ultimate, the palette gets recoloured. Top-tier skin
// "celestial" turns pure gold across body+wings+accent (the legendary
// reward). Every other mastered skin gets a gold body tint while
// keeping its accent + glow — visible "this skin is mastered" cue.
function _3d_resolveSkin(){
  const skinId = (typeof save !== 'undefined' && save && save.skin) || 'default';
  const skin = (typeof SKINS !== 'undefined' && SKINS.find(s => s.id === skinId)) || null;
  const mastered = (typeof isSkinMastered === 'function') && isSkinMastered(skinId);
  if(!skin){
    return { id:'default', body:0x3aa0ff, glow:0x00eaff, accent:0xffea00, rainbow:false, dark:false, mastered };
  }
  let body   = _hex(skin.color,  0x3aa0ff);
  let glow   = _hex(skin.glow,   0x00eaff);
  let accent = _hex(skin.accent, 0xffea00);
  if(mastered){
    if(skinId === 'celestial'){
      // The "best plane" reward — fully gold ship.
      body   = 0xffd700;
      accent = 0xffffff;
      glow   = 0xfff7c0;
    } else {
      // Other mastered skins: gold body tint, keep accent + glow.
      body   = 0xffd700;
    }
  }
  return {
    id:     skin.id,
    body, glow, accent,
    rainbow: !!skin.rainbow,
    dark:    !!skin.dark,
    mastered,
  };
}

// === 3D ship model — faithful to the 2D drawShip() silhouette ==========
// Mirrors the cel-shaded sprite the player sees in 2D mode so the same
// skin reads as the same plane across both modes. Vertex layout was
// transcribed directly from 11-render.js (the 2D outline at lines
// 674-684) and scaled by 1/24 to fit a unit-cube model.
//
//   • Hull: hexagonal "guppy" silhouette — narrow nose, widest at the
//     hip (mid-back), tapering to a pointed tail.
//   • Cockpit: prominent egg-shaped dome on top of the front-mid hull
//     (matches the 2D ellipse at (0, -8) with radii 5×9).
//   • Wings: short swept-back triangles off the hip — only 1.3× hull
//     width (matches the 2D wings at ±26 vs hull ±20), not the giant
//     deltas the stealth-fighter version had.
//   • Tail flares: two small swept fins angled back (matches the 2D
//     tail outer points at (±14, 18)).
//   • Accent stripes: three small accent-coloured boxes on the top of
//     the hull (matches the 2D fillRect strips).
//   • Nose tip: bright white emissive sphere — same as the 2D nose glow.
//   • Engine plumes: twin teardrops out the back with point lights.
function _3d_buildShip(palette){
  const g = new THREE.Group();
  const parts = {};

  // Helper to build a flat-shaded mesh from raw triangle vertices.
  function tri(verts, color, opts){
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    geom.computeVertexNormals();
    const mat = new THREE.MeshPhongMaterial(Object.assign({
      color, flatShading: true, shininess: 28, side: THREE.DoubleSide,
    }, opts || {}));
    return new THREE.Mesh(geom, mat);
  }
  // Hull tri — same as tri() but applies a glittery metallic profile
  // when the skin is mastered. EMISSIVE is the key piece: it makes
  // every face radiate gold (or whatever body colour) independent of
  // lighting, so the wing EDGES and BELLY stay visibly gold even when
  // they face away from the sun. Without it, ambient×gold = dark
  // olive, which is what made the user's screenshot show black wings
  // despite a "gold body". `shininess + specular` add the moving
  // highlight shimmer ("glittery") on top of the steady glow.
  function hullTri(verts, color){
    return tri(verts, color, palette.mastered
      ? {
          shininess: 140,
          specular: 0xfff7c0,
          flatShading: false,
          emissive: color,              // glow with the SAME colour the face is painted
          emissiveIntensity: 0.55,      // 55% steady glow — leaves room for highlights
        }
      : null);
  }

  // ===== HULL OUTLINE (transcribed from 2D drawShip, scaled /24) =====
  // 2D pixel point      →  3D vertex (x, _, z)
  // (0, -26)  nose       →  (0,    -1.08)
  // (7, -10)  shoulder   →  (0.29, -0.42)
  // (20, 8)   hip        →  (0.83,  0.33)   ← widest hull point
  // (14, 18)  tail-out   →  (0.58,  0.75)
  // (7, 14)   tail-in    →  (0.29,  0.58)
  // (0, 22)   tail-tip   →  (0,     0.92)
  // (mirrored on left side)
  const H_TOP_Y = 0.16;  // top face Y
  const H_BOT_Y = -0.12; // belly face Y

  // === Hull TOP face — triangulated as a fan from the nose ===
  const hullTopVerts = [
    // Front: nose → shoulder L → shoulder R
     0,H_TOP_Y,-1.08,    -0.29,H_TOP_Y,-0.42,    0.29,H_TOP_Y,-0.42,
    // Front-to-hip (left then right)
    -0.29,H_TOP_Y,-0.42, -0.83,H_TOP_Y, 0.33,    0,   H_TOP_Y,-0.42,
    -0.83,H_TOP_Y, 0.33,  0,   H_TOP_Y, 0.33,    0,   H_TOP_Y,-0.42,
     0,   H_TOP_Y,-0.42,  0,   H_TOP_Y, 0.33,    0.83,H_TOP_Y, 0.33,
     0,   H_TOP_Y,-0.42,  0.83,H_TOP_Y, 0.33,    0.29,H_TOP_Y,-0.42,
    // Hip-to-tail-outer
    -0.83,H_TOP_Y, 0.33, -0.58,H_TOP_Y, 0.75,    0,   H_TOP_Y, 0.33,
    -0.58,H_TOP_Y, 0.75, -0.29,H_TOP_Y, 0.58,    0,   H_TOP_Y, 0.33,
     0,   H_TOP_Y, 0.33,  0.29,H_TOP_Y, 0.58,    0.58,H_TOP_Y, 0.75,
     0,   H_TOP_Y, 0.33,  0.58,H_TOP_Y, 0.75,    0.83,H_TOP_Y, 0.33,
    // Tail-outer → tail-tip
    -0.58,H_TOP_Y, 0.75, -0.29,H_TOP_Y, 0.58,    0,   H_TOP_Y, 0.92,
    -0.29,H_TOP_Y, 0.58,  0.29,H_TOP_Y, 0.58,    0,   H_TOP_Y, 0.92,
     0.29,H_TOP_Y, 0.58,  0.58,H_TOP_Y, 0.75,    0,   H_TOP_Y, 0.92,
  ];
  const hullTop = hullTri(hullTopVerts, palette.body);
  g.add(hullTop);
  parts.body = hullTop;

  // Mastered ships use FULL body color across every hull surface so the
  // whole ship reads as a single metal (gold for celestial-mastered).
  // Non-mastered ships keep moderate darkening on the belly/sides/wings
  // so the lighting cues still read.
  const bellyMul = palette.mastered ? 1.00 : 0.55;
  const sideMul  = palette.mastered ? 1.00 : 0.45;
  const wingMul  = palette.mastered ? 1.00 : 0.55;

  // === Hull BELLY face — same silhouette mirrored to H_BOT_Y ===
  const hullBotVerts = [];
  for(let i = 0; i < hullTopVerts.length; i += 9){
    // Reverse winding so the belly normals face down
    hullBotVerts.push(
      hullTopVerts[i+0], H_BOT_Y, hullTopVerts[i+2],
      hullTopVerts[i+6], H_BOT_Y, hullTopVerts[i+8],
      hullTopVerts[i+3], H_BOT_Y, hullTopVerts[i+5]
    );
  }
  const hullBot = hullTri(hullBotVerts, _darken(palette.body, bellyMul));
  g.add(hullBot);
  parts.hullBot = hullBot;     // tracked so DIVINE WRATH can tint it

  // === Side fill — connects top and belly along the hull outline ===
  const outline = [
    [ 0,    -1.08],
    [ 0.29, -0.42],
    [ 0.83,  0.33],
    [ 0.58,  0.75],
    [ 0.29,  0.58],
    [ 0,     0.92],
    [-0.29,  0.58],
    [-0.58,  0.75],
    [-0.83,  0.33],
    [-0.29, -0.42],
  ];
  const sideVerts = [];
  for(let i = 0; i < outline.length; i++){
    const a = outline[i];
    const b = outline[(i+1) % outline.length];
    // Two triangles per outline edge (top-a, top-b, bot-a + bot-a, top-b, bot-b)
    sideVerts.push(
      a[0], H_TOP_Y, a[1],   b[0], H_TOP_Y, b[1],   a[0], H_BOT_Y, a[1],
      a[0], H_BOT_Y, a[1],   b[0], H_TOP_Y, b[1],   b[0], H_BOT_Y, b[1]
    );
  }
  g.add(hullTri(sideVerts, _darken(palette.body, sideMul)));

  // ===== COCKPIT DOME — egg-shaped at (0, -8) in 2D → (0, top+0.18, -0.33).
  // The 2D ship draws the cockpit with a radial gradient
  // white → accent → dark (see drawShip line ~696), so we use the
  // skin's ACCENT colour (yellow for NOVA) rather than .glow (cyan).
  // This is the change that makes the 3D ship's top-down view read
  // the same as the 2D hub hero. =====
  const canopyGeom = new THREE.SphereGeometry(0.22, 18, 12, 0, Math.PI*2, 0, Math.PI/2);
  const canopyMat  = new THREE.MeshPhongMaterial({
    color: palette.accent, transparent: true, opacity: 0.92,
    flatShading: false, shininess: 130, specular: 0xffffff, emissive: palette.accent, emissiveIntensity: 0.25,
  });
  const canopy = new THREE.Mesh(canopyGeom, canopyMat);
  canopy.position.set(0, H_TOP_Y + 0.02, -0.33);
  canopy.scale.set(0.95, 1.20, 1.65);     // tall + elongated (matches 2D 5×9 ellipse)
  g.add(canopy);
  parts.canopy = canopy;
  // Cockpit core — bright white inner glow (2D had a white→accent radial)
  const canopyCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  canopyCore.position.set(0, H_TOP_Y + 0.04, -0.33);
  g.add(canopyCore);

  // ===== WINGS — extruded 3D prisms, not flat triangles ===============
  // The 2D drawShip wings read as chunky from above because of the thick
  // black outline on the flat polygon. In 3D a flat polygon just becomes
  // a thin slice when viewed off-axis — so each wing is now an extruded
  // PRISM: a top face + a bottom face + 3 side strips (leading edge,
  // tip edge, trailing edge). The root edge is hidden inside the hull.
  // 2D vertex map (Y → Z, scaled /24):
  //   root-front (-7,-2) → (±0.29, _, -0.08)
  //   tip-front  (-26,12)→ (±1.08, _,  0.50)
  //   tip-back   (-18,14)→ (±0.75, _,  0.58)
  //   root-back  (-7, 8) → (±0.29, _,  0.33)
  for(const sign of [-1, 1]){
    const yT = H_TOP_Y - 0.02;       // top face Y
    const yB = H_TOP_Y - 0.12;       // bottom face Y (0.10 thick)
    // 4 outline points in (x, z)
    const rf = [sign*0.29, -0.08];
    const tf = [sign*1.08,  0.50];
    const tb = [sign*0.75,  0.58];
    const rb = [sign*0.29,  0.33];
    // Top face (2 triangles, CCW from above)
    const topVerts = [
      rf[0], yT, rf[1],   tf[0], yT, tf[1],   tb[0], yT, tb[1],
      rf[0], yT, rf[1],   tb[0], yT, tb[1],   rb[0], yT, rb[1],
    ];
    const wing = hullTri(topVerts, _darken(palette.body, wingMul));
    g.add(wing);
    if(sign === -1) parts.wingL = wing; else parts.wingR = wing;
    // Bottom face (2 triangles, CW from above so normals point down)
    const botVerts = [
      rf[0], yB, rf[1],   tb[0], yB, tb[1],   tf[0], yB, tf[1],
      rf[0], yB, rf[1],   rb[0], yB, rb[1],   tb[0], yB, tb[1],
    ];
    // Wing bottom — when mastered we use full body colour (no darkening)
    // so the WHOLE wing reads gold from any camera angle. Non-mastered
    // gets a slight 0.55 multiplier for natural shading.
    const wingBotMul = palette.mastered ? 1.00 : (wingMul * 0.55);
    const wingBot = hullTri(botVerts, _darken(palette.body, wingBotMul));
    g.add(wingBot);
    // Side strips — leading edge, tip edge, trailing edge. Each pair
    // of points (top, bottom) makes a quad split into 2 tris.
    function edgeQuad(a, b){
      return [
        a[0], yT, a[1],   b[0], yT, b[1],   a[0], yB, a[1],
        a[0], yB, a[1],   b[0], yT, b[1],   b[0], yB, b[1],
      ];
    }
    // Wing edges (leading/tip/trailing strips). Same mastery rule:
    // full gold when mastered, moderate shading otherwise.
    const edgeCol = _darken(palette.body, palette.mastered ? 1.00 : (wingMul * 0.75));
    g.add(hullTri(edgeQuad(rf, tf), edgeCol));  // leading edge
    g.add(hullTri(edgeQuad(tf, tb), edgeCol));  // tip edge
    g.add(hullTri(edgeQuad(tb, rb), edgeCol));  // trailing edge
    // Track edge meshes so Divine Wrath can tint the whole wing
    if(sign === -1){
      parts.wingLBot = wingBot;
    } else {
      parts.wingRBot = wingBot;
    }

    // Wing-tip nav light. Port-red / starboard-green normally, but
    // GOLD for mastered ships so they're consistent with the rest of
    // the glittery-gold treatment.
    const tipCol = palette.mastered ? 0xffea00 : (sign < 0 ? 0xff3344 : 0x00ffaa);
    const tipLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshBasicMaterial({ color: tipCol })
    );
    tipLight.position.set(sign*1.08, H_TOP_Y, 0.50);
    g.add(tipLight);
    const tipPL = new THREE.PointLight(tipCol, 0.35, 3);
    tipPL.position.copy(tipLight.position);
    g.add(tipPL);
  }

  // ===== ACCENT STRIPES — the three yellow bars the 2D ship has on
  // top of its hull. Matches the 2D exactly:
  //   fillRect(-1.5, -22, 3, 8)  → forward centerline (nose→cockpit)
  //   fillRect(-12,  10, 3, 5)   → left rear stripe (tail-inner-left)
  //   fillRect(  9,  10, 3, 5)   → right rear stripe (tail-inner-right)
  // Scaled by 1/24 to fit the 3D unit-cube model. These are the bright
  // yellow accents the user pointed out in the 2D screenshot.
  // Accent stripes — yellow by default (matches the 2D ship's yellow
  // accents). When mastered we force GOLD so they don't go pale
  // (mastered celestial's palette.accent = white, which read as
  // off-colour against the gold hull).
  const accentMat = new THREE.MeshBasicMaterial({
    color: palette.mastered ? 0xffea00 : palette.accent
  });
  // Forward centerline stripe — only between nose and cockpit
  const stripeFwd = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.33), accentMat);
  stripeFwd.position.set(0, H_TOP_Y + 0.025, -0.75);
  g.add(stripeFwd);
  // Two rear side stripes — short vertical bars near the tail-inner
  for(const sx of [-0.50, 0.50]){
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.22), accentMat);
    s.position.set(sx, H_TOP_Y + 0.025, 0.45);
    g.add(s);
  }

  // ===== NOSE TIP GLOW — bright white emissive sphere on the very tip =====
  // Matches the 2D nose dot at (0, -26) with shadowBlur 20.
  const noseTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  noseTip.position.set(0, H_TOP_Y - 0.04, -1.08);
  g.add(noseTip);
  parts.nose = noseTip;
  // Soft halo point light at the nose tip — sells the glow
  const noseLight = new THREE.PointLight(palette.glow, 0.5, 2);
  noseLight.position.copy(noseTip.position);
  g.add(noseLight);

  // ===== ENGINE PLUMES — twin teardrops out the back, centered low =====
  for(const xOff of [-0.18, 0.18]){
    const podGeom = new THREE.CylinderGeometry(0.10, 0.13, 0.30, 10);
    // Engine pods are dark gray by default; mastered ships swap them
    // for glittery gold (same emissive treatment as the hull) so the
    // whole spaceship reads as one continuous golden material.
    const podMat  = palette.mastered
      ? new THREE.MeshPhongMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.55, shininess: 140, specular: 0xfff7c0, flatShading: false })
      : new THREE.MeshPhongMaterial({ color: 0x14141c, flatShading: true });
    const pod = new THREE.Mesh(podGeom, podMat);
    pod.rotation.x = Math.PI/2;
    pod.position.set(xOff, H_TOP_Y - 0.10, 0.80);
    g.add(pod);
    // Hot rim ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.02, 8, 14),
      new THREE.MeshBasicMaterial({ color: palette.glow })
    );
    ring.position.set(xOff, H_TOP_Y - 0.10, 0.96);
    g.add(ring);
    // Plume — stretched white-core / glow-mantle teardrop
    const plume = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshBasicMaterial({ color: palette.glow, transparent: true, opacity: 0.9 })
    );
    plume.position.set(xOff, H_TOP_Y - 0.10, 1.10);
    plume.scale.set(1, 1, 1.8);
    g.add(plume);
    // Inner white core (matches the 2D linear-grad plume: white→glow→0)
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    core.position.set(xOff, H_TOP_Y - 0.10, 1.00);
    g.add(core);
    // Engine point light
    const pl = new THREE.PointLight(palette.glow, 0.7, 5);
    pl.position.copy(plume.position);
    g.add(pl);
  }

  // === Dark-skin override (ECLIPSE / SHADOW): drop hull toward black ===
  if(palette.dark){
    parts.body.material.color.setHex(0x222244);
    parts.wingL.material.color.setHex(0x1a1a2c);
    parts.wingR.material.color.setHex(0x1a1a2c);
  }

  // The model was authored with nose at -Z (forward). The ship Group's
  // local frame matches that — strafes happen on the parent, banking
  // happens on this Group's rotation. No extra rotation needed.
  return { group: g, parts };
}

// Invulnerability halo — built once, hidden by default. Shown for the
// duration of the Q-ability invuln timer with a pulsing scale.
function _3d_buildHalo(){
  const geom = new THREE.TorusGeometry(1.2, 0.08, 8, 24);
  const mat  = new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.0 });
  const halo = new THREE.Mesh(geom, mat);
  halo.rotation.x = Math.PI/2;
  return halo;
}

// Build a starfield as a Points cloud — cheap parallax tunnel.
function _3d_buildStars(){
  const N = 1500;
  const positions = new Float32Array(N * 3);
  const colors    = new Float32Array(N * 3);
  for(let i=0;i<N;i++){
    positions[i*3]   = (Math.random()-0.5) * 200;
    positions[i*3+1] = (Math.random()-0.5) * 120;
    positions[i*3+2] = -Math.random() * 600 - 5;
    const tint = Math.random();
    if(tint < 0.5){      colors[i*3]=1.0; colors[i*3+1]=1.0; colors[i*3+2]=1.0; }
    else if(tint < 0.8){ colors[i*3]=0.0; colors[i*3+1]=0.92; colors[i*3+2]=1.0; }
    else {               colors[i*3]=1.0; colors[i*3+1]=0.4;  colors[i*3+2]=0.8; }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
  const mat = new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: false });
  return new THREE.Points(geom, mat);
}

function _3d_spawnAsteroid(){
  const bigChance = 0.30 + Math.min(0.30, _3D.kills * 0.005);
  const isBig = Math.random() < bigChance;
  const r = isBig ? (2.0 + Math.random()*1.0) : (1.1 + Math.random()*0.6);
  const geom = new THREE.IcosahedronGeometry(r, 0);
  const greys = [0x4a4a55, 0x55504a, 0x3a4050, 0x605a4a, 0x554a55];
  // emissive enabled so we can drive a hit-flash via material.emissive —
  // asteroids briefly glow white when struck for clear damage feedback.
  const mat = new THREE.MeshPhongMaterial({
    color: greys[Math.floor(Math.random() * greys.length)],
    flatShading: true, shininess: 8,
    emissive: 0x000000,
  });
  const a = new THREE.Mesh(geom, mat);
  a.position.set(
    (Math.random() - 0.5) * 36,
    (Math.random() - 0.5) * 18,
    -260 - Math.random() * 60
  );
  a.userData.spin = new THREE.Vector3(
    (Math.random() - 0.5) * 0.04,
    (Math.random() - 0.5) * 0.04,
    (Math.random() - 0.5) * 0.04
  );
  a.userData.speed  = 0.85 + Math.random()*0.6 + Math.min(0.6, _3D.kills*0.01);
  a.userData.radius = r;
  a.userData.hp     = isBig ? 2 : 1;
  a.userData.score  = isBig ? 25 : 10;
  _3D.scene.add(a);
  _3D.asteroids.push(a);
}

// Fire one or more bullets from the ship's nose toward the aim point.
// Aim point comes from the mouse — we unproject the screen NDC into a
// world ray, aim bullets at a point ~80 units down that ray.
//
// Dispatches on weapon `kind`:
//   • beam  → spawn an instant cylinder mesh + raycast-damage along it
//   • split → cluster pod (parent gets a fuse + bolts count for later split)
//   • chain → shock orb (chain flag carried on the bullet)
//   • aoe   → void cannon (aoe flag carried on the bullet)
//   • wave  → adds wave userdata so the update loop modulates the path
//   • everything else → straight-line projectile (current behaviour)
function _3d_fireBullets(){
  const w = _3D_WEAPONS[_3D.weapons[_3D.weaponIdx]] || _3D_WEAPONS.single;

  // === GOLDENISED WEAPONS — when the equipped skin is mastered, every
  // bullet/beam/cluster/particle uses gold instead of the weapon's
  // native colour. So a mastered Celestial firing PLASMA shoots gold
  // bolts, not cyan; a mastered Celestial firing AETHER WAVE shoots
  // gold wavy bolts, not magenta. Cosmetic only — damage + cooldown
  // unchanged.
  const _mastered = (typeof isSkinMastered === 'function')
    && typeof save !== 'undefined' && save
    && isSkinMastered(save.skin || 'default');
  const shotColor = _mastered ? 0xffea00 : w.color;

  const aimWorld = new THREE.Vector3(_3D.aimNDC.x, _3D.aimNDC.y, 0.5);
  aimWorld.unproject(_3D.camera);
  const dir = aimWorld.sub(_3D.camera.position).normalize();
  const aimTarget = _3D.camera.position.clone().add(dir.multiplyScalar(80));

  const origin = _3D.ship.position.clone();
  origin.z -= 1.5;

  // === ION LANCE — instant beam, raycast all asteroids on the firing line.
  if(w.kind === 'beam'){
    const beamDir = aimTarget.clone().sub(origin).normalize();
    const beamLen = 240;
    // Damage every asteroid within 0.7 units of the beam line (cheap point-line distance).
    for(let j = _3D.asteroids.length - 1; j >= 0; j--){
      const a = _3D.asteroids[j];
      const toAst = a.position.clone().sub(origin);
      const proj  = toAst.dot(beamDir);
      if(proj < 0 || proj > beamLen) continue;
      const closest = origin.clone().add(beamDir.clone().multiplyScalar(proj));
      const d = closest.distanceTo(a.position);
      if(d < a.userData.radius + 0.7){
        a.userData.hp -= w.dmg;
        _3d_flashAsteroid(a);
        _3d_spawnParticles(a.position, shotColor, 6);
        if(a.userData.hp <= 0){
          _3d_destroyAsteroid(a, j);
        }
      }
    }
    // Visualise the beam — a thin cylinder along the firing line that
    // fades in ~140ms. Tracked in _3D.bullets with a `lifeMs` field so
    // the update loop fades + removes it.
    const beamGeom = new THREE.CylinderGeometry(0.10, 0.10, beamLen, 8, 1, true);
    const beamMat  = new THREE.MeshBasicMaterial({ color: shotColor, transparent: true, opacity: 0.95 });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    // Cylinder is along Y by default — orient along beamDir.
    const mid = origin.clone().add(beamDir.clone().multiplyScalar(beamLen/2));
    beam.position.copy(mid);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), beamDir);
    beam.userData.beam   = true;
    beam.userData.lifeMs = 140;
    _3D.scene.add(beam);
    _3D.bullets.push(beam);
    if(typeof sfx === 'function') sfx('shoot');
    return;
  }

  for(let i=0; i<w.bolts; i++){
    const target = aimTarget.clone();
    if(w.spread > 0 && w.bolts > 1){
      const t = (i - (w.bolts-1)/2);
      target.x += t * w.spread * 30;
    }
    const speedMul = (w.kind === 'aoe' || w.kind === 'chain') ? 1.6 : 2.6;
    const vel = target.sub(origin).normalize().multiplyScalar(speedMul);

    const geom = new THREE.SphereGeometry(w.size, 10, 8);
    const mat  = new THREE.MeshBasicMaterial({ color: shotColor });
    const b = new THREE.Mesh(geom, mat);
    b.position.copy(origin);
    b.userData.vel = vel;
    // RAGE ultimate doubles bullet damage for its duration.
    b.userData.dmg = w.dmg * (_3D.ragingMs > 0 ? 2 : 1);
    // Carry the SHOT colour (already goldened if mastered) so impact
    // particles + cluster splits + chain arcs use the same tint.
    b.userData.color = shotColor;
    b.userData.kind  = w.kind;     // carried so the bullet loop can dispatch on impact
    if(w.kind === 'split'){
      b.userData.fuse = 280;       // ms before the pod splits into 6 micro bolts
    } else if(w.kind === 'wave'){
      b.userData.waveAng = Math.random() * Math.PI * 2;
      b.userData.waveAxis = new THREE.Vector3(-vel.y, vel.x, 0).normalize();
      b.userData.t = 0;
    }
    // === Tracer stretch — elongate along the velocity vector for that
    // "round of plasma" feel. Skipped for chain/aoe (those should look
    // like distinct orbs, not streaks).
    if(w.kind !== 'chain' && w.kind !== 'aoe'){
      b.lookAt(origin.clone().add(vel));
      b.scale.z = 3.0 + Math.min(2, vel.length() * 0.4);
    }
    _3D.scene.add(b);
    _3D.bullets.push(b);
  }
  if(typeof sfx === 'function') sfx('shoot');
}

// Spawn N micro-bolts at the given position with random directions in
// the same forward hemisphere — used by Cluster Pod when its fuse hits.
function _3d_clusterBurst(pos, parentVel, dmg, color){
  const n = 6;
  for(let i = 0; i < n; i++){
    const ang = (i / n) * Math.PI * 2;
    const fan = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).multiplyScalar(0.6);
    const v   = parentVel.clone().normalize().add(fan).normalize().multiplyScalar(2.4);
    const b = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    b.position.copy(pos);
    b.userData.vel = v;
    b.userData.dmg = dmg;
    b.userData.color = color;
    b.userData.kind = 'normal';
    _3D.scene.add(b);
    _3D.bullets.push(b);
  }
}

// Chain damage — shock orb hits a target then jumps to the 2 nearest
// asteroids within `range`, drawing a brief lightning line to each.
function _3d_chainDamage(origin, alreadyHit, dmg, color, range){
  let hits = 0;
  // Sort remaining asteroids by distance from the impact point.
  const candidates = _3D.asteroids
    .filter(a => a !== alreadyHit)
    .map(a => ({ a, d: origin.distanceTo(a.position) }))
    .filter(x => x.d < range)
    .sort((x, y) => x.d - y.d);
  for(const { a } of candidates){
    if(hits >= 2) break;
    a.userData.hp -= dmg;
    _3d_flashAsteroid(a);
    _3d_spawnParticles(a.position, color, 4);
    // Lightning line — thin cylinder from origin → asteroid for a brief flash
    const dir = a.position.clone().sub(origin);
    const len = dir.length();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, len, 6, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.85 })
    );
    beam.position.copy(origin.clone().add(dir.clone().multiplyScalar(0.5)));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
    beam.userData.beam = true; beam.userData.lifeMs = 120;
    _3D.scene.add(beam); _3D.bullets.push(beam);
    if(a.userData.hp <= 0) _3d_destroyAsteroid(a);
    hits++;
  }
}

// Spawn a void singularity at impact — pulls nearby asteroids in and
// damages anything inside the AOE radius, then despawns after ~1s.
function _3d_spawnVoidWell(pos, dmg, color){
  const well = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 16, 12),
    new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.6 })
  );
  well.position.copy(pos);
  well.userData.well = true;
  well.userData.lifeMs = 900;
  well.userData.dmg = dmg;
  _3D.scene.add(well);
  _3D.bullets.push(well);
}

// Mark an asteroid as just-hit so the next few frames render a white
// emissive flash on it — clear visual feedback that the shot connected
// even if it didn't kill. The decay happens in the asteroid update
// loop where we lerp emissive back to black.
function _3d_flashAsteroid(a){
  a.userData.flashMs = 160;
}

// Award score + combo for a kill. Combo multiplier maxes at ×5 (combo
// of 40+) and resets if no new kill within 1.5s (handled in tick loop).
// Also accrues skin-mastery XP. Boss kills fire an explicit toast with
// the actual XP amount so the player can confirm the reward landed
// (the previous design only toasted on first-time mastery, leaving
// every kill in between completely silent).
function _3d_onKill(a){
  _3D.combo      += 1;
  _3D.comboTimer  = 1500;
  const mult     = Math.min(5, 1 + _3D.combo * 0.1);
  const award    = Math.round((a.userData.score || 10) * mult);
  _3D.score     += award;
  _3D.kills     += 1;
  // Skin-mastery XP — 10 per regular kill (+combo bonus). Boss kills
  // use the tier-scaled BOSS_XP_BY_TIER table so higher-tier bosses
  // award progressively more XP: 100 / 300 / 500 / 1000 / 1600.
  if(typeof addSkinXp === 'function' && typeof save !== 'undefined' && save){
    let xp;
    if(a.userData.boss){
      const tier = a.userData.bossTier || 1;
      xp = BOSS_XP_BY_TIER[tier] || BOSS_XP_BY_TIER[1];
      // Explicit boss-kill toast — combines the score + XP reward into
      // a single line so the player sees exactly what they earned.
      // Bigger shake at higher tiers.
      _3d_shake(0.6 + tier * 0.10, 450);
      if(typeof toast === 'function'){
        toast('★ TIER ' + tier + ' DOWN  ·  +' + award + ' SCORE  ·  +' + xp + ' XP');
      }
    } else {
      xp = 10 + Math.min(20, _3D.combo);
    }
    addSkinXp(save.skin || 'default', xp);
  }
}

// Destroy an asteroid: particles, remove from scene + array, score it.
// Index is optional — when omitted we look it up.
function _3d_destroyAsteroid(a, idx){
  _3d_spawnParticles(a.position, 0xffaa00, 18);
  if(idx === undefined) idx = _3D.asteroids.indexOf(a);
  if(idx >= 0){
    _3D.scene.remove(a);
    _3D.asteroids.splice(idx, 1);
  }
  _3d_onKill(a);
  if(typeof sfx === 'function') sfx('explode');
}

// Camera-shake helper — decaying jitter applied after lookAt(). Bigger
// shakes overwrite weaker ones; same shake won't double-stack.
function _3d_shake(amp, ms){
  if(!_3D.shake || amp > _3D.shake.amp){
    _3D.shake = { amp, ms, total: ms };
  }
}

// Red screen-edge vignette pulse — flashed when the player takes damage.
// CSS-driven (radial-gradient ring) so it doesn't burn a draw call on
// the WebGL canvas. Self-removes after the fade completes.
function _3d_damageVignette(){
  const v = document.createElement('div');
  v.style.cssText =
    'position:fixed;inset:0;z-index:7;pointer-events:none;' +
    'background:radial-gradient(ellipse at center, transparent 35%, #ff334488 80%, #ff1122dd 100%);' +
    'opacity:0.85;transition:opacity .55s ease-out;';
  document.body.appendChild(v);
  requestAnimationFrame(()=>{ v.style.opacity = '0'; });
  setTimeout(()=>{ if(v.parentNode) v.parentNode.removeChild(v); }, 600);
}

// Distance from point `p` to the line segment [a, b]. Used by the
// swept bullet-vs-asteroid hit test — checks the entire path the
// bullet swept this frame, not just its current position, so fast
// projectiles can't tunnel through small asteroids.
function _3d_segDist(a, b, p){
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  const len2 = abx*abx + aby*aby + abz*abz;
  if(len2 < 1e-8) return Math.hypot(apx, apy, apz);
  let t = (apx*abx + apy*aby + apz*abz) / len2;
  if(t < 0) t = 0; else if(t > 1) t = 1;
  const cx = a.x + abx*t, cy = a.y + aby*t, cz = a.z + abz*t;
  return Math.hypot(p.x - cx, p.y - cy, p.z - cz);
}

// === BOSS — giant asteroid that spawns every 25 kills. Each spawn
// advances `bossNumber` and maps to a tier (1..5, wraps after 5) which
// drives HP / score / size / XP reward — so the 5th boss is a clearly
// bigger threat than the 1st. Visually distinct: red palette + gold
// phase ring + tier-tinted halo on higher tiers.
function _3d_spawnBoss(){
  _3D.bossNumber += 1;
  const tier = ((_3D.bossNumber - 1) % 5) + 1;
  const baseR = 5.5 * BOSS_SCALE_BY_TIER[tier];
  const geom = new THREE.IcosahedronGeometry(baseR, 1);   // detail 1 → bumpier
  // Higher tiers shift hull colour toward magenta/purple — visible class cue.
  const tierColors = [0x000000, 0x882211, 0x99221a, 0xaa3322, 0xbb2266, 0xcc22aa];
  const mat  = new THREE.MeshPhongMaterial({
    color: tierColors[tier], emissive: 0x220000, flatShading: true, shininess: 12,
  });
  const b = new THREE.Mesh(geom, mat);
  b.position.set(0, 0, -120);
  b.userData.spin     = new THREE.Vector3(0.005, 0.008, 0.003);
  b.userData.speed    = 0.20;
  b.userData.radius   = baseR;
  b.userData.hp       = BOSS_HP_BY_TIER[tier];
  b.userData.maxHp    = BOSS_HP_BY_TIER[tier];
  b.userData.score    = BOSS_SCORE_BY_TIER[tier];
  b.userData.boss     = true;
  b.userData.bossTier = tier;
  // Gold ring around it — visual "BOSS" marker. Higher tiers add a
  // second outer ring so the threat reads at a glance.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(baseR * 1.3, 0.18, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffea00 })
  );
  ring.rotation.x = Math.PI/2;
  b.add(ring);
  b.userData.ring = ring;
  if(tier >= 3){
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(baseR * 1.55, 0.12, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xff66cc })
    );
    outerRing.rotation.x = Math.PI/2;
    outerRing.rotation.y = Math.PI/4;
    b.add(outerRing);
  }
  _3D.scene.add(b);
  _3D.asteroids.push(b);
  _3D.boss = b;
  _3d_shake(0.6 + tier * 0.05, 600);
  if(typeof toast === 'function') toast('★ BOSS TIER ' + tier + ' APPROACHING');
  if(typeof sfx === 'function') sfx('powerup');
}

function _3d_spawnParticles(pos, color, count){
  for(let i=0;i<count;i++){
    const geom = new THREE.SphereGeometry(0.15, 4, 4);
    const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const p = new THREE.Mesh(geom, mat);
    p.position.copy(pos);
    p.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.6
    );
    p.userData.life = 30;
    _3D.scene.add(p);
    _3D.particles.push(p);
  }
}

function _3d_updateHud(){
  const hpEl = document.getElementById('hud3dHp');
  const scEl = document.getElementById('hud3dScore');
  const wEl  = document.getElementById('hud3dWeapon');
  const aEl  = document.getElementById('hud3dAbility');
  const cEl  = document.getElementById('hud3dCombo');
  if(hpEl) hpEl.textContent = '●'.repeat(Math.max(0, _3D.hp)) + '○'.repeat(Math.max(0, _3D.maxHp - _3D.hp));
  if(scEl) scEl.textContent = _3D.score;
  if(wEl){
    const w = _3D_WEAPONS[_3D.weapons[_3D.weaponIdx]] || _3D_WEAPONS.single;
    wEl.textContent = w.name;
  }
  if(aEl){
    if(_3D.invuln > 0)        aEl.textContent = 'Q · INVULN ' + (_3D.invuln/1000).toFixed(1) + 's';
    else if(_3D.abilityCd > 0)aEl.textContent = 'Q · ' + (_3D.abilityCd/1000).toFixed(1) + 's';
    else                      aEl.textContent = 'Q · READY';
  }
  // === ULTIMATE state line ===
  const uEl = document.getElementById('hud3dUltimate');
  const mEl = document.getElementById('hud3dMastery');
  const mNum = document.getElementById('hud3dMasteryNum');
  if(uEl && typeof save !== 'undefined' && save){
    const skinId   = save.skin || 'default';
    const mastered = (typeof isSkinMastered === 'function') && isSkinMastered(skinId);
    const ult      = (typeof getUltimate === 'function') ? getUltimate(skinId) : null;
    if(!mastered){
      uEl.textContent = 'E · LOCKED';
      uEl.style.color = '#888';
    } else if(_3D.ragingMs > 0){
      uEl.textContent = 'E · RAGE ' + (_3D.ragingMs/1000).toFixed(1) + 's';
      uEl.style.color = '#ffea00';
    } else if(_3D.ultCd > 0){
      uEl.textContent = 'E · ' + (_3D.ultCd/1000).toFixed(1) + 's';
      uEl.style.color = '#aaa';
    } else {
      uEl.textContent = 'E · ' + (ult ? ult.name : 'ULTIMATE');
      uEl.style.color = '#ffd700';
      uEl.style.textShadow = '0 0 10px #ffd700';
    }
  }
  if(mEl && mNum && typeof save !== 'undefined' && save && typeof getSkinXp === 'function'){
    const skinId = save.skin || 'default';
    const have = getSkinXp(skinId);
    const need = getSkinMasteryXp(skinId);
    if(have >= need){
      mEl.style.color = '#ffd700';
      mNum.textContent = '★ MASTERED';
    } else {
      mEl.style.color = '#9ec5ff';
      mNum.textContent = have + '/' + need;
    }
  }
  if(cEl){
    if(_3D.combo > 1){
      const mult = Math.min(5, 1 + _3D.combo * 0.1);
      cEl.textContent = '×' + mult.toFixed(1) + '  ' + _3D.combo + ' STREAK';
      cEl.style.visibility = 'visible';
      // Hue scales with combo so big streaks read hot.
      const hue = Math.min(360, 280 + _3D.combo * 4);
      cEl.style.color = 'hsl(' + hue + ',100%,65%)';
      cEl.style.textShadow = '0 0 10px hsl(' + hue + ',100%,65%)';
    } else {
      cEl.style.visibility = 'hidden';
    }
  }
}

// Try the next OWNED weapon in the cycle. Skips weapons the player
// hasn't unlocked from the shop (save.weapons[id] === false).
function _3d_cycleWeapon(){
  if(_3D.weapons.length <= 1) return;
  for(let step = 1; step <= _3D.weapons.length; step++){
    const idx = (_3D.weaponIdx + step) % _3D.weapons.length;
    const id  = _3D.weapons[idx];
    if(typeof save !== 'undefined' && save && save.weapons && save.weapons[id]){
      _3D.weaponIdx = idx;
      const w = _3D_WEAPONS[id];
      if(typeof toast === 'function') toast('WEAPON: ' + (w?w.name:id));
      if(typeof sfx === 'function') sfx('powerup');
      return;
    }
  }
}

// E ability — ULTIMATE. Locked until the equipped skin reaches its
// mastery XP threshold (see isSkinMastered + addSkinXp in 01-core.js).
// Each skin maps to one of four `kind`s — same effect, themed colour.
//   • nova    — destroy every asteroid on screen + huge ring + flash
//   • rage    — 8s of ×3 fire rate + ×2 damage; ship body tints accent
//   • rift    — spawn 3 black-hole wells across the play area for 6s
//   • rebirth — instant heal-to-full + 6s invuln (no SOLAR-FLARE rings)
function _3d_triggerUltimate(){
  if(typeof save === 'undefined' || !save) return;
  const skinId = save.skin || 'default';
  if(typeof isSkinMastered !== 'function' || !isSkinMastered(skinId)){
    if(typeof toast === 'function') toast('Ultimate locked — earn ' + (typeof getSkinMasteryXp==='function' ? getSkinMasteryXp(skinId) : '???') + ' XP with this skin');
    return;
  }
  if(_3D.ultCd > 0) return;
  const ult = (typeof getUltimate === 'function') ? getUltimate(skinId) : { name:'NOVA BURST', cd:25000, kind:'nova', color:0x00eaff };
  _3D.ultCd = ult.cd;

  switch(ult.kind){
    case 'rage': {
      _3D.ragingMs = 8000;
      _3d_shake(0.6, 350);
      // Ember storm around ship
      for(let i = 0; i < 24; i++){
        const ang = Math.random() * Math.PI * 2;
        _3d_spawnParticles(
          new THREE.Vector3(
            _3D.ship.position.x + Math.cos(ang) * 1.6,
            _3D.ship.position.y + Math.sin(ang) * 1.6,
            _3D.ship.position.z
          ),
          ult.color, 1
        );
      }
      if(typeof toast === 'function') toast('★ ' + ult.name + '  ·  8s OVERDRIVE');
      break;
    }
    case 'rebirth': {
      _3D.hp = _3D.maxHp;
      _3D.invuln = Math.max(_3D.invuln, 6000);
      _3d_shake(0.7, 400);
      // Healing burst — green particle ring
      for(let i = 0; i < 36; i++){
        const ang = (i / 36) * Math.PI * 2;
        _3d_spawnParticles(
          new THREE.Vector3(
            _3D.ship.position.x + Math.cos(ang) * 2.2,
            _3D.ship.position.y + Math.sin(ang) * 2.2,
            _3D.ship.position.z
          ),
          0x00ff88, 1
        );
      }
      if(typeof toast === 'function') toast('★ ' + ult.name + '  ·  FULL REPAIR + INVULN');
      break;
    }
    case 'rift': {
      _3d_shake(0.9, 600);
      // Three big void wells spread across the play area in front of the ship
      const positions = [
        new THREE.Vector3(_3D.ship.position.x - 8, _3D.ship.position.y + 3, _3D.ship.position.z - 25),
        new THREE.Vector3(_3D.ship.position.x + 8, _3D.ship.position.y - 3, _3D.ship.position.z - 25),
        new THREE.Vector3(_3D.ship.position.x,     _3D.ship.position.y,     _3D.ship.position.z - 35),
      ];
      for(const p of positions){
        const well = new THREE.Mesh(
          new THREE.SphereGeometry(3.5, 18, 14),
          new THREE.MeshBasicMaterial({ color: ult.color, transparent:true, opacity:0.55 })
        );
        well.position.copy(p);
        well.userData.well = true;
        well.userData.lifeMs = 6000;
        well.userData.dmg = 4;     // strong tick damage
        // Ultimate wells have a wider attractor radius than the void cannon's.
        well.userData.bigWell = true;
        _3D.scene.add(well);
        _3D.bullets.push(well);
      }
      if(typeof toast === 'function') toast('★ ' + ult.name + '  ·  3 RIFTS / 6s');
      break;
    }
    case 'nova':
    default: {
      // Destroy every asteroid currently on screen + chained ring burst
      _3d_shake(1.4, 800);
      // === CELESTIAL → DIVINE WRATH special: 4 concentric YELLOW LASER
      // rings sweep outward and clear the field. Massive sustained
      // screen shake. Ship turns brilliant PLATINUM-WHITE for 5 s —
      // visibly different from the base mastered-gold ship so the
      // ability registers even on an already-gold celestial. ===
      const isCelestial = (skinId === 'celestial');
      if(isCelestial){
        // Four thick, glowing yellow ring lasers. Tube radius bumped
        // 0.22 → 0.50, opacity stays at 1, so they read as solid bands
        // of light (not thin wireframes). Stagger 100 ms between
        // spawns so they cascade outward like ripples.
        for(let i = 0; i < 4; i++){
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.8, 0.50, 16, 56),
            new THREE.MeshBasicMaterial({ color: 0xffea00, transparent:true, opacity:1 })
          );
          ring.position.copy(_3D.ship.position);
          // No rotation → default TorusGeometry lies in the XY plane
          // with the donut hole facing +Z, i.e. straight at the
          // 3rd-person camera. That's what makes them read as proper
          // CIRCLES of yellow light, not flat ground-level ellipses
          // (the old rotation.x = π/2 was tilting them onto the floor).
          ring.userData.life       = 1;
          ring.userData.maxLife    = 1.6;
          ring.userData.startScale = 1;
          ring.userData.endScale   = 24 + i * 14;   // 24, 38, 52, 66 — sweeps far past the play area
          ring.userData.delay      = i * 100;
          _3D.scene.add(ring);
          _3D.shockwaves.push(ring);
        }
        // Big, sustained screen shake — covers the whole ring-expansion
        // window rather than the brief 800 ms generic-nova kick.
        _3d_shake(2.4, 1100);
        // Big yellow point light at the ship for the duration — lights
        // up nearby asteroids in gold so the field reads as drenched
        // in the ability's energy.
        const flashLight = new THREE.PointLight(0xffea00, 4, 60);
        flashLight.position.copy(_3D.ship.position);
        _3D.scene.add(flashLight);
        setTimeout(()=>{ if(_3D.scene) _3D.scene.remove(flashLight); }, 1100);
        // Turn the ship platinum-WHITE for 5 seconds (much brighter
        // than the base mastered gold so DIVINE WRATH visibly fires
        // even when the ship is already gold).
        _3D.divineWrathMs = 5000;
      } else {
        // Standard nova rings — multi-axis sweep for non-celestial novas.
        for(let i = 0; i < 5; i++){
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.6, 0.18, 12, 40),
            new THREE.MeshBasicMaterial({ color: ult.color, transparent:true, opacity:0.95 })
          );
          ring.position.copy(_3D.ship.position);
          ring.rotation.x = (i % 2 === 0) ? Math.PI/2 : 0;
          if(i === 1 || i === 3) ring.rotation.y = Math.PI/2;
          ring.userData.life = 1;
          ring.userData.maxLife = 1.4;
          ring.userData.startScale = 1;
          ring.userData.endScale = 60;
          ring.userData.delay = i * 80;
          _3D.scene.add(ring);
          _3D.shockwaves.push(ring);
        }
      }
      // Central fireball
      const fire = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent:true, opacity:1 })
      );
      fire.position.copy(_3D.ship.position);
      fire.userData.life = 1; fire.userData.maxLife = 0.8;
      fire.userData.startScale = 1; fire.userData.endScale = 14;
      fire.userData.delay = 0;
      fire.userData.fireball = true;
      _3D.scene.add(fire);
      _3D.shockwaves.push(fire);
      // Wipe everything currently on screen — count as kills + score
      const swept = _3D.asteroids.slice();
      for(const a of swept){
        _3d_spawnParticles(a.position, ult.color, 12);
        _3d_destroyAsteroid(a);
      }
      // Big screen flash in the ult's colour
      const flash = document.createElement('div');
      const cssCol = '#' + ult.color.toString(16).padStart(6, '0');
      flash.style.cssText = 'position:fixed;inset:0;background:radial-gradient(ellipse at center, #ffffffee 0%, ' + cssCol + 'cc 35%, ' + cssCol + '00 80%);z-index:7;pointer-events:none;opacity:0.95;transition:opacity .65s ease-out;';
      document.body.appendChild(flash);
      requestAnimationFrame(()=>{ flash.style.opacity = '0'; });
      setTimeout(()=>{ if(flash.parentNode) flash.parentNode.removeChild(flash); }, 700);
      if(typeof toast === 'function') toast('★ ' + ult.name + '  ·  FIELD CLEARED');
      break;
    }
  }
  if(typeof sfx === 'function') sfx('powerup');
}

// Q ability — "4D" SOLAR FLARE. 3 seconds of invulnerability + asteroid
// time-slow + a yellow nova: 6 expanding shockwave rings, two of them
// rotated to pitch + yaw axes (so the burst reads volumetric, not flat),
// a central fireball that flashes white→yellow→orange, 8 lightning
// arcs radiating outward at random angles, plus a yellow screen flash
// and continuous particle storm around the ship. 8s cooldown.
function _3d_triggerAbility(){
  if(_3D.abilityCd > 0 || _3D.invuln > 0) return;
  _3D.invuln = 3000;
  _3D.abilityCd = 8000;

  const HOT  = 0xffffff;   // white core
  const YEL  = 0xffea00;   // primary yellow
  const ORN  = 0xff8800;   // outer orange edge

  // === Six expanding shockwave rings on three axes ===
  // Two per axis — staggered scale + delay so the burst feels layered.
  const ringCfg = [
    { axis:'xy', delay:   0, end: 18, color: HOT },  // flat horizontal, biggest
    { axis:'xy', delay: 100, end: 24, color: YEL },
    { axis:'xz', delay:  60, end: 16, color: YEL },  // pitched ring
    { axis:'xz', delay: 180, end: 22, color: ORN },
    { axis:'yz', delay:  60, end: 16, color: YEL },  // yawed ring
    { axis:'yz', delay: 180, end: 22, color: ORN },
  ];
  for(const cfg of ringCfg){
    const geom = new THREE.TorusGeometry(0.6, 0.14, 10, 36);
    const mat  = new THREE.MeshBasicMaterial({ color: cfg.color, transparent:true, opacity:0.95 });
    const ring = new THREE.Mesh(geom, mat);
    ring.position.copy(_3D.ship.position);
    if(cfg.axis === 'xy')      ring.rotation.x = Math.PI/2;       // flat ground plane
    else if(cfg.axis === 'xz') ring.rotation.x = 0;                // pitched (faces camera Y axis)
    else                       ring.rotation.y = Math.PI/2;        // yawed (faces camera X axis)
    ring.userData.life       = 1;
    ring.userData.maxLife    = 1.1;
    ring.userData.startScale = 1;
    ring.userData.endScale   = cfg.end;
    ring.userData.delay      = cfg.delay;
    _3D.scene.add(ring);
    _3D.shockwaves.push(ring);
  }

  // === Central fireball — bright sphere that grows + fades behind the
  // rings, sells the "nova went off here" moment.
  const fire = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 20, 14),
    new THREE.MeshBasicMaterial({ color: HOT, transparent:true, opacity:1 })
  );
  fire.position.copy(_3D.ship.position);
  fire.userData.life       = 1;
  fire.userData.maxLife    = 0.55;          // shorter — flash, not glow
  fire.userData.startScale = 1;
  fire.userData.endScale   = 6;
  fire.userData.delay      = 0;
  fire.userData.fireball   = true;          // tick code colour-cycles HOT→YEL→ORN
  _3D.scene.add(fire);
  _3D.shockwaves.push(fire);

  // === Eight lightning arcs radiating outward — thin yellow cylinders
  // around the ship at random pitch/yaw, fade quickly.
  for(let i = 0; i < 8; i++){
    const ang  = (i / 8) * Math.PI * 2;
    const tilt = (Math.random() - 0.5) * 0.8;
    const dir  = new THREE.Vector3(Math.cos(ang), Math.sin(tilt), Math.sin(ang)).normalize();
    const len  = 8 + Math.random() * 4;
    const arc  = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.10, len, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: YEL, transparent:true, opacity:0.95 })
    );
    arc.position.copy(_3D.ship.position).add(dir.clone().multiplyScalar(len/2));
    arc.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
    arc.userData.beam   = true;
    arc.userData.lifeMs = 300;
    _3D.scene.add(arc);
    _3D.bullets.push(arc);
  }

  // === Yellow screen flash overlay (warmer than the previous white) ===
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:radial-gradient(ellipse at center, #ffffffee 0%, #ffea00cc 35%, #ff880000 80%);z-index:7;pointer-events:none;opacity:0.85;transition:opacity .50s ease-out;';
  document.body.appendChild(flash);
  requestAnimationFrame(()=>{ flash.style.opacity = '0'; });
  setTimeout(()=>{ if(flash.parentNode) flash.parentNode.removeChild(flash); }, 550);

  if(typeof sfx === 'function') sfx('powerup');
  if(typeof toast === 'function') toast('★ SOLAR FLARE  ·  3s INVULN');
}

function _3d_tick(now){
  if(!_3D.active) return;
  _3D.rafId = requestAnimationFrame(_3d_tick);

  const dt = Math.min(50, now - (_3D.lastT || now));
  _3D.lastT = now;

  // === INPUT ===
  // Reads our PRIVATE input map (_3D.ks) populated by start3DMode's own
  // listeners — the global keys[] map is gated on the 2D phase so it
  // would never have populated here.
  const ks = _3D.ks;
  let strafeX = 0, strafeY = 0, fire = false;
  if(ks['a'] || ks['arrowleft'])  strafeX -= 1;
  if(ks['d'] || ks['arrowright']) strafeX += 1;
  if(ks['w'] || ks['arrowup'])    strafeY += 1;
  if(ks['s'] || ks['arrowdown'])  strafeY -= 1;
  if(ks[' '] || ks['space'])      fire = true;
  // Touch drag adds to strafe (small dead zone; magnitude clamped).
  if(_3D.touch.active){
    const tdx = (_3D.touch.lastX - _3D.touch.startX);
    const tdy = (_3D.touch.lastY - _3D.touch.startY);
    if(Math.hypot(tdx, tdy) > 8){
      strafeX += Math.max(-1, Math.min(1, tdx / 60));
      strafeY += Math.max(-1, Math.min(1, -tdy / 60));
      _3D.touch.dragged = true;
    }
  }
  // Touch tap-to-fire flag (set in touchend handler)
  if(_3D.touch.fired){ fire = true; _3D.touch.fired = false; }

  // === SHIP movement ===
  const shipSpeed = 0.32;
  _3D.ship.position.x += strafeX * shipSpeed * (dt/16);
  _3D.ship.position.y += strafeY * shipSpeed * (dt/16);
  _3D.ship.position.x = Math.max(-16, Math.min(16, _3D.ship.position.x));
  _3D.ship.position.y = Math.max(-9,  Math.min(9,  _3D.ship.position.y));

  // === SHIP banking (the "shift and turn" feel) ===
  const targetRoll  = -strafeX * 0.55;
  const targetPitch = -strafeY * 0.30;
  _3D.ship.rotation.z += (targetRoll  - _3D.ship.rotation.z) * 0.12;
  _3D.ship.rotation.x += (targetPitch - _3D.ship.rotation.x) * 0.12;
  _3D.ship.rotation.y += ((-strafeX * 0.18) - _3D.ship.rotation.y) * 0.10;

  // === Rainbow skin: cycle hue on body + canopy ===
  if(_3D.shipParts && _3D.shipParts._isRainbow){
    const hue = (now / 30) % 360;
    const col = new THREE.Color('hsl(' + hue + ', 80%, 60%)');
    _3D.shipParts.body.material.color.copy(col);
    _3D.shipParts.wingL.material.color.copy(col);
    _3D.shipParts.wingR.material.color.copy(col);
  }
  // === DIVINE WRATH platinum-gold flash (5s, celestial nova only) ===
  // Now tints the ENTIRE ship hull (top + belly + both wing top + both
  // wing bottom) so the gold reads from every camera angle, not just
  // top-down. Base colours cached on first activation; restored on
  // expiry. Pulses warmer-yellow with a sin so the gold shimmers.
  if(_3D.divineWrathMs > 0 && _3D.shipParts && _3D.shipParts.body){
    _3D.divineWrathMs -= dt;
    const sp = _3D.shipParts;
    const tintables = [sp.body, sp.hullBot, sp.wingL, sp.wingLBot, sp.wingR, sp.wingRBot].filter(Boolean);
    if(!_3D.shipBaseColors){
      _3D.shipBaseColors = tintables.map(m => ({ mesh: m, hex: m.material.color.getHex() }));
    }
    // COMPLETELY GOLD pulse — pure bright gold (#ffea00-ish) with a
    // shimmer that lifts it above the base mastered-gold (#ffd700),
    // so DIVINE WRATH visibly fires even when the ship is already
    // gold. Pulses between regular gold and brilliant yellow-gold.
    const pulse = 0.85 + 0.15 * Math.sin(now/80);
    const r = 1.0  * pulse;        // full red channel — gold needs it
    const gC = (0.84 + 0.16 * pulse);  // 0.84 (gold) → 1.0 (yellow)
    const b = 0.05 * pulse;        // tiny blue — pure gold range
    for(const m of tintables) m.material.color.setRGB(r, gC, b);
    if(_3D.divineWrathMs <= 0 && _3D.shipBaseColors){
      for(const { mesh, hex } of _3D.shipBaseColors) mesh.material.color.setHex(hex);
      _3D.shipBaseColors = null;
    }
  }

  // === CAMERA — follow + counter-roll for cinematic feel ===
  const camTarget = new THREE.Vector3(
    _3D.ship.position.x * 0.55,
    _3D.ship.position.y * 0.55 + 3.2,
    _3D.ship.position.z + 11
  );
  _3D.camera.position.lerp(camTarget, 0.10);
  _3D.camera.rotation.z += ((strafeX * 0.08) - _3D.camera.rotation.z) * 0.08;
  _3D.camera.lookAt(
    _3D.ship.position.x * 0.4,
    _3D.ship.position.y * 0.4,
    _3D.ship.position.z - 14
  );
  // Camera shake — decaying jitter applied AFTER lookAt so the
  // orientation is correct first, then the shake displaces it.
  if(_3D.shake){
    _3D.shake.ms -= dt;
    if(_3D.shake.ms <= 0){
      _3D.shake = null;
    } else {
      const t = _3D.shake.ms / _3D.shake.total;          // 1 → 0 over duration
      const s = _3D.shake.amp * t * t;                    // ease-out via t²
      _3D.camera.position.x += (Math.random() - 0.5) * s;
      _3D.camera.position.y += (Math.random() - 0.5) * s;
    }
  }
  // Combo timer — collapses streak if no kill within 1.5s
  if(_3D.combo > 0){
    _3D.comboTimer -= dt;
    if(_3D.comboTimer <= 0) _3D.combo = 0;
  }
  // Boss spawn — first boss at 25 kills, then every 25 after
  if(!_3D.boss && _3D.kills >= _3D.bossNextKills){
    _3D.bossNextKills += 25;
    _3d_spawnBoss();
  }
  // Boss reference cleanup: if our boss handle is no longer in the
  // asteroid array (either destroyed OR despawned past the camera),
  // clear the reference so the next boss can spawn. The "TIER N DOWN"
  // toast lives in _3d_onKill so it ONLY fires on actual kills, not
  // when a boss flew past unharmed.
  if(_3D.boss && _3D.asteroids.indexOf(_3D.boss) < 0){
    _3D.boss = null;
  }

  // === STARFIELD drift ===
  _3D.starField.position.z += 0.55 * (dt/16);
  if(_3D.starField.position.z > 80) _3D.starField.position.z -= 160;

  // === Q ABILITY (HYPERDRIVE) timers + VFX ===
  if(_3D.invuln > 0){
    _3D.invuln -= dt;
    // Halo: stays warm yellow (matches the SOLAR FLARE palette).
    if(_3D.shipHalo){
      _3D.shipHalo.position.copy(_3D.ship.position);
      const pulse = 0.85 + 0.25*Math.sin(now/80);
      _3D.shipHalo.scale.set(pulse, pulse, pulse);
      _3D.shipHalo.material.opacity = Math.min(1, _3D.invuln/1500) * 0.90;
      _3D.shipHalo.material.color.setHex(0xffea00);
      _3D.shipHalo.visible = true;
    }
    // Particle storm — 3 yellow/orange sparkles per tick swirling
    // around the ship (was previously rainbow; now reads as embers).
    for(let i = 0; i < 3; i++){
      const ang = Math.random() * Math.PI * 2;
      const r   = 1.4 + Math.random() * 0.7;
      const emberCols = [0xffea00, 0xffaa00, 0xff8800, 0xffffff];
      _3d_spawnParticles(
        new THREE.Vector3(
          _3D.ship.position.x + Math.cos(ang) * r,
          _3D.ship.position.y + Math.sin(ang) * r,
          _3D.ship.position.z + (Math.random() - 0.5)
        ),
        emberCols[Math.floor(Math.random() * emberCols.length)],
        1
      );
    }
  } else if(_3D.shipHalo){
    _3D.shipHalo.visible = false;
  }
  if(_3D.abilityCd > 0) _3D.abilityCd -= dt;
  // Shockwave rings + central fireball — grow + fade, despawn when life <= 0.
  // Fireballs additionally cycle colour through the white→yellow→orange
  // ramp so the central flash visibly cools as it expands.
  for(let i = _3D.shockwaves.length - 1; i >= 0; i--){
    const r = _3D.shockwaves[i];
    if(r.userData.delay > 0){ r.userData.delay -= dt; continue; }
    r.userData.life -= (dt / 1000) / r.userData.maxLife;
    const t = 1 - Math.max(0, r.userData.life);
    const s = r.userData.startScale + (r.userData.endScale - r.userData.startScale) * t;
    r.scale.set(s, s, s);
    r.material.opacity = Math.max(0, r.userData.life) * 0.95;
    r.position.copy(_3D.ship.position);
    if(r.userData.fireball){
      // Lerp HOT (1,1,1) → YEL (1, 0.92, 0) → ORN (1, 0.53, 0)
      let cr, cg, cb;
      if(t < 0.5){ const k = t * 2;        cr = 1; cg = 1 - k * 0.08; cb = 1 - k; }
      else       { const k = (t - 0.5) * 2; cr = 1; cg = 0.92 - k * 0.39; cb = 0; }
      r.material.color.setRGB(cr, cg, cb);
    }
    if(r.userData.life <= 0){
      _3D.scene.remove(r);
      _3D.shockwaves.splice(i, 1);
    }
  }
  // Time-slow factor for asteroids while invuln is active. 0.30 = 70%
  // slowdown — enough to feel like time stopped without freezing.
  const timeScale = (_3D.invuln > 0) ? 0.30 : 1.0;

  // === ASTEROID spawn + motion + ship collision ===
  _3D.spawnCooldown -= dt;
  if(_3D.spawnCooldown <= 0 && _3D.asteroids.length < 30){
    _3d_spawnAsteroid();
    _3D.spawnCooldown = Math.max(120, 240 - _3D.kills * 2) + Math.random()*200;
  }
  for(let i = _3D.asteroids.length - 1; i >= 0; i--){
    const a = _3D.asteroids[i];
    // Hit-flash decay — lerp emissive from white back to black over 160ms
    if(a.userData.flashMs > 0){
      a.userData.flashMs -= dt;
      const t = Math.max(0, a.userData.flashMs / 160);
      a.material.emissive.setRGB(t, t, t);
    }
    // Boss extras: pulse the gold ring around it
    if(a.userData.boss && a.userData.ring){
      const p = 1 + 0.05 * Math.sin(now/200);
      a.userData.ring.scale.set(p, p, p);
    }
    // timeScale (set above) is 0.30 during the Q-ability invuln —
    // asteroids visibly crawl while the player is in HYPERDRIVE.
    a.position.z += a.userData.speed * (dt/16) * timeScale;
    a.rotation.x += a.userData.spin.x * (dt/16) * timeScale;
    a.rotation.y += a.userData.spin.y * (dt/16) * timeScale;
    a.rotation.z += a.userData.spin.z * (dt/16) * timeScale;
    // === PLAYER COLLISION — run EVERY frame for EVERY asteroid, not
    // just at despawn time. The previous code only hit-checked when an
    // asteroid had already passed the camera (z>12), but the ship sits
    // at z≈0, so the dz alone was always 12+ and the radius check
    // never triggered → you could never take damage. Now we check on
    // every tick and destroy the asteroid that hit us so it can't
    // re-trigger next frame.
    if(_3D.invuln <= 0){
      const dx = a.position.x - _3D.ship.position.x;
      const dy = a.position.y - _3D.ship.position.y;
      const dz = a.position.z - _3D.ship.position.z;
      const hitR = a.userData.radius + 1.0;
      if(dx*dx + dy*dy + dz*dz < hitR*hitR){
        // Boss does 2 damage, regular asteroids do 1
        const dmg = a.userData.boss ? 2 : 1;
        _3D.hp -= dmg;
        _3D.combo = 0;
        _3d_shake(a.userData.boss ? 0.9 : 0.5, a.userData.boss ? 500 : 280);
        _3d_spawnParticles(_3D.ship.position, 0xff3344, 16);
        // Vignette flash on the HUD so the hit is unmistakable
        _3d_damageVignette();
        if(typeof sfx === 'function') sfx('hit');
        // Destroy the asteroid that hit us so it can't double-tick.
        // Boss survives — it just drops one HP if you ram it (no insta-kill).
        if(!a.userData.boss){
          _3D.scene.remove(a);
          _3D.asteroids.splice(i, 1);
        }
        if(_3D.hp <= 0){
          _3d_spawnParticles(_3D.ship.position, 0xffea00, 32);
          _3d_shake(1.2, 700);
          if(typeof sfx === 'function') sfx('explode');
          if(typeof toast === 'function') toast('GAME OVER · Score ' + _3D.score);
          // === Score persistence ===
          if(typeof save !== 'undefined' && save){
            if(_3D.score > (save.best||0))      save.best       = _3D.score;
            save.totalKills  = (save.totalKills  || 0) + _3D.kills;
            save.totalRuns   = (save.totalRuns   || 0) + 1;
            save.totalShards = (save.totalShards || 0) + Math.floor(_3D.score / 5);
            save.credits    += Math.floor(_3D.score / 5);
            if(typeof persist === 'function') persist();
            if(typeof updateHubInfo === 'function') updateHubInfo();
          }
          stop3DMode();
          return;
        }
        continue; // skip the despawn branch — asteroid already gone
      }
    }
    // === Despawn — asteroid sailed past the camera without hitting
    if(a.position.z > 12){
      _3D.scene.remove(a);
      _3D.asteroids.splice(i, 1);
    }
  }

  // === BULLET firing + motion + collision ===
  _3D.fireCooldown -= dt;
  if(fire && _3D.fireCooldown <= 0){
    _3d_fireBullets();
    const w = _3D_WEAPONS[_3D.weapons[_3D.weaponIdx]] || _3D_WEAPONS.single;
    // RAGE ultimate compresses fire cooldown to 1/3 — weapons fire 3× as fast
    _3D.fireCooldown = (_3D.ragingMs > 0) ? w.cd / 3 : w.cd;
  }
  // Tick RAGE timer + ultimate cooldown
  if(_3D.ragingMs > 0) _3D.ragingMs -= dt;
  if(_3D.ultCd     > 0) _3D.ultCd     -= dt;
  for(let i = _3D.bullets.length - 1; i >= 0; i--){
    const b = _3D.bullets[i];
    const ud = b.userData;

    // === BEAM (Lance) and lightning lines (Shock chain): no motion,
    // just fade opacity and despawn when their lifeMs runs out.
    if(ud.beam){
      ud.lifeMs -= dt;
      b.material.opacity = Math.max(0, ud.lifeMs / 140);
      if(ud.lifeMs <= 0){ _3D.scene.remove(b); _3D.bullets.splice(i, 1); }
      continue;
    }

    // === VOID WELL: stationary attractor. Pulls asteroids inward and
    // damages anything in its radius, then fades and despawns.
    if(ud.well){
      ud.lifeMs -= dt;
      const t01 = Math.max(0, ud.lifeMs / 900);
      b.material.opacity = 0.6 * t01;
      b.scale.setScalar(1 + (1 - t01) * 0.7);  // expands as it dies
      // Pull and damage. Ultimate "rift" wells (bigWell flag) have a
      // 2× attractor radius and a stronger pull than the regular Void
      // Cannon — they sweep most of the play area for their duration.
      const radius = ud.bigWell ? 14 : 6;
      const pull   = ud.bigWell ? 0.18 : 0.06;
      for(let j = _3D.asteroids.length - 1; j >= 0; j--){
        const a = _3D.asteroids[j];
        const to = b.position.clone().sub(a.position);
        const d  = to.length();
        if(d < radius){
          a.position.add(to.normalize().multiplyScalar(pull * (dt/16)));
          a.userData.hp -= ud.dmg * (dt/600);
          _3d_flashAsteroid(a);
          if(a.userData.hp <= 0) _3d_destroyAsteroid(a, j);
        }
      }
      if(ud.lifeMs <= 0){ _3D.scene.remove(b); _3D.bullets.splice(i, 1); }
      continue;
    }

    // === MOTION (normal projectiles, including wave / split / chain / aoe carriers)
    // CAPTURE PREVIOUS POSITION so the collision check below can do a
    // swept (continuous) hit-test instead of a per-frame point check —
    // otherwise fast bullets tunnel through small asteroids.
    if(!ud.prevPos) ud.prevPos = b.position.clone();
    else            ud.prevPos.copy(b.position);
    if(ud.kind === 'wave'){
      // Sinusoidal modulation perpendicular to the velocity vector — the
      // "weaving" path of the AETHER WAVE. Amplitude grows briefly then steady.
      ud.t += dt;
      const offsetMag = Math.sin(ud.t * 0.012) * 0.55;
      const wobble = ud.waveAxis.clone().multiplyScalar(offsetMag);
      b.position.add(ud.vel.clone().multiplyScalar(dt/16)).add(wobble.multiplyScalar(dt/200));
    } else {
      b.position.add(ud.vel.clone().multiplyScalar(dt/16));
    }

    // === CLUSTER fuse — split into 6 micro-bolts when the timer expires
    if(ud.kind === 'split' && ud.fuse !== undefined){
      ud.fuse -= dt;
      if(ud.fuse <= 0){
        _3d_clusterBurst(b.position.clone(), ud.vel.clone(), ud.dmg, ud.color);
        _3D.scene.remove(b); _3D.bullets.splice(i, 1);
        continue;
      }
    }

    // === Out-of-bounds despawn
    if(b.position.z < -300 || Math.abs(b.position.x) > 80 || Math.abs(b.position.y) > 60){
      _3D.scene.remove(b);
      _3D.bullets.splice(i, 1);
      continue;
    }

    // === COLLISION (continuous / swept)
    // Distance from asteroid center to the LINE SEGMENT swept by the
    // bullet this frame, not just to its end position. With bullet
    // speeds of ~2.6 units/frame and the smallest asteroid radius at
    // ~1.1, the old point-check tunneled through anything small —
    // bullets visibly passed through rocks. Swept distance can't.
    // Padding bumped 0.3 → 0.5 so the visible tracer aligns with
    // what registers as a hit.
    let consumed = false;
    for(let j = _3D.asteroids.length - 1; j >= 0; j--){
      const a = _3D.asteroids[j];
      if(_3d_segDist(ud.prevPos, b.position, a.position) < a.userData.radius + 0.5){
        // ★ AOE — Void Cannon: spawn a singularity at impact instead of
        // direct damage. The well does the work over its lifetime.
        if(ud.kind === 'aoe'){
          _3d_spawnVoidWell(a.position.clone(), ud.dmg, ud.color);
          _3d_spawnParticles(a.position, ud.color, 12);
          if(typeof sfx === 'function') sfx('explode');
          consumed = true;
          break;
        }
        // ★ Direct damage for everything else
        a.userData.hp -= ud.dmg;
        _3d_flashAsteroid(a);
        _3d_spawnParticles(a.position, ud.color, 6);
        // ★ CHAIN — Shock Orb: arc to 2 nearest neighbours
        if(ud.kind === 'chain'){
          _3d_chainDamage(a.position.clone(), a, ud.dmg, ud.color, 7);
        }
        if(a.userData.hp <= 0){
          _3d_destroyAsteroid(a, j);
        } else {
          if(typeof sfx === 'function') sfx('hit');
        }
        consumed = true;
        break;
      }
    }
    if(consumed){ _3D.scene.remove(b); _3D.bullets.splice(i, 1); }
  }

  // === PARTICLES decay ===
  for(let i = _3D.particles.length - 1; i >= 0; i--){
    const p = _3D.particles[i];
    p.position.add(p.userData.vel);
    p.userData.life -= dt/16;
    p.material.opacity = Math.max(0, p.userData.life / 30);
    if(p.userData.life <= 0){
      _3D.scene.remove(p);
      _3D.particles.splice(i, 1);
    }
  }

  _3d_updateHud();
  _3D.renderer.render(_3D.scene, _3D.camera);
}

function start3DMode(){
  if(typeof THREE === 'undefined'){
    if(typeof toast === 'function') toast('3D engine still loading — try again in a moment.');
    return;
  }
  if(_3D.active) return;
  const canvas = _3d_canvas();
  const hud    = _3d_hud();
  if(!canvas){ console.warn('3D mode: #game3d canvas missing'); return; }

  _3D.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  _3D.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  _3D.renderer.setSize(window.innerWidth, window.innerHeight, false);
  _3D.renderer.setClearColor(0x02030a, 1);

  _3D.scene = new THREE.Scene();
  _3D.scene.fog = new THREE.Fog(0x0a0518, 35, 240);

  _3D.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 800);
  _3D.camera.position.set(0, 4, 12);
  _3D.camera.lookAt(0, 0, -10);

  _3D.scene.add(new THREE.AmbientLight(0x4060a0, 0.45));
  const sun = new THREE.DirectionalLight(0xffeac0, 1.1);
  sun.position.set(8, 12, 6);
  _3D.scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff00cc, 0.35);
  rim.position.set(-6, -4, -8);
  _3D.scene.add(rim);

  _3D.starField = _3d_buildStars();
  _3D.scene.add(_3D.starField);

  // === Distant planet — gives the void real scale. Sits far in -Z
  // with a faint emissive glow so it reads through the fog. The fog
  // softens its silhouette so it doesn't look pasted on. ===
  const planetGeom = new THREE.SphereGeometry(40, 24, 18);
  const planetMat  = new THREE.MeshPhongMaterial({
    color: 0x553388, emissive: 0x221144, flatShading: true, shininess: 12,
  });
  const planet = new THREE.Mesh(planetGeom, planetMat);
  planet.position.set(-60, 18, -260);
  _3D.scene.add(planet);
  // Atmospheric glow halo — slightly bigger transparent sphere
  const haloGeom = new THREE.SphereGeometry(46, 24, 18);
  const haloMat  = new THREE.MeshBasicMaterial({
    color: 0xff66cc, transparent: true, opacity: 0.18, side: THREE.BackSide,
  });
  const halo = new THREE.Mesh(haloGeom, haloMat);
  halo.position.copy(planet.position);
  _3D.scene.add(halo);
  // Stylised ring (single torus, slight tilt)
  const ringGeom = new THREE.RingGeometry(60, 76, 64);
  const ringMat  = new THREE.MeshBasicMaterial({
    color: 0xffaa66, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.position.copy(planet.position);
  ring.rotation.x = -Math.PI/3;
  ring.rotation.z =  Math.PI/8;
  _3D.scene.add(ring);

  // === Three drifting nebula sprites — soft coloured planes that face
  // the camera and add depth between the player and the planet. ===
  for(const nebCfg of [
    { col:0xff66cc, x:-30, y:-10, z:-150, scale: 60 },
    { col:0x00eaff, x: 38, y:  6, z:-180, scale: 80 },
    { col:0xaa66ff, x: 10, y:-22, z:-220, scale: 70 },
  ]){
    const nebGeom = new THREE.SphereGeometry(nebCfg.scale, 14, 10);
    const nebMat  = new THREE.MeshBasicMaterial({
      color: nebCfg.col, transparent: true, opacity: 0.10, depthWrite: false,
    });
    const neb = new THREE.Mesh(nebGeom, nebMat);
    neb.position.set(nebCfg.x, nebCfg.y, nebCfg.z);
    _3D.scene.add(neb);
  }

  // === Build the player ship from the equipped skin ===
  const palette = _3d_resolveSkin();
  const built = _3d_buildShip(palette);
  _3D.ship = built.group;
  _3D.shipParts = built.parts;
  _3D.shipParts._isRainbow = !!palette.rainbow;
  _3D.scene.add(_3D.ship);

  // === Q-ability halo (hidden by default) ===
  _3D.shipHalo = _3d_buildHalo();
  _3D.shipHalo.visible = false;
  _3D.scene.add(_3D.shipHalo);

  // Pre-spawn asteroids so the first frame already has stuff in view.
  for(let i=0;i<8;i++) _3d_spawnAsteroid();

  // === Reset gameplay state ===
  _3D.maxHp = 5 + (typeof save !== 'undefined' && save && save.upgrades ? (save.upgrades.hp||0) : 0);
  _3D.hp = _3D.maxHp; _3D.score = 0; _3D.kills = 0;
  _3D.fireCooldown = 0; _3D.spawnCooldown = 600;
  _3D.invuln = 0; _3D.abilityCd = 0;
  _3D.combo = 0; _3D.comboTimer = 0;
  _3D.shake = null;
  _3D.boss = null; _3D.bossNextKills = 25; _3D.bossNumber = 0;
  _3D.ultCd = 0; _3D.ragingMs = 0;
  _3D.divineWrathMs = 0; _3D.shipBaseColors = null;
  _3D.lastT = 0;
  _3D.aimNDC = { x: 0, y: 0 };
  _3D.touch = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, dragged: false, fired: false };
  // Build cycle list of OWNED weapons in canonical order. All ten shop
  // weapons are now wired in 3D — see _3D_WEAPONS for the per-kind
  // behaviours. Owned weapons are read from save.weapons (the same
  // map the 2D shop writes to), so anything you bought in 2D shows up
  // in 3D's C-cycle automatically.
  const allWeapons = ['single','spread','rapid','heavy','wave','flame','lance','cluster','shock','void'];
  _3D.weapons = allWeapons.filter(id =>
    typeof save === 'undefined' || !save || !save.weapons || save.weapons[id]
  );
  if(_3D.weapons.length === 0) _3D.weapons = ['single'];
  _3D.weaponIdx = 0;

  // === Show 3D, hide 2D ===
  canvas.style.display = 'block';
  if(hud) hud.style.display = 'block';
  const overlay = document.getElementById('overlay');     if(overlay) overlay.style.display = 'none';
  const wrap    = document.getElementById('wrap');        if(wrap)    wrap.style.display = 'none';
  const hud2d   = document.getElementById('hud');         if(hud2d)   hud2d.style.display = 'none';
  const hudBot  = document.getElementById('hudBottom');   if(hudBot)  hudBot.style.display = 'none';
  const touchEl = document.getElementById('touch');       if(touchEl) touchEl.style.display = 'none';

  // === Resize ===
  _3D.resizeHandler = () => {
    if(!_3D.active) return;
    _3D.camera.aspect = window.innerWidth / window.innerHeight;
    _3D.camera.updateProjectionMatrix();
    _3D.renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  window.addEventListener('resize', _3D.resizeHandler);

  // === Keyboard — populates the PRIVATE input map _3D.ks (NOT the
  // global keys[] from 01-core.js, which is gated on the 2D phase and
  // would never light up here). Also handles single-shot keys: ESC
  // quit, Q ability, C cycle weapon.
  _3D.keyDownHandler = (e) => {
    if(!_3D.active) return;
    const k = e.key.toLowerCase();
    // Stop the browser from scrolling on space / arrows.
    if(['arrowleft','arrowright','arrowup','arrowdown',' '].includes(k)) e.preventDefault();
    _3D.ks[k] = true;
    if(k === 'escape') stop3DMode();
    else if(k === 'q') _3d_triggerAbility();
    else if(k === 'e') _3d_triggerUltimate();
    else if(k === 'c') _3d_cycleWeapon();
  };
  _3D.keyUpHandler = (e) => {
    if(!_3D.active) return;
    _3D.ks[e.key.toLowerCase()] = false;
  };
  window.addEventListener('keydown', _3D.keyDownHandler);
  window.addEventListener('keyup',   _3D.keyUpHandler);
  // Drop all keys on focus loss so a stuck key can't survive an alt-tab.
  _3D.blurHandler = () => { for(const k in _3D.ks) _3D.ks[k] = false; };
  window.addEventListener('blur', _3D.blurHandler);

  // === Mouse-aim — track NDC pointer position + drive a visible
  // crosshair element so the player SEES where they're aiming. The
  // built-in browser cursor is hidden over the canvas (cursor:none) so
  // the custom one reads as the pointer.
  _3D.mouseHandler = (e) => {
    if(!_3D.active) return;
    _3D.aimNDC.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    _3D.aimNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    _3D.aimPx.x = e.clientX;
    _3D.aimPx.y = e.clientY;
    if(_3D.crosshairEl){
      _3D.crosshairEl.style.left = e.clientX + 'px';
      _3D.crosshairEl.style.top  = e.clientY + 'px';
    }
  };
  window.addEventListener('mousemove', _3D.mouseHandler);
  // Pointer-down anywhere = fire (mouse click triggers a single shot
  // into the cycle so the player doesn't have to hold space).
  _3D.mouseDownHandler = (e) => {
    if(!_3D.active) return;
    _3D.ks[' '] = true;
  };
  _3D.mouseUpHandler = (e) => {
    if(!_3D.active) return;
    _3D.ks[' '] = false;
  };
  window.addEventListener('mousedown', _3D.mouseDownHandler);
  window.addEventListener('mouseup',   _3D.mouseUpHandler);
  // Hide the system cursor over the 3D canvas + show the custom one.
  canvas.style.cursor = 'none';
  if(!_3D.crosshairEl){
    const ch = document.createElement('div');
    ch.id = 'crosshair3d';
    ch.style.cssText = [
      'position:fixed','pointer-events:none','z-index:6',
      'left:50%','top:50%','transform:translate(-50%,-50%)',
      'width:36px','height:36px','border:2px solid #00eaff','border-radius:50%',
      'box-shadow:0 0 14px #00eaff,inset 0 0 8px #00eaff66',
      'transition:transform .05s linear',
    ].join(';');
    ch.innerHTML =
      '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:5px;height:5px;background:#ff3344;border-radius:50%;box-shadow:0 0 8px #ff3344;"></div>'+
      '<div style="position:absolute;left:50%;top:-12px;width:2px;height:8px;background:#00eaff;transform:translateX(-50%);"></div>'+
      '<div style="position:absolute;left:50%;bottom:-12px;width:2px;height:8px;background:#00eaff;transform:translateX(-50%);"></div>'+
      '<div style="position:absolute;top:50%;left:-12px;width:8px;height:2px;background:#00eaff;transform:translateY(-50%);"></div>'+
      '<div style="position:absolute;top:50%;right:-12px;width:8px;height:2px;background:#00eaff;transform:translateY(-50%);"></div>';
    document.body.appendChild(ch);
    _3D.crosshairEl = ch;
  }
  _3D.crosshairEl.style.display = 'block';

  // === Touch — drag to strafe, tap to fire ===
  _3D.touchStartHandler = (e) => {
    if(!_3D.active) return;
    const t = e.touches[0]; if(!t) return;
    _3D.touch.active = true; _3D.touch.dragged = false;
    _3D.touch.startX = _3D.touch.lastX = t.clientX;
    _3D.touch.startY = _3D.touch.lastY = t.clientY;
  };
  _3D.touchMoveHandler = (e) => {
    if(!_3D.active || !_3D.touch.active) return;
    const t = e.touches[0]; if(!t) return;
    _3D.touch.lastX = t.clientX;
    _3D.touch.lastY = t.clientY;
    e.preventDefault();
  };
  _3D.touchEndHandler = () => {
    if(!_3D.active) return;
    if(_3D.touch.active && !_3D.touch.dragged) _3D.touch.fired = true;
    _3D.touch.active = false; _3D.touch.dragged = false;
  };
  canvas.addEventListener('touchstart', _3D.touchStartHandler, { passive: true });
  canvas.addEventListener('touchmove',  _3D.touchMoveHandler,  { passive: false });
  canvas.addEventListener('touchend',   _3D.touchEndHandler,   { passive: true });

  _3D.active = true;
  _3D.rafId = requestAnimationFrame(_3d_tick);
  if(typeof setMusicMode === 'function') setMusicMode('boss-enrage');
  if(typeof toast === 'function') toast('3D MODE · Mouse aims · WASD strafes · SPACE fire · Q ability · C weapon');
}

function stop3DMode(){
  if(!_3D.active) return;
  _3D.active = false;
  cancelAnimationFrame(_3D.rafId);
  if(_3D.resizeHandler)     { window.removeEventListener('resize',    _3D.resizeHandler);     _3D.resizeHandler = null; }
  if(_3D.keyDownHandler)    { window.removeEventListener('keydown',   _3D.keyDownHandler);    _3D.keyDownHandler = null; }
  if(_3D.keyUpHandler)      { window.removeEventListener('keyup',     _3D.keyUpHandler);      _3D.keyUpHandler = null; }
  if(_3D.blurHandler)       { window.removeEventListener('blur',      _3D.blurHandler);       _3D.blurHandler = null; }
  if(_3D.mouseHandler)      { window.removeEventListener('mousemove', _3D.mouseHandler);      _3D.mouseHandler = null; }
  if(_3D.mouseDownHandler)  { window.removeEventListener('mousedown', _3D.mouseDownHandler);  _3D.mouseDownHandler = null; }
  if(_3D.mouseUpHandler)    { window.removeEventListener('mouseup',   _3D.mouseUpHandler);    _3D.mouseUpHandler = null; }
  _3D.ks = {};
  const canvas = _3d_canvas();
  if(canvas){
    canvas.style.cursor = '';
    if(_3D.touchStartHandler){ canvas.removeEventListener('touchstart', _3D.touchStartHandler); _3D.touchStartHandler = null; }
    if(_3D.touchMoveHandler) { canvas.removeEventListener('touchmove',  _3D.touchMoveHandler);  _3D.touchMoveHandler  = null; }
    if(_3D.touchEndHandler)  { canvas.removeEventListener('touchend',   _3D.touchEndHandler);   _3D.touchEndHandler   = null; }
  }
  if(_3D.crosshairEl) _3D.crosshairEl.style.display = 'none';
  if(_3D.renderer){ _3D.renderer.dispose(); _3D.renderer = null; }
  _3D.scene = _3D.camera = _3D.ship = _3D.shipParts = _3D.shipHalo = _3D.starField = null;
  _3D.asteroids = []; _3D.bullets = []; _3D.particles = []; _3D.shockwaves = [];

  if(canvas) canvas.style.display = 'none';
  const hud = _3d_hud(); if(hud) hud.style.display = 'none';
  const wrap = document.getElementById('wrap'); if(wrap) wrap.style.display = '';
  // === Restore inline display:'' on every 2D HUD element start3DMode
  // set to 'none'. Without these clears, the inline display:none beats
  // the CSS class rules (#touch.on, #hud, #hudBottom defaults) → touch
  // controls (joystick, fire, ability, weapon, pause, consumables) all
  // stay invisible forever after the first 3D session.
  const touchEl = document.getElementById('touch');     if(touchEl) touchEl.style.display = '';
  const hud2d   = document.getElementById('hud');       if(hud2d)   hud2d.style.display   = '';
  const hudBot  = document.getElementById('hudBottom'); if(hudBot)  hudBot.style.display  = '';
  const overlay = document.getElementById('overlay');   if(overlay) overlay.style.display = '';
  if(typeof showMenu === 'function') showMenu('menuMain');
  if(typeof setMusicMode === 'function') setMusicMode('menu');
}

// === QUIT button wiring ===
// Arrow wrapper rather than `btn.onclick = stop3DMode` so the lookup
// happens at click time (the static-audit test enforces this — see
// the drift-bug postmortem in CLAUDE.md for why bare references at
// script load time bit us before).
(function _3d_wireQuit(){
  const btn = document.getElementById('hud3dQuit');
  if(btn) btn.onclick = ()=> stop3DMode();
})();
