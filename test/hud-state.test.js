'use strict';
// HUD state restoration tests — guards regressions where pause/resume
// (or other HUD-toggle paths) drop an in-flight overlay because the
// "show" path forgot the state it was supposed to restore.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSandbox, loadAllAsBrowser, vm_eval, vm_run } = require('./_helpers.js');

function freshCtx(){
  const { sandbox } = buildSandbox();
  return loadAllAsBrowser(sandbox);
}

test('hud: bossBar is hidden by default (no boss in play)', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'state.boss = null; showHUD(false);');
  // Stub style display starts unset; showHUD without an active boss
  // must not paint the bar.
  const d = vm_eval(ctx, 'document.getElementById("bossBar").style.display');
  assert.notStrictEqual(d, 'block',
    'no active boss → showHUD must not display the boss bar');
});

test('hud: bossBar reappears on showHUD when state.boss is set', () => {
  const ctx = freshCtx();
  // Simulate the in-flight boss fight + a pause → resume cycle.
  vm_run(ctx, [
    'state.boss = { hp: 50, maxHp: 100, name: "TEST BOSS" };',
    'hideHUD();',                  // pause path drops the bar
    'showHUD(false);',             // resume must put it back
  ].join('\n'));
  const d = vm_eval(ctx, 'document.getElementById("bossBar").style.display');
  assert.strictEqual(d, 'block',
    'showHUD with an active boss must restore the bossBar — regression: pause+resume during a boss fight was killing the HP bar');
});

test('hud: hideHUD really hides everything regardless of state', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'state.boss = { hp: 50 }; hideHUD();');
  const ids = ['hud', 'hudBottom', 'pvpScore', 'bossBar', 'tutCaption', 'minimap', 'combo'];
  for(const id of ids){
    const d = vm_eval(ctx, `document.getElementById(${JSON.stringify(id)}).style.display`);
    assert.strictEqual(d, 'none', `${id} must be hidden by hideHUD`);
  }
});
