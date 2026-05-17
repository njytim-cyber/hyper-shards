'use strict';
// PRESTIGE system tests — covers the helpers added in 01-core.js
// (prestigeRequirements, prestigeProgress, PRESTIGE_PERKS) and the
// ELITE difficulty entry they unlock.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSandbox, loadAllAsBrowser, vm_eval, vm_run } = require('./_helpers.js');

function freshCtx() {
  const { sandbox } = buildSandbox();
  return loadAllAsBrowser(sandbox);
}

test('prestige: defaultSave starts at level 0', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, 'save.prestige'), 0);
});

test('prestige: requirements gate scales with current level', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'save.prestige = 0;');
  const r0 = JSON.parse(vm_eval(ctx, 'JSON.stringify(prestigeRequirements())'));
  vm_run(ctx, 'save.prestige = 2;');
  const r2 = JSON.parse(vm_eval(ctx, 'JSON.stringify(prestigeRequirements())'));
  assert.ok(r2.shards    > r0.shards,    'shards req must rise per level');
  assert.ok(r2.bestRound > r0.bestRound, 'bestRound req must rise per level');
  assert.ok(r2.skins    >= r0.skins,     'skins req must rise (or cap)');
});

test('prestige: progress.ready === true only when ALL gates met', () => {
  const ctx = freshCtx();
  vm_run(ctx, [
    'save.prestige = 0;',
    'save.credits = 100000;',
    'save.bestRound = 99;',
    'for(const s of SKINS) save.skins[s.id] = true;',
  ].join('\n'));
  let p = JSON.parse(vm_eval(ctx, 'JSON.stringify(prestigeProgress())'));
  assert.strictEqual(p.ready, true, 'should be ready when all gates passed');

  vm_run(ctx, 'save.credits = 0;');
  p = JSON.parse(vm_eval(ctx, 'JSON.stringify(prestigeProgress())'));
  assert.strictEqual(p.ready, false, 'shard gate gone → must not be ready');

  vm_run(ctx, 'save.credits = 100000; save.bestRound = 1;');
  p = JSON.parse(vm_eval(ctx, 'JSON.stringify(prestigeProgress())'));
  assert.strictEqual(p.ready, false, 'bestRound gate gone → must not be ready');
});

test('prestige: shardMul perk scales then caps at 3.0 (+200%)', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, 'PRESTIGE_PERKS.shardMul(0)'),   1);
  assert.strictEqual(vm_eval(ctx, 'PRESTIGE_PERKS.shardMul(1)'),   1.25);
  assert.strictEqual(vm_eval(ctx, 'PRESTIGE_PERKS.shardMul(4)'),   2);
  assert.strictEqual(vm_eval(ctx, 'PRESTIGE_PERKS.shardMul(8)'),   3);   // cap
  assert.strictEqual(vm_eval(ctx, 'PRESTIGE_PERKS.shardMul(100)'), 3);   // still capped
});

test('prestige: hpBonus + dmgBonus cap correctly', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, 'PRESTIGE_PERKS.hpBonus(0)'),  0);
  assert.strictEqual(vm_eval(ctx, 'PRESTIGE_PERKS.hpBonus(3)'),  3);
  assert.strictEqual(vm_eval(ctx, 'PRESTIGE_PERKS.hpBonus(99)'), 5);   // cap
  assert.ok(Math.abs(vm_eval(ctx, 'PRESTIGE_PERKS.dmgBonus(2)') - 0.10)  < 1e-9);
  assert.ok(Math.abs(vm_eval(ctx, 'PRESTIGE_PERKS.dmgBonus(99)') - 0.50) < 1e-9);  // cap
});

test('prestige: ELITE difficulty unlocks at level >= 1', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, 'PRESTIGE_PERKS.eliteUnlocked(0)'), false);
  assert.strictEqual(vm_eval(ctx, 'PRESTIGE_PERKS.eliteUnlocked(1)'), true);
  assert.strictEqual(vm_eval(ctx, 'PRESTIGE_PERKS.eliteUnlocked(5)'), true);
});

test('prestige: DIFFICULTY.elite has the standard shape + rewards more shards than HARD', () => {
  const ctx = freshCtx();
  const elite = JSON.parse(vm_eval(ctx, 'JSON.stringify(DIFFICULTY.elite)'));
  for (const k of ['enemyHp', 'enemyDmg', 'enemySpd', 'fireRate', 'shardMul', 'hpStart']) {
    assert.ok(typeof elite[k] === 'number',
      `DIFFICULTY.elite missing numeric key: ${k}`);
  }
  assert.ok(vm_eval(ctx, 'DIFFICULTY.elite.shardMul > DIFFICULTY.hard.shardMul'),
    'ELITE should out-earn HARD or the prestige climb is pointless');
  assert.ok(vm_eval(ctx, 'DIFFICULTY.elite.enemyHp > DIFFICULTY.hard.enemyHp'),
    'ELITE enemies should be tougher than HARD');
});

test('prestige: prestigeRequirements skin cap never exceeds SKINS.length', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'save.prestige = 99;');
  const req = JSON.parse(vm_eval(ctx, 'JSON.stringify(prestigeRequirements())'));
  const skinCount = vm_eval(ctx, 'SKINS.length');
  assert.ok(req.skins <= skinCount,
    `req.skins (${req.skins}) must not exceed SKINS.length (${skinCount}) — would be unbeatable`);
});
