// Course sur tablette simulée : chargement (titre), JOUER, voiture qui roule seule dès PARTEZ sans aucun doigt (tâche 11d),
// tape hors du bouton saut sans effet, course courte jusqu'à l'arrivée (le podium : `podium.spec.ts`), captures.
// Depuis la tâche 10, la page arrive au TITRE : chaque test lance la course par le vrai bouton JOUER (`startRace`, décision
// Q1 du papa), décompte de 3 s compris.
import { expect, test, type Page } from '@playwright/test';
import {
  SHOTS, boxOf, frameSteps, gameState, hudLayout, jumpState, pilotIds, progressOf, startRace, tapAt, tapPoint, waitForFinish,
  waitForGame, waitForRaceTime, waitForState, type Box, type HudLayout,
} from './helpers';

test('la page charge', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(dims).toEqual({ scrollWidth: 1280, scrollHeight: 800 });
  expect((await gameState(page)).state).toBe('title');
  const canvas = page.locator('canvas#game');
  await expect(canvas).toHaveCount(1);
  expect(await canvas.evaluate((c) => c.clientWidth)).toBe(1280);
  await startRace(page);
  expect((await gameState(page)).state).toBe('racing');
});

/** Progression de Galahad (m) et temps de course (s), lus dans le même rappel (aucun pas entre les deux). */
const atRaceTime = async (page: Page, t: number): Promise<{ x: number; t: number }> => (await (await page.waitForFunction(
  (tt) => { const g = (window as any).__game; return g.time >= tt ? { x: g.progress('galahad') as number, t: g.time as number } : null; },
  t,
)).jsonValue()) as { x: number; t: number };

test('sans aucun doigt (tâche 11d) : la grille ne bouge pas pendant le décompte, puis la voiture part à PARTEZ et avance toute seule, gaz à fond ; capture course-sans-doigt.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  // Le tap de JOUER (touchStart puis touchEnd en 80 ms) est levé bien avant PARTEZ : aucun doigt n'est posé ensuite.
  await tapAt(page, '.btn-play');
  await waitForState(page, 'countdown', 2_000);
  const grid = await gameState(page);
  await page.waitForTimeout(1_500);
  const still = await gameState(page);
  expect(still.state).toBe('countdown');
  expect(still.time, 'aucun pas pendant le décompte').toBe(0);
  expect(still.progress).toBe(grid.progress);
  expect((await jumpState(page)).galahadThrottle, 'aucun gaz avant PARTEZ').toBe(false);
  await waitForState(page, 'racing', 5_000);
  // Le temps de course part à PARTEZ (tâche 10) : lu quelques images après `waitForState('racing')`, il est encore sous 0,3 s.
  const start = await gameState(page);
  expect(start.time).toBeLessThan(0.3);
  const a = await atRaceTime(page, 1);
  const b = await atRaceTime(page, 3);
  expect(a.x - grid.progress, 'partie à PARTEZ').toBeGreaterThan(0.5);
  expect(b.x - a.x, 'elle avance toute seule').toBeGreaterThan(5);
  expect((await jumpState(page)).galahadThrottle, 'gaz à fond sans doigt').toBe(true);
  await page.screenshot({ path: `${SHOTS}/course-sans-doigt.png`, fullPage: true });
  const c = await atRaceTime(page, 5);
  expect(c.x, 'x croît encore').toBeGreaterThan(b.x + 5);
});

test('une tape hors du bouton saut pendant la course (tâche 11d) : ni saut, ni pause, la voiture roule toujours seule', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  await startRace(page);
  await waitForRaceTime(page, 1);
  const jump = await boxOf(page, '.jump-button');
  const { width, height } = page.viewportSize()!;
  // Au centre, sur le ciel, juste à droite du bouton saut, et un appui long (1 s) au centre.
  const spots = [
    { x: width / 2, y: height / 2, ms: 80 }, { x: width * 0.75, y: height * 0.3, ms: 80 },
    { x: jump.x + jump.width + 30, y: jump.y + jump.height / 2, ms: 150 }, { x: width / 2, y: height / 2, ms: 1_000 },
  ];
  for (const p of spots) {
    const before = await gameState(page);
    await tapPoint(page, p.x, p.y, p.ms);
    await page.waitForTimeout(300);
    const after = await gameState(page);
    expect(after.state, `tape en (${p.x}, ${p.y})`).toBe('racing');
    expect(after.progress, `la voiture roule toujours après la tape en (${p.x}, ${p.y})`).toBeGreaterThan(before.progress);
    expect(await jumpState(page), `tape en (${p.x}, ${p.y})`).toEqual({ jumps: 0, galahadThrottle: true });
  }
  await expect(page.locator('.screen-pause')).toBeHidden();
});

