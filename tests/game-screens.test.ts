// @vitest-environment jsdom
// Câblage de `Game` aux écrans (plan B, tâche 10 ; spec §4 « Machine d'états », §8 « Entrée tactile » et « Écrans »,
// addendum « présentation » §2) : titre → JOUER → décompte (aucun pas) → PARTEZ → course ; pause par popstate, onglet
// caché ou portrait, reprise par un décompte à 3 sans toucher au chrono ; historique stable ; AUTRE PISTE ; podium (roue
// libre, classement figé, confettis, ENCORE et MENU, tâche 11) ; erreurs de rendu et de pas. Même harnais que
// tests/hud.test.ts : faux requestAnimationFrame, `performance.now` à 0, contexte vide, `Renderer.resize`/`draw`/`drawTitle`
// et `paintCarIcon` interceptés.
import Matter from 'matter-js';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CONFIG } from '../src/config';
import { Game } from '../src/game';
import { cameraTarget } from '../src/loop/frame';
import { Renderer } from '../src/render/renderer';
import { posesOf, rankEntriesOf, type RaceSim } from '../src/sim/simulate';
import { rankCars } from '../src/cars/ranking';
import { formatTime } from '../src/ui/hud';
import { defaultPilotSeed, drawPilots, GALAHAD } from '../src/cars/pilots';
import { placeCar } from '../src/physics/car';
import { heightAt } from '../src/track/query';
import { startRacing } from './helpers/racing';

const DT = CONFIG.PHYSICS_DT;
let raf: FrameRequestCallback | null = null;
const disposers: (() => void)[] = [];
let drawn: { title: number; race: number };
let painted: string[] = [];

beforeEach(() => {
  raf = null;
  drawn = { title: 0, race: 0 };
  painted = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { raf = cb; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as unknown as RenderingContext);
  vi.spyOn(Renderer.prototype, 'resize').mockImplementation(() => {});
  vi.spyOn(Renderer.prototype, 'draw').mockImplementation(() => { drawn.race++; });
  vi.spyOn(Renderer.prototype, 'drawTitle').mockImplementation(() => { drawn.title++; });
  // Le faux contexte `{}` lèverait dans `drawCar` ; l'exception remonterait au `try` de `frame` → `error`.
  vi.spyOn(Renderer.prototype, 'paintCarIcon').mockImplementation((_canvas, pilot) => { painted.push(pilot.id); });
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
});
afterEach(() => {
  for (const d of disposers.splice(0)) d();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  document.body.innerHTML = ''; document.head.innerHTML = '';
  history.replaceState(null, '', '/');
});

interface Internals {
  sim: RaceSim; stop(): void; throttle: { dispose(): void; pressed: boolean }; jumpInput: { dispose(): void; pending: boolean };
  historyArmed: boolean; effects: { count: number; confettiCount: number; spawnSparks(x: number, y: number): void }; camera: { x: number; y: number };
}
function makeGame(seed = 1, debug = false) {
  const canvas = document.createElement('canvas');
  const root = document.createElement('div');
  document.body.append(canvas, root);
  const game = new Game(canvas, root, { seed, length: 1680, debug, version: '1.1.0' });
  const internals = () => game as unknown as Internals;
  disposers.push(() => { internals().stop(); internals().throttle.dispose(); internals().jumpInput.dispose(); });
  const q = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  return { game, root, q, internals };
}
const pointer = (type: string, id: number, target: EventTarget = window) => {
  const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'pointerId', { value: id }); target.dispatchEvent(e);
};
const frames = (n: number, now: number, stepMs = DT * 1000): number => { for (let i = 0; i < n; i++) { now += stepMs; raf!(now); } return now; };
const setOrientation = (w: number, h: number) => {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
  window.dispatchEvent(new Event('resize'));
};

test('start : titre, scène du titre dessinée, aucune course dessinée, HUD de course et bouton saut cachés, sim figée', () => {
  const { game, q, internals } = makeGame();
  game.start();
  expect(game.state).toBe('title');
  expect(q('.screen-title').hidden).toBe(false);
  frames(30, 0, 1000 / 60);
  expect(drawn).toEqual({ title: 30, race: 0 });
  expect(internals().sim.time).toBe(0);
  for (const sel of ['.hud-time', '.hud-bar', '.hud-position', '.jump-button']) expect(q(sel).hidden, sel).toBe(true);
  expect(q('.title-version').textContent).toBe('v1.1.0');
  expect(game.pilots.map((p) => p.id)).toEqual([GALAHAD, ...drawPilots(defaultPilotSeed(1))].map((p) => p.id));
});

