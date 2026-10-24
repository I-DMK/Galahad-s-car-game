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

test('images : __game.art complet sur la tablette simulée, Galahad en l’air (hauteur de vol lue avant et après la capture) ; capture course-sprites.png', async ({ page }) => {
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
  // Galahad est bien en l'air (hauteur de sa roue la plus basse, celle qui règle son ombre) avant et après la capture.
  const airHeight = () => page.evaluate(() => (window as any).__game.airHeight as number);
  expect(await airHeight()).toBeGreaterThan(0.5);
  await page.screenshot({ path: `${SHOTS}/course-sprites.png`, fullPage: true });
  expect(await airHeight()).toBeGreaterThan(0.5);
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

test('turbo : les images de flamme sont vraiment dessinées à l’arrière de Galahad ; capture course-sprites-turbo.png', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror : ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console : ${m.text()}`); });
  // Note le nom de fichier de chaque image passée à drawImage du vrai canvas (le ciel, un canvas, n'en a pas).
  await page.addInitScript(() => {
    const drawn = new Set<string>();
    (window as any).__drawn = drawn;
    const original = CanvasRenderingContext2D.prototype.drawImage as (...a: unknown[]) => void;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, img: unknown, ...rest: unknown[]) {
      const src = (img as { src?: string } | null)?.src;
      if (src) drawn.add(src.split('/').pop()!);
      return original.call(this, img, ...rest);
    } as typeof CanvasRenderingContext2D.prototype.drawImage;
  });
  // Graine 5 : Galahad prend une étoile dans les premières secondes, doigt posé.
  await page.goto('./?seed=5&debug=1');
  await waitForGame(page);
  await waitForArt(page);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 640, y: 400, id: 0 }] });
    // Au moins 1 s de turbo restant : les flammes tournent encore pendant la capture.
    await page.waitForFunction(() => { const g = (window as any).__game; return g.sim.cars[0].state.turboUntil > g.time + 1; }, null, { timeout: 60_000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/course-sprites-turbo.png`, fullPage: true });
    const drawn: string[] = await page.evaluate(() => [...(window as any).__drawn]);
    expect(drawn.filter((f) => /^flame-\d\.png$/.test(f)).length, `images dessinées : ${drawn.join(', ')}`).toBeGreaterThanOrEqual(2);
    expect(drawn).toContain('galahad.png');
    expect(drawn).toContain('wheel.png');
  } finally {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }
  expect(errors).toEqual([]);
});
