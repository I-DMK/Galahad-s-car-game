// Aides Playwright : taps (CDP tactile) et lecture de `window.__game` (?debug=1). Depuis la tâche 11d, la voiture de
// Galahad roule toute seule après PARTEZ : aucune aide ne pose plus de doigt de gaz.
import type { Page } from '@playwright/test';
import type { StepCounts } from '../src/loop/frame-stats';

export type GameSnapshot = { state: string; time: number; seed: number; progress: number };

/** Dossier des captures : `e2e/screenshots` en local ; celui que fixe `playwright.live.config.ts` sur le site en ligne. */
export const SHOTS = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
  .E2E_SHOTS ?? 'e2e/screenshots';

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

/** Durée maximale (s, temps réel) pour finir une piste de 300 m, la voiture roulant seule. */
export const MAX_RACE_S = 90;

/**
 * Attend l'arrivée de Galahad (au plus MAX_RACE_S) : la voiture roule seule depuis PARTEZ (tâche 11d). Rend à la
 * première image `finished` (avant le podium, 1,5 s de roue libre plus tard) ; `podium` est aussi accepté.
 */
export async function waitForFinish(page: Page): Promise<void> {
  await page.waitForFunction(() => ['finished', 'podium'].includes((window as any).__game.state), null, {
    timeout: MAX_RACE_S * 1000, polling: 'raf',
  });
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

/** Tap tactile (CDP) au point (x, y) (px CSS) ; `holdMs` entre touchStart et touchEnd. */
export async function tapPoint(page: Page, x: number, y: number, holdMs = 80): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(holdMs);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

/** Tap tactile (CDP) au centre de l'élément `selector` ; `holdMs` entre touchStart et touchEnd. */
export async function tapAt(page: Page, selector: string, holdMs = 80): Promise<void> {
  const b = await boxOf(page, selector);
  await tapPoint(page, b.x + b.width / 2, b.y + b.height / 2, holdMs);
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

/**
 * Sauts de Galahad et gaz qu'il a reçu au dernier pas de course (`window.__game.jumps`, `galahadThrottle`, ?debug=1 ;
 * tâche 11d : le gaz est donné par le jeu, plus par un doigt).
 */
export async function jumpState(page: Page): Promise<{ jumps: number; galahadThrottle: boolean }> {
  return page.evaluate(() => {
    const g = (window as any).__game;
    return { jumps: g.jumps as number, galahadThrottle: g.galahadThrottle as boolean };
  });
}

/** Tap seul sur le bouton saut (CDP tactile) : doigt posé au centre du bouton pendant `holdMs`, puis levé. */
export async function tapJump(page: Page, holdMs = 150): Promise<void> {
  const b = await jumpButtonCenter(page);
  await tapPoint(page, b.x, b.y, holdMs);
}

/**
 * Taps sur le bouton saut jusqu'à un saut compté (au plus `tries`), chacun quand le bouton est prêt (pas `is-waiting`).
 * La voiture roule (tâche 11d) : une bosse peut la tenir en l'air au-delà de la tolérance de sol entre la lecture du bouton
 * et le tap ; le saut est alors refusé et la demande consommée. Rend le nombre de sauts.
 */
export async function tapJumpUntilJump(page: Page, tries = 10, holdMs = 150): Promise<number> {
  for (let k = 0; k < tries && (await jumpState(page)).jumps === 0; k++) {
    await page.waitForFunction(() => !document.querySelector('.jump-button')!.classList.contains('is-waiting'), null, { polling: 'raf' });
    await tapJump(page, holdMs);
    await page.waitForTimeout(100);
  }
  return (await jumpState(page)).jumps;
}

/**
 * Un doigt posé ailleurs et un tap de l'autre sur le bouton saut (CDP tactile, deux points) : doigt A posé en (640, 400)
 * (il ne fait rien, tâche 11d) ; `afterS` s plus tard, doigt B posé au centre du bouton ; 0,2 s plus tard, B levé
 * (`touchEnd` qui le nomme, leçon de la session 7) ; `holdS` s plus tard, A levé.
 */
export async function restFingerAndTapJump(page: Page, afterS = 1, holdS = 1): Promise<void> {
  const a = { x: 640, y: 400, id: 0 };
  const b = { ...(await jumpButtonCenter(page)), id: 1 };
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    await page.waitForTimeout(afterS * 1000);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
    await page.waitForTimeout(200);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [b] });
    await page.waitForTimeout(holdS * 1000);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
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
