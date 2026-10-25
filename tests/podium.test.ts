// @vitest-environment jsdom
// Podium (plan B, tâche 11 ; spec §6 « Arrivée », §8 « Écrans » et « Rendu ») : classement final pur (`podiumView`),
// confettis (`Effects`), petite voiture peinte par `Renderer.paintCarIcon`, écran DOM (`Screens.showPodium`, Partie 2).
import { afterEach, expect, test, vi } from 'vitest';
import { GALAHAD, PILOTS, type Pilot } from '../src/cars/pilots';
import { ordinal, podiumView, rankCars, type RankEntry } from '../src/cars/ranking';
import { CONFIG } from '../src/config';
import { CONFETTI_PER_SECOND, CONFETTI_SECONDS, Effects, MAX_PARTICLES } from '../src/render/effects';
import { Renderer } from '../src/render/renderer';
import { formatTime } from '../src/ui/hud';
import { Screens } from '../src/ui/screens';
import { fakeCtx } from './helpers/fake-ctx';

/** Galahad, puis pablo, diego, timothé, matthis (index 0 à 4). */
const pilots = [GALAHAD, PILOTS[0], PILOTS[1], PILOTS[2], PILOTS[3]];
const entry = (index: number, progress: number, finishedAt: number | null = null): RankEntry => ({ index, progress, finishedAt });
const DT = 1 / 60;
const NO_VOLCANO = { volcanoes: [] };

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; document.head.innerHTML = ''; });

test('podiumView : arrivés par temps, puis non arrivés par progression (rankCars), égalité par index ; prénoms, couleurs, Galahad repéré', () => {
  const entries = [entry(0, 300, 80), entry(1, 290), entry(2, 310, 78.5), entry(3, 295), entry(4, 295)];
  const v = podiumView(entries, pilots, 0, 80);
  expect(v.places.map((p) => p.index)).toEqual(rankCars(entries));
  expect(v.places.map((p) => p.index)).toEqual([2, 0, 3, 4, 1]);
  expect(v.places.map((p) => p.place)).toEqual([1, 2, 3, 4, 5]);
  expect(v.places[0]).toEqual({ place: 1, index: 2, id: 'diego', name: 'Diego', pilot: PILOTS[1], isGalahad: false });
  expect(v.places.filter((p) => p.isGalahad).map((p) => p.id)).toEqual(['galahad']);
  expect(v.galahadPlace).toBe(2);
  expect(v.galahadTime).toBe(80);
});

test('podiumView : Galahad 4e (trois copains arrivés avant lui), 5e (dernier sans arrivée) ; moins de trois voitures', () => {
  const four = podiumView([entry(0, 300, 90), entry(1, 300, 70), entry(2, 300, 71), entry(3, 300, 72), entry(4, 100)], pilots, 0, 90);
  expect(four.galahadPlace).toBe(4);
  expect(four.places.slice(0, 3).map((p) => p.id)).toEqual(['pablo', 'diego', 'timothé']);
  expect(podiumView([entry(0, 10), entry(1, 50), entry(2, 40), entry(3, 30), entry(4, 20)], pilots, 0, 0).galahadPlace).toBe(5);
  const alone = podiumView([entry(0, 300, 60)], [GALAHAD], 0, 60);
  expect(alone.places).toHaveLength(1);
  expect(alone.galahadPlace).toBe(1);
  expect(() => podiumView([entry(0, 1), entry(7, 2)], pilots, 0, 0)).toThrow(RangeError);
});

test('confettis : rien sans startConfetti ; pluie de CONFETTI_SECONDS, puis plus aucun nouveau ; tout est tombé ensuite', () => {
  const fx = new Effects(CONFIG);
  const tick = () => { fx.rainConfetti(DT, 100, 20, 11); fx.update(DT, NO_VOLCANO, 100, 11); };
  for (let i = 0; i < 60; i++) tick();
  expect(fx.confettiCount).toBe(0);
  fx.startConfetti();
  let max = 0;
  for (let i = 0; i < Math.round(CONFETTI_SECONDS / DT); i++) { tick(); max = Math.max(max, fx.confettiCount); }
  expect(max).toBe(CONFETTI_SECONDS * CONFETTI_PER_SECOND);   // exactement 160 : ni 159 (fraction reportée), ni 161
  expect(max).toBeLessThanOrEqual(Math.min(MAX_PARTICLES, CONFETTI_SECONDS * CONFETTI_PER_SECOND));
  const after = fx.confettiCount;
  // Aucun confetti ne meurt avant ≈ 9,7 s (traversée de la vue) : un seul de plus (reste flottant, CONFETTI_EPS) se verrait ici.
  for (let i = 0; i < 30; i++) tick();
  expect(fx.confettiCount).toBe(after);
  for (let i = 0; i < 600; i++) tick();
  expect(fx.confettiCount).toBe(0);
});

