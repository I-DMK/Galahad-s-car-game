// « Ce que le bouton rend à Galahad » (npm run test:slow:bouton, plan B tâche 7, Step 6) : lecture des étapes du
// rattrapage (tests/slow/out/rattrapage-*.jsonl), à la demande, hors de npm run test:slow ; < 1 s.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/slow/bouton.test.ts'],
    testTimeout: 60_000,
    silent: false,
  },
});
