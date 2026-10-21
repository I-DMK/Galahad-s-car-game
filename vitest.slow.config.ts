// Suite lente (npm run test:slow) : simulations de tests/slow/, hors CI (budget de deploy.yml).
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/slow/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'tests/slow/race-objective.test.ts'],
    testTimeout: 1_800_000,
  },
});
