// Tests de bout en bout sur une tablette simulée (Lenovo : 1280×800 CSS, DPR 2, tactile).
// Chromium est fourni par PLAYWRIGHT_BROWSERS_PATH (pas d'executablePath ici).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'off',
    trace: 'off',
  },
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'tablet',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
});
