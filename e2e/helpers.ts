// Aides Playwright : doigt posé (CDP tactile) et lecture de `window.__game` (?debug=1).
import type { Page } from '@playwright/test';
import type { StepCounts } from '../src/loop/frame-stats';

export type GameSnapshot = { state: string; time: number; seed: number; progress: number };

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
