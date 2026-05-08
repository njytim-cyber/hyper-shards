# Hyper Shards — Engineering Notes

A neon-arcade space shooter (HTML5 Canvas, single-page, browser-direct).
This file is durable context for future Claude sessions.

## Stack

**Pure JavaScript. No TypeScript, no bundler, no build step.**
- HTML + CSS + classic `<script>` tags loaded in order from `js/01-*.js` → `js/14-*.js`
- Deployed on **Cloudflare Pages** by serving the repo root as static files. Build command: empty. Output dir: `/`. Cache headers in `_headers` (HTML/CSS/JS short, `audio/*` immutable for 1 year).
- Unit tests use Node 24's built-in `node:test` runner with a stubbed-DOM `vm` sandbox — zero runtime deps
- E2E tests use Playwright (`@playwright/test`) — installed as the only `devDependency`. Runs Chromium against three device-profile projects (desktop / tablet / phone) hitting the same `http-server` we deploy with.

### When to revisit JS-vs-TS (decision recorded 2026-05)

Stay on JS while **all** of these hold:
- Single-developer or pair-sized team
- "Edit, save, refresh" loop in the browser is the dominant inner loop
- Game shape (`save`, `state`, `player`) doesn't churn weekly
- Codebase < ~15k lines

Switch to TS when **any** trigger fires:
1. **Multiple contributors** — types are the contract that survives across mental models
2. **Refactor-rot recurs** — second time the same "renamed X, forgot Y" bug class shows up, types pay for themselves
3. **Public surface area** — modding API, plugin system, library export, network protocol
4. **Schema in flight** — non-trivial state machines, save format versioning

When you do switch: go all-in (`strict: true`, `noUncheckedIndexedAccess`),
not partial. Halfway TS is worse than confident JS.

**Cheap intermediate option** that's NOT a full TS migration: a 30-min
`// @ts-check` + JSDoc pass on `state`, `save`, `player` shapes. Catches
~80% of refactor-rot at zero build cost. Worth doing first.

## File layout

```
index.html                  ~290 lines, markup only + <link> + <script src> tags
css/style.css               ~830 lines (incl. body.is-phone overrides)
js/01-core.js                  canvas init, save schema, config tables, state, device detection
js/02-input.js                 keyboard, touch joystick, menu navigation, button wiring
js/03-actors.js                player, skin abilities, weapons, fire()
js/04-enemies.js               enemy + boss spawn
js/05-flow.js                  startSurvival, beginRound, endRound, pause/resume, shop
js/06-audio.js                 sfx (WebAudio synth) + looping music tracks
js/07-loop.js                  combo, achievements, hit-stop, main rAF loop
js/08-update.js                core update — movement, collisions, physics
js/09-boss-ai.js               boss AI + patterns
js/10-modes.js                 PvP + tutorial
js/11-render.js                canvas drawing, ship/bullet/enemy/boss
js/12-icons.js                 shop icons + 3D Bloons-style menu icons
js/13-hub.js                   Bloons-style main hub menu
js/14-boss-arena.js            boss-rush mode + final boot (showMenu('menuMain'))
audio/                         Lyria-2 generated tracks (mp3, 96kbps; originals at 128kbps in audio/original)
test/*.test.js                 Node 24 native test runner, no deps
```

Original was a single 5,781-line `index.html` IIFE. Refactored into
classic scripts because:
- ES modules don't work over `file://` (CORS) and would force a server for local dev
- Classic scripts share a single "script scope" — top-level `const`/`let`/`function`
  in script A is visible by name from script B (no `window.` prefixes, no namespace object)
- No bundler keeps deploy = `git push` to Cloudflare Pages

## Refactor gotcha that bit us

**Don't do `el.onclick = funcName;` at script top level when `funcName`
lives in a later-loaded script.** Classic scripts execute in order;
top-level identifiers are looked up immediately. Wrap in an arrow:
`el.onclick = ()=> funcName();` so the lookup happens at click time.

The boot-smoke test in `test/boot-smoke.test.js` catches this regression
class — it concatenates all 14 files and runs them through `node:vm` with
a stubbed DOM. If anything throws, the test fails.

## Drift bug postmortem

Symptom: ship drifted right with no input.
Root cause: combination of three things —
1. `'use strict'` + bad `.onclick = resume` reference threw at parse
   time, leaving menu wiring half-installed
2. `vx *= 0.86` was per-frame, not dt-scaled, so glide stretched at low FPS
3. No velocity floor, so residual drift compounded asymptotically

