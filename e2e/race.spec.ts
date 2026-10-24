// Course sur tablette simulée : chargement, accélérateur au doigt, course courte jusqu'à l'arrivée, captures.
import { expect, test, type Page } from '@playwright/test';
import { SHOTS, frameSteps, gameState, holdFinger, pilotIds, progressOf, waitForGame, waitForRaceTime, waitForState } from './helpers';

/** Durée maximale doigt posé pour finir une piste de 300 m. */
const MAX_HOLD_S = 90;

/** Doigt posé par tranches de 5 s jusqu'à l'arrivée (au plus MAX_HOLD_S). */
async function driveToFinish(page: Page): Promise<void> {
  const deadline = Date.now() + MAX_HOLD_S * 1000;
  while ((await gameState(page)).state === 'racing' && Date.now() < deadline) {
    await holdFinger(page, 5);
  }
  await waitForState(page, 'finished', 1_000);
}

/** Collecte les erreurs console et les exceptions non rattrapées de la page. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

test('la page charge', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(dims).toEqual({ scrollWidth: 1280, scrollHeight: 800 });
  expect((await gameState(page)).state).toBe('racing');
  const canvas = page.locator('canvas#game');
  await expect(canvas).toHaveCount(1);
  expect(await canvas.evaluate((c) => c.clientWidth)).toBe(1280);
});

test('doigt posé 3 s : la voiture avance', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  const before = (await gameState(page)).progress;
  await holdFinger(page, 3);
  const after = (await gameState(page)).progress;
  expect(after - before).toBeGreaterThan(5);
});

/**
 * Temps de course (s) pendant lequel les copains ne poussent pas Galahad arrêté sur la grille : robots polis (tâche 6,
 * décision du papa) : le copain de rang 1, derrière une voiture presque arrêtée (< POLITE_SPEED) à moins de POLITE_GAP,
 * lève le pied, au plus POLITE_MAX_WAIT = 3 s (ruling Q8 : l'e2e en exige au moins 2). Avant la tâche 6, il le poussait
 * dès ≈ 0,95 s. La politesse sans limite derrière Galahad doigt levé (tâche 7) ne joue qu'après son premier appui
 * (décision du papa, tour 2 de la tâche 7) : sans doigt depuis le départ, on garde ces 3 s au plus.
 */
const BEFORE_ROBOTS_S = 2;

test('sans doigt : la voiture ne part pas toute seule, et les copains ne la poussent pas pendant au moins 2 s', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  const before = await gameState(page);
  expect(before.time).toBeLessThan(0.3);
  // Lu dans le même rappel que le temps : aucun pas de course entre les deux.
  const after = await page.waitForFunction(
    (t) => { const g = (window as any).__game; return g.time >= t ? g.progress('galahad') : false; },
    BEFORE_ROBOTS_S,
  );
  expect(Math.abs((await after.jsonValue()) - before.progress)).toBeLessThan(0.5);
});

test('5 voitures : Galahad en pole, 4 copains distincts derrière lui qui partent ; capture course-5-voitures.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  const ids = await pilotIds(page);
  expect(ids).toHaveLength(5);
  expect(ids[0]).toBe('galahad');
  expect(new Set(ids).size).toBe(5);
  const start = await progressOf(page, ids);
  // Grille en file : Galahad devant, chaque copain 1,5 × CAR_LENGTH = 3,3 m derrière le précédent.
  for (let i = 1; i < 5; i++) expect(start[i - 1] - start[i]).toBeCloseTo(3.3, 1);
  await holdFinger(page, 0.6);
  // Le copain de rang 4 part à 1,2 s ; à 3,5 s les 5 voitures sont groupées à l'écran.
  await waitForRaceTime(page, 3.5);
  const later = await progressOf(page, ids);
  for (let i = 1; i < 5; i++) expect(later[i] - start[i], ids[i]).toBeGreaterThan(1);
  await page.screenshot({ path: `${SHOTS}/course-5-voitures.png`, fullPage: true });
});

