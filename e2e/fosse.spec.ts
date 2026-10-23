// Fosse de lave sur tablette simulée (plan B, tâche 5g, Step 5 ; addendum « bouton saut » §6.4 et §6.7, ruling R-F13).
// Graine 18 : sa première fosse est la plus proche du départ des graines 0 à 49 (bord amont à ≈ 317 m ; graine 31
// jusqu'au tour 1 de la 5g, avant le poids de tirage des volcans 4). Doigt tenu, sans jamais sauter : captures de la
// fosse (lave, halo, langues de feu) et de son panneau, puis deux chutes dans la lave (`__game.respawns`, ?debug=1) ;
// la 2e pose Galahad juste après la fosse (option B) et la course continue.
// Aucune assertion sur un saut à la main à l'instant juste : Playwright n'est pas régulier à 16 ms près (couvert en
// simulation, tests/fosses.test.ts et tests/slow/fosses-fenetres-*.test.ts).
import { expect, test } from '@playwright/test';
import { CONFIG } from '../src/config';
import { defaultTrackLength, generateTrack } from '../src/track/generate';
import { fosses } from '../src/track/query';
import { SHOTS, waitForGame } from './helpers';

const SEED = 18;

test('doigt tenu sans sauter jusqu’à la première fosse : captures, deux chutes, posé après la fosse, la course continue', async ({ page }) => {
  test.setTimeout(150_000);
  const f = fosses(generateTrack(SEED, defaultTrackLength(CONFIG), CONFIG))[0];
  expect(f.xBord).toBeLessThan(400);
  await page.goto(`./?seed=${SEED}&debug=1`);
  await waitForGame(page);
  const progress = (x: number) => page.waitForFunction((xx) => (window as any).__game.progress('galahad') >= xx, x, { timeout: 90_000 });
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 640, y: 400 }] });
    // Le panneau (au début de l'approche, 32 m avant le bord) puis la fosse : la vue fait ≈ 22 m de large.
    await progress(f.xLancement - 4);
    await page.screenshot({ path: `${SHOTS}/fosse-panneau.png` });
    await progress(f.xBord - 12);
    await page.screenshot({ path: `${SHOTS}/fosse.png` });
    await page.waitForFunction(() => (window as any).__game.respawns.length >= 2, undefined, { timeout: 60_000 });
    const respawns: { reason: string; t: number; x: number; targetX: number }[] = await page.evaluate(() => (window as any).__game.respawns);
    expect(respawns.slice(0, 2).map((r) => r.reason)).toEqual(['lava', 'lava']);
    // 1re chute : retour au point sûr, avant l'approche (au plus xLancement + 5) ; 2e : juste après la fosse.
    expect(respawns[0].targetX).toBeLessThan(f.xLancement + CONFIG.SAFE_LANCEMENT_MARGIN);
    expect(respawns[1].targetX).toBeGreaterThanOrEqual(f.xReception + CONFIG.FOSSE_RESPAWN_AFTER - 1e-6);
    expect(respawns[1].targetX).toBeLessThan(f.xReception + CONFIG.FOSSE_GHOST_AFTER);
    // La course continue : Galahad dépasse la fin de la réception.
    await progress(f.xEnd + 5);
    expect(await page.evaluate(() => (window as any).__game.state)).toBe('racing');
    expect((await page.evaluate(() => (window as any).__game.respawns)).length).toBe(2);
  } finally {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
    await cdp.detach();
  }
});