Fixes (all three layered, defense in depth):
- Wrap parse-time references in arrow funcs (boot-smoke test enforces)
- `vx *= Math.pow(0.86, dt/16)` — dt-scaled damping
- `if(!ax && Math.abs(vx) < 0.05) vx = 0;` — snap to zero
- `resetKeys()` called from `startSurvival`, `startPvp`, `startTutorial`,
  `startBossFight`; also on `window.blur` and `visibilitychange`
- Touchmove listener moved from stick → document so dragging off the
  visible pad still tracks

Regression coverage in `test/physics.test.js`:
- 600 frames at 60fps + 300 at 30fps with no input → no drift
- Phantom stuck key before startSurvival → no drift
- Pressing/releasing D moves and stops correctly
- Peak velocity matches across 60fps and 30fps (catches non-dt damping)

## Device + orientation detection

`01-core.js`'s `applyDeviceClass()` toggles five body classes; `resize`
and `orientationchange` re-run it.

| Class | When | Drives |
|---|---|---|
| `is-touch`     | `'ontouchstart' in window` or `navigator.maxTouchPoints > 0` | perf overrides (no backdrop-filter, no shadowBlur), touch UI shown, keyboard hint bar hidden |
| `is-phone`     | `is-touch && min(w,h) < 500` | compact HUD (hides PROGRESS panel), pilot badge shrunk, smaller nav |
| `is-tablet`    | `is-touch && min(w,h) ≥ 500` | shares perf overrides; full HUD; full hub |
| `is-portrait`  | `innerHeight > innerWidth` | further overrides keyed below |
| `is-landscape` | otherwise | (placeholder for future tweaks) |

iPad Mini at 768px and up gets `is-tablet`, never `is-phone`.

## Orientation-adaptive design (added 2026-05)

The game used to force landscape with a full-screen "rotate" prompt
covering any portrait state. That's been removed entirely.

Rationale: this is a vertical-scrolling shooter (enemies fall from
above, ship sits at the bottom). Portrait is genre-native; forcing
rotation fights the form. 2026 mobile users see "rotate your device"
as friction, not guidance.

Now both orientations are first-class on touch devices:

- **Phone landscape** — original layout, polished. 5 hearts top-left,
  shard count top-right, joystick + fire/ability/weapon/boost row at
  the bottom.
- **Phone portrait** — restacked. PROGRESS centre panel hidden (the
  ability info is already on the touch button), pilot badge compacts,
  hub side icons shrink to 34px, bottom nav bar drops to 42px buttons
  with a 62px PLAY centerpiece. Title shows `HYPER\nSHARDS` on two
  lines. The 6-button nav fits 390px wide with 4px gaps.
- **Tablet landscape** — original.
- **Tablet portrait** — original layout works almost unmodified; only
  the right HUD panel got a `max-width:110px` to prevent it creeping
  off the right edge.

