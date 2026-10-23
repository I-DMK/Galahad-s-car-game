// Les mêmes tests de bout en bout, rejoués sur le site déployé (GitHub Pages) au lieu du serveur local :
// `npm run e2e:live`, après chaque déploiement. Adresse changeable par E2E_LIVE_URL ; captures dans
// test-results/live-screenshots (celles du dépôt, e2e/screenshots, ne sont pas touchées). Les URL des tests sont
// relatives (`./?seed=…`) pour rester sous le chemin du site.
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

process.env.E2E_SHOTS ??= 'test-results/live-screenshots';

export default defineConfig({
  ...base,
  outputDir: 'test-results/live',
  webServer: undefined,
  use: { ...base.use, baseURL: process.env.E2E_LIVE_URL ?? 'https://i-dmk.github.io/Galahad-s-car-game/' },
});
