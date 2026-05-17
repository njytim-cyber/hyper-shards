'use strict';
// SKIN MASTERY + ULTIMATES tests — covers MASTERY_XP_BY_TIER,
// getSkinMasteryXp/isSkinMastered/addSkinXp helpers, and the
// ULTIMATES registry (every skin must have a defined ultimate).

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSandbox, loadAllAsBrowser, vm_eval, vm_run } = require('./_helpers.js');

const VALID_ULT_KINDS = new Set(['nova', 'rage', 'rift', 'rebirth']);

function freshCtx() {
  const { sandbox } = buildSandbox();
  return loadAllAsBrowser(sandbox);
}

test('mastery: defaultSave starts with empty skinXp map', () => {
  const ctx = freshCtx();
  const xp = JSON.parse(vm_eval(ctx, 'JSON.stringify(save.skinXp)'));
  assert.deepStrictEqual(xp, {});
});

test('mastery: every SKIN has a positive integer XP threshold', () => {
  const ctx = freshCtx();
  const ids = JSON.parse(vm_eval(ctx, 'JSON.stringify(SKINS.map(s => s.id))'));
  for (const id of ids) {
    const t = vm_eval(ctx, `getSkinMasteryXp(${JSON.stringify(id)})`);
    assert.ok(Number.isInteger(t) && t > 0,
      `${id} has non-positive XP threshold: ${t}`);
  }
});

test('mastery: thresholds monotonically rise from default → celestial', () => {
  const ctx = freshCtx();
  const ids = JSON.parse(vm_eval(ctx, 'JSON.stringify(SKINS.map(s => s.id))'));
  let prev = 0;
  for (const id of ids) {
    const t = vm_eval(ctx, `getSkinMasteryXp(${JSON.stringify(id)})`);
    assert.ok(t >= prev,
      `threshold for ${id} (${t}) must be >= previous skin (${prev})`);
    prev = t;
  }
});

test('mastery: isSkinMastered flips exactly at the threshold', () => {
  const ctx = freshCtx();
  const t = vm_eval(ctx, 'getSkinMasteryXp("default")');
  vm_run(ctx, `save.skinXp.default = ${t - 1};`);
  assert.strictEqual(vm_eval(ctx, 'isSkinMastered("default")'), false);
  vm_run(ctx, `save.skinXp.default = ${t};`);
  assert.strictEqual(vm_eval(ctx, 'isSkinMastered("default")'), true);
});

test('mastery: addSkinXp accumulates on the right slot', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'save.skinXp = {}; addSkinXp("crimson", 50); addSkinXp("crimson", 30); addSkinXp("void", 7);');
  assert.strictEqual(vm_eval(ctx, 'save.skinXp.crimson'), 80);
  assert.strictEqual(vm_eval(ctx, 'save.skinXp.void'),     7);
});

test('mastery: addSkinXp persists to localStorage', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'save.skinXp = {}; addSkinXp("crimson", 100);');
  const stored = vm_eval(ctx,
    'JSON.parse(localStorage.getItem(SAVE_KEY)).skinXp.crimson');
  assert.strictEqual(stored, 100, 'XP must survive a save round-trip');
});

test('mastery: addSkinXp tolerates non-integer / negative amounts via |0', () => {
  const ctx = freshCtx();
  vm_run(ctx, 'save.skinXp = {}; addSkinXp("default", 10.7);');
  assert.strictEqual(vm_eval(ctx, 'save.skinXp.default'), 10,
    'fractional amounts are truncated by the |0 coercion');
});

test('ULTIMATES: every SKIN has an entry with the required shape', () => {
  const ctx = freshCtx();
  const ids = JSON.parse(vm_eval(ctx, 'JSON.stringify(SKINS.map(s => s.id))'));
  for (const id of ids) {
    const ult = JSON.parse(
      vm_eval(ctx, `JSON.stringify(ULTIMATES[${JSON.stringify(id)}] || null)`)
    );
    assert.ok(ult, `skin ${id} has no ULTIMATES entry`);
    assert.ok(typeof ult.name === 'string' && ult.name.length > 0,
      `${id}.name missing or empty`);
    assert.ok(Number.isInteger(ult.cd) && ult.cd > 0,
      `${id}.cd invalid: ${ult.cd}`);
    assert.ok(VALID_ULT_KINDS.has(ult.kind),
      `${id}.kind="${ult.kind}" — must be one of ${[...VALID_ULT_KINDS].join('|')}`);
    assert.ok(Number.isInteger(ult.color) && ult.color >= 0 && ult.color <= 0xffffff,
      `${id}.color invalid: ${ult.color}`);
  }
});

