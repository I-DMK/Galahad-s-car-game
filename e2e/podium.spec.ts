// Podium (plan B, tâche 11) sur la tablette simulée : course courte (?len=300) jusqu'au podium, 1,5 s après l'arrivée ;
// trois marches (prénoms du classement final), temps de Galahad, ENCORE et MENU ; Galahad 4e à côté du podium, à 1280 × 800
// puis 844 × 390 ; doigt de gaz encore posé + ENCORE (deux doigts) ; captures podium.png, podium-4e.png, podium-telephone.png.
import { expect, test, type Page } from '@playwright/test';
import {
  SHOTS, boxOf, collectErrors, driveToFinish, gameState, pilotIds, startRace, tapAt, waitForGame, waitForState, type Box,
} from './helpers';

type Podium = { order: string[]; galahadPlace: number; time: number };
const podiumOf = (page: Page) => page.evaluate(() => (window as any).__game.podium as Podium | null);
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Mise en page : temps, marches, case de Galahad (si montrée) et boutons dans la fenêtre, sans recouvrement ; boutons ≥ 96 px. */
async function expectPodiumLayout(page: Page): Promise<void> {
  const { width, height } = page.viewportSize()!;
  const blocks: [string, Box][] = [
    ['temps', await boxOf(page, '.podium-time')], ['marches', await boxOf(page, '.podium-row')],
    ['ENCORE', await boxOf(page, '.btn-again')], ['MENU', await boxOf(page, '.btn-menu')],
  ];
  if (await page.locator('.podium-me').isVisible()) blocks.push(['case de Galahad', await boxOf(page, '.podium-me')]);
  for (const [label, b] of blocks) {
    expect(b.x, label).toBeGreaterThanOrEqual(0);
    expect(b.y, label).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, label).toBeLessThanOrEqual(width);
    expect(b.y + b.height, label).toBeLessThanOrEqual(height);
  }
  for (const [label, b] of blocks.slice(2, 4)) expect(Math.min(b.width, b.height), label).toBeGreaterThanOrEqual(96);
  // La case de Galahad est dans la rangée des marches : on compare temps, rangée et boutons.
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    expect(overlap(blocks[i][1], blocks[j][1]), `${blocks[i][0]} et ${blocks[j][0]} se recouvrent`).toBe(false);
  }
}

test('course courte jusqu’au podium : 1,5 s de roue libre, puis marches du classement final, temps de Galahad, ENCORE et MENU ; aucun pas ; confettis si Galahad 1er ; sans erreur console ; capture podium.png ; ENCORE → même course', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = collectErrors(page);
  await page.goto('./?seed=1&len=300&debug=1');
  await waitForGame(page);
  await startRace(page);
  await driveToFinish(page, 0.5);
  expect((await gameState(page)).state).toBe('finished');
  await expect(page.locator('.screen-podium')).toBeHidden();
  await waitForState(page, 'podium', 5_000);
  const podium = (await podiumOf(page))!;
  const t = (await gameState(page)).time;
  await page.waitForTimeout(500);
  expect((await gameState(page)).time, 'aucun pas au podium').toBe(t);
  const pilots: [string, string][] = await page.evaluate(() => (window as any).__game.pilots.map((p: { id: string; name: string }) => [p.id, p.name]));
  const nameOf = new Map(pilots);
  expect(await page.locator('.podium-step .podium-name').allTextContents()).toEqual([1, 0, 2].map((k) => nameOf.get(podium.order[k])));
  await expect(page.locator('.podium-time')).toHaveText(/^\d\d:\d\d$/);
  await expectPodiumLayout(page);
  if (podium.galahadPlace === 1) {
    await expect(page.locator('.step-1')).toHaveClass(/is-galahad/);
    await page.waitForFunction(() => (window as any).__game.confetti > 20);
  } else {
    test.info().annotations.push({ type: 'podium', description: `Galahad ${podium.galahadPlace}e sur seed=1 len=300` });
  }
  await page.waitForTimeout(800);   // pluie bien lancée pour la capture
  await page.screenshot({ path: `${SHOTS}/podium.png`, fullPage: true });
  const ids = await pilotIds(page);
  const seed = (await gameState(page)).seed;
  await tapAt(page, '.btn-again');
  await waitForState(page, 'countdown', 2_000);
  await expect(page.locator('.screen-podium')).toBeHidden();
  expect(await pilotIds(page)).toEqual(ids);
  const after = await gameState(page);
  expect(after.seed).toBe(seed);
  expect(after.time).toBe(0);
  expect(errors).toEqual([]);
});

