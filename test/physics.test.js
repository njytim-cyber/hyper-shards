'use strict';
// Physics + drift regression tests.
// Loads the real game JS in a stubbed browser and exercises update()
// across many simulated frames with no input. The ship MUST stay put.

const test = require('node:test');
const assert = require('node:assert');
const { buildSandbox, loadAllAsBrowser, vm_eval, vm_run, freshGame } = require('./_helpers.js');

test('makePlayer: starts at rest and pointing up', () => {
  const g = freshGame();
  assert.strictEqual(g.player.vx, 0, 'initial vx must be 0');
  assert.strictEqual(g.player.vy, 0, 'initial vy must be 0');
  assert.strictEqual(g.player.facing, -Math.PI/2, 'initial facing should be up (-PI/2)');
  assert.ok(g.player.hp > 0, 'player should have hp');
});

// Quiet sandbox: clears enemies and freezes the spawner each frame so
// the test isolates *player movement physics* from gameplay events
// (enemy ram pushes player.vx via the collision response code).
function quietUpdate(g, dt) {
  vm_run(g.ctx, 'state.enemies = []; state.spawnTimer = 1e9; state.boss = null;');
  g.update(dt);
}

test('drift regression: with no keys pressed, player does not move over 600 frames', () => {
  const g = freshGame();
  const startX = g.player.x;
  const startY = g.player.y;
  // 600 frames at 16ms = 9.6 simulated seconds. With dt-scaled damping
  // and the velocity floor in place, the ship must not move at all.
  for (let i = 0; i < 600; i++) quietUpdate(g, 16);
  const dx = Math.abs(g.player.x - startX);
  const dy = Math.abs(g.player.y - startY);
  assert.ok(dx < 1, `player x drifted ${dx.toFixed(3)}px with no input (limit 1px)`);
  assert.ok(dy < 1, `player y drifted ${dy.toFixed(3)}px with no input (limit 1px)`);
  assert.strictEqual(g.player.vx, 0, 'vx must snap to 0');
  assert.strictEqual(g.player.vy, 0, 'vy must snap to 0');
});

test('drift regression: also holds at low frame rate (30fps)', () => {
  const g = freshGame();
  const startX = g.player.x;
  const startY = g.player.y;
  for (let i = 0; i < 300; i++) quietUpdate(g, 33);
  assert.ok(Math.abs(g.player.x - startX) < 1, 'no drift at 30fps');
  assert.ok(Math.abs(g.player.y - startY) < 1, 'no drift at 30fps');
});

test('drift regression: phantom stuck key from previous menu does not move the ship', () => {
  // Simulate the bug class: a key got "stuck" in a previous menu phase.
  // resetKeys() runs at startSurvival entry and should wipe it.
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, "keys['d'] = true; keys['arrowright'] = true;");
  vm_run(ctx, "startSurvival('medium');");
  const startX = vm_eval(ctx, 'player.x');
  for (let i = 0; i < 60; i++) {
    vm_run(ctx, 'state.enemies = []; state.spawnTimer = 1e9; update(16);');
  }
  const endX = vm_eval(ctx, 'player.x');
  assert.ok(Math.abs(endX - startX) < 1,
    `stuck-key phantom drift: ship moved ${(endX-startX).toFixed(3)}px in 1s`);
});

test('movement: pressing D actually moves the ship right', () => {
  const g = freshGame();
  const startX = g.player.x;
  g.setKey('d', true);
  for (let i = 0; i < 30; i++) g.update(16); // 0.5s of input
  const movedX = g.player.x - startX;
  assert.ok(movedX > 5, `D should push the ship right; moved only ${movedX.toFixed(2)}px`);
});

test('movement: releasing D stops the ship within 1 second', () => {
  const g = freshGame();
  g.setKey('d', true);
  for (let i = 0; i < 30; i++) g.update(16);
  g.setKey('d', false);
  for (let i = 0; i < 60; i++) g.update(16); // 1s of decel
  assert.strictEqual(g.player.vx, 0, `vx should snap to 0 after release; got ${g.player.vx}`);
});

test('damping is frame-rate independent (60fps and 30fps reach similar peak velocity)', () => {
  function peakVx(dt, frames) {
    const g = freshGame();
    g.setKey('d', true);
    let max = 0;
    for (let i = 0; i < frames; i++) {
      g.update(dt);
      const v = g.player.vx;
      if (Math.abs(v) > Math.abs(max)) max = v;
    }
    return max;
  }
  const v60 = peakVx(16, 90);
  const v30 = peakVx(33, 45);
  // Without dt-scaled damping (the original bug) v30 would be ~2× v60.
  const ratio = Math.max(v60, v30) / Math.min(v60, v30);
  assert.ok(ratio < 1.15,
    `peak-velocity ratio across frame rates is ${ratio.toFixed(3)} (limit 1.15); v60=${v60.toFixed(2)}, v30=${v30.toFixed(2)}`);
});

test('keys reset on phase change: switching menus then starting fresh wipes state', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, "keys['d'] = true; keys['arrowleft'] = true; keys['shift'] = true;");
  vm_run(ctx, "startSurvival('hard');");
  const ks = vm_eval(ctx, 'JSON.stringify(keys)');
  const obj = JSON.parse(ks);
  for (const k of Object.keys(obj)) {
    assert.strictEqual(obj[k], false, `key '${k}' should be false after resetKeys()`);
  }
});
