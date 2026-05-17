'use strict';
// Static structural audit — no runtime, just text scanning.
// Catches refactor-rot at the file level: duplicate top-level declarations,
// IIFE leftovers, references to onclick=funcName at parse time, etc.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, FILES } = require('./_helpers.js');

function readFile(f) {
  return fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
}

test('static audit: no top-level const/let collisions across files', () => {
  // function declarations CAN repeat (the later wins, mirroring the old
  // monolith) but const/let MUST be unique or browser scripts throw
  // "Identifier has already been declared" on load.
  const declRe = /^(const|let|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;
  const seen = new Map();
  const collisions = [];
  for (const f of FILES) {
    for (const line of readFile(f).split(/\r?\n/)) {
      const m = line.match(declRe);
      if (!m) continue;
      const name = m[2];
      if (seen.has(name)) {
        collisions.push(`${name}: ${seen.get(name)} vs ${f}`);
      } else {
        seen.set(name, f);
      }
    }
  }
  assert.deepStrictEqual(collisions, [],
    'top-level const/let must not be duplicated across files:\n  ' + collisions.join('\n  '));
});

test('static audit: no leftover IIFE wrappers from the original monolith', () => {
  const offenders = [];
  for (const f of FILES) {
    const src = readFile(f);
    // A leftover top-level IIFE wrapper would look like the first
    // non-comment line being `(() => {` or `(function(){`.
    if (/^\s*\(\s*(?:function\s*\(\s*\)|\(\)\s*=>)\s*\{/m.test(src)) {
      offenders.push(f);
    }
  }
  assert.deepStrictEqual(offenders, [],
    `IIFE wrapper found — refactor missed something: ${offenders.join(', ')}`);
});

test('static audit: every <script src> in index.html exists on disk', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scriptRe = /<script\s+src="([^"]+)"/g;
  const missing = [];
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    const rel = m[1];
    // Remote URLs (Three.js CDN, etc.) are intentionally not on disk —
    // skip the existence check for anything that isn't a local path.
    if (/^https?:\/\//.test(rel) || /^\/\//.test(rel)) continue;
    if (!fs.existsSync(path.join(ROOT, rel))) missing.push(rel);
  }
  assert.deepStrictEqual(missing, [],
    `index.html references missing files: ${missing.join(', ')}`);
});

test('static audit: index.html loads JS files in the canonical order', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scriptRe = /<script\s+src="js\/([^"]+)"/g;
  const order = [];
  let m;
  while ((m = scriptRe.exec(html)) !== null) order.push(m[1]);
  assert.deepStrictEqual(order, FILES,
    'JS load order in index.html must match the canonical numbered sequence');
});

test('static audit: no setInterval that runs forever in normal phases', () => {
  // After the perf pass, the only setIntervals that should remain are
  // either gated (cleared on phase exit) or run for a bounded duration
  // (audio crossfade). Bare top-level "setInterval(fn, ms)" without a
  // surrounding clearInterval/condition is a perf smell.
  const allowed = ['06-audio.js']; // music crossfade clears itself on completion
  const offenders = [];
  for (const f of FILES) {
    if (allowed.includes(f)) continue;
    const src = readFile(f);
    // Find raw setInterval that isn't assigned to a variable for cleanup.
    const re = /^[ \t]*setInterval\s*\(/gm;
    if (re.test(src)) offenders.push(f);
  }
  assert.deepStrictEqual(offenders, [],
    'unbounded setInterval found — convert to rAF or assign to a clearable variable:\n  ' + offenders.join('\n  '));
});

test('static audit: no .onclick = bareIdentifier (parse-time function ref)', () => {
  // The bug we just fixed: `el.onclick = resume` at parse time of an early
  // file ReferenceError'd because `resume` lives in a later file.
  // Direct identifier refs are forbidden; wrap in `()=> name()` instead.
  const offenders = [];
  // Match `.onclick = <ident>` where the value is NOT an arrow, function,
  // or null/undefined/property access. Whitespace tolerated.
  const re = /\.onclick\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*[;\n]/g;
  for (const f of FILES) {
    const src = readFile(f);
    let m;
    while ((m = re.exec(src)) !== null) {
      const name = m[1];
      if (['null', 'undefined', 'function'].includes(name)) continue;
      offenders.push(`${f}: .onclick = ${name}`);
    }
  }
  assert.deepStrictEqual(offenders, [],
    'wrap parse-time onclick handlers in arrow funcs:\n  ' + offenders.join('\n  '));
});

test('version: VERSION constant is in sync across package.json / 01-core.js / sw.js', () => {
  // Three sources of truth that MUST agree:
  //   - package.json `version`           — what npm/tooling sees
  //   - js/01-core.js `const VERSION`    — what the running game reports
  //   - sw.js        `const VERSION`     — drives the cache-shell name
  // Drift means a deploy may evict caches without bumping the visible
  // version (or vice versa), so this test fails loudly if any disagree.
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const coreSrc = fs.readFileSync(path.join(ROOT, 'js', '01-core.js'), 'utf8');
  const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const coreMatch = coreSrc.match(/^const VERSION\s*=\s*['"]([^'"]+)['"]/m);
  const swMatch = swSrc.match(/^const VERSION\s*=\s*['"]([^'"]+)['"]/m);
  assert.ok(coreMatch, '01-core.js must declare `const VERSION = "x.y.z";` at top level');
  assert.ok(swMatch,   'sw.js must declare `const VERSION = "x.y.z";` at top level');
  const core = coreMatch[1];
  const sw   = swMatch[1];
  assert.strictEqual(core, pkg.version,
    `01-core.js VERSION (${core}) must match package.json version (${pkg.version})`);
  assert.strictEqual(sw, pkg.version,
    `sw.js VERSION (${sw}) must match package.json version (${pkg.version})`);
  // Must be a semver-shaped string so display + comparison stay sane.
  assert.match(pkg.version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/,
    `package.json version "${pkg.version}" is not a valid semver string`);
});
