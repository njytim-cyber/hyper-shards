// Playwright config — minimal, no plugins.
// Tests live in test/e2e/ so they don't collide with the node:test suite
// in test/*.test.js (which runs via `npm test`).

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/e2e',
  testMatch: /.*\.spec\.js$/,
  // Single worker — these tests share the http-server on :8000 and run
  // fast enough that parallelism doesn't buy much.
  workers: 1,
  // Each test gets one retry to ride out transient asset-load flakes
  // (audio fetches, font swaps).
  retries: 1,
  timeout: 20_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Auto-start a static server on :8000 if none is already running.
  // `reuseExistingServer` means iterating with a long-lived dev server
  // (python -m http.server, http-server, Live Server) just works.
  webServer: {
    command: 'npx http-server -p 8000 -s -c-1',
    port: 8000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  // Three projects map to the three device tiers we care about. All run
  // on Chromium for now — covers the JS code paths and our IS_PHONE /
  // IS_TABLET detection. To validate iOS Safari quirks specifically
  // (backdrop-filter behavior, AudioContext autoplay rules, real Touch
  // events), `npx playwright install webkit` and switch the tablet/phone
  // projects back to `devices['iPad Pro 11']` / `devices['iPhone 13']`.
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'tablet-landscape',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 2, hasTouch: true, isMobile: false,
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    },
    {
      name: 'tablet-portrait',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2, hasTouch: true, isMobile: false,
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    },
    {
      name: 'phone-landscape',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 844, height: 390 },
        deviceScaleFactor: 3, hasTouch: true, isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    },
    {
      name: 'phone-portrait',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3, hasTouch: true, isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    },
  ],
});
