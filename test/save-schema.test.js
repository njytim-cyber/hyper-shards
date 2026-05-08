'use strict';
// Save-schema regression. The JSON shape that `persist()` writes to
// localStorage is a public contract — players' save files in the wild
// rely on it. If a field gets renamed or dropped, this test fires.

const test = require('node:test');
const assert = require('node:assert');
const { buildSandbox, loadAllAsBrowser, vm_eval, vm_run } = require('./_helpers.js');

const REQUIRED_TOP_LEVEL = [
  'credits', 'best', 'skin', 'username', 'music',
  'upgrades', 'weapons', 'consumables', 'specials',
  'bossWins',
];

const REQUIRED_UPGRADES = [
  'hp', 'dmg', 'fire', 'speed', 'boost', 'shield',
  'magnet', 'multishot', 'pierce',
];

test('save schema: defaultSave returns all expected top-level fields', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  const def = vm_eval(ctx, 'defaultSave()');
  for (const k of REQUIRED_TOP_LEVEL) {
    assert.ok(k in def, `defaultSave() missing top-level field: ${k}`);
  }
});

test('save schema: upgrades has all expected stat keys, all integers', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  const u = vm_eval(ctx, 'defaultSave().upgrades');
  for (const k of REQUIRED_UPGRADES) {
    assert.ok(k in u, `upgrades missing field: ${k}`);
    assert.strictEqual(typeof u[k], 'number', `upgrades.${k} should be a number`);
    assert.ok(Number.isInteger(u[k]), `upgrades.${k} should be an integer`);
  }
});

test('save schema: weapons.single is true by default (the starting weapon)', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  const w = vm_eval(ctx, 'defaultSave().weapons');
  assert.strictEqual(w.single, true, 'starting weapon "single" must default to true');
});

test('save schema: persist round-trip preserves credits and upgrades', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, 'save.credits = 12345; save.upgrades.hp = 4; persist();');
  const stored = vm_eval(ctx, 'localStorage.getItem("hypershards_save_v3")');
  assert.ok(stored, 'persist() must write to localStorage key hypershards_save_v3');
  const parsed = JSON.parse(stored);
  assert.strictEqual(parsed.credits, 12345);
  assert.strictEqual(parsed.upgrades.hp, 4);
});

test('save schema: ensureSaveCompat tolerates a partial / old save', () => {
  // Simulate a save that's missing newer fields. The compat shim should
  // backfill them rather than crash on undefined access.
  const { sandbox } = buildSandbox();
  sandbox.localStorage._store['hypershards_save_v3'] = JSON.stringify({
    credits: 50, best: 0, skin: 'default', music: true,
    // upgrades missing entirely
  });
  let ctx;
  assert.doesNotThrow(() => { ctx = loadAllAsBrowser(sandbox); },
    'loading the game with a partial save must not throw');
  const u = vm_eval(ctx, 'save.upgrades');
  assert.ok(u && typeof u === 'object', 'upgrades object should be filled in by compat shim');
});

test('save schema: persist() must not throw on QuotaExceededError (iOS Safari private mode)', () => {
  // Stub localStorage.setItem to throw the way iOS does in private browsing.
  const { sandbox } = buildSandbox();
  sandbox.localStorage.setItem = function(){
    const e = new Error('quota exceeded');
    e.name = 'QuotaExceededError';
    throw e;
  };
  const ctx = loadAllAsBrowser(sandbox);
  // Multiple persists must not throw. Without the try/catch in 01-core.js,
  // the first achievement unlock would tear down the round.
  assert.doesNotThrow(() => {
    vm_run(ctx, 'save.credits = 1; persist();');
    vm_run(ctx, 'save.credits = 2; persist();');
    vm_run(ctx, 'save.credits = 3; persist();');
  }, 'persist() must swallow storage quota errors');
});

test('save schema: corrupt JSON in localStorage falls back to defaultSave', () => {
  const { sandbox } = buildSandbox();
  sandbox.localStorage._store['hypershards_save_v3'] = '{not valid json';
  let ctx;
  assert.doesNotThrow(() => { ctx = loadAllAsBrowser(sandbox); });
  const credits = vm_eval(ctx, 'save.credits');
  assert.strictEqual(credits, 0, 'corrupt save should reset to defaults, not crash');
});