test('HUD : position vide au départ puis ordinal, barre à 5 marqueurs sans chevauchement ; capture course-copains.png', async ({ page }) => {
  await page.goto('./?seed=1&len=300&debug=1');
  await waitForGame(page);
  // Première seconde de course : la position est vide (texte lu dans le même rappel que le temps de course).
  const early = await page.evaluate(() => ({
    t: (window as any).__game.time as number,
    text: document.querySelector('.hud-rank')?.textContent ?? null,
  }));
  expect(early.t).toBeLessThan(1);
  expect(early.text).toBe('');
  // La barre porte les 5 voitures, celle de Galahad seule distinguée.
  await expect(page.locator('.hud-bar .hud-marker')).toHaveCount(5);
  await expect(page.locator('.hud-bar .hud-marker.is-galahad')).toHaveCount(1);
  // Après 1 s de course : une place en ordinal (« 1er », « 2e »…).
  await waitForRaceTime(page, 1.2);
  const rank = page.locator('.hud-rank');
  await expect(rank).toHaveText(/^(1er|[2-5]e)$/);
  // Doigt posé : les voitures quittent la grille, les marqueurs avancent (Galahad passe la ligne de départ).
  await holdFinger(page, 6);
  await expect(rank).toHaveText(/^(1er|[2-5]e)$/);
  const lefts = await page.locator('.hud-marker').evaluateAll((els) => els.map((e) => parseFloat((e as HTMLElement).style.left)));
  expect(lefts).toHaveLength(5);
  expect(lefts[0], 'marqueur de Galahad').toBeGreaterThan(0);
  for (const left of lefts) expect(left).toBeLessThanOrEqual(100);
  // Mise en page à 1280 px : position, barre et chrono côte à côte sans se recouvrir.
  const [pos, bar, time] = await Promise.all(['.hud-position', '.hud-bar', '.hud-time'].map((sel) => page.locator(sel).boundingBox()));
  expect(pos!.x + pos!.width).toBeLessThan(bar!.x);
  expect(bar!.x + bar!.width).toBeLessThan(time!.x);
  await page.screenshot({ path: `${SHOTS}/course-copains.png`, fullPage: true });
});

test('debug : compteur d’images à 0 et 2+ pas affiché, frameSteps exposé ; capture compteur-images.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  await page.waitForTimeout(2_000);
  const steps = page.locator('.hud-steps');
  await expect(steps).toBeVisible();
  await expect(steps).toHaveText(/^0 pas : \d+ · 2\+ pas : \d+$/);
  const counts = await frameSteps(page);
  expect(counts.frames).toBeGreaterThan(0);
  // Le HUD affiche exactement les comptes exposés (mis à jour à la clôture de chaque seconde).
  expect(counts.hud).toBe(`0 pas : ${counts.zero} · 2+ pas : ${counts.multi}`);
  await page.screenshot({ path: `${SHOTS}/compteur-images.png`, fullPage: true });
});

test('course courte : arrivée et calque ARRIVÉE, sans erreur console', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = collectErrors(page);
  await page.goto('./?seed=1&len=300&debug=1');
  await waitForGame(page);
  await driveToFinish(page);
  expect((await gameState(page)).state).toBe('finished');
  await expect(page.getByText('ARRIVÉE')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('button[data-no-pedal]', { hasText: 'ENCORE' })).toBeVisible({ timeout: 5_000 });
  expect(errors).toEqual([]);
});

test('captures : course.png et arrivee.png', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  await holdFinger(page, 3);
  await page.screenshot({ path: `${SHOTS}/course.png`, fullPage: true });

  await page.goto('./?seed=1&len=300&debug=1');
  await waitForGame(page);
  await driveToFinish(page);
  await expect(page.getByText('ARRIVÉE')).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: `${SHOTS}/arrivee.png`, fullPage: true });
});