Specific HUD constraint: the 3-panel HUD (HULL / PROGRESS / RESOURCES)
overflowed iPhone-class viewports. Fix in [css/style.css:830-858](css/style.css#L830-L858):
- Phone hides the centre PROGRESS panel entirely.
- Phone right panel: 80px max-width, hides "RESOURCES" label and "SCORE " prefix, just shows numbers.
- Tablet-portrait right panel: 110px max-width, same label hiding.
- The "SCORE " prefix in [index.html:33](index.html#L33) was wrapped in a `.lbl-prefix` span specifically so CSS can hide just the prefix without losing the live `<b id="scoreTxt">` number.

Verified across 5 device profiles via Playwright screenshots — see
`test/_screenshots/` for the full set after each iteration.

## Polish pass (added 2026-05)

- **Touch action buttons use inline SVG icons** instead of text labels.
  Crosshair/reticle for FIRE, lightning bolt for BOOST, sparkle for ABILITY,
  cycle-arrow for WEAPON, ‖ for PAUSE. SVG inherits `currentColor` from each
  button so the existing per-skin coloring still works. Defined in
  [index.html:52-94](index.html#L52-L94); `aria-label` on every button for
  screen readers.
- **`#saveBar` z-index bumped to 11** (above `#overlay` at 10) so the
  bar isn't dimmed by the overlay's dark backdrop on menu screens.
  Was looking faded/floating in portrait, now bright and clear.
- **HUD right panel + pause button no longer collide.** The `#tPause`
  touch button sits at top:8px right:8px on phone (40×40) and top:14px
  right:14px on tablet (50×50). The HUD's right `<div class="panel">`
  was sliding under the pause button, clipping `RESOURCES`/`SCORE` text.
  Fixed with `margin-right: 44px` (phone) / `60px` (tablet) on the
  third panel, plus `max-width:80px` (phone) / `110px` (tablet).
- **Difficulty / VS-AI select stacks vertically on touch portrait.**
  The default 3-button row laid out small, especially on tablet portrait
  where there was lots of empty vertical space. `.btn.diff` becomes
  full-width 18px-padded blocks in a column when `body.is-touch.is-portrait`,
  with the BACK button row (`.btnRow:last-of-type`) staying horizontal.

## Music

- 7 Lyria-generated MP3s in `audio/`, **96 kbps stereo** (originals at
  128 kbps preserved in `audio/original/`). Total ~12 MB, down from
  ~16 MB; first-paint (`menu`+`play` eager) is ~3.8 MB instead of ~5 MB.
- Loaded via `<audio>` elements (not WebAudio decode) — gapless loop via `'ended'` re-listen
- Lazy preload: only `menu` + `play` tracks eager-load; boss/enrage/final/victory/gameover
  fetch on demand
- Modes: `setMusicMode('menu'|'play'|'boss'|'boss-enrage'|'final-boss'|'gameover')`
  with 700ms crossfade
- One-shot stinger: `playMusicSting('victory')`
- Volume: scaled by `save.musicVol` (0–100, default 70). `refreshMusicVolume()`
  re-applies live as the slider moves in settings.

## Stability hardening (added 2026-05)

- **`persist()` is wrapped** — iOS Safari private mode + cookie-disabled
  states throw on every `localStorage.setItem`. Without the guard, every
  shop buy / round clear / achievement crashed the game. Now silently
  swallows after a single console warning.
- **Main loop has an error boundary** — a single `update()`/`render()`
  throw used to permanently kill the rAF chain. Now logs first 3 errors
  and continues. The next frame gets a fresh attempt.
- **Corrupt save JSON → `defaultSave()`** — already true via try/catch
  in `loadSave`, but tested explicitly so a refactor can't regress it.
- **No more "forever" setIntervals** — the touch-UI visibility check
  (200ms) and the tutorial poll (150ms) used to run for the entire
  session. Both are now event-driven (`__refreshTouchUI` hook on
  show/hide, `_ensureTutPoll` on phase entry/exit). Static audit test
  enforces this.
- **HUD DOM lookups cached** — `maybeUpdateHud` was calling
  `getElementById` 8× per 60ms tick. Now resolved once per element.
  `fxBar.innerHTML +=` chain replaced with single string-build + cached
  diff (skips DOM write when unchanged).
- **shadowBlur disabled on touch** — see drift postmortem for the
  intercept mechanism in `render()`.

## Security notes

The only user-controlled string in the codebase is `save.username`. It
flows to two places:
1. `textContent` (auto-escaped) in [13-hub.js:302](js/13-hub.js#L302) — safe
2. An attribute value with `"` stripped in [13-hub.js:393](js/13-hub.js#L393) — safe (browser parses the attribute as a string until a closing `"` it can't reach)

Defense in depth at the assignment site: input is filtered to printable
ASCII minus `<>"'\`&`, uppercased, capped at 14 chars. See
[13-hub.js:426-440](js/13-hub.js#L426-L440).

No `eval`, no `new Function()`, no `setTimeout(string)`, no `dangerouslySetInnerHTML`-equivalents on user data. All `innerHTML` writes elsewhere interpolate from hardcoded config tables in `01-core.js`.

## Running tests

```sh
npm test                  # unit tests, ~150ms, zero deps
npm run e2e               # full E2E across 5 device profiles
npm run e2e:tablet        # tablet-landscape + tablet-portrait only
npm run e2e:phone         # phone-landscape + phone-portrait only
npm run e2e:desktop       # desktop only
```

**Unit tests** (`test/*.test.js`, 22 tests) are zero-dependency. They:
- Concatenate all 14 JS files
- Run inside a `node:vm` context with a stubbed `document`/`window`/`canvas`
- Drive `startSurvival`, `update(dt)`, key state directly
- Assert physics, key handling, save schema, boot integrity, and static-audit invariants

**E2E tests** (`test/e2e/*.spec.js`, 50 tests) use Playwright to:
- Boot a real Chromium against `http-server` on :8000 (auto-spawned by Playwright if not already running)
- Run smoke (page errors, globals), drift (start a run, verify ship doesn't move), perf (180-frame timing sample), and screenshots
- Each test runs across 5 device-emulation profiles: `desktop`, `tablet-landscape`, `tablet-portrait`, `phone-landscape`, `phone-portrait`
- Screenshots land in `test/_screenshots/{screen}-{profile}.png` for visual review

**To validate against real iOS Safari** (different rendering quirks):
```sh
npx playwright install webkit
```
Then in `playwright.config.js`, swap the touch projects' `Desktop Chrome`
base for `devices['iPad Pro 11']` / `devices['iPhone 13']`.
