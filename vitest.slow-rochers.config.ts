// Chocs des copains contre les rochers à 5 voitures par bras (npm run test:slow:rochers, plan C tâche 11c, ruling
// R-11c-5) : hors de npm run test:slow (≈ 17 min mur par fichier, 48 graines × 3 courses).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/slow/robots-rochers-*.test.ts'],
    testTimeout: 1_800_000,
    silent: false,
  },
});
