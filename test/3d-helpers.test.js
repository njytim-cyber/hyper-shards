'use strict';
// 3D MODE — pure math + palette helpers tests. These functions are
// the ones most likely to silently break (off-by-one in colour math,
// tunneling in collision, palette resolver dropping a field), so
// they get the most direct unit-level coverage. None of them touch
// THREE.* APIs, so the node:vm sandbox can call them as-is.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSandbox, loadAllAsBrowser, vm_eval, vm_run } = require('./_helpers.js');

function freshCtx() {
  const { sandbox } = buildSandbox();
  return loadAllAsBrowser(sandbox);
}

// === _hex: CSS hex string → integer ====================================
test('_hex: parses #rrggbb correctly', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, '_hex("#3aa0ff", 0)'), 0x3aa0ff);
  assert.strictEqual(vm_eval(ctx, '_hex("#ffffff", 0)'), 0xffffff);
  assert.strictEqual(vm_eval(ctx, '_hex("#000000", 0)'), 0x000000);
});

test('_hex: returns fallback for bad input', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, '_hex("nope",  0x123456)'), 0x123456);
  assert.strictEqual(vm_eval(ctx, '_hex(null,    0xabcdef)'), 0xabcdef);
  assert.strictEqual(vm_eval(ctx, '_hex("#fff",  0xdeadbe)'), 0xdeadbe,
    'short hex (#fff) must fall back, we only accept full 6-digit');
});

// === _darken: channel-wise multiplication ==============================
test('_darken: factor=1 is identity', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, '_darken(0xff8800, 1)'), 0xff8800);
});

test('_darken: factor=0 returns black', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, '_darken(0xff8800, 0)'), 0);
});

test('_darken: factor=0.5 halves each channel (truncating)', () => {
  const ctx = freshCtx();
  // 0xff*.5=127.5→127, 0x88*.5=68, 0x00*.5=0
  assert.strictEqual(vm_eval(ctx, '_darken(0xff8800, 0.5)'), 0x7f4400);
});

test('_darken: factor>1 clamps each channel at 255', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, '_darken(0xff8800, 5)'), 0xffff00,
    'over-bright must clamp, not wrap');
});

// === _shadeHex: hex × factor → 'rgb(r,g,b)' string =====================
test('_shadeHex: factor=1 returns identity in rgb form', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, '_shadeHex("#888888", 1)'), 'rgb(136,136,136)');
});

test('_shadeHex: factor=0.5 halves channels', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, '_shadeHex("#888888", 0.5)'), 'rgb(68,68,68)');
});

test('_shadeHex: factor>=2 clamps at 255 (rgb(255,255,255))', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, '_shadeHex("#ffffff", 2.0)'), 'rgb(255,255,255)');
});

test('_shadeHex: handles missing/invalid input via #888888 default', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, '_shadeHex(null, 1)'), 'rgb(136,136,136)');
});

// === _3d_segDist: point-to-segment distance (collision-critical) ======
test('_3d_segDist: returns 0 when point sits on the segment start', () => {
  const ctx = freshCtx();
  const d = vm_eval(ctx, '_3d_segDist({x:0,y:0,z:0}, {x:10,y:0,z:0}, {x:0,y:0,z:0})');
  assert.ok(Math.abs(d) < 1e-9);
});

test('_3d_segDist: returns 0 when point sits on the segment middle', () => {
  const ctx = freshCtx();
  const d = vm_eval(ctx, '_3d_segDist({x:0,y:0,z:0}, {x:10,y:0,z:0}, {x:5,y:0,z:0})');
  assert.ok(Math.abs(d) < 1e-9);
});

test('_3d_segDist: returns perpendicular distance when point is alongside', () => {
  const ctx = freshCtx();
  // segment along X, point at (5, 3, 0) → perpendicular = 3
  const d = vm_eval(ctx, '_3d_segDist({x:0,y:0,z:0}, {x:10,y:0,z:0}, {x:5,y:3,z:0})');
  assert.ok(Math.abs(d - 3) < 1e-9, `expected 3, got ${d}`);
});

test('_3d_segDist: returns endpoint distance when point is past the segment', () => {
  const ctx = freshCtx();
  // segment ends at (10,0,0); point at (20,4,0) → distance to endpoint = sqrt(116)
  const d = vm_eval(ctx, '_3d_segDist({x:0,y:0,z:0}, {x:10,y:0,z:0}, {x:20,y:4,z:0})');
  assert.ok(Math.abs(d - Math.sqrt(116)) < 1e-9, `expected ${Math.sqrt(116)}, got ${d}`);
});

