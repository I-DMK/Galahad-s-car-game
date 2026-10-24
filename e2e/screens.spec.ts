// Écrans (plan B, tâche 10) sur la tablette simulée : titre avec les copains de la graine, AUTRE PISTE, décompte, doigt gardé depuis
// JOUER, pause par portrait et reprise sans gaz, police Fredoka servie par le site, captures titre.png, decompte.png, pause.png, tourne.png.
import { expect, test } from '@playwright/test';
import { GALAHAD, defaultPilotSeed, drawPilots } from '../src/cars/pilots';   // purs : pas de matter-js dans le runner Playwright
import { CONFIG } from '../src/config';
import { SHOTS, boxOf, gameState, offSiteRequests, pilotIds, startRace, tapAt, waitForGame, waitForRaceTime, waitForState, type Box } from './helpers';

const expectedIds = (seed: number) => [GALAHAD, ...drawPilots(defaultPilotSeed(seed))].map((p) => p.id);
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('titre : état title, aucun pas, les copains de la graine dans l’ordre de la grille, JOUER et AUTRE PISTE ≥ 96 px, rien sur la bande des voitures ; capture titre.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  expect((await gameState(page)).state).toBe('title');
  await page.waitForTimeout(500);
  expect((await gameState(page)).time).toBe(0);
  expect(await pilotIds(page)).toEqual(expectedIds(1));
  const play = await boxOf(page, '.btn-play');
  const other = await boxOf(page, '.btn-other');
  const name = await boxOf(page, '.title-name');
  const version = await boxOf(page, '.title-version');
  for (const [label, b] of [['JOUER', play], ['AUTRE PISTE', other]] as const) {
    expect(b.width, label).toBeGreaterThanOrEqual(96);
    expect(b.height, label).toBeGreaterThanOrEqual(96);
  }
  // Bande des voitures : du sol (62 % de la hauteur) à 1,9 m au-dessus (voiture 1,4 m + bond 0,5 m), à l'échelle de la vue.
  const { width, height } = page.viewportSize()!;
  const ppm = height / CONFIG.VISIBLE_HEIGHT_M;
  const band: Box = { x: 0, y: 0.62 * height - 1.9 * ppm, width, height: 1.9 * ppm };
  for (const [label, b] of [['JOUER', play], ['AUTRE PISTE', other], ['nom', name], ['version', version]] as const) {
    expect(overlap(b, band), `${label} recouvre les voitures`).toBe(false);
  }
  expect(overlap(play, other)).toBe(false);
  expect(overlap(play, name)).toBe(false);
  await expect(page.locator('.hud-time')).toBeHidden();
  await expect(page.locator('.jump-button')).toBeHidden();
  await page.screenshot({ path: `${SHOTS}/titre.png`, fullPage: true });
});

test('AUTRE PISTE : graine dans l’URL, autres copains, toujours au titre, le tap n’est pas du gaz', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  await tapAt(page, '.btn-other');
  const s = await gameState(page);
  expect(s.state).toBe('title');
  expect(s.seed).not.toBe(1);
  expect(new URL(page.url()).searchParams.get('seed')).toBe(String(s.seed));
  expect(new URL(page.url()).searchParams.get('debug')).toBe('1');
  expect(await pilotIds(page)).toEqual(expectedIds(s.seed));
  expect(await page.evaluate(() => (window as any).__game.throttlePressed)).toBe(false);
});

test('JOUER : décompte 3, 2, 1, PARTEZ sans aucun pas, puis course ; capture decompte.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  await tapAt(page, '.btn-play');
  await waitForState(page, 'countdown', 2_000);
  const text = page.locator('.countdown-text');
  await expect(text).toHaveText('3');
  await page.screenshot({ path: `${SHOTS}/decompte.png`, fullPage: true });
  await expect(text).toHaveText('2', { timeout: 2_000 });
  expect((await gameState(page)).time).toBe(0);
  await expect(text).toHaveText('1', { timeout: 2_000 });
  await expect(text).toHaveText('PARTEZ', { timeout: 2_000 });
  await waitForState(page, 'racing', 1_000);
  await expect(page.locator('.screen-countdown')).toBeHidden({ timeout: 2_000 });
  await expect(page.locator('.hud-time')).toBeVisible();
});

