// Course sur tablette simulée : chargement, accélérateur au doigt, course courte jusqu'à l'arrivée, captures.
import { expect, test, type Page } from '@playwright/test';
import {
  SHOTS, frameSteps, gameState, holdFinger, holdFingerUntilRaceTime, hudLayout, pilotIds, progressOf, waitForGame, waitForRaceTime,
  waitForState, type Box, type HudLayout,
} from './helpers';

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

/** Hauteur maximale (px) de la barre de progression (cinq couloirs), décision du papa du 2026-10-24. */
const BAR_MAX_HEIGHT = 60;

/** Les deux boîtes se recouvrent-elles (surface commune non nulle) ? */
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width - 0.01 && b.x < a.x + a.width - 0.01 && a.y < b.y + b.height - 0.01 && b.y < a.y + a.height - 0.01;

/**
 * Mise en page du HUD de course : position, barre, chrono et bouton saut sans recouvrement ; position très grosse (plus
 * que le chrono) et barre en haut, la barre centrée et d'au plus BAR_MAX_HEIGHT px ; cinq petites voitures dans la barre,
 * aux boîtes disjointes (une par couloir, Galahad en haut, plus grosse que celles des copains).
 */
function expectHudLayout(l: HudLayout): void {
  const blocks: [string, Box][] = [['position', l.position], ['barre', l.bar], ['chrono', l.time], ['bouton saut', l.jump]];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      expect(overlap(blocks[i][1], blocks[j][1]), `${blocks[i][0]} et ${blocks[j][0]} se recouvrent`).toBe(false);
    }
  }
  expect(l.bar.height, 'hauteur de la barre').toBeLessThanOrEqual(BAR_MAX_HEIGHT);
  expect(Math.abs(l.bar.x + l.bar.width / 2 - l.viewport.width / 2), 'barre centrée').toBeLessThan(2);
  expect(l.bar.y + l.bar.height, 'barre en haut').toBeLessThan(l.viewport.height * 0.3);
  expect(l.position.y + l.position.height, 'position en haut').toBeLessThan(l.viewport.height * 0.3);
  expect(l.rankFontPx, 'position plus grosse que le chrono').toBeGreaterThan(l.timeFontPx);
  expect(l.markers).toHaveLength(5);
  for (let i = 0; i < 5; i++) {
    const m = l.markers[i];
    expect(m.x, `voiture ${i} dans la barre (gauche)`).toBeGreaterThanOrEqual(l.bar.x - 0.5);
    expect(m.x + m.width, `voiture ${i} dans la barre (droite)`).toBeLessThanOrEqual(l.bar.x + l.bar.width + 0.5);
    expect(m.y, `voiture ${i} dans la barre (haut)`).toBeGreaterThanOrEqual(l.bar.y - 0.5);
    expect(m.y + m.height, `voiture ${i} dans la barre (bas)`).toBeLessThanOrEqual(l.bar.y + l.bar.height + 0.5);
    for (let j = i + 1; j < 5; j++) expect(overlap(m, l.markers[j]), `voitures ${i} et ${j} se recouvrent`).toBe(false);
    if (i > 0) {
      expect(m.y, `couloir ${i} sous le couloir ${i - 1}`).toBeGreaterThan(l.markers[i - 1].y);
      expect(m.height, `la voiture de Galahad est plus grosse que la ${i}`).toBeLessThan(l.markers[0].height);
    }
  }
}

test('HUD : place en ordinal après 1 s, cinq couloirs aux voitures séparées à 30 s et 60 s, mise en page sans recouvrement ; capture course-copains.png', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  // Première seconde de course : la position est vide (texte et temps lus dans le même rappel ; la machine peut avoir
  // été lente à charger : le vide n'est affirmé que si le temps lu est bien sous la seconde).
  const early = await page.evaluate(() => ({
    t: (window as any).__game.time as number,
    text: document.querySelector('.hud-rank')?.textContent ?? null,
    display: getComputedStyle(document.querySelector('.hud-position')!).display,
  }));
  // Le `display:flex` de la position ne doit pas l'emporter sur `hidden` : rien d'affiché, pas même la petite voiture.
  if (early.t < 1) expect({ text: early.text, display: early.display }).toEqual({ text: '', display: 'none' });
  // La barre porte les 5 voitures, une par couloir, celle de Galahad seule distinguée.
  await expect(page.locator('.hud-bar .hud-lane')).toHaveCount(5);
  await expect(page.locator('.hud-bar .hud-lane.is-galahad')).toHaveCount(1);
  await expect(page.locator('.hud-bar .hud-lane').first()).toHaveClass(/is-galahad/);
  // Après 1 s de course : une place en ordinal (« 1er », « 2e »…).
  await waitForRaceTime(page, 1.2);
  const rank = page.locator('.hud-rank');
  await expect(rank).toHaveText(/^(1er|[2-5]e)$/);
  // Sur la grille (tout le monde à 0 %), les cinq petites voitures sont centrées sur le même x : 0 % est au même endroit
  // dans les cinq couloirs, malgré leurs tailles différentes.
  const centres = (await hudLayout(page)).markers.map((m) => m.x + m.width / 2);
  expect(Math.max(...centres) - Math.min(...centres), 'centres des voitures sur la grille').toBeLessThan(0.5);
  // Doigt posé : à 30 s et à 60 s de course, les cinq voitures sont séparées dans la barre (elles se superposaient
  // sur une seule ligne : les copains restent à 20 m de Galahad) et rien du HUD ne se recouvre.
  const percents: number[][] = [];
  for (const t of [30, 60]) {
    await holdFingerUntilRaceTime(page, t);
    expect((await gameState(page)).state).toBe('racing');
    await expect(rank).toHaveText(/^(1er|[2-5]e)$/);
    expectHudLayout(await hudLayout(page));
    percents.push(await page.locator('.hud-marker').evaluateAll((els) => els.map((e) => parseFloat((e as HTMLElement).style.transform.replace(/[^\d.]/g, '')))));
  }
  // Les voitures ont avancé sur la barre, de plus en plus loin de la ligne de départ.
  expect(percents[0][0], 'marqueur de Galahad à 30 s').toBeGreaterThan(5);
  expect(percents[1][0], 'marqueur de Galahad à 60 s').toBeGreaterThan(percents[0][0]);
  for (const l of percents) for (const left of l) expect(left).toBeLessThanOrEqual(100);
  await page.screenshot({ path: `${SHOTS}/course-copains.png`, fullPage: true });
});

test.describe('téléphone en paysage (844 × 390)', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('HUD : position, barre en cinq couloirs et chrono sans recouvrement ni débordement ; capture course-copains-telephone.png', async ({ page }) => {
    await page.goto('./?seed=1&debug=1');
    await waitForGame(page);
    await waitForRaceTime(page, 1.2);
    await holdFinger(page, 5);
    await expect(page.locator('.hud-rank')).toHaveText(/^(1er|[2-5]e)$/);
    const layout = await hudLayout(page);
    expect(layout.viewport).toEqual({ width: 844, height: 390 });
    expectHudLayout(layout);
    await page.screenshot({ path: `${SHOTS}/course-copains-telephone.png`, fullPage: true });
  });
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
