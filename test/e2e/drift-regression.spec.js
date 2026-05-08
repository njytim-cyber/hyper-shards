'use strict';
// E2E drift regression — boots the game, starts a survival run via the
// real DOM click path, then asserts the ship doesn't move with no input.
// This is the in-browser version of test/physics.test.js — needed
// because the static sandbox can't reproduce the bug class that broke
// us originally (parse-time `.onclick = funcName` ReferenceError that
// silently dropped half the menu wiring).

const { test, expect } = require('@playwright/test');

test('starting a run from the menu wires the click correctly and ship stays put', async ({ page }) => {
  page._errors = [];
  page.on('pageerror', err => page._errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') page._errors.push(msg.text());
  });

  await page.goto('/');
  // First user interaction unlocks audio + boots music. Click anywhere.
  await page.mouse.click(10, 10);
  await page.waitForTimeout(200);

  // Drive the click chain: hub PLAY → difficulty MEDIUM.
  // Use page.evaluate rather than .click() because the menu buttons
  // are styled with absolute positioning + animations that can move
  // them between mouse-down and mouse-up.
  await page.evaluate(() => {
    document.querySelector('[data-nav="play"]').click();
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.querySelector('[data-diff="medium"]').click();
  });
  await page.waitForTimeout(300);

  // We should now be in the play phase with a player object.
  const inPlay = await page.evaluate(() => state && state.phase === 'play' && !!player);
  expect(inPlay).toBe(true);

  // Sample the starting position, idle for 2s, sample again.
  const startPos = await page.evaluate(() => ({ x: player.x, y: player.y }));
  await page.waitForTimeout(2000);
  const endPos = await page.evaluate(() => ({ x: player.x, y: player.y }));

  // Allow some movement from enemy ram physics — but nothing close to
  // the "ship pinned to right wall" symptom of the original bug.
  // Original bug: ship moved hundreds of px with no input.
  const dx = Math.abs(endPos.x - startPos.x);
  const dy = Math.abs(endPos.y - startPos.y);
  expect(dx, `ship drifted ${dx.toFixed(1)}px on x with no input`).toBeLessThan(60);
  expect(dy, `ship drifted ${dy.toFixed(1)}px on y with no input`).toBeLessThan(60);

  // No console errors thrown anywhere along the click path.
  expect(page._errors).toEqual([]);
});

test('round transition is seamless — no menuBetween screen', async ({ page }) => {
  await page.goto('/');
  await page.mouse.click(10, 10);
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('[data-nav="play"]').click());
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('[data-diff="medium"]').click());
  await page.waitForTimeout(200);

  // Force-end the round by setting travel past goal + clearing enemies,
  // then drive the next frame. We're testing the FLOW (no menu shows),
  // not the gameplay condition that triggers it.
  await page.evaluate(() => {
    state.toClear = 0;
    state.enemies = [];
    state.travel = (state.travelGoal || 0) + 1;
    // The check happens inside update(); just calling update() suffices.
    // We pass a typical 16ms frame.
    update(16);
  });
  await page.waitForTimeout(100);

  const between = await page.evaluate(() =>
    document.getElementById('menuBetween') !== null
  );
  expect(between, 'menuBetween element should be deleted entirely').toBe(false);
});