test('ULTIMATES: getUltimate falls back to default for unknown skin id', () => {
  const ctx = freshCtx();
  const ult = JSON.parse(vm_eval(ctx, 'JSON.stringify(getUltimate("nonexistent_skin"))'));
  // The default fallback is NOVA BURST (kind=nova)
  assert.strictEqual(ult.kind, 'nova');
  assert.strictEqual(typeof ult.name, 'string');
});

test('ULTIMATES: every kind has at least one skin using it (no dead code)', () => {
  const ctx = freshCtx();
  const ults = JSON.parse(vm_eval(ctx, 'JSON.stringify(ULTIMATES)'));
  const kindsInUse = new Set(Object.values(ults).map(u => u.kind));
  for (const k of VALID_ULT_KINDS) {
    assert.ok(kindsInUse.has(k),
      `ultimate kind '${k}' is never used by any skin → either remove the implementation or assign a skin to it`);
  }
});

test('MASTERY_XP_BY_TIER: covers every SKIN positionally', () => {
  const ctx = freshCtx();
  const skinsLen = vm_eval(ctx, 'SKINS.length');
  const tiersLen = vm_eval(ctx, 'MASTERY_XP_BY_TIER.length');
  assert.ok(tiersLen >= skinsLen,
    `MASTERY_XP_BY_TIER (${tiersLen}) must cover SKINS (${skinsLen}) — last skins fall back to the default 5000 otherwise`);
});

test('BOSS_XP_BY_TIER: matches the spec — 100 / 300 / 500 / 1000 / 1600', () => {
  const ctx = freshCtx();
  // Indexed 1..5 (index 0 is unused). Defined inside 15-3d-mode.js.
  assert.strictEqual(vm_eval(ctx, 'BOSS_XP_BY_TIER[1]'),  100);
  assert.strictEqual(vm_eval(ctx, 'BOSS_XP_BY_TIER[2]'),  300);
  assert.strictEqual(vm_eval(ctx, 'BOSS_XP_BY_TIER[3]'),  500);
  assert.strictEqual(vm_eval(ctx, 'BOSS_XP_BY_TIER[4]'), 1000);
  assert.strictEqual(vm_eval(ctx, 'BOSS_XP_BY_TIER[5]'), 1600);
});

test('BOSS_XP_BY_TIER: HP + score scale monotonically per tier', () => {
  const ctx = freshCtx();
  for(let t = 2; t <= 5; t++){
    const prevHp  = vm_eval(ctx, `BOSS_HP_BY_TIER[${t - 1}]`);
    const hp      = vm_eval(ctx, `BOSS_HP_BY_TIER[${t}]`);
    const prevSc  = vm_eval(ctx, `BOSS_SCORE_BY_TIER[${t - 1}]`);
    const sc      = vm_eval(ctx, `BOSS_SCORE_BY_TIER[${t}]`);
    assert.ok(hp > prevHp,  `tier ${t} HP (${hp}) must beat tier ${t-1} (${prevHp})`);
    assert.ok(sc > prevSc,  `tier ${t} score (${sc}) must beat tier ${t-1} (${prevSc})`);
  }
});

// End-to-end kill-path test: simulate a tier-5 boss kill the same way
// _3d_destroyAsteroid does it (calling _3d_onKill with a userData.boss
// asteroid object) and verify the right XP shows up in save.skinXp.
// This is the regression guard the user's bug really needed — proves
// the entire chain (kill → onKill → addSkinXp → persist) works.
test('BOSS_XP_BY_TIER: killing a tier-5 boss awards 1600 XP to the equipped skin', () => {
  const ctx = freshCtx();
  vm_run(ctx, [
    'save.skin = "default";',
    'save.skinXp = {};',
    // Stub the 3D scene state enough that _3d_onKill can run without crashing.
    '_3D.combo = 0; _3D.comboTimer = 0; _3D.score = 0; _3D.kills = 0;',
    // Build a fake boss with the right userData and feed it to _3d_onKill.
    'const fakeBoss = { userData: { boss: true, bossTier: 5, score: 2500 }, position: { x:0, y:0, z:0 } };',
    '_3d_onKill(fakeBoss);',
  ].join('\n'));
  assert.strictEqual(vm_eval(ctx, 'save.skinXp.default'), 1600,
    'tier-5 boss kill must add exactly 1600 XP — the spec the user asked for');
});