test('JOUER (pointerdown) → décompte 3, 2, 1 sans aucun pas, PARTEZ la première seconde de course, puis course ; HUD visible, bouton saut grisé pendant le décompte', () => {
  const { game, q, internals } = makeGame();
  game.start();
  let now = 0;
  pointer('pointerdown', 1, q('.btn-play'));
  expect(game.state).toBe('countdown');
  expect(q('.screen-title').hidden).toBe(true);
  expect(q('.hud-time').hidden).toBe(false);
  expect(q('.jump-button').hidden).toBe(false);
  now += 1000 / 60; raf!(now);
  expect(q('.jump-button').classList.contains('is-waiting')).toBe(true);   // grisé : pas de saut pendant le décompte
  const texts: string[] = [q('.countdown-text').textContent!];
  let i = 1;
  // Images de 1/60 s jusqu'au passage en course : l'image qui fait passer à `racing` ne fait aucun pas (le premier pas est à l'image suivante).
  for (; game.state === 'countdown' && i < 200; i++) {
    now += 1000 / 60; raf!(now);
    const t = q('.countdown-text').textContent!;
    if (texts[texts.length - 1] !== t) texts.push(t);
    expect(internals().sim.time, `image ${i}`).toBe(0);
  }
  expect(game.state).toBe('racing');
  expect(i).toBeGreaterThanOrEqual(178);   // ≈ 3 s à 60 images par seconde, aux arrondis près
  expect(i).toBeLessThanOrEqual(182);
  expect(texts).toEqual(['3', '2', '1', 'PARTEZ']);
  expect(game.countdownText).toBe('PARTEZ');
  expect(drawn.race).toBeGreaterThan(170);   // la grille est dessinée pendant le décompte
  // Première seconde de course : PARTEZ affiché, la course avance ; puis le calque se retire.
  now = frames(30, now);
  expect(internals().sim.time).toBeCloseTo(30 * DT, 6);
  expect(q('.screen-countdown').hidden).toBe(false);
  now = frames(40, now);
  expect(q('.screen-countdown').hidden).toBe(true);
  expect(game.countdownText).toBeNull();
});

test('doigt gardé posé depuis JOUER : Galahad avance dès PARTEZ ; le pointerup sur le bouton caché relâche le gaz', () => {
  const { game, q, internals } = makeGame();
  game.start();
  pointer('pointerdown', 4, q('.btn-play'));
  expect(internals().throttle.pressed).toBe(true);
  let now = startRacing(game, () => raf!, 0);   // ne touche pas au doigt : le décompte s'écoule avec le doigt posé
  const x0 = game.progress('galahad');
  now = frames(120, now);
  expect(game.progress('galahad') - x0).toBeGreaterThan(2);
  pointer('pointerup', 4, q('.btn-play'));
  expect(internals().throttle.pressed).toBe(false);
});

test('startRacing : helper → racing, time 0 au premier pas', () => {
  const { game } = makeGame();
  const now = startRacing(game, () => raf!);
  expect(game.state).toBe('racing');
  expect(now).toBeGreaterThanOrEqual(CONFIG.COUNTDOWN_SECONDS * 1000);
  expect(game.time).toBe(0);
});

test('pause en course (popstate) : PAUSE + REPRENDRE, sim figée, demande de saut jetée ; REPRENDRE → décompte à 3 → la course reprend au même temps', () => {
  const { game, q, internals } = makeGame();
  pointer('pointerdown', 1);
  let now = startRacing(game, () => raf!);
  now = frames(120, now);
  const t0 = internals().sim.time;
  const x0 = game.progress('galahad');
  pointer('pointerdown', 9, q('.jump-button'));
  expect(internals().jumpInput.pending).toBe(true);
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(game.state).toBe('paused');
  expect(q('.pause-text').textContent).toBe('PAUSE');
  expect(q('.btn-resume').hidden).toBe(false);
  now = frames(60, now);
  expect(internals().sim.time).toBe(t0);
  expect(internals().jumpInput.pending).toBe(false);
  q('.btn-resume').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('countdown');
  expect(q('.countdown-text').textContent).toBe('3');
  now = frames(3, now, 1000);
  expect(game.state).toBe('racing');
  expect(internals().sim.time).toBe(t0);
  expect(game.progress('galahad')).toBe(x0);
  now = frames(10, now);
  expect(internals().sim.time).toBeCloseTo(t0 + 10 * DT, 6);
  expect(game.jumps).toBe(0);
});

test('onglet caché pendant le décompte → pause ; le retour visible ne reprend pas tout seul ; REPRENDRE relance le décompte à 3', () => {
  const { game, q } = makeGame();
  game.start();
  game.play();
  frames(1, 0, 1500);
  expect(q('.countdown-text').textContent).toBe('2');
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(game.state).toBe('paused');
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(game.state).toBe('paused');
  game.resume();
  expect(game.state).toBe('countdown');
  expect(q('.countdown-text').textContent).toBe('3');
});

