// @vitest-environment jsdom
// Podium (plan B, tâche 11 ; spec §6 « Arrivée », §8 « Écrans » et « Rendu ») : classement final pur (`podiumView`),
// confettis (`Effects`), petite voiture peinte par `Renderer.paintCarIcon`, écran DOM (`Screens.showPodium`, Partie 2).
import { afterEach, expect, test, vi } from 'vitest';
import { GALAHAD, PILOTS, colorHex } from '../src/cars/pilots';
import { podiumView, rankCars, type RankEntry } from '../src/cars/ranking';
import { CONFIG } from '../src/config';
import { CONFETTI_PER_SECOND, CONFETTI_SECONDS, Effects, MAX_PARTICLES } from '../src/render/effects';
import { Renderer } from '../src/render/renderer';
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
  expect(v.places[0]).toEqual({ place: 1, index: 2, id: 'diego', name: 'Diego', color: colorHex(PILOTS[1].color), isGalahad: false });
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
  expect(max).toBeGreaterThanOrEqual(0.9 * CONFETTI_SECONDS * CONFETTI_PER_SECOND);
  expect(max).toBeLessThanOrEqual(Math.min(MAX_PARTICLES, CONFETTI_SECONDS * CONFETTI_PER_SECOND));
  const after = fx.confettiCount;
  // Aucun confetti ne meurt avant 7 s : un seul de plus (reste flottant de la pluie, CONFETTI_EPS) se verrait ici.
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