test('BOSS_XP_BY_TIER: each tier awards the spec XP through the kill path', () => {
  const ctx = freshCtx();
  const expected = { 1: 100, 2: 300, 3: 500, 4: 1000, 5: 1600 };
  for(const [tier, want] of Object.entries(expected)){
    vm_run(ctx, [
      'save.skin = "default";',
      'save.skinXp = {};',
      '_3D.combo = 0; _3D.comboTimer = 0; _3D.score = 0; _3D.kills = 0;',
      `const fakeBoss = { userData: { boss: true, bossTier: ${tier}, score: 100 }, position: { x:0, y:0, z:0 } };`,
      '_3d_onKill(fakeBoss);',
    ].join('\n'));
    const got = vm_eval(ctx, 'save.skinXp.default');
    assert.strictEqual(got, want,
      `tier-${tier} boss should award ${want} XP, got ${got}`);
  }
});

// === The bug that bit the user: the 2D survival mode boss-kill code
// (08-update.js) used to award shards + score but never called
// addSkinXp, so killing tier-5 bosses in the regular 2D game gave 0
// skin mastery XP. This test exercises that path end-to-end.
test('2D boss kill: tier-5 boss in survival awards 1600 XP to equipped skin', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, [
    'startSurvival("medium");',
    'save.skin = "default";',
    'save.skinXp = {};',
    // Stand up a fake tier-5 boss the same shape spawnBoss creates.
    'state.boss = { x:W/2, y:120, color:"#ff2299", tier:5, hp:0, maxHp:1, r:60, vx:0, vy:0, phase:0, t:0, ai:{}, name:"BOSS 5" };',
    // Run one update tick — the boss hp<=0 branch fires inline.
    'update(16);',
  ].join('\n'));
  assert.strictEqual(vm_eval(ctx, 'save.skinXp.default'), 1600,
    'killing a tier-5 boss in 2D survival must award 1600 XP — same as 3D mode');
});

test('2D ULT: E triggers nothing when current skin is not mastered', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, [
    'startSurvival("medium");',
    'save.skin = "default";',
    'save.skinXp = { default: 0 };',
    'state.ultCd = 0;',
    'triggerUltimate();',
  ].join('\n'));
  assert.strictEqual(vm_eval(ctx, 'state.ultCd'), 0,
    'unmastered skin must not start the ult cooldown — ult was locked');
});

test('2D ULT: E with mastered "default" (nova) wipes enemies on screen', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, [
    'startSurvival("medium");',
    'save.skin = "default";',
    'save.skinXp = { default: 99999 };',  // mastered
    'state.ultCd = 0;',
    // Spawn 3 enemies in the field
    'state.enemies.push({ type:"asteroid", x:100, y:100, vx:0, vy:0, hp:5, r:20, color:"#888", split:false });',
    'state.enemies.push({ type:"asteroid", x:200, y:200, vx:0, vy:0, hp:5, r:20, color:"#888", split:false });',
    'state.enemies.push({ type:"ufo",      x:300, y:300, vx:0, vy:0, hp:5, r:20, color:"#888" });',
    'triggerUltimate();',
  ].join('\n'));
  // After nova fires, every enemy.hp <= 0 (they'll be exploded next tick).
  const allDead = vm_eval(ctx, 'state.enemies.every(e => e.hp <= 0)');
  assert.strictEqual(allDead, true,
    'nova ULT must zero hp on every enemy on screen');
  assert.ok(vm_eval(ctx, 'state.ultCd') > 0,
    'firing ult must start the cooldown');
});

test('2D ULT: E with mastered "crimson" (rage) sets player.fxBerserk', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, [
    'startSurvival("medium");',
    'save.skin = "crimson"; save.skins.crimson = true;',
    'save.skinXp = { crimson: 99999 };',
    // makePlayer was already called by startSurvival with default skin;
    // re-make so player.skin reflects the new equip.
    'player = makePlayer();',
    'state.ultCd = 0;',
    'triggerUltimate();',
  ].join('\n'));
  assert.ok(vm_eval(ctx, 'player.fxBerserk') >= 8000,
    'rage ULT must enable fxBerserk for ~8s');
});