test('portrait pendant le décompte → TOURNE, REPRENDRE caché et inactif ; paysage → PAUSE + REPRENDRE ; tap → décompte à 3', () => {
  const { game, q } = makeGame();
  game.start();
  game.play();
  setOrientation(800, 1280);
  expect(game.state).toBe('paused');
  expect(game.portrait).toBe(true);
  expect(q('.pause-text').textContent).toBe('TOURNE');
  expect(q('.btn-resume').hidden).toBe(true);
  game.resume();
  expect(game.state).toBe('paused');   // refusé en portrait
  setOrientation(1280, 800);
  expect(q('.pause-text').textContent).toBe('PAUSE');
  expect(q('.btn-resume').hidden).toBe(false);
  q('.btn-resume').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('countdown');
  expect(q('.countdown-text').textContent).toBe('3');
});

test('portrait au titre : rien ne change (pas de pause au titre) ; JOUER tapé en portrait → décompte puis TOURNE aussitôt', () => {
  const { game, q } = makeGame();
  game.start();
  setOrientation(800, 1280);
  expect(game.state).toBe('title');
  expect(q('.screen-pause').hidden).toBe(true);
  game.play();
  expect(game.state).toBe('paused');
  expect(q('.pause-text').textContent).toBe('TOURNE');
  setOrientation(1280, 800);
  game.resume();
  expect(game.state).toBe('countdown');
});

test('portrait lu à l’entrée en décompte, sans événement resize (CR6)', () => {
  const { game, q } = makeGame();
  game.start();   // paysage (1280 × 800)
  expect(game.portrait).toBe(false);
  // La fenêtre passe en portrait sans que `resize` ne soit envoyé : JOUER doit relire l'orientation lui-même.
  Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 1280, configurable: true });
  game.play();
  expect(game.portrait).toBe(true);
  expect(game.state).toBe('paused');
  expect(q('.pause-text').textContent).toBe('TOURNE');
});

test('portrait lu dès start() sans resize préalable (fenêtre déjà en portrait au chargement)', () => {
  Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 1280, configurable: true });
  const { game } = makeGame();
  game.start();
  expect(game.portrait).toBe(true);
});

