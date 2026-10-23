// Objectif de course à 5 voitures sous élastique (npm run test:slow:race, addendum §2 ; plan B, tâche 7, Step 5) :
// tests/slow/race-objective.test.ts (modèle D7-1 et sauteur, graines 0 à 19) et race-objective-leve.test.ts (doigt levé
// 30 %, graines 0 à 9), en parallèle.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/slow/race-objective*.test.ts'],
    silent: false,
    testTimeout: 1_800_000,
  },
});