test('_3d_segDist: works fully in 3D (not just XY plane)', () => {
  const ctx = freshCtx();
  // segment along X, point at (5, 3, 4) → perpendicular = sqrt(9+16) = 5
  const d = vm_eval(ctx, '_3d_segDist({x:0,y:0,z:0}, {x:10,y:0,z:0}, {x:5,y:3,z:4})');
  assert.ok(Math.abs(d - 5) < 1e-9, `expected 5, got ${d}`);
});

test('_3d_segDist: handles zero-length segment (degenerate case)', () => {
  const ctx = freshCtx();
  // segment of length 0 at origin, point at (3,4,0) → distance = 5
  const d = vm_eval(ctx, '_3d_segDist({x:0,y:0,z:0}, {x:0,y:0,z:0}, {x:3,y:4,z:0})');
  assert.ok(Math.abs(d - 5) < 1e-9, `expected 5, got ${d}`);
});

// === _vrotXY: pitch+yaw rotation ======================================
test('_vrotXY: identity rotation returns input unchanged', () => {
  const ctx = freshCtx();
  const p = JSON.parse(vm_eval(ctx, 'JSON.stringify(_vrotXY([1,2,3], 0, 0))'));
  assert.ok(Math.abs(p[0] - 1) < 1e-9);
  assert.ok(Math.abs(p[1] - 2) < 1e-9);
  assert.ok(Math.abs(p[2] - 3) < 1e-9);
});

test('_vrotXY: yaw of π rotates X to -X', () => {
  const ctx = freshCtx();
  const p = JSON.parse(vm_eval(ctx, 'JSON.stringify(_vrotXY([1,0,0], 0, Math.PI))'));
  assert.ok(Math.abs(p[0] - (-1)) < 1e-9, `expected -1, got ${p[0]}`);
});

// === _vproject: closer points project larger ===========================
test('_vproject: closer points project to larger screen coords', () => {
  const ctx = freshCtx();
  // SCALE=30, DIST=3.5. Point at z=+1 is closer than z=0; closer point's
  // X projects larger.
  const near = vm_eval(ctx, '_vproject([1,0,1], 30, 3.5)[0]');
  const far  = vm_eval(ctx, '_vproject([1,0,0], 30, 3.5)[0]');
  assert.ok(Math.abs(near) > Math.abs(far),
    `near (${near}) should project bigger than far (${far})`);
});

test('_vproject: never divides by zero (clamps z near camera)', () => {
  const ctx = freshCtx();
  // Point z >> DIST puts us essentially at the camera — must not return NaN
  const p = JSON.parse(vm_eval(ctx, 'JSON.stringify(_vproject([1,0,10], 30, 3.5))'));
  assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]),
    `project must clamp to a positive denominator (got ${JSON.stringify(p)})`);
});

// === _3d_resolveSkin: palette resolver + mastery override =============
test('_3d_resolveSkin: returns body/glow/accent for default skin', () => {
  const ctx = freshCtx();
  const p = JSON.parse(vm_eval(ctx, 'JSON.stringify(_3d_resolveSkin())'));
  assert.ok(Number.isInteger(p.body),   'body must be a colour int');
  assert.ok(Number.isInteger(p.glow),   'glow must be a colour int');
  assert.ok(Number.isInteger(p.accent), 'accent must be a colour int');
  assert.strictEqual(p.id, 'default');
  assert.strictEqual(p.mastered, false);
});

test('_3d_resolveSkin: mastered CELESTIAL turns fully gold', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'save.skin = "celestial"; save.skinXp.celestial = 99999;');
  const p = JSON.parse(vm_eval(ctx, 'JSON.stringify(_3d_resolveSkin())'));
  assert.strictEqual(p.mastered, true);
  assert.strictEqual(p.body,   0xffd700, 'celestial mastered body must be #ffd700');
  assert.strictEqual(p.accent, 0xffffff, 'celestial mastered accent must be white');
  assert.strictEqual(p.glow,   0xfff7c0, 'celestial mastered glow must be the warm gold');
});

test('_3d_resolveSkin: mastered non-top skin gets gold body, keeps original accent', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'save.skin = "crimson"; save.skinXp.crimson = 99999;');
  const p = JSON.parse(vm_eval(ctx, 'JSON.stringify(_3d_resolveSkin())'));
  assert.strictEqual(p.mastered, true);
  assert.strictEqual(p.body, 0xffd700, 'mastered non-top body must be gold');
  // CRIMSON's accent is #ffea00 — not white; the celestial override must not have leaked.
  assert.notStrictEqual(p.accent, 0xffffff,
    'only celestial should override accent; other masters keep theirs');
});

test('_3d_resolveSkin: missing SKINS entry returns safe defaults (no crash)', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'save.skin = "this-is-not-a-skin";');
  const p = JSON.parse(vm_eval(ctx, 'JSON.stringify(_3d_resolveSkin())'));
  assert.strictEqual(p.id, 'default');
  assert.strictEqual(p.mastered, false);
});
