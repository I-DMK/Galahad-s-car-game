// @vitest-environment jsdom
// Câblage de `Game` aux écrans (plan B, tâche 10 ; spec §4 « Machine d'états », §8 « Entrée tactile » et « Écrans »,
// addendum « présentation » §2) : titre → JOUER → décompte (aucun pas) → PARTEZ → course ; pause par popstate, onglet
// caché ou portrait, reprise par un décompte à 3 sans toucher au chrono ; historique stable ; AUTRE PISTE ; ARRIVÉE avec
// ENCORE et MENU ; erreurs de rendu et de pas. Même harnais que tests/hud.test.ts : faux requestAnimationFrame,
// `performance.now` à 0, contexte vide, `Renderer.resize`/`draw`/`drawTitle` interceptés.
import Matter from 'matter-js';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CONFIG } from '../src/config';
import { Game } from '../src/game';
import { Renderer } from '../src/render/renderer';
import type { RaceSim } from '../src/sim/simulate';
import { defaultPilotSeed, drawPilots, GALAHAD } from '../src/cars/pilots';
import { placeCar } from '../src/physics/car';
import { heightAt } from '../src/track/query';
import { startRacing } from './helpers/racing';

const DT = CONFIG.PHYSICS_DT;
let raf: FrameRequestCallback | null = null;
const disposers: (() => void)[] = [];
let drawn: { title: number; race: number };

beforeEach(() => {
  raf = null;
  drawn = { title: 0, race: 0 };
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { raf = cb; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as unknown as RenderingContext);
  vi.spyOn(Renderer.prototype, 'resize').mockImplementation(() => {});
  vi.spyOn(Renderer.prototype, 'draw').mockImplementation(() => { drawn.race++; });
  vi.spyOn(Renderer.prototype, 'drawTitle').mockImplementation(() => { drawn.title++; });
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
});
afterEach(() => {
  for (const d of disposers.splice(0)) d();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  document.body.innerHTML = ''; document.head.innerHTML = '';
  history.replaceState(null, '', '/');
});

interface Internals { sim: RaceSim; stop(): void; throttle: { dispose(): void; pressed: boolean }; jumpInput: { dispose(): void; pending: boolean } }
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
  q('.btn-other').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('title');
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

test('AUTRE PISTE ignoré hors du titre', () => {
  const { game } = makeGame();
  startRacing(game, () => raf!);
  const seed = game.seed;
  game.otherTrack();
  expect(game.seed).toBe(seed);
  expect(game.state).toBe('racing');
});

/** Galahad posé 3 m avant la ligne, doigt posé (pointeur 1), images jusqu'à `finished`, puis FINISH_COAST_SECONDS d'images : le calque ARRIVÉE. */
function driveToArrival(game: Game, internals: () => Internals, now: number): number {
  const { sim } = internals();
  placeCar(sim.cars[0].body, sim.track.xFinish - 3, (x) => heightAt(sim.track, x), 0, CONFIG);
  pointer('pointerdown', 1);
  for (let f = 0; f < 600 && game.state !== 'finished'; f++) now = frames(1, now);
  expect(game.state).toBe('finished');
  return frames(Math.ceil(CONFIG.FINISH_COAST_SECONDS / DT) + 5, now);
}

test('arrivée : calque ARRIVÉE avec ENCORE et MENU (data-no-pedal) ; ENCORE → décompte sur la même piste et les mêmes copains, chrono à 0 ; MENU → titre', () => {
  const { game, q, root, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToArrival(game, internals, now);
  const overlay = root.querySelector<HTMLElement>('.hud-overlay')!;
  expect(overlay).not.toBeNull();
  expect(overlay.textContent).toMatch(/ARRIVÉE/);
  const buttons = [...overlay.querySelectorAll<HTMLButtonElement>('button')];
  expect(buttons.map((b) => b.textContent)).toEqual(['ENCORE', 'MENU']);
  for (const b of buttons) expect(b.hasAttribute('data-no-pedal'), b.textContent!).toBe(true);
  const pilots = game.pilots.map((p) => p.id);
  const seed = game.seed;
  expect(game.time).toBeGreaterThan(0);
  q('.hud-again').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('countdown');
  expect(q('.countdown-text').textContent).toBe('3');
  expect(game.time).toBe(0);
  expect(game.pilots.map((p) => p.id)).toEqual(pilots);
  expect(game.seed).toBe(seed);
  expect(root.querySelector('.hud-overlay')).toBeNull();
  expect(q('.hud-time').textContent).toBe('00:00');
  now = frames(3, now, 1000);
  expect(game.state).toBe('racing');
  expect(game.time).toBe(0);
  now = frames(60, now);
  expect(game.time).toBeGreaterThan(0);
  // Seconde arrivée (même mise en place), puis MENU : titre, HUD caché, mêmes pilotes.
  now = driveToArrival(game, internals, now);
  q('.hud-menu').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('title');
  expect(q('.screen-title').hidden).toBe(false);
  expect(root.querySelector('.hud-overlay')).toBeNull();
  for (const sel of ['.hud-time', '.hud-bar', '.hud-position', '.jump-button']) expect(q(sel).hidden, sel).toBe(true);
  expect(game.pilots.map((p) => p.id)).toEqual(pilots);
  expect(game.time).toBe(0);
  const race = drawn.race;
  frames(5, now, 1000 / 60);
  expect(drawn.race).toBe(race);
  expect(drawn.title).toBeGreaterThanOrEqual(5);
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
