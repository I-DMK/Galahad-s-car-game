import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  // Version affichée au titre (tâche 10 ; décision Q3 du papa : celle de package.json, montée à chaque tâche déployée).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: {
    globals: true,
    environment: 'node',
    // Suites lentes dans tests/slow/ : npm run test:slow et test:slow:race (vitest.slow*.config.ts).
    include: ['tests/*.test.ts'],
    testTimeout: 180_000,
    // Vitest 5 masque les console.log des tests verts : les mesures imprimées doivent rester visibles.
    silent: false,
  },
});