test('confettis : nés au-dessus de topY dans [cx − demi-largeur, cx + demi-largeur], rectangles de plusieurs couleurs, pile save/restore vide ; clear() arrête la pluie', () => {
  const fx = new Effects(CONFIG);
  fx.startConfetti();
  fx.rainConfetti(0.5, 100, 20, 11);
  expect(fx.confettiCount).toBe(0.5 * CONFETTI_PER_SECOND);
  const { ctx, calls, state } = fakeCtx();
  fx.draw(ctx, (p) => ({ x: p.x, y: p.y }), 1);
  const rects = calls.filter((c) => c.name === 'fillRect');
  expect(rects).toHaveLength(fx.confettiCount);
  for (const r of rects) {
    const [x, y] = r.args as number[];
    expect(x).toBeGreaterThanOrEqual(100 - 11 - 1);
    expect(x).toBeLessThanOrEqual(100 + 11 + 1);
    expect(y).toBeGreaterThanOrEqual(20 - 1);
    expect(r.fillStyle).toMatch(/^#[0-9a-f]{6}$/);
  }
  expect(new Set(rects.map((r) => r.fillStyle)).size).toBeGreaterThan(1);
  expect(state()).toMatchObject({ depth: 0, underflows: 0 });
  fx.clear();
  expect(fx.confettiCount).toBe(0);
  fx.rainConfetti(0.5, 100, 20, 11);
  expect(fx.confettiCount).toBe(0);
});

test('Renderer.paintCarIcon : carrosserie image puis deux roues image, centrée, sans prénom, tampon 2:1 ; carrosserie par code sans image', () => {
  const { ctx, calls, state } = fakeCtx();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as unknown as RenderingContext);
  const renderer = new Renderer(document.createElement('canvas'), CONFIG);
  const img = (n: string) => ({ name: n }) as unknown as CanvasImageSource;
  renderer.setArt({ bodies: new Map([[PILOTS[1].id, img('diego')]]), wheel: img('wheel'), flames: null, star: null, loaded: [], failed: [] });
  const icon = document.createElement('canvas');
  calls.length = 0;
  renderer.paintCarIcon(icon, PILOTS[1]);
  // jsdom : clientWidth 0 → largeur par défaut (160 px CSS), devicePixelRatio 1.
  expect(icon.width).toBe(160);
  expect(icon.height).toBe(80);
  const images = calls.filter((c) => c.name === 'drawImage');
  expect(images.map((c) => (c.args[0] as { name: string }).name)).toEqual(['diego', 'wheel', 'wheel']);
  expect(images[0].matrix[4]).toBeCloseTo(80, 6);   // carrosserie centrée dans la toile
  expect(calls.some((c) => c.name === 'fillText')).toBe(false);
  expect(state()).toMatchObject({ depth: 0, underflows: 0, globalAlpha: 1 });
  calls.length = 0;
  renderer.paintCarIcon(icon, PILOTS[0]);   // pas d'image de pablo : carrosserie par code
  expect(calls.filter((c) => c.name === 'drawImage').map((c) => (c.args[0] as { name: string }).name)).toEqual(['wheel', 'wheel']);
  expect(calls.some((c) => c.name === 'clearRect')).toBe(true);
});

function makeScreens() {
  const root = document.createElement('div');
  document.body.append(root);
  const actions = { onPlay: vi.fn(), onOtherTrack: vi.fn(), onResume: vi.fn(), onAgain: vi.fn(), onMenu: vi.fn() };
  const screens = new Screens(root, { version: '1.2.0' }, actions);
  const q = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  const qa = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
  return { root, screens, actions, q, qa };
}
/** Classement où la voiture `order[k]` arrive k-ième. */
const viewOf = (order: number[], time = 83.4, ps: readonly Pilot[] = pilots) =>
  podiumView(order.map((index, k) => entry(index, 0, 10 + k)), ps, 0, time);
const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const pointerDown = (el: Element) => { const e = new Event('pointerdown', { bubbles: true }); Object.defineProperty(e, 'pointerId', { value: 3 }); el.dispatchEvent(e); };

test('podium : calque caché à la création, montré seul par showPodium, voile entier data-no-pedal, temps de Galahad en mm:ss', () => {
  const { screens, q } = makeScreens();
  expect(q('.screen-podium').hidden).toBe(true);
  expect(q('.podium-me').hidden).toBe(true);   // la case de Galahad ne se montre jamais avant un podium où il est 4e ou 5e
  screens.showTitle();
  screens.showPodium(viewOf([0, 1, 2, 3, 4]), () => {});
  expect(q('.screen-podium').hidden).toBe(false);
  for (const s of ['.screen-title', '.screen-countdown', '.screen-pause']) expect(q(s).hidden, s).toBe(true);
  expect(q('.screen-podium').hasAttribute('data-no-pedal')).toBe(true);
  expect(q('.podium-time').textContent).toBe(formatTime(83.4));
  expect(q('.podium-time').textContent).toBe('01:23');
});

