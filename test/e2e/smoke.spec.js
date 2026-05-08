'use strict';
// E2E smoke test — page actually loads in a real browser without
// throwing. Catches things that node:vm with stubbed DOM cannot:
//   - real Canvas2D context behavior
//   - actual <audio> / AudioContext init
//   - layout-dependent code (the hub scene's getBoundingClientRect)
//   - touch + viewport detection against real device profiles

const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Surface any browser-side error onto the test result.
  page._errors = [];
  page.on('pageerror', err => page._errors.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') page._errors.push(`console.error: ${msg.text()}`);
  });
});

test('boots without page or console errors', async ({ page }) => {
  await page.goto('/');
  // Wait for the rAF loop to run a few frames so any first-frame init
  // errors have a chance to fire.
  await page.waitForTimeout(500);
  expect(page._errors).toEqual([]);
});

test('exposes critical globals after boot', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(300);
  const probe = await page.evaluate(() => ({
    hasState: typeof state === 'object',
    hasSave: typeof save === 'object',
    hasStartSurvival: typeof startSurvival === 'function',
    hasUpdate: typeof update === 'function',
    hasResetKeys: typeof resetKeys === 'function',
    isTouch: typeof isTouch !== 'undefined' ? isTouch : null,
    isPhone: typeof IS_PHONE !== 'undefined' ? IS_PHONE : null,
    isTablet: typeof IS_TABLET !== 'undefined' ? IS_TABLET : null,
  }));
  expect(probe.hasState).toBe(true);
  expect(probe.hasSave).toBe(true);
  expect(probe.hasStartSurvival).toBe(true);
  expect(probe.hasUpdate).toBe(true);
  expect(probe.hasResetKeys).toBe(true);
});

test('device classification matches the project profile', async ({ page, browserName }, testInfo) => {
  await page.goto('/');
  await page.waitForTimeout(300);
  const flags = await page.evaluate(() => ({
    isTouch: isTouch,
    IS_PHONE,
    IS_TABLET,
    bodyClasses: document.body.className,
  }));
  // Project names are e.g. 'phone-portrait', 'tablet-landscape'. Match by prefix.
  const project = testInfo.project.name;
  if (project === 'desktop') {
    expect(flags.isTouch).toBe(false);
    expect(flags.IS_PHONE).toBe(false);
    expect(flags.IS_TABLET).toBe(false);
  } else if (project.startsWith('phone')) {
    expect(flags.isTouch).toBe(true);
    expect(flags.IS_PHONE).toBe(true);
    expect(flags.IS_TABLET).toBe(false);
    expect(flags.bodyClasses).toContain('is-phone');
  } else if (project.startsWith('tablet')) {
    expect(flags.isTouch).toBe(true);
    expect(flags.IS_PHONE).toBe(false);
    expect(flags.IS_TABLET).toBe(true);
    expect(flags.bodyClasses).toContain('is-tablet');
  }
});
