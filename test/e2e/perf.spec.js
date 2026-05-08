'use strict';
// E2E perf measurement — records frame deltas during gameplay and
// asserts the average frame time stays below a threshold appropriate
// for each device tier. Designed to flag regressions, not to be a
// fine-grained profile.

const { test, expect } = require('@playwright/test');

// Per-device frame-time targets (ms). Generous on touch because
// Playwright's iPad emulation isn't a real iPad — these are guard rails
// against catastrophic regressions, not benchmarks.
function targetFor(name){
  if (name === 'desktop') return 22;
  if (name.startsWith('tablet')) return 28;
  if (name.startsWith('phone')) return 32;
  return 30;
}

test('avg frame time stays within budget during a 3s gameplay sample', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.mouse.click(10, 10);
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('[data-nav="play"]').click());
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('[data-diff="medium"]').click());
  await page.waitForTimeout(500);

  // Hook a frame timing recorder onto rAF. Sample for 3s of real time.
  const frames = await page.evaluate(async () => {
    const samples = [];
    let last = performance.now();
    return new Promise(resolve => {
      function tick(now) {
        samples.push(now - last);
        last = now;
        if (samples.length < 180) requestAnimationFrame(tick);
        else resolve(samples);
      }
      requestAnimationFrame(tick);
    });
  });

  // Drop the first 10 frames (warm-up) and compute average.
  const trimmed = frames.slice(10);
  const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  const p95 = [...trimmed].sort((a, b) => a - b)[Math.floor(trimmed.length * 0.95)];

  const budget = targetFor(testInfo.project.name);
  console.log(`  [perf:${testInfo.project.name}] avg=${avg.toFixed(2)}ms p95=${p95.toFixed(2)}ms (budget ${budget}ms)`);

  // Soft-assert: warn on p95 spike but only fail on average regression.
  expect(avg, `avg frame time ${avg.toFixed(2)}ms exceeds ${budget}ms budget`).toBeLessThan(budget);
});
