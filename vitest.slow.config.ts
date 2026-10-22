// Suite lente (npm run test:slow) : simulations de tests/slow/, hors CI (budget de deploy.yml). La mesure du
// rattrapage (tests/slow/rattrapage-*.test.ts) en est exclue : npm run test:slow:rattrapage, à la demande.
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/slow/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'tests/slow/race-objective.test.ts', 'tests/slow/rattrapage-*.test.ts'],
    testTimeout: 1_800_000,
    silent: false,
  },
});
