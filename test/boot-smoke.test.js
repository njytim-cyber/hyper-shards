'use strict';
// Boot smoke regression test.
// Loads index.html in a stubbed-DOM sandbox and asserts the boot sequence
// completes without throwing. Catches cross-file reference rot — e.g. a
// `.onclick = funcInLaterFile` at script top-level that ReferenceError's
// at parse time and silently breaks every assignment after it.

const test = require('node:test');
const assert = require('node:assert');
const { buildSandbox, loadAllAsBrowser } = require('./_helpers.js');

test('boot smoke: all 14 JS files load without throwing', () => {
  const { sandbox } = buildSandbox();
  let ctx;
  try {
    ctx = loadAllAsBrowser(sandbox);
  } catch (e) {
    assert.fail(`Boot failed: ${e.message}\n${e.stack}`);
  }
  const x = ctx.__exports__;
  assert.equal(typeof x.canvas, 'object', 'canvas should be defined after 01-core.js');
  assert.equal(typeof x.state, 'object', 'state should exist');
  assert.equal(typeof x.save, 'object', 'save should exist');
  assert.strictEqual(typeof x.startSurvival, 'function', 'startSurvival must be reachable');
  assert.strictEqual(typeof x.beginRound, 'function', 'beginRound must be reachable');
  assert.strictEqual(typeof x.update, 'function', 'update must be reachable');
  assert.strictEqual(typeof x.render, 'function', 'render must be reachable');
  assert.strictEqual(typeof x.makePlayer, 'function', 'makePlayer must be reachable');
  assert.strictEqual(typeof x.resetKeys, 'function', 'resetKeys must be reachable');
});
