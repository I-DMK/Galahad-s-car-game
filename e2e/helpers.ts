// Aides Playwright : doigt posé (CDP tactile) et lecture de `window.__game` (?debug=1).
import type { Page } from '@playwright/test';
import type { StepCounts } from '../src/loop/frame-stats';

export type GameSnapshot = { state: string; time: number; seed: number; progress: number };

/** Dossier des captures : `e2e/screenshots` en local ; celui que fixe `playwright.live.config.ts` sur le site en ligne. */
export const SHOTS = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
  .E2E_SHOTS ?? 'e2e/screenshots';

/** Pose un doigt au centre de l'écran pendant `seconds`, puis le lève. */
export async function holdFinger(page: Page, seconds: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 640, y: 400 }],
    });
    await page.waitForTimeout(seconds * 1000);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

/** Instantané de la partie (nécessite `debug=1` dans l'URL). */
export async function gameState(page: Page): Promise<GameSnapshot> {
  return page.evaluate(() => {
    const g = (window as any).__game;
    return { state: g.state, time: g.time, seed: g.seed, progress: g.progress('galahad') };
  });
}

/** Attend que `window.__game.state === state` (lève une erreur au-delà de `timeoutMs`). */
export async function waitForState(page: Page, state: string, timeoutMs: number): Promise<void> {
  await page.waitForFunction(
    (s) => (window as any).__game?.state === s,
    state,
    { timeout: timeoutMs },
  );
}

/** Attend que le jeu soit exposé (`window.__game`) après une navigation. */
export async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__game !== undefined);
}

/** Attend que le temps de course simulé atteigne `t` s (indépendant de la cadence d'affichage). */
export async function waitForRaceTime(page: Page, t: number): Promise<void> {
  await page.waitForFunction((tt) => (window as any).__game.time >= tt, t);
}

/** Ids des pilotes (`window.__game.pilots`), dans l'ordre de la grille : Galahad puis les 4 copains. */
export async function pilotIds(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__game.pilots.map((p: { id: string }) => p.id));
}

/** Progression (m) de chaque voiture `ids`. */
export async function progressOf(page: Page, ids: string[]): Promise<number[]> {
  return page.evaluate((list) => list.map((id) => (window as any).__game.progress(id) as number), ids);
}

/**
 * Images de la dernière seconde (`window.__game.frameSteps`, ?debug=1) : total, à 0 pas, à 2 pas ou plus,
 * et texte du compteur du HUD (`.hud-steps`), lus dans le même rappel.
 */
export async function frameSteps(page: Page): Promise<StepCounts & { hud: string | null }> {
  return page.evaluate(() => ({
    ...(window as any).__game.frameSteps,
    hud: document.querySelector('.hud-steps')?.textContent ?? null,
  }));
}

type Point = { x: number; y: number };

/** Centre (px CSS) du bouton saut. */
export async function jumpButtonCenter(page: Page): Promise<Point> {
  const box = await page.locator('.jump-button').boundingBox();
  if (!box) throw new Error('bouton saut introuvable');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Sauts de Galahad et doigt de gaz (`window.__game.jumps`, `throttlePressed`, ?debug=1). */
export async function jumpState(page: Page): Promise<{ jumps: number; throttlePressed: boolean }> {
  return page.evaluate(() => {
    const g = (window as any).__game;
    return { jumps: g.jumps as number, throttlePressed: g.throttlePressed as boolean };
  });
}

/**
 * Tap seul sur le bouton saut (CDP tactile) : doigt posé au centre du bouton pendant `holdMs`, puis levé.
 * Rend `throttlePressed` lu pendant l'appui.
 */
export async function tapJump(page: Page, holdMs = 150): Promise<{ throttleDuring: boolean }> {
  const b = await jumpButtonCenter(page);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...b, id: 1 }] });
    await page.waitForTimeout(holdMs);
    const { throttlePressed } = await jumpState(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return { throttleDuring: throttlePressed };
  } finally {
    await cdp.detach();
  }
}

/**
 * Gaz d'un doigt et tap de l'autre (CDP tactile, deux points) : doigt A posé en (640, 400) ; `afterS` s plus
 * tard, doigt B posé au centre du bouton ; 0,2 s plus tard, `touchMove` avec A seul (CDP relâche B par
 * comparaison avec l'événement précédent) ; `holdS` s plus tard, A levé. Rend `throttlePressed` lu juste
 * après la pose de B et juste après son relâchement : le gaz doit rester posé.
 */
export async function holdFingerAndTapJump(
  page: Page, afterS = 1, holdS = 2,
): Promise<{ throttleWithB: boolean; throttleAfterB: boolean }> {
  const a = { x: 640, y: 400, id: 0 };
  const b = { ...(await jumpButtonCenter(page)), id: 1 };
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    await page.waitForTimeout(afterS * 1000);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
    const throttleWithB = (await jumpState(page)).throttlePressed;
    await page.waitForTimeout(200);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [a] });
    const throttleAfterB = (await jumpState(page)).throttlePressed;
    await page.waitForTimeout(holdS * 1000);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return { throttleWithB, throttleAfterB };
  } finally {
    await cdp.detach();
  }
}
