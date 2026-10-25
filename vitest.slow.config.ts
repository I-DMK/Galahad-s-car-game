// Suite lente (npm run test:slow) : simulations de tests/slow/, hors CI (budget de deploy.yml). En sont exclus : la mesure
// du rattrapage (tests/slow/rattrapage-*.test.ts : npm run test:slow:rattrapage, à la demande), l'objectif de course
// (tests/slow/race-objective*.test.ts : npm run test:slow:race) et sa lecture « ce que le bouton rend »
// (tests/slow/bouton.test.ts : npm run test:slow:bouton) (tâche 7) ; les chocs des copains contre les rochers par bras
// (tests/slow/robots-rochers-*.test.ts : npm run test:slow:rochers, tâche 11c, ruling R-11c-5).
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/slow/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'tests/slow/race-objective*.test.ts', 'tests/slow/rattrapage-*.test.ts', 'tests/slow/bouton.test.ts', 'tests/slow/robots-rochers-*.test.ts'],
    testTimeout: 1_800_000,
    silent: false,
  },
});
