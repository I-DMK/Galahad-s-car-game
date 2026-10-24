// @vitest-environment jsdom
// Scène du titre (plan B, tâche 10 ; addendum « présentation » §2) : Galahad qui rebondit devant les quatre copains de la
// graine, rangés comme sur la grille (`render/title.ts`, pur), et `Renderer.drawTitle` sur le faux contexte 2D (ciel, sol,
// ombres, voitures par `drawCar` : images reçues par `setArt`, sinon dessin par code). `colorHex` et `defaultPilotSeed`
// déplacés de `sim/simulate.ts` vers `cars/pilots.ts` (purs : pas de matter-js pour la scène ni pour les e2e).
import { afterEach, expect, test, vi } from 'vitest';
import { GALAHAD, PILOTS, colorHex, defaultPilotSeed, drawPilots } from '../src/cars/pilots';
import { CONFIG } from '../src/config';
import { Renderer } from '../src/render/renderer';
import {
  TITLE_BOUNCE_HEIGHT_M, TITLE_BOUNCE_PERIOD_S, TITLE_GROUND_FRAC, bounceHeight, titleScene,
} from '../src/render/title';
import { createRaceSim } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { fakeCtx } from './helpers/fake-ctx';

const pilots = [GALAHAD, ...drawPilots(7)];

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

test('colorHex (déplacé dans pilots) : 0x1e5cff → #1e5cff, zéros gardés', () => {
  expect(colorHex(0x1e5cff)).toBe('#1e5cff');
  expect(colorHex(0x00a8a0)).toBe('#00a8a0');
});

test('bounceHeight : 0 aux rebonds, H à mi-période, jamais négatif, périodique', () => {
  expect(bounceHeight(0)).toBeCloseTo(0, 9);
  expect(bounceHeight(TITLE_BOUNCE_PERIOD_S / 2)).toBeCloseTo(TITLE_BOUNCE_HEIGHT_M, 9);
  expect(bounceHeight(TITLE_BOUNCE_PERIOD_S)).toBeCloseTo(0, 9);
  for (const t of [-0.3, 0.17, 2.9, 100.01]) {
    expect(bounceHeight(t)).toBeGreaterThanOrEqual(0);
    expect(bounceHeight(t)).toBeLessThanOrEqual(TITLE_BOUNCE_HEIGHT_M + 1e-9);
    expect(bounceHeight(t + TITLE_BOUNCE_PERIOD_S)).toBeCloseTo(bounceHeight(t), 9);
  }
});

test('titleScene : cinq voitures, Galahad dessiné en dernier et devant (x = 0), copains à −3,3 m par rang, prénoms et couleurs des pilotes', () => {
  const s = titleScene(pilots, 0, CONFIG);
  expect(s.cars).toHaveLength(5);
  const galahad = s.cars[4];
  expect(galahad.id).toBe('galahad');
  expect(galahad.x).toBeCloseTo(0, 9);
  // Ordre de dessin inverse de la grille : le copain de rang 4 d'abord.
  for (let rank = 1; rank <= 4; rank++) {
    const c = s.cars[4 - rank];
    expect(c.id).toBe(pilots[rank].id);
    expect(c.name).toBe(pilots[rank].name);
    expect(c.x).toBeCloseTo(-rank * CONFIG.GRID_SPACING_FACTOR * CONFIG.CAR_LENGTH, 9);
    expect(c.color).toBe(colorHex(pilots[rank].color));
    expect(c.accent).toBe(colorHex(pilots[rank].accent));
    expect(c.helmet).toBe(colorHex(pilots[rank].helmet));
    expect(c.turbo).toBe(false);
    expect(c.angle).toBe(0);
  }
  expect(s.centerX).toBeCloseTo(-2 * CONFIG.GRID_SPACING_FACTOR * CONFIG.CAR_LENGTH, 9);
});

