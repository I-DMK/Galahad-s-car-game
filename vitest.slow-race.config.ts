// Objectif de course à 5 voitures (npm run test:slow:race, addendum §2) : fichier créé par la tâche
// « élastique » ; vide pour l'instant (passWithNoTests).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/slow/race-objective.test.ts'],
    passWithNoTests: true,
    testTimeout: 1_800_000,
  },
});