test('5 voitures : Galahad en pole, 4 copains distincts derrière lui qui partent ; capture course-5-voitures.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  await startRace(page);
  const ids = await pilotIds(page);
  expect(ids).toHaveLength(5);
  expect(ids[0]).toBe('galahad');
  expect(new Set(ids).size).toBe(5);
  const start = await progressOf(page, ids);
  // Grille en file : Galahad devant, chaque copain 1,5 × CAR_LENGTH = 3,3 m derrière le précédent.
  for (let i = 1; i < 5; i++) expect(start[i - 1] - start[i]).toBeCloseTo(3.3, 1);
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
 * Mise en page du HUD de course : position, barre, drapeau d'arrivée, chrono et bouton saut sans recouvrement ; position
 * très grosse (plus que le chrono) et barre en haut, la barre centrée et d'au plus BAR_MAX_HEIGHT px ; drapeau à droite de
 * la barre, de sa hauteur, dans la fenêtre, sans toucher aucune petite voiture (même à 100 %) ; cinq petites voitures dans
 * la barre, aux boîtes disjointes (une par couloir, Galahad en haut, plus grosse que celles des copains).
 */
function expectHudLayout(l: HudLayout): void {
  const blocks: [string, Box][] = [
    ['position', l.position], ['barre', l.bar], ['drapeau', l.flag], ['chrono', l.time], ['bouton saut', l.jump],
  ];
  // Bouton pause (tâche 11, Partie 5), montré en course : aucun recouvrement avec le reste du HUD, ≥ 96 px, dans la fenêtre.
  if (l.pause) {
    blocks.push(['bouton pause', l.pause]);
    expect(Math.min(l.pause.width, l.pause.height), 'bouton pause ≥ 96 px').toBeGreaterThanOrEqual(96);
    expect(l.pause.x + l.pause.width, 'bouton pause dans la fenêtre').toBeLessThanOrEqual(l.viewport.width);
    expect(l.pause.y + l.pause.height, 'bouton pause dans la fenêtre').toBeLessThanOrEqual(l.viewport.height);
  }
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      expect(overlap(blocks[i][1], blocks[j][1]), `${blocks[i][0]} et ${blocks[j][0]} se recouvrent`).toBe(false);
    }
  }
  expect(l.bar.height, 'hauteur de la barre').toBeLessThanOrEqual(BAR_MAX_HEIGHT);
  expect(l.flag.x, 'drapeau à droite de la barre (côté arrivée)').toBeGreaterThanOrEqual(l.bar.x + l.bar.width - 0.5);
  expect(l.flag.x + l.flag.width, 'drapeau dans la fenêtre').toBeLessThanOrEqual(l.viewport.width);
  expect(Math.abs(l.flag.height - l.bar.height), 'drapeau de la hauteur de la barre').toBeLessThanOrEqual(1);
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
    expect(overlap(m, l.flag), `la voiture ${i} touche le drapeau`).toBe(false);
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
  // La première seconde de course se lit juste après JOUER et le décompte (tâche 10 : le temps part à PARTEZ).
  await startRace(page);
  // Première seconde de course : la position est vide (texte et temps lus dans le même rappel ; la machine peut avoir
  // été lente : le vide n'est affirmé que si le temps lu est bien sous la seconde).
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
  // La voiture roule seule : à 30 s et à 60 s de course, les cinq voitures sont séparées dans la barre (elles se
  // superposaient sur une seule ligne : les copains restent à 20 m de Galahad) et rien du HUD ne se recouvre.
  const percents: number[][] = [];
  for (const t of [30, 60]) {
    await waitForRaceTime(page, t);
    expect((await gameState(page)).state).toBe('racing');
    await expect(rank).toHaveText(/^(1er|[2-5]e)$/);
    const l = await hudLayout(page);
    expect(l.pause, 'bouton pause montré en course').not.toBeNull();
    expectHudLayout(l);
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
    await startRace(page);
    await waitForRaceTime(page, 6.2);
    await expect(page.locator('.hud-rank')).toHaveText(/^(1er|[2-5]e)$/);
    const layout = await hudLayout(page);
    expect(layout.viewport).toEqual({ width: 844, height: 390 });
    expect(layout.pause, 'bouton pause montré en course').not.toBeNull();
    expectHudLayout(layout);
    await page.screenshot({ path: `${SHOTS}/course-copains-telephone.png`, fullPage: true });
  });
});

test('debug : compteur d’images à 0 et 2+ pas affiché, frameSteps exposé ; capture compteur-images.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  // Le compteur d'images compte les pas de course : il n'apparaît qu'en course.
  await startRace(page);
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

test('captures : course.png, course-copains-arrivee.png (Galahad au drapeau), puis podium', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  await startRace(page);
  await waitForRaceTime(page, 3);
  await page.screenshot({ path: `${SHOTS}/course.png`, fullPage: true });

  await page.goto('./?seed=1&len=300&debug=1');
  await waitForGame(page);
  await startRace(page);
  // La capture suit l'arrivée de Galahad de près (première image `finished`), avant le podium (1,5 s de roue libre).
  await waitForFinish(page);
  const layout = await hudLayout(page);
  // Galahad à 100 % : sa petite voiture est au bout de son couloir, collée au drapeau sans le toucher.
  expect(layout.markers[0].x + layout.markers[0].width, 'Galahad au bout de la barre').toBeGreaterThanOrEqual(layout.bar.x + layout.bar.width - 1.5);
  expect(layout.flag.x - (layout.markers[0].x + layout.markers[0].width), 'Galahad ne touche pas le drapeau').toBeGreaterThanOrEqual(0);
  expectHudLayout(layout);
  await page.screenshot({ path: `${SHOTS}/course-copains-arrivee.png`, fullPage: true });
  await waitForState(page, 'podium', 5_000);
  await expect(page.locator('.screen-podium')).toBeVisible();
});
