// Mesure du rattrapage à 5 voitures (npm run test:slow:rattrapage, plan B tâche 5d) : à la demande, hors de
// npm run test:slow (≈ 7 min mur). Étape : RATTRAPAGE_ETAPE ; référence : RATTRAPAGE_REF (défaut « avant ») ;
// rapport unique après les deux fichiers (globalSetup).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/slow/rattrapage-*.test.ts'],
    globalSetup: ['tests/helpers/rattrapage-rapport.ts'],
    testTimeout: 1_800_000,
    silent: false,
  },
});