test('doigt de gaz encore posé à l’arrivée + tap sur ENCORE de l’autre doigt : décompte ; le doigt sur ENCORE n’est pas du gaz', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('./?seed=1&len=300&debug=1');
  await waitForGame(page);
  await startRace(page);
  // Doigt A posé en course (gaz) et GARDÉ jusqu'au podium : avec lui sur l'écran, le `click` d'un second doigt ne part pas
  // toujours ; ENCORE doit répondre au `pointerdown` (A7).
  const { width, height } = page.viewportSize()!;
  const a = { x: width / 2, y: height / 2, id: 0 };
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    await page.waitForFunction(() => (window as any).__game.state === 'podium', null, { timeout: 120_000 });
    expect(await page.evaluate(() => (window as any).__game.throttlePressed), 'doigt A toujours posé').toBe(true);
    const e = await boxOf(page, '.btn-again');
    const b = { x: e.x + e.width / 2, y: e.y + e.height / 2, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
    await waitForState(page, 'countdown', 2_000);
    // A levé, B encore posé sur ENCORE (caché sous le doigt, jamais retiré du DOM) : plus de gaz. Ce Chromium ne lève un seul
    // doigt que par un `touchEnd` qui le nomme (mesuré : un `touchMove` ou un `touchStart` sans A ne lève pas A).
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [a] });
    expect(await page.evaluate(() => (window as any).__game.throttlePressed), 'le doigt sur ENCORE n’est pas du gaz').toBe(false);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  expect((await gameState(page)).state).toBe('countdown');   // le click éventuel du doigt B n'a rien relancé
});

test('Galahad 4e : sa place à côté du podium, pas de confettis ; tient en 844 × 390 ; MENU → titre ; captures podium-4e.png, podium-telephone.png', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('./?seed=1&len=300&debug=1');
  await waitForGame(page);
  await startRace(page);
  // Trois copains déclarés arrivés dès le départ par la poignée de débogage (A12) : ils freinent sur la grille derrière
  // Galahad ; le quatrième, poli, reste derrière eux. Seul chemin déterministe vers « Galahad 4e ».
  await page.evaluate(() => { const g = (window as any).__game; for (const i of [1, 2, 3]) g.sim.cars[i].state.finishedAt = 0.1 * i; });
  await driveToFinish(page);
  await waitForState(page, 'podium', 5_000);
  expect((await podiumOf(page))!.galahadPlace).toBe(4);
  await expect(page.locator('.podium-me')).toBeVisible();
  await expect(page.locator('.podium-me-place')).toHaveText('4e');
  await expect(page.locator('.podium-me .podium-name')).toHaveText('Galahad');
  await expect(page.locator('.podium-step.is-galahad')).toHaveCount(0);
  await expectPodiumLayout(page);
  expect(await page.evaluate(() => (window as any).__game.confetti)).toBe(0);
  await page.screenshot({ path: `${SHOTS}/podium-4e.png`, fullPage: true });
  // Téléphone en paysage : sortir du plein écran (accordé au pointerup de JOUER) avant de changer la fenêtre.
  await page.evaluate(() => document.exitFullscreen?.().catch(() => {}));
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(844);
  expect((await gameState(page)).state).toBe('podium');
  await expectPodiumLayout(page);
  await page.screenshot({ path: `${SHOTS}/podium-telephone.png`, fullPage: true });
  await tapAt(page, '.btn-menu');
  await waitForState(page, 'title', 2_000);
  await expect(page.locator('.screen-title')).toBeVisible();
  await expect(page.locator('.screen-podium')).toBeHidden();
  await page.waitForTimeout(500);
  expect((await gameState(page)).seed, 'MENU au doigt seul : pas d’AUTRE PISTE fantôme').toBe(1);
});

test('doigt de gaz encore posé + tap sur MENU de l’autre doigt : titre, même graine et mêmes copains (aucun AUTRE PISTE fantôme) (cr 2, tour 1)', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('./?seed=1&len=300&debug=1');
  await waitForGame(page);
  await startRace(page);
  const ids = await pilotIds(page);
  const { width, height } = page.viewportSize()!;
  const a = { x: width / 2, y: height / 2, id: 0 };
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    await page.waitForFunction(() => (window as any).__game.state === 'podium', null, { timeout: 120_000 });
    const m = await boxOf(page, '.btn-menu');
    const b = { x: m.x + m.width / 2, y: m.y + m.height / 2, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
    await page.waitForTimeout(80);
    expect((await gameState(page)).state, 'MENU n’agit pas au pointerdown (A20)').toBe('podium');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [b] });   // B levé, A encore posé
    await waitForState(page, 'title', 2_000);
    await page.waitForTimeout(500);   // un click fantôme du tap aurait eu le temps de partir
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  await page.waitForTimeout(300);
  const s = await gameState(page);
  expect(s.state).toBe('title');
  expect(s.seed, 'graine inchangée : pas d’AUTRE PISTE').toBe(1);
  expect(await pilotIds(page)).toEqual(ids);
  expect(new URL(page.url()).searchParams.get('seed')).toBe('1');
});
