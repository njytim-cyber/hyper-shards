'use strict';
// HUB THEMES tests — covers HUB_BG_THEMES registry, getHubTheme()
// fallback, and save default ownership.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSandbox, loadAllAsBrowser, vm_eval, vm_run } = require('./_helpers.js');

function freshCtx() {
  const { sandbox } = buildSandbox();
  return loadAllAsBrowser(sandbox);
}

test('themes: defaultSave starts with nebula owned + equipped', () => {
  const ctx = freshCtx();
  assert.strictEqual(vm_eval(ctx, 'save.hubBg'), 'nebula',
    'fresh save should equip the starter theme');
  assert.strictEqual(vm_eval(ctx, 'save.hubBgs.nebula'), true,
    'fresh save should own the starter theme');
});

test('themes: nebula is free (cost 0); every other theme costs > 0', () => {
  const ctx = freshCtx();
  const themes = JSON.parse(vm_eval(ctx, 'JSON.stringify(HUB_BG_THEMES)'));
  assert.strictEqual(themes.nebula.cost, 0, 'starter theme must be free');
  for (const [id, t] of Object.entries(themes)) {
    if (id === 'nebula') continue;
    assert.ok(t.cost > 0,
      `${id} should cost > 0 shards — gold-tier cosmetic, not a freebie`);
  }
});

test('themes: every HUB_BG_THEMES entry has the renderer-required shape', () => {
  const ctx = freshCtx();
  const themes = JSON.parse(vm_eval(ctx, 'JSON.stringify(HUB_BG_THEMES)'));
  for (const [id, t] of Object.entries(themes)) {
    assert.ok(typeof t.label === 'string' && t.label.length > 0,
      `${id} missing label`);
    assert.ok(Number.isInteger(t.cost) && t.cost >= 0,
      `${id} cost invalid: ${t.cost}`);
    assert.ok(Array.isArray(t.bg) && t.bg.length === 3,
      `${id}.bg must be a 3-stop gradient array (got ${t.bg ? t.bg.length : 'null'})`);
    assert.ok(Array.isArray(t.nebs) && t.nebs.length === 4,
      `${id}.nebs must have 4 nebula colors (got ${t.nebs ? t.nebs.length : 'null'})`);
    for (const k of ['glowA', 'glowB', 'beam']) {
      assert.ok(typeof t[k] === 'string' && t[k].startsWith('#'),
        `${id}.${k} must be a CSS hex string`);
    }
  }
});

test('themes: getHubTheme returns the equipped theme by id', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'save.hubBg = "crimson";');
  const t = JSON.parse(vm_eval(ctx, 'JSON.stringify(getHubTheme())'));
  assert.strictEqual(t.label, 'CRIMSON');
});

test('themes: getHubTheme falls back to nebula for unknown ids', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'save.hubBg = "this-theme-does-not-exist";');
  const t = JSON.parse(vm_eval(ctx, 'JSON.stringify(getHubTheme())'));
  assert.strictEqual(t.label, 'NEBULA',
    'unknown theme id must fall back, not crash drawHubScene');
});

test('themes: save round-trip preserves hubBgs ownership', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'save.hubBgs.crimson = true; save.hubBgs.solar = true; persist();');
  // Re-parse the stored JSON inside the sandbox; bring the result back
  // as a JSON string so we don't have to round-trip a live object
  // across the vm boundary (which String()-coerces to "[object Object]").
  const reloaded = JSON.parse(vm_eval(ctx,
    'JSON.stringify(JSON.parse(localStorage.getItem(SAVE_KEY)).hubBgs)'));
  assert.strictEqual(reloaded.nebula,  true);
  assert.strictEqual(reloaded.crimson, true);
  assert.strictEqual(reloaded.solar,   true);
});