test('2D ULT: E with mastered "void" (rift) spawns a black hole', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, [
    'startSurvival("medium");',
    'save.skin = "void"; save.skins.void = true;',
    'save.skinXp = { void: 99999 };',
    'player = makePlayer();',
    'state.ultCd = 0;',
    'state.blackHole = null;',
    'triggerUltimate();',
  ].join('\n'));
  const bh = JSON.parse(vm_eval(ctx, 'JSON.stringify(state.blackHole)'));
  assert.ok(bh && bh.life > 0,
    'rift ULT must instantiate state.blackHole with positive lifetime');
});

test('2D ULT: a second E press during cooldown is rejected', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, [
    'startSurvival("medium");',
    'save.skin = "default";',
    'save.skinXp = { default: 99999 };',
    'state.ultCd = 0;',
    'triggerUltimate();',                         // 1st fire — sets cooldown
    'const firstCd = state.ultCd;',
    'triggerUltimate();',                         // 2nd fire while on cooldown
    'globalThis.__cdAfterSecond = state.ultCd;',
    'globalThis.__cdAtFirst    = firstCd;',
  ].join('\n'));
  const first  = vm_eval(ctx, '__cdAtFirst');
  const second = vm_eval(ctx, '__cdAfterSecond');
  assert.ok(first > 0, 'first ult fire should have set a positive cooldown');
  // Second press must not RESET the cooldown back to a fresh value — it
  // should be untouched (modulo the dt that passed, which is zero here).
  assert.strictEqual(second, first,
    'second E press during cooldown must be a no-op');
});

test('rewards: ALL_ACHIEVEMENTS each have a numeric shards+xp reward', () => {
  const ctx = freshCtx();
  const ach = JSON.parse(vm_eval(ctx, 'JSON.stringify(ALL_ACHIEVEMENTS)'));
  for(const a of ach){
    assert.ok(a.reward && typeof a.reward === 'object',
      `${a.id} must have a reward object`);
    assert.ok(Number.isInteger(a.reward.shards) && a.reward.shards > 0,
      `${a.id}.reward.shards must be a positive integer (got ${a.reward.shards})`);
    assert.ok(Number.isInteger(a.reward.xp) && a.reward.xp > 0,
      `${a.id}.reward.xp must be a positive integer (got ${a.reward.xp})`);
  }
});

test('rewards: achievement() adds the right shards + XP', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, [
    'startSurvival("medium");',
    'save.skin = "default";',
    'save.skinXp = {};',
    'save.credits = 0;',
    'state.achievements = {};',
    'achievement("VOID WALKER");',   // hardest: 1000 ◈, 800 XP
  ].join('\n'));
  assert.strictEqual(vm_eval(ctx, 'save.credits'),         1000,
    'VOID WALKER must add 1000 shards');
  assert.strictEqual(vm_eval(ctx, 'save.skinXp.default'),  800,
    'VOID WALKER must add 800 XP to equipped skin');
});

test('rewards: same achievement only pays out once', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, [
    'startSurvival("medium");',
    'save.skin = "default";',
    'save.skinXp = {};',
    'save.credits = 0;',
    'state.achievements = {};',
    'achievement("FIRST BLOOD");',  // 50 ◈, 25 XP
    'achievement("FIRST BLOOD");',  // second call: no-op
    'achievement("FIRST BLOOD");',  // third call: no-op
  ].join('\n'));
  assert.strictEqual(vm_eval(ctx, 'save.credits'),        50,
    'duplicate achievement calls must not double-reward shards');
  assert.strictEqual(vm_eval(ctx, 'save.skinXp.default'), 25,
    'duplicate achievement calls must not double-reward XP');
});

test('2D kill: regular enemy in survival awards small per-kill XP', () => {
  const { sandbox } = buildSandbox();
  const ctx = loadAllAsBrowser(sandbox);
  vm_run(ctx, [
    'startSurvival("medium");',
    'save.skin = "default";',
    'save.skinXp = {};',
    // startSurvival sets up state.combo = {count, timer, mult, killTime}
    // already; we leave it alone.
    'state.enemies.push({ type:"asteroid", x:W/2, y:200, vx:0, vy:0, hp:0, r:20, color:"#888", split:false });',
    'update(16);',
  ].join('\n'));
  const got = vm_eval(ctx, 'save.skinXp.default');
  assert.ok(got > 0, `2D kill should award >0 XP to equipped skin, got ${got}`);
});
