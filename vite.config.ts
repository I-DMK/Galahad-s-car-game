import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  test: {
    globals: true,
    environment: 'node',
    // Suites lentes dans tests/slow/ : npm run test:slow et test:slow:race (vitest.slow*.config.ts).
    include: ['tests/*.test.ts'],
    testTimeout: 180_000,
  },
});