test('titleScene : poses au sol (châssis à R + 0,25, roues à ±0,75 et R), Galahad seul rebondit, ses roues tournent', () => {
  const R = CONFIG.WHEEL_RADIUS;
  const t = TITLE_BOUNCE_PERIOD_S / 2;
  const s = titleScene(pilots, t, CONFIG);
  const h = bounceHeight(t);
  expect(h).toBeGreaterThan(0.4);
  for (const c of s.cars.slice(0, 4)) {
    expect(c.y).toBeCloseTo(R + 0.25, 9);
    expect(c.wheels).toHaveLength(2);
    // Flottants (−rank × 3,3 + 0,75 n'est pas exact) : au 1e-9 près.
    expect(c.wheels[0].x - c.x).toBeCloseTo(-0.75, 9);
    expect(c.wheels[1].x - c.x).toBeCloseTo(0.75, 9);
    for (const w of c.wheels) { expect(w.y).toBeCloseTo(R, 9); expect(w.angle).toBe(0); }
  }
  const g = s.cars[4];
  expect(g.y).toBeCloseTo(R + 0.25 + h, 9);
  for (const w of g.wheels) {
    expect(w.y).toBeCloseTo(R + h, 9);
    expect(w.angle).toBeLessThan(0);   // sens de la marche (convention anti-horaire du monde)
  }
  expect(s.heights).toEqual([0, 0, 0, 0, h]);
  expect(s.t).toBe(t);
});

test('titleScene : avec moins de pilotes (course sans robots), une seule voiture, centrée', () => {
  const s = titleScene([GALAHAD], 0.3, CONFIG);
  expect(s.cars).toHaveLength(1);
  expect(s.centerX).toBeCloseTo(0, 9);
});

test('defaultPilotSeed (déplacé dans pilots) : entier de [0, 2³²) décorrélé de la graine, celui que createRaceSim utilise', () => {
  expect(defaultPilotSeed(1)).toBe((1 ^ 0x9e3779b9) >>> 0);
  expect(defaultPilotSeed(123)).toBeGreaterThanOrEqual(0);
  expect(Number.isInteger(defaultPilotSeed(2 ** 31 + 5))).toBe(true);
  expect(createRaceSim(generateTrack(1, 1680, CONFIG), CONFIG, { robots: true }).pilotSeed).toBe(defaultPilotSeed(1));
});

test('Renderer.drawTitle : ciel, sol #8b8b8b, cinq ombres avant les voitures, cinq carrosseries image (setArt), sol à 62 % de la hauteur', () => {
  const { ctx, calls, state } = fakeCtx();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as unknown as RenderingContext);
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 1280 });
  Object.defineProperty(canvas, 'clientHeight', { value: 800 });
  const renderer = new Renderer(canvas, CONFIG);
  const img = (n: string) => ({ name: n }) as unknown as CanvasImageSource;
  renderer.setArt({ bodies: new Map([GALAHAD, ...PILOTS].map((p) => [p.id, img(p.id)])), wheel: img('wheel'), flames: null, star: null, loaded: [], failed: [] });
  calls.length = 0;
  const scene = titleScene(pilots, 0.2, CONFIG);
  renderer.drawTitle(scene);
  const names = calls.map((c) => c.name);
  expect(names.slice(0, 3)).toEqual(['setTransform', 'clearRect', 'drawImage']);   // ciel juste après l'effacement (globalAlpha remis à 1 avant)
  // Sol : un `fillRect` gris (le faux contexte note le nom de la méthode : `fillRect`, pas `fill`).
  const ground = calls.find((c) => c.name === 'fillRect' && c.fillStyle === '#8b8b8b');
  expect(ground).toBeDefined();
  const shadows = calls.filter((c) => c.name === 'ellipse' && c.fillStyle === '#000000');
  expect(shadows).toHaveLength(5);
  const bodies = calls.filter((c) => c.name === 'drawImage' && typeof (c.args[0] as { name?: string }).name === 'string' && (c.args[0] as { name: string }).name !== 'wheel');
  expect(bodies.map((c) => (c.args[0] as { name: string }).name)).toEqual(scene.cars.map((c) => c.id));
  expect(calls.indexOf(shadows[4])).toBeLessThan(calls.indexOf(bodies[0]));
  // Le sol (y = 0 du monde) tombe à TITLE_GROUND_FRAC de la hauteur du tampon : l'ombre d'un copain au sol y est posée.
  const h = canvas.height;
  expect(shadows[0].args[1] as number).toBeCloseTo(TITLE_GROUND_FRAC * h, 0);
  // Rien ne fuit : pile save/restore vide, opacité 1.
  expect(state()).toMatchObject({ depth: 0, globalAlpha: 1, underflows: 0 });
  // Sans images : tout par code, toujours cinq ombres, aucune image hormis le ciel (2 copies).
  renderer.setArt({ bodies: new Map(), wheel: null, flames: null, star: null, loaded: [], failed: [] });
  calls.length = 0;
  renderer.drawTitle(scene);
  expect(calls.filter((c) => c.name === 'drawImage')).toHaveLength(2);
  expect(calls.filter((c) => c.name === 'ellipse' && c.fillStyle === '#000000')).toHaveLength(5);
});