test('trois marches dans l’ordre 2e, 1er, 3e : prénoms, médaille SVG, voiture peinte par le rappel (une fois par marche, dans l’ordre du DOM)', () => {
  const { screens, qa } = makeScreens();
  const paint = vi.fn();
  screens.showPodium(viewOf([2, 0, 1, 3, 4]), paint);
  const steps = qa('.podium-step');
  expect(steps.map((s) => [...s.classList].find((c) => c.startsWith('step-')))).toEqual(['step-2', 'step-1', 'step-3']);
  expect(steps.map((s) => s.querySelector('.podium-name')!.textContent)).toEqual(['Galahad', 'Diego', 'Pablo']);
  for (const s of steps) expect(s.querySelector('.podium-medal svg')).not.toBeNull();
  expect(paint).toHaveBeenCalledTimes(3);
  expect(paint.mock.calls.map(([c]) => c)).toEqual(steps.map((s) => s.querySelector('canvas')));
  expect(paint.mock.calls.map(([, p]) => p.place)).toEqual([2, 1, 3]);
});

test('Galahad 1er : sa marche surlignée, pas de case à côté ; Galahad 2e, puis 3e : la marche du 2e, puis du 3e, surlignée', () => {
  const { screens, q, qa } = makeScreens();
  screens.showPodium(viewOf([0, 1, 2, 3, 4]), () => {});
  expect(q('.step-1').classList.contains('is-galahad')).toBe(true);
  expect(qa('.podium-step.is-galahad')).toHaveLength(1);
  expect(q('.podium-me').hidden).toBe(true);
  screens.showPodium(viewOf([1, 0, 2, 3, 4]), () => {});
  expect(qa('.podium-step.is-galahad').map((s) => s.classList.contains('step-2'))).toEqual([true]);
  expect(q('.podium-me').hidden).toBe(true);
  // 3e : encore sur le podium (mutant « case montrée dès la 3e place », Step 12).
  screens.showPodium(viewOf([1, 2, 0, 3, 4]), () => {});
  expect(qa('.podium-step.is-galahad').map((s) => s.classList.contains('step-3'))).toEqual([true]);
  expect(q('.podium-me').hidden).toBe(true);
});

test('Galahad 4e puis 5e : case à droite avec sa place, sa voiture (peinte en 4e appel) et son prénom ; aucune marche surlignée', () => {
  const { screens, q, qa } = makeScreens();
  const paint = vi.fn();
  screens.showPodium(viewOf([1, 2, 3, 0, 4]), paint);
  expect(q('.podium-me').hidden).toBe(false);
  expect(q('.podium-me-place').textContent).toBe(ordinal(4));
  expect(q('.podium-me .podium-name').textContent).toBe('Galahad');
  expect(qa('.podium-step.is-galahad')).toHaveLength(0);
  expect(paint).toHaveBeenCalledTimes(4);
  expect(paint.mock.calls[3][0]).toBe(q('.podium-me canvas'));
  expect(paint.mock.calls[3][1].isGalahad).toBe(true);
  screens.showPodium(viewOf([1, 2, 3, 4, 0]), () => {});
  expect(q('.podium-me-place').textContent).toBe('5e');
});

test('ENCORE et MENU : data-no-pedal, mots et icônes ; onAgain au pointerdown ET au click (un doigt de gaz peut rester posé) ; onMenu au click seul (A20) ; ≥ 96 px déclarés', () => {
  const { screens, actions, q } = makeScreens();
  screens.showPodium(viewOf([0, 1, 2, 3, 4]), () => {});
  const again = q('.btn-again');
  const menu = q('.btn-menu');
  for (const b of [again, menu]) {
    expect(b.hasAttribute('data-no-pedal')).toBe(true);
    expect(b.querySelector('svg')).not.toBeNull();
    expect(parseFloat(getComputedStyle(b).getPropertyValue('min-width'))).toBeGreaterThanOrEqual(96);
    expect(parseFloat(getComputedStyle(b).getPropertyValue('min-height'))).toBeGreaterThanOrEqual(96);
  }
  expect(again.textContent).toBe('ENCORE');
  expect(menu.textContent).toBe('MENU');
  expect(again.querySelector('.btn-label')!.textContent).toBe('ENCORE');
  expect(menu.querySelector('.btn-label')!.textContent).toBe('MENU');
  pointerDown(again);
  expect(actions.onAgain).toHaveBeenCalledTimes(1);
  click(again);   // le click qui suit le doigt levé : `Game` l'ignore (aucune ligne `again` depuis `countdown`)
  expect(actions.onAgain).toHaveBeenCalledTimes(2);
  pointerDown(menu);
  expect(actions.onMenu).not.toHaveBeenCalled();
  click(menu);
  expect(actions.onMenu).toHaveBeenCalledTimes(1);
});

