'use strict';
// SHOP / cross-module integrity tests — guard against forgetting to
// add a weapon to the 3D dispatcher, a skin to ULTIMATES, etc. These
// failures would otherwise ship silently and only surface when a
// player buys the item.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSandbox, loadAllAsBrowser, vm_eval } = require('./_helpers.js');

function freshCtx() {
  const { sandbox } = buildSandbox();
  return loadAllAsBrowser(sandbox);
}

test('shop integrity: every SHOP_WEAPONS id has a _3D_WEAPONS entry', () => {
  const ctx = freshCtx();
  const shopIds  = JSON.parse(vm_eval(ctx, 'JSON.stringify(SHOP_WEAPONS.map(w => w.id))'));
  const threeIds = JSON.parse(vm_eval(ctx, 'JSON.stringify(Object.keys(_3D_WEAPONS))'));
  for (const id of shopIds) {
    assert.ok(threeIds.includes(id),
      `weapon ${id} is sold in the 2D shop but has no _3D_WEAPONS entry — players who buy it can't cycle to it in 3D`);
  }
});

test('shop integrity: every _3D_WEAPONS entry has a shop counterpart', () => {
  const ctx = freshCtx();
  const shopIds  = JSON.parse(vm_eval(ctx, 'JSON.stringify(SHOP_WEAPONS.map(w => w.id))'));
  const threeIds = JSON.parse(vm_eval(ctx, 'JSON.stringify(Object.keys(_3D_WEAPONS))'));
  for (const id of threeIds) {
    assert.ok(shopIds.includes(id),
      `_3D_WEAPONS has ${id} but no SHOP_WEAPONS entry — it can never be unlocked`);
  }
});

test('shop integrity: every _3D_WEAPONS entry has a valid kind + cd + dmg', () => {
  const ctx = freshCtx();
  const valid = new Set(['normal', 'wave', 'beam', 'split', 'chain', 'aoe']);
  const ws = JSON.parse(vm_eval(ctx, 'JSON.stringify(_3D_WEAPONS)'));
  for (const [id, w] of Object.entries(ws)) {
    assert.ok(valid.has(w.kind),
      `${id}.kind="${w.kind}" — unknown dispatch kind`);
    assert.ok(Number.isInteger(w.cd) && w.cd > 0,  `${id}.cd invalid: ${w.cd}`);
    assert.ok(Number.isInteger(w.dmg) && w.dmg > 0, `${id}.dmg invalid: ${w.dmg}`);
    assert.ok(Number.isInteger(w.color) && w.color >= 0,
      `${id}.color invalid: ${w.color}`);
  }
});

test('shop integrity: SHOP_WEAPONS[0] is the free starter PLASMA', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, 'SHOP_WEAPONS[0].id'),   'single');
  assert.strictEqual(vm_eval(ctx, 'SHOP_WEAPONS[0].cost'), 0);
  assert.strictEqual(vm_eval(ctx, 'save.weapons.single'),  true,
    'fresh save should own the starter weapon');
});

test('shop integrity: SKINS[0] is the free starter NOVA', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, 'SKINS[0].id'),    'default');
  assert.strictEqual(vm_eval(ctx, 'SKINS[0].cost'),  0);
  assert.strictEqual(vm_eval(ctx, 'save.skins.default'), true,
    'fresh save should own the starter skin');
  assert.strictEqual(vm_eval(ctx, 'save.skin'), 'default',
    'fresh save should equip the starter skin');
});

test('shop integrity: every SHOP_WEAPONS cost is non-negative + ordered ascending', () => {
  const ctx = freshCtx();
  const ws = JSON.parse(vm_eval(ctx, 'JSON.stringify(SHOP_WEAPONS)'));
  let prev = -1;
  for (const w of ws) {
    assert.ok(Number.isInteger(w.cost) && w.cost >= 0,
      `${w.id} cost invalid: ${w.cost}`);
    assert.ok(w.cost >= prev,
      `${w.id} (${w.cost}) breaks ascending cost order (prev ${prev})`);
    prev = w.cost;
  }
});

test('shop integrity: every SHOP_CONSUMABLES has cost > 0 and cap > 0', () => {
  const ctx = freshCtx();
  const cons = JSON.parse(vm_eval(ctx, 'JSON.stringify(SHOP_CONSUMABLES)'));
  for (const c of cons) {
    assert.ok(c.cost > 0, `consumable ${c.id} should cost > 0`);
    assert.ok(c.cap  > 0, `consumable ${c.id} should have positive cap`);
  }
});

test('shop integrity: every SKIN has color + accent + glow + ability', () => {
  const ctx = freshCtx();
  const skins = JSON.parse(vm_eval(ctx, 'JSON.stringify(SKINS)'));
  for (const s of skins) {
    for (const k of ['color', 'accent', 'glow']) {
      assert.ok(typeof s[k] === 'string' && s[k].startsWith('#'),
        `skin ${s.id}.${k} should be a CSS hex string`);
    }
    assert.ok(s.ability && typeof s.ability.name === 'string',
      `skin ${s.id}.ability missing name`);
    assert.ok(Number.isInteger(s.ability.cd) && s.ability.cd > 0,
      `skin ${s.id}.ability.cd invalid`);
  }
});

test('shop integrity: HUB_BG_THEMES ids do not clash with HUB defaults', () => {
  const ctx = freshCtx();
  const themeIds = Object.keys(JSON.parse(vm_eval(ctx, 'JSON.stringify(HUB_BG_THEMES)')));
  assert.ok(themeIds.includes('nebula'),
    'the default save.hubBg refers to "nebula" — must exist as a theme');
});
