// Images du jeu (plan B, tâche 8b) sur la tablette simulée : les 13 images se chargent (sous la base du site : la même
// spec rejoue sur l'aperçu de build et sur le site en ligne), la capture montre Galahad en l'air avec son ombre, et une
// image bloquée donne une voiture mi-image mi-code sans exception, la course roulant.
import { expect, test, type Page } from '@playwright/test';
import { SHOTS, gameState, holdFinger, holdFingerAndTapJump, jumpState, waitForGame } from './helpers';

/** Les 13 images attendues, triées (`src/render/assets.ts`, `ART_FILES`). */
const ART = [
  'diego.png', 'flame-0.png', 'flame-1.png', 'flame-2.png', 'flame-3.png', 'galahad.png', 'liam.png', 'malo.png',
  'matthis.png', 'pablo.png', 'star.png', 'timothe.png', 'wheel.png',
];

/** `__game.art` (debug) : images réglées, fichiers chargés et en échec. */
async function waitForArt(page: Page): Promise<{ settled: boolean; loaded: string[]; failed: string[] }> {
  await page.waitForFunction(() => (window as any).__game.art.settled, null, { timeout: 10_000 });
  return page.evaluate(() => (window as any).__game.art);
}

test('images : __game.art complet sur la tablette simulée, Galahad en l’air avec son ombre ; capture course-sprites.png', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror : ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console : ${m.text()}`); });
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  const art = await waitForArt(page);
  expect(art.failed).toEqual([]);
  expect([...art.loaded].sort()).toEqual(ART);

  const { throttleWithB } = await holdFingerAndTapJump(page, 2.5, 0.3);
  expect(throttleWithB).toBe(true);
  expect((await jumpState(page)).jumps).toBe(1);
  await page.screenshot({ path: `${SHOTS}/course-sprites.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('une carrosserie bloquée (galahad.png) : repli par code, la course roule sans exception', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror : ${e.message}`));
  // La requête bloquée écrit « Failed to load resource » dans la console : attendu, pas une erreur du jeu.
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(`console : ${m.text()}`); });
  await page.route('**/sprites/galahad.png', (route) => route.abort());
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  const art = await waitForArt(page);
  expect(art.failed).toEqual(['galahad.png']);
  expect(art.loaded).toHaveLength(12);

  const before = (await gameState(page)).progress;
  await holdFinger(page, 2);
  const after = await gameState(page);
  expect(after.state).toBe('racing');
  expect(after.progress - before).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});