test('showPodium deux fois : contenu réécrit, jamais doublé ; un autre écran cache le podium (jamais retiré du DOM)', () => {
  const { screens, q, qa } = makeScreens();
  screens.showPodium(viewOf([1, 2, 3, 0, 4]), () => {});
  screens.showPodium(viewOf([0, 1, 2, 3, 4], 61), () => {});
  expect(qa('.podium-step')).toHaveLength(3);
  expect(qa('.podium-me')).toHaveLength(1);
  expect(qa('.btn-again')).toHaveLength(1);
  expect(q('.podium-time').textContent).toBe('01:01');
  expect(q('.podium-me').hidden).toBe(true);
  screens.showCountdown('3');
  expect(q('.screen-podium').hidden).toBe(true);
  expect(q('.screen-podium').isConnected).toBe(true);
});

test('prénoms en texte : un prénom à balises n’injecte aucun élément', () => {
  const { screens, q } = makeScreens();
  const evil: Pilot = { ...PILOTS[0], id: 'x', name: '<img src=x onerror=alert(1)>' };
  screens.showPodium(viewOf([1, 0, 2, 3, 4], 50, [GALAHAD, evil, PILOTS[1], PILOTS[2], PILOTS[3]]), () => {});
  expect(q('.step-1 .podium-name').textContent).toBe('<img src=x onerror=alert(1)>');
  expect(q('.screen-podium').querySelector('img')).toBeNull();
});

test('moins de trois places : marches vides cachées', () => {
  const { screens, q } = makeScreens();
  screens.showPodium(podiumView([entry(0, 300, 60)], [GALAHAD], 0, 60), () => {});
  expect(q('.step-1').hidden).toBe(false);
  expect(q('.step-2').hidden).toBe(true);
  expect(q('.step-3').hidden).toBe(true);
});

test('la feuille : .screen-podium (flex de .screen) et la case de Galahad cachée par .screen [hidden] ; police Fredoka', () => {
  makeScreens();
  const rules = [...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
  expect(rules.find((r) => r.selectorText === '.screen [hidden]')?.style.display).toBe('none');
  expect(rules.find((r) => r.selectorText.split(',').map((s) => s.trim()).includes('.podium-me'))?.style.display).toBe('flex');
  expect(rules.find((r) => r.selectorText === '.screen')?.style.fontFamily).toMatch(/Fredoka/);
});

test('confettis : chacun traverse toute la vue avant de disparaître (sous le bas de l’écran, VISIBLE_HEIGHT_M sous topY) (cr 4, tour 1)', () => {
  const fx = new Effects(CONFIG);
  const parts = () => (fx as unknown as { particles: { kind: string; y: number }[] }).particles;
  const top = 20;
  fx.startConfetti();
  let died = 0;
  for (let i = 0; i < Math.round(20 / DT); i++) {
    const before = new Map(parts().map((p) => [p, p.y]));
    fx.rainConfetti(DT, 100, top, 11);
    fx.updateConfetti(DT);
    const alive = new Set(parts());
    for (const [p, y] of before) {
      if (alive.has(p)) continue;
      died++;
      expect(y, 'mort encore dans la vue').toBeLessThanOrEqual(top - CONFIG.VISIBLE_HEIGHT_M);
    }
  }
  expect(died).toBe(CONFETTI_SECONDS * CONFETTI_PER_SECOND);
});

test('confettis : la pluie ne dépasse jamais MAX_PARTICLES, même avec 300 particules déjà présentes (adv M2, tour 1)', () => {
  const fx = new Effects(CONFIG);
  while (fx.count < MAX_PARTICLES) fx.spawnSparks(0, 0);
  expect(fx.count).toBe(MAX_PARTICLES);
  fx.startConfetti();
  for (let i = 0; i < Math.round(CONFETTI_SECONDS / DT); i++) {
    fx.rainConfetti(DT, 100, 20, 11);
    expect(fx.count).toBeLessThanOrEqual(MAX_PARTICLES);
  }
  expect(fx.confettiCount).toBe(CONFETTI_SECONDS * CONFETTI_PER_SECOND);   // les plus anciennes (étincelles) cèdent la place
});