test('le bouton saut caché le reste malgré son display:flex : règle .jump-button[hidden]{display:none}', () => {
  makeGame().game.start();
  const rules = [...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
  expect(rules.find((r) => r.selectorText === '.jump-button')?.style.display).toBe('flex');
  expect(rules.find((r) => r.selectorText === '.jump-button[hidden]')?.style.display).toBe('none');
});

test('fps (debug) compté au titre et pendant le décompte, pas seulement en course', () => {
  const { game, q } = makeGame(1, true);
  game.start();
  frames(70, 0, 1000 / 60);   // > 1 s au titre
  expect(q('.hud-fps').hidden).toBe(false);
  expect(q('.hud-fps').textContent).toMatch(/^\d+ fps$/);
});

test('historique : une entrée poussée au premier décompte, consommée par popstate, repoussée à la reprise ; replaceState sinon (pile stable)', () => {
  const { game, internals } = makeGame();
  game.start();
  const len0 = history.length;
  game.play();
  expect(history.length).toBe(len0 + 1);
  window.dispatchEvent(new PopStateEvent('popstate'));   // jsdom ne dépile pas tout seul : on simule le navigateur
  expect(game.state).toBe('paused');
  game.resume();
  expect(history.length).toBe(len0 + 2);   // repoussée (le navigateur réel avait dépilé la première)
  // Sans popstate entre-temps : une vraie arrivée puis ENCORE ne poussent rien de plus (replaceState : l'entrée est encore là).
  let now = startRacing(game, () => raf!, 10_000);
  const { sim } = internals();
  placeCar(sim.cars[0].body, sim.track.xFinish - 3, (x) => heightAt(sim.track, x), 0, CONFIG);
  pointer('pointerdown', 1);
  for (let f = 0; f < 600 && game.state !== 'finished'; f++) now = frames(1, now);
  expect(game.state).toBe('finished');
  const len1 = history.length;
  game.again();
  expect(game.state).toBe('countdown');
  expect(history.length).toBe(len1);
});

test('AUTRE PISTE : nouvelle graine (Date.now() % 100000) dans l’URL (len et debug gardés), nouveaux copains, toujours au titre, aucune course dessinée', () => {
  vi.spyOn(Date, 'now').mockReturnValue(1_761_300_000_123);
  history.replaceState(null, '', '/?seed=1&len=1680&debug=1');
  const { game, q } = makeGame(1, true);
  game.start();
  const before = game.pilots.map((p) => p.id);
  const len = history.length;
  q('.btn-other').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('title');
  expect(history.length).toBe(len);   // replaceState, jamais pushState (M7b)
  expect(game.seed).toBe(1_761_300_000_123 % 100_000);
  expect(new URLSearchParams(location.search).get('seed')).toBe(String(game.seed));
  expect(new URLSearchParams(location.search).get('len')).toBe('1680');
  expect(new URLSearchParams(location.search).get('debug')).toBe('1');
  const expected = [GALAHAD, ...drawPilots(defaultPilotSeed(game.seed))].map((p) => p.id);
  expect(game.pilots.map((p) => p.id)).toEqual(expected);
  // Graine 1 : diego, timothé, liam, malo ; graine 123 : timothé, diego, matthis, pablo (mesuré) : les copains ont bien changé.
  expect(expected).not.toEqual(before);
  expect([...q('.hud-bar').querySelectorAll<HTMLElement>('.hud-lane')].map((l) => l.style.color).length).toBe(5);
  expect(game.time).toBe(0);
  frames(5, 0, 1000 / 60);
  expect(drawn.race).toBe(0);
});

test('AUTRE PISTE : un replaceState qui lève (quota) ne laisse ni exception ni graine sans course (std M1)', () => {
  vi.spyOn(Date, 'now').mockReturnValue(777);
  vi.spyOn(history, 'replaceState').mockImplementation(() => { throw new Error('quota (test)'); });
  const { game } = makeGame();
  game.start();
  expect(() => game.otherTrack()).not.toThrow();
  expect(game.seed).toBe(777);
  expect(game.pilots.map((p) => p.id)).toEqual([GALAHAD, ...drawPilots(defaultPilotSeed(777))].map((p) => p.id));
  expect(game.state).toBe('title');
});

test('tap sur le bouton saut (grisé) pendant le décompte : aucun saut à PARTEZ, demande jetée (adv I1)', () => {
  const { game, q, internals } = makeGame();
  game.start();
  game.play();
  let now = frames(1, 0, 1500);
  pointer('pointerdown', 7, q('.jump-button'));
  now = frames(3, now, 1000);
  expect(game.state).toBe('racing');
  now = frames(30, now);
  expect(game.jumps).toBe(0);
  expect(internals().jumpInput.pending).toBe(false);
});

test('popstate en pause : reste en pause, entrée consommée ; popstate au titre : rien ne casse (std M4)', () => {
  const { game, internals } = makeGame();
  game.start();
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(game.state).toBe('title');
  expect(internals().historyArmed).toBe(false);
  game.play();
  expect(internals().historyArmed).toBe(true);
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(game.state).toBe('paused');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(game.state).toBe('paused');
  expect(internals().historyArmed).toBe(false);
  game.resume();
  expect(game.state).toBe('countdown');
  expect(internals().historyArmed).toBe(true);
});

test('plein écran : le pointerup n’est écouté qu’après un JOUER au doigt (pas au clavier) ; stop() le retire (CR3, std M2)', () => {
  const first = makeGame();
  const add = vi.spyOn(window, 'addEventListener');
  const remove = vi.spyOn(window, 'removeEventListener');
  first.game.start();
  first.q('.btn-play').dispatchEvent(new MouseEvent('click', { bubbles: true }));   // clavier : click sans pointeur
  expect(first.game.state).toBe('countdown');
  expect(add.mock.calls.filter((c) => c[0] === 'pointerup')).toHaveLength(0);
  first.internals().stop();
  const second = makeGame();
  add.mockClear();
  second.game.start();
  pointer('pointerdown', 2, second.q('.btn-play'));
  expect(second.game.state).toBe('countdown');
  const ups = add.mock.calls.filter((c) => c[0] === 'pointerup');
  expect(ups).toHaveLength(1);
  remove.mockClear();   // le stop() du premier jeu a déjà retiré (à vide) le même écouteur
  second.internals().stop();
  expect(remove.mock.calls.filter((c) => c[0] === 'pointerup' && c[1] === ups[0][1])).toHaveLength(1);
});

test('pause et décompte : effets et caméra figés ; MENU vide les effets ; après MENU + JOUER la caméra se cale d’un coup sur la grille (CR2, adv M24, M25)', () => {
  const { game, internals } = makeGame();
  pointer('pointerdown', 1);
  let now = startRacing(game, () => raf!);
  now = frames(120, now);
  internals().effects.spawnSparks(game.progress('galahad'), 1);
  const n0 = internals().effects.count;
  expect(n0).toBeGreaterThan(0);
  window.dispatchEvent(new PopStateEvent('popstate'));
  const camX = internals().camera.x;
  now = frames(60, now);
  expect(internals().effects.count).toBe(n0);
  expect(internals().camera.x).toBe(camX);
  // Le décompte de la reprise ne fait rien avancer non plus.
  game.resume();
  now = frames(30, now);
  expect(internals().effects.count).toBe(n0);
  expect(internals().camera.x).toBe(camX);
  now = frames(3, now, 1000);
  expect(game.state).toBe('racing');
  // M24 : MENU vide les effets.
  now = driveToPodium(game, internals, now);
  internals().effects.spawnSparks(game.progress('galahad'), 1);
  expect(internals().effects.count).toBeGreaterThan(0);
  game.menu();
  expect(internals().effects.count).toBe(0);
  // M25 : la première image du décompte cale la caméra sur la grille, sans lissage depuis l'arrivée.
  game.play();
  frames(1, now);
  const { sim } = internals();
  const target = cameraTarget(posesOf(sim)[0], (x) => heightAt(sim.track, x));
  expect(internals().camera.x).toBeCloseTo(target.x, 9);
  expect(internals().camera.y).toBeCloseTo(target.y, 9);
});

test('MENU avec une entrée d’historique armée la consomme (history.back) ; AUTRE PISTE ensuite ne pousse rien ; geste retour pendant le podium → titre sans history.back (CR1, adv M38)', () => {
  const back = vi.spyOn(history, 'back').mockImplementation(() => {});
  const { game, root, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  expect(internals().historyArmed).toBe(true);
  now = driveToPodium(game, internals, now);
  game.menu();
  expect(game.state).toBe('title');
  expect(back).toHaveBeenCalledTimes(1);
  // Le navigateur dépile l'entrée et envoie popstate : la phase est title, rien d'autre ne bouge.
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(internals().historyArmed).toBe(false);
  expect(game.state).toBe('title');
  expect(root.querySelector<HTMLElement>('.screen-podium')!.hidden).toBe(true);
  const len = history.length;
  vi.spyOn(Date, 'now').mockReturnValue(4242);
  game.otherTrack();
  expect(history.length).toBe(len);
  expect(game.seed).toBe(4242);
  expect(new URLSearchParams(location.search).get('seed')).toBe('4242');
  // Geste retour pendant le podium (A5) : titre, podium caché, sans history.back (le popstate a déjà consommé l'entrée).
  back.mockClear();
  now = startRacing(game, () => raf!, now + 10_000);
  now = driveToPodium(game, internals, now);
  expect(root.querySelector<HTMLElement>('.screen-podium')!.hidden).toBe(false);
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(game.state).toBe('title');
  expect(root.querySelector<HTMLElement>('.screen-podium')!.hidden).toBe(true);
  expect(back).not.toHaveBeenCalled();
  expect(internals().historyArmed).toBe(false);
});

test('AUTRE PISTE ignoré hors du titre', () => {
  const { game } = makeGame();
  startRacing(game, () => raf!);
  const seed = game.seed;
  game.otherTrack();
  expect(game.seed).toBe(seed);
  expect(game.state).toBe('racing');
});

/** Galahad posé 3 m avant la ligne, doigt posé (pointeur 1), images jusqu'à `finished` ; rend le `now` atteint. */
function driveToFinished(game: Game, internals: () => Internals, now: number): number {
  const { sim } = internals();
  placeCar(sim.cars[0].body, sim.track.xFinish - 3, (x) => heightAt(sim.track, x), 0, CONFIG);
  pointer('pointerdown', 1);
  for (let f = 0; f < 600 && game.state !== 'finished'; f++) now = frames(1, now);
  expect(game.state).toBe('finished');
  return now;
}
/** `driveToFinished`, puis FINISH_COAST_SECONDS d'images (+ 5) : le podium (tâche 11). */
function driveToPodium(game: Game, internals: () => Internals, now: number): number {
  now = frames(Math.ceil(CONFIG.FINISH_COAST_SECONDS / DT) + 5, driveToFinished(game, internals, now));
  expect(game.state).toBe('podium');
  return now;
}

test('podium : ENCORE et MENU (data-no-pedal) ; ENCORE → décompte sur la même piste et les mêmes copains, chrono à 0, podium caché, confettis effacés ; MENU → titre', () => {
  const { game, q, root, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToPodium(game, internals, now);
  const podium = q('.screen-podium');
  expect(podium.hidden).toBe(false);
  expect(root.querySelector('.hud-overlay')).toBeNull();   // plus de calque ARRIVÉE
  expect(podium.textContent).not.toMatch(/ARRIVÉE/);
  const buttons = [...podium.querySelectorAll<HTMLButtonElement>('button')];
  expect(buttons.map((b) => b.textContent)).toEqual(['ENCORE', 'MENU']);
  for (const b of buttons) expect(b.hasAttribute('data-no-pedal'), b.textContent!).toBe(true);
  now = frames(30, now);
  expect(internals().effects.confettiCount).toBeGreaterThan(0);   // Galahad 1er
  const pilots = game.pilots.map((p) => p.id);
  const seed = game.seed;
  expect(game.time).toBeGreaterThan(0);
  q('.btn-again').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('countdown');
  expect(q('.countdown-text').textContent).toBe('3');
  expect(game.time).toBe(0);
  expect(game.pilots.map((p) => p.id)).toEqual(pilots);
  expect(game.seed).toBe(seed);
  expect(podium.hidden).toBe(true);
  expect(game.podium).toBeNull();
  expect(internals().effects.confettiCount).toBe(0);
  expect(q('.hud-time').hidden).toBe(false);
  expect(q('.hud-time').textContent).toBe('00:00');
  now = frames(3, now, 1000);
  expect(game.state).toBe('racing');
  now = frames(60, now);
  expect(game.time).toBeGreaterThan(0);
  // Second podium (même mise en place), puis MENU : titre, HUD caché, mêmes pilotes, plus aucune course dessinée.
  now = driveToPodium(game, internals, now);
  q('.btn-menu').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('title');
  expect(q('.screen-title').hidden).toBe(false);
  expect(podium.hidden).toBe(true);
  for (const sel of ['.hud-time', '.hud-bar', '.hud-position', '.jump-button']) expect(q(sel).hidden, sel).toBe(true);
  expect(game.pilots.map((p) => p.id)).toEqual(pilots);
  expect(game.time).toBe(0);
  const race = drawn.race;
  frames(5, now, 1000 / 60);
  expect(drawn.race).toBe(race);
  expect(drawn.title).toBeGreaterThanOrEqual(5);
});

test('podium : FINISH_COAST_SECONDS de roue libre après l’arrivée (la course avance, pas de podium), puis podium ; aucun pas ensuite ; HUD de course et bouton saut cachés ; temps de Galahad', () => {
  const { game, q, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToFinished(game, internals, now);
  const { sim } = internals();
  const finishedAt = sim.cars[0].state.finishedAt!;
  const t0 = sim.time;
  for (let f = 0; f < 200 && sim.time < finishedAt + CONFIG.FINISH_COAST_SECONDS - 2 * DT; f++) {
    now = frames(1, now);
    expect(game.state).toBe('finished');
  }
  expect(sim.time).toBeGreaterThan(t0);   // la course a avancé pendant la roue libre
  expect(q('.screen-podium').hidden).toBe(true);
  now = frames(3, now);
  expect(game.state).toBe('podium');
  expect(q('.screen-podium').hidden).toBe(false);
  expect(sim.time).toBeGreaterThanOrEqual(finishedAt + CONFIG.FINISH_COAST_SECONDS);
  now = frames(1, now);   // au moins une image de podium (`podiumFrame`) avant de relever la caméra
  const t = sim.time;
  const x = game.progress(game.pilots[1].id);
  const cam = { x: internals().camera.x, y: internals().camera.y };
  now = frames(120, now);
  expect(sim.time).toBe(t);   // aucun pas au podium
  expect(game.progress(game.pilots[1].id)).toBe(x);
  // Caméra immobile : `presentFrame(…, 0)` ; avec le temps écoulé de l'image, elle glisserait vers son avance de vitesse.
  expect(internals().camera.x).toBe(cam.x);
  expect(internals().camera.y).toBe(cam.y);
  expect(q('.podium-time').textContent).toBe(formatTime(finishedAt));
  expect(game.podium!.time).toBe(finishedAt);
  for (const sel of ['.hud-time', '.hud-bar', '.hud-position', '.jump-button']) expect(q(sel).hidden, sel).toBe(true);
  expect(painted).toHaveLength(3);
});

test('classement figé à l’entrée au podium (rankCars, copains non arrivés par progression) ; Galahad 1er → confettis ; voitures peintes dans l’ordre des marches', () => {
  const { game, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToPodium(game, internals, now);
  const { sim } = internals();
  const order = rankCars(rankEntriesOf(sim)).map((i) => sim.cars[i].state.id);
  expect(game.podium!.order).toEqual(order);
  expect(game.podium!.galahadPlace).toBe(1);   // posé 3 m avant la ligne, les copains loin derrière
  expect(painted).toEqual([order[1], order[0], order[2]]);
  now = frames(30, now);
  expect(internals().effects.confettiCount).toBeGreaterThan(0);
  expect(game.confetti).toBe(internals().effects.confettiCount);
  sim.cars[4].state.progress = 1e6;   // sonde : une progression changée après coup ne change pas le podium
  now = frames(10, now);
  expect(game.podium!.order).toEqual(order);
});

test('Galahad 4e (trois copains arrivés avant lui) : sa case à côté du podium avec « 4e », marches aux copains, aucun confetti', () => {
  const { game, q, root, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  const { sim } = internals();
  // Trois copains déclarés arrivés (comme tests/fosses.test.ts déclare Galahad arrivé) : ils freinent sur la grille.
  for (const i of [1, 2, 3]) sim.cars[i].state.finishedAt = 0.1 * i;
  now = driveToPodium(game, internals, now);
  expect(game.podium!.galahadPlace).toBe(4);
  expect(q('.podium-me').hidden).toBe(false);
  expect(q('.podium-me-place').textContent).toBe('4e');
  expect(root.querySelectorAll('.podium-step.is-galahad')).toHaveLength(0);
  expect([...root.querySelectorAll('.podium-step .podium-name')].map((n) => n.textContent)).toEqual([2, 1, 3].map((i) => sim.cars[i].pilot.name));
  now = frames(60, now);
  expect(internals().effects.confettiCount).toBe(0);
  expect(painted).toHaveLength(4);
});

test('onglet caché au podium : reste au podium (pas de pause), aucun pas', () => {
  const { game, q, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToPodium(game, internals, now);
  const t = internals().sim.time;
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(game.state).toBe('podium');
  expect(q('.screen-pause').hidden).toBe(true);
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  frames(30, now);
  expect(internals().sim.time).toBe(t);
  expect(q('.screen-podium').hidden).toBe(false);
});

test('erreur de rendu au titre (drawTitle lève) → error, « Oups ! Recharge la page », boucle arrêtée', () => {
  vi.spyOn(Renderer.prototype, 'drawTitle').mockImplementation(() => { throw new Error('canvas perdu (test)'); });
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { game, root } = makeGame();
  game.start();
  raf!(16);
  expect(game.state).toBe('error');
  expect(root.querySelector('.hud-error')?.textContent).toBe('Oups ! Recharge la page');
  expect(error).toHaveBeenCalled();
  const again = raf;
  raf = null;
  again!(32);
  expect(raf).toBeNull();   // plus de requestAnimationFrame
});

test('aucun pas de course hors de racing et finished : 3 échecs de stepRace en course → error, comme avant', () => {
  // `Engine.update` est le pas physique de `stepRace` (et de lui seul : `rebuildCars` ne l'appelle pas) : son compte d'appels
  // dit combien de pas la course a faits ; une exception qu'il lève est celle d'un « pas qui lève ».
  const update = vi.spyOn(Matter.Engine, 'update');
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { game, root } = makeGame();
  game.start();
  let now = frames(30, 0);               // titre : aucun pas
  expect(update).not.toHaveBeenCalled();
  game.play();
  now = frames(30, now);                 // décompte : aucun pas
  expect(update).not.toHaveBeenCalled();
  now = frames(3, now, 1000);            // → racing ; l'image du passage ne fait aucun pas
  expect(game.state).toBe('racing');
  expect(update).not.toHaveBeenCalled();
  now = frames(1, now);
  expect(update).toHaveBeenCalledTimes(1);
  update.mockImplementation(() => { throw new Error('pas qui lève (test)'); });
  now = frames(1, now);
  expect(game.state).toBe('racing');
  now = frames(1, now);
  expect(game.state).toBe('racing');
  now = frames(1, now);
  expect(game.state).toBe('error');
  expect(error).toHaveBeenCalledWith('stepRace a échoué', expect.any(Error));
  expect(root.querySelector('.hud-error')?.textContent).toBe('Oups ! Recharge la page');
  // Boucle arrêtée : plus d'image demandée, plus aucun pas.
  const again = raf;
  raf = null;
  again!(now + 16);
  expect(raf).toBeNull();
  const calls = update.mock.calls.length;
  window.dispatchEvent(new PopStateEvent('popstate'));
  game.play(); game.resume(); game.again(); game.menu();
  expect(game.state).toBe('error');
  expect(update.mock.calls.length).toBe(calls);
});

test('bouton pause (option) : caché au titre ; visible au décompte et en course ; tap → PAUSE + REPRENDRE, sim figée, pas de gaz ; caché en pause, à l’arrivée et au podium ; REPRENDRE le rend', () => {
  const { game, q, internals } = makeGame();
  game.start();
  const btn = q('.pause-button');
  expect(btn.hidden).toBe(true);
  expect(btn.hasAttribute('data-no-pedal')).toBe(true);
  let now = startRacing(game, () => raf!);
  expect(btn.hidden).toBe(false);
  now = frames(60, now);
  const t0 = internals().sim.time;
  pointer('pointerdown', 6, btn);
  expect(game.state).toBe('paused');
  expect(internals().throttle.pressed).toBe(false);
  expect(q('.pause-text').textContent).toBe('PAUSE');
  expect(btn.hidden).toBe(true);
  pointer('pointerup', 6, btn);
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // le click qui suit le doigt : sans effet en pause
  expect(game.state).toBe('paused');
  now = frames(30, now);
  expect(internals().sim.time).toBe(t0);
  q('.btn-resume').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('countdown');
  expect(btn.hidden).toBe(false);
  pointer('pointerdown', 7, btn);   // pause pendant le décompte aussi
  expect(game.state).toBe('paused');
  pointer('pointerup', 7, btn);
  game.resume();
  now = frames(3, now, 1000);
  expect(game.state).toBe('racing');
  now = driveToFinished(game, internals, now);
  expect(btn.hidden).toBe(true);   // arrivée
  now = frames(Math.ceil(CONFIG.FINISH_COAST_SECONDS / DT) + 5, now);
  expect(game.state).toBe('podium');
  expect(btn.hidden).toBe(true);
});

test('bouton pause (option) : ≥ 96 px déclarés, règle .pause-button[hidden]{display:none}, au-dessus du HUD et sous les écrans (ordre du DOM)', () => {
  const { game, root } = makeGame();
  game.start();
  const rules = [...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
  const base = rules.find((r) => r.selectorText === '.pause-button')!;
  expect(base.style.display).toBe('flex');
  expect(parseFloat(base.style.width)).toBeGreaterThanOrEqual(96);
  expect(parseFloat(base.style.height)).toBeGreaterThanOrEqual(96);
  expect(rules.find((r) => r.selectorText === '.pause-button[hidden]')?.style.display).toBe('none');
  const kids = [...root.children];
  expect(kids.indexOf(root.querySelector('.pause-button')!)).toBeLessThan(kids.indexOf(root.querySelector('.screen-pause')!));
});

test('podium : seuls les confettis bougent ; une étincelle présente à l’entrée reste en place et les autres particules (bulles, fumée) ne naissent ni ne vieillissent (adv I1, tour 1)', () => {
  const { game, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToPodium(game, internals, now);
  const fx = internals().effects as unknown as { spawnSparks(x: number, y: number): void; particles: { kind: string; x: number; y: number; life: number }[] };
  fx.spawnSparks(internals().camera.x, internals().camera.y);
  const others = () => fx.particles.filter((p) => p.kind !== 'confetti').map((p) => ({ ...p }));
  const before = others();
  expect(before.length).toBeGreaterThan(0);
  now = frames(60, now);
  expect(others()).toEqual(before);
  expect(internals().effects.confettiCount).toBeGreaterThan(0);   // la pluie, elle, tombe
});

test('podium : une petite voiture qui ne se peint pas (drawCar lève) n’empêche pas le podium, sans « Oups » (cr 1, tour 1)', () => {
  vi.spyOn(Renderer.prototype, 'paintCarIcon').mockImplementation(() => { throw new Error('drawCar lève (test)'); });
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { game, q, root, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToPodium(game, internals, now);
  frames(30, now);
  expect(game.state).toBe('podium');
  expect(q('.screen-podium').hidden).toBe(false);
  expect(q('.btn-again').hidden).toBe(false);
  expect(root.querySelector('.hud-error')).toBeNull();
  expect(error).toHaveBeenCalled();
});

test('podium : rotation de la tablette (resize) → petites voitures repeintes à la nouvelle taille (cr 5, tour 1)', () => {
  const { game, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToPodium(game, internals, now);
  expect(painted).toHaveLength(3);
  setOrientation(800, 1280);
  expect(game.state).toBe('podium');
  expect(painted).toHaveLength(6);
  expect(painted.slice(3)).toEqual(painted.slice(0, 3));
  frames(5, now);
});

test('podium : les confettis naissent au-dessus du haut de l’écran et descendent (adv M1, tour 1)', () => {
  const { game, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToPodium(game, internals, now);
  const parts = () => (internals().effects as unknown as { particles: { kind: string; y: number }[] }).particles.filter((p) => p.kind === 'confetti');
  const top = internals().camera.y + CONFIG.VISIBLE_HEIGHT_M / 2;
  now = frames(1, now);
  const born = parts().map((p) => p.y);
  expect(born.length).toBeGreaterThan(0);
  for (const y of born) expect(y).toBeGreaterThanOrEqual(top - 2.6 * 2 * DT);
  const first = parts().slice(0, born.length);
  now = frames(30, now);
  first.forEach((p, i) => expect(p.y).toBeLessThan(born[i]));
});
