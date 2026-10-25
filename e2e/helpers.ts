// Aides Playwright : doigt posé (CDP tactile) et lecture de `window.__game` (?debug=1).
import type { Page } from '@playwright/test';
import type { StepCounts } from '../src/loop/frame-stats';

export type GameSnapshot = { state: string; time: number; seed: number; progress: number };

/** Dossier des captures : `e2e/screenshots` en local ; celui que fixe `playwright.live.config.ts` sur le site en ligne. */
export const SHOTS = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
  .E2E_SHOTS ?? 'e2e/screenshots';

/** Pose un doigt au centre de l'écran (640, 400 à 1 280 × 800) pendant `seconds`, puis le lève. */
export async function holdFinger(page: Page, seconds: number): Promise<void> {
  const size = page.viewportSize() ?? { width: 1280, height: 800 };
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: size.width / 2, y: size.height / 2 }],
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

/** Durée maximale doigt posé pour finir une piste de 300 m. */
export const MAX_HOLD_S = 90;

/**
 * Doigt posé par tranches de `chunkS` s jusqu'à l'arrivée de Galahad (au plus MAX_HOLD_S) ; rend dès que l'état n'est
 * plus `racing` : `finished`, ou déjà `podium` (tâche 11) si la dernière tranche a duré plus que la roue libre (1,5 s).
 */
export async function driveToFinish(page: Page, chunkS = 5): Promise<void> {
  const deadline = Date.now() + MAX_HOLD_S * 1000;
  while ((await gameState(page)).state === 'racing' && Date.now() < deadline) await holdFinger(page, chunkS);
  await page.waitForFunction(() => ['finished', 'podium'].includes((window as any).__game.state), null, { timeout: 1_000 });
}

/** Collecte les erreurs console et les exceptions non rattrapées de la page. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

/** Attend que le jeu soit exposé (`window.__game`) après une navigation. */
export async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__game !== undefined);
}

/** Boîte d'un élément (px CSS, repère de la fenêtre). */
export type Box = { x: number; y: number; width: number; height: number };

/** Boîte de `selector` (px CSS) ; lève si absent ou caché. */
export async function boxOf(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} : introuvable ou caché`);
  return box;
}

/** Tap tactile (CDP) au centre de l'élément `selector` ; `holdMs` entre touchStart et touchEnd. */
export async function tapAt(page: Page, selector: string, holdMs = 80): Promise<void> {
  const b = await boxOf(page, selector);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
    await page.waitForTimeout(holdMs);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

/**
 * Depuis le titre (tâche 10 ; décision Q1 du papa : le vrai chemin de Galahad, pas de raccourci d'URL) : tap (CDP tactile,
 * touchStart puis touchEnd) au centre du bouton `.btn-play`, puis attente de `racing` (décompte compris, ≤ 10 s).
 */
export async function startRace(page: Page): Promise<void> {
  await tapAt(page, '.btn-play');
  await waitForState(page, 'racing', 10_000);
}

/**
 * Collecte (tableau rempli au fil des requêtes) les adresses dont l'origine n'est pas celle du document (origine de la
 * première requête de navigation). À brancher avant `goto`. Police et images doivent venir du site (addendum §2).
 */
export function offSiteRequests(page: Page): string[] {
  const off: string[] = [];
  let origin: string | null = null;
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (origin === null) {
      if (!req.isNavigationRequest()) return;
      origin = url.origin;
    }
    if (url.origin !== origin) off.push(req.url());
  });
  return off;
}

/**
 * Retarde de `ms` ms chaque requête d'image du jeu (`sprites/*.png`, tâche 8b). La course part sans attendre les images
 * (addendum §1.2) mais l'événement `load` de la page, lui, les attend : c'est ce que fait un réseau lent (≈ 0,5 s en ligne,
 * rien en local). Un test qui lit le temps de course juste après l'ouverture de la page ouvre alors avec
 * `waitUntil: 'domcontentloaded'` et impose ce retard pour que la précondition ne dépende pas de la vitesse du réseau.
 */
export async function delaySprites(page: Page, ms: number): Promise<void> {
  await page.route('**/sprites/*.png', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    try { await route.continue(); } catch { /* page fermée entre-temps */ }
  });
}

/** Attend que le temps de course simulé atteigne `t` s (indépendant de la cadence d'affichage). */
export async function waitForRaceTime(page: Page, t: number): Promise<void> {
  await page.waitForFunction((tt) => (window as any).__game.time >= tt, t);
}

/** Doigt posé par tranches d'une seconde jusqu'à ce que le temps de course atteigne `t` s (dépassement d'au plus 1 s). */
export async function holdFingerUntilRaceTime(page: Page, t: number): Promise<void> {
  while ((await gameState(page)).time < t) await holdFinger(page, 1);
}

/** Mise en page du HUD de course : blocs, petites voitures de la barre (dans l'ordre de la grille) et tailles de police. */
export interface HudLayout {
  viewport: { width: number; height: number };
  position: Box;
  bar: Box;
  time: Box;
  jump: Box;
  /** Drapeau à damier au bout de la barre, côté arrivée. */
  flag: Box;
  /** Boîte de l'icône (petite voiture) de chacun des marqueurs de la barre, Galahad d'abord. */
  markers: Box[];
  /** Bouton pause sous le chrono (tâche 11, Partie 5) ; null s'il est caché. */
  pause: Box | null;
  rankFontPx: number;
  timeFontPx: number;
}

/**
 * Mise en page du HUD (`.hud-position`, `.hud-bar`, `.hud-time`, `.jump-button`, `.hud-flag`, `.hud-marker svg`, et
 * `.pause-button` s'il est montré) lue dans un même rappel.
 */
export async function hudLayout(page: Page): Promise<HudLayout> {
  return page.evaluate(() => {
    const box = (el: Element | null): Box => {
      if (!el) throw new Error('élément du HUD introuvable');
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const fontPx = (sel: string): number => parseFloat(getComputedStyle(document.querySelector(sel)!).fontSize);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      position: box(document.querySelector('.hud-position')),
      bar: box(document.querySelector('.hud-bar')),
      time: box(document.querySelector('.hud-time')),
      jump: box(document.querySelector('.jump-button')),
      flag: box(document.querySelector('.hud-flag')),
      markers: [...document.querySelectorAll('.hud-marker svg')].map(box),
      pause: ((el) => (!el || el.hidden ? null : box(el)))(document.querySelector<HTMLElement>('.pause-button')),
      rankFontPx: fontPx('.hud-rank'),
      timeFontPx: fontPx('.hud-time'),
    };
  });
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

/** Rochers vus par le jeu (tâche 11c, ?debug=1) : chocs de Galahad, par voiture, rochers de la piste, encore dessinés. */
export interface RockSnapshot {
  rocksHit: number; byCar: Record<string, number>; rocks: { xStart: number; xEnd: number }[]; active: number;
  x: number; speed: number; respawns: number; state: string;
}

/** Instantané des rochers et de Galahad (nécessite `debug=1` dans l'URL). */
export async function rockSnapshot(page: Page): Promise<RockSnapshot> {
  return page.evaluate(() => {
    const g = (window as any).__game;
    return {
      rocksHit: g.rocksHit, byCar: g.rocksHitByCar, rocks: g.rocks, active: g.sceneRocksActive,
      x: g.progress('galahad'), speed: g.speed('galahad'), respawns: g.respawns.length, state: g.state,
    };
  });
}