test('doigt gardé posé depuis JOUER à travers le décompte : la voiture part à PARTEZ, et le doigt levé la relâche', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  const b = await boxOf(page, '.btn-play');
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
    await waitForState(page, 'racing', 10_000);
    const x0 = (await gameState(page)).progress;
    await page.waitForFunction((t) => (window as any).__game.time >= t, 2);
    expect((await gameState(page)).progress - x0).toBeGreaterThan(2);
    expect(await page.evaluate(() => (window as any).__game.throttlePressed)).toBe(true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  expect(await page.evaluate(() => (window as any).__game.throttlePressed)).toBe(false);
});

test('portrait en course → TOURNE sans REPRENDRE, course figée ; paysage → PAUSE + REPRENDRE ; doigt tenu sur REPRENDRE → décompte puis course sans gaz ; captures tourne.png, pause.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  // Galahad à l'arrêt sur la grille (sans doigt, les copains ne le poussent pas avant 2 s : race.spec « sans doigt ») : sa progression
  // sert de témoin, le doigt sur REPRENDRE ne doit pas la changer.
  await startRace(page);
  await waitForRaceTime(page, 0.5);
  // JOUER a demandé le plein écran (spec §8), accordé par Chromium headless ; Playwright ne redimensionne pas une fenêtre en
  // plein écran (`Browser.setWindowBounds`) : on en sort d'abord. Sur la tablette, c'est la rotation qui change
  // innerWidth / innerHeight, plein écran ou pas.
  await page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : Promise.resolve()));
  await page.setViewportSize({ width: 800, height: 1280 });
  await waitForState(page, 'paused', 2_000);
  await expect(page.locator('.pause-text')).toHaveText('TOURNE');
  await expect(page.locator('.btn-resume')).toBeHidden();
  await expect(page.locator('.pause-tablet')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/tourne.png`, fullPage: true });
  const { time: t1, progress: x0 } = await gameState(page);
  await page.waitForTimeout(700);
  expect((await gameState(page)).time).toBe(t1);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.pause-text')).toHaveText('PAUSE');
  const resume = await boxOf(page, '.btn-resume');
  expect(Math.min(resume.width, resume.height)).toBeGreaterThanOrEqual(96);
  await page.screenshot({ path: `${SHOTS}/pause.png`, fullPage: true });
  // Doigt posé sur REPRENDRE et GARDÉ à travers le décompte et la première seconde de course : jamais du gaz (data-no-pedal).
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: resume.x + resume.width / 2, y: resume.y + resume.height / 2 }] });
    await waitForState(page, 'countdown', 2_000);
    expect(await page.evaluate(() => (window as any).__game.throttlePressed)).toBe(false);
    await waitForState(page, 'racing', 6_000);
    await waitForRaceTime(page, t1 + 1);
    const after = await gameState(page);
    expect(Math.abs(after.progress - x0), 'le doigt sur REPRENDRE n’a pas fait avancer la voiture').toBeLessThan(0.3);
    expect(await page.evaluate(() => (window as any).__game.throttlePressed)).toBe(false);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
});

test('police : Fredoka chargée depuis le site, aucune requête hors site, texte visible au titre', async ({ page }) => {
  const off = offSiteRequests(page);
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  await expect(page.locator('.btn-play')).toBeVisible();
  // `document.fonts.check` rend vrai même sans @font-face Fredoka : on exige une FontFace Fredoka réellement chargée.
  await page.waitForFunction(() => [...document.fonts].some((f) => /Fredoka/.test(f.family) && f.status === 'loaded'), null, { timeout: 5_000 });
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => /Fredoka/.test(f.family) && f.status === 'loaded').map((f) => f.weight).sort());
  expect(loaded).toEqual(['600', '700']);
  const family = await page.evaluate(() => getComputedStyle(document.querySelector('.title-name')!).fontFamily);
  expect(family).toMatch(/Fredoka/);
  expect(off).toEqual([]);
});

test.describe('téléphone en paysage (844 × 390)', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('titre : boutons ≥ 96 px, dans la fenêtre, sans recouvrement ; capture titre-telephone.png', async ({ page }) => {
    await page.goto('./?seed=1&debug=1');
    await waitForGame(page);
    const play = await boxOf(page, '.btn-play');
    const other = await boxOf(page, '.btn-other');
    const name = await boxOf(page, '.title-name');
    for (const b of [play, other, name]) {
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(844); expect(b.y + b.height).toBeLessThanOrEqual(390);
    }
    expect(Math.min(play.width, play.height)).toBeGreaterThanOrEqual(96);
    expect(Math.min(other.width, other.height)).toBeGreaterThanOrEqual(96);
    expect(overlap(play, other) || overlap(play, name) || overlap(other, name)).toBe(false);
    await page.screenshot({ path: `${SHOTS}/titre-telephone.png`, fullPage: true });
  });
});
