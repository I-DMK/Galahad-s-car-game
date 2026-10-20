// Aides Playwright : doigt posé (CDP tactile) et lecture de `window.__game` (?debug=1).
import type { Page } from '@playwright/test';

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
