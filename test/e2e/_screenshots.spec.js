'use strict';
// One-off screenshot capture across device tiers. Not a real test —
// just produces images we can eyeball to audit the UX.
// Run with: npx playwright test _screenshots.spec.js

const { test } = require('@playwright/test');
const path = require('path');

const OUT = path.resolve(__dirname, '../../test/_screenshots');

test('hub menu', async ({ page }, info) => {
  await page.goto('/');
  await page.mouse.click(10, 10);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `hub-${info.project.name}.png`), fullPage: false });
});

test('difficulty select', async ({ page }, info) => {
  await page.goto('/');
  await page.mouse.click(10, 10);
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('[data-nav="play"]').click());
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `diff-${info.project.name}.png`), fullPage: false });
});

test('in-game', async ({ page }, info) => {
  await page.goto('/');
  await page.mouse.click(10, 10);
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('[data-nav="play"]').click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('[data-diff="medium"]').click());
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `play-${info.project.name}.png`), fullPage: false });
});

test('shop', async ({ page }, info) => {
  await page.goto('/');
  await page.mouse.click(10, 10);
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('[data-nav="shop"]').click());
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `shop-${info.project.name}.png`), fullPage: false });
});
