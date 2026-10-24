// @vitest-environment jsdom
// Les images dans le rendu (tâche 8b) : `Renderer` sans puis avec `setArt` (ordre ombres → effets → étoiles → voitures,
// carrosserie de chaque voiture = celle de son pilote), puis `Game`, qui reçoit la promesse des images sans jamais
// l'attendre. Faux contexte 2D, fausses images (`{ name }`).
import { afterEach, describe, expect, test, vi } from 'vitest';
import { GALAHAD, PILOTS } from '../src/cars/pilots';
import { CONFIG } from '../src/config';
import { NO_ART, type Art } from '../src/render/assets';
import { Camera } from '../src/render/camera';
import type { Effects } from '../src/render/effects';
import { Renderer } from '../src/render/renderer';
import { createRaceSim, sceneOf } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { heightAt } from '../src/track/query';
import { fakeCtx, type Call } from './helpers/fake-ctx';

const img = (name: string) => ({ name }) as unknown as CanvasImageSource;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('Renderer : dessin par code puis avec les images', () => {
  const track = generateTrack(1, 1680, CONFIG);
  const sim = createRaceSim(track, CONFIG, { robots: true });
  const scene = sceneOf(sim);
  const bodies = new Map([GALAHAD, ...PILOTS].map((p) => [p.id, img(`corps-${p.id}`)]));
  const full: Art = { bodies, wheel: img('roue'), flames: [0, 1, 2, 3].map((i) => img(`flamme-${i}`)), star: img('etoile'), loaded: [], failed: [] };

  /** Renderer branché sur un faux contexte unique (le tampon de ciel et le canvas principal le partagent). */
  function setup() {
    const { ctx, calls } = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as unknown as RenderingContext);
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 1280 });
    Object.defineProperty(canvas, 'clientHeight', { value: 800 });
    const renderer = new Renderer(canvas, CONFIG);
    return { renderer, calls };
  }
  /** Caméra centrée sur la moyenne des x des 5 voitures, y du sol + 3. */
  function cameraOnCars(): Camera {
    const cam = new Camera(CONFIG);
    const mean = scene.cars.reduce((s, c) => s + c.x, 0) / scene.cars.length;
    cam.update(mean, heightAt(track, mean) + 3, 0, 1 / 60);
    return cam;
  }
  const draws = (calls: Call[]) => calls.filter((c) => c.name === 'drawImage');
  const shadows = (calls: Call[]) => calls.filter((c) => c.name === 'ellipse' && c.fillStyle === '#000000');

  test('sans images : le ciel seul en drawImage, une ombre par voiture, voitures par code', () => {
    const { renderer, calls } = setup();
    calls.length = 0;
    renderer.draw(scene, cameraOnCars());
    expect(draws(calls)).toHaveLength(2);
    expect(shadows(calls)).toHaveLength(5);
  });

  test('setArt : carrosserie de chaque voiture (celle de son pilote), 2 roues chacune, ombres avant toute carrosserie', () => {
    const { renderer, calls } = setup();
    renderer.setArt(full);
    const cam = cameraOnCars();
    const n = scene.stars.filter((s) => s.active && Math.abs(s.x - cam.x) <= renderer.visibleHalfWidthM(cam) + 1).length;
    calls.length = 0;
    renderer.draw(scene, cam);
    const d = draws(calls);
    expect(d).toHaveLength(2 + 5 + 10 + n);
    // La carrosserie dessinée de chaque voiture est celle de son pilote, dans l'ordre de la scène.
    const bodyDraws = d.filter((c) => [...bodies.values()].includes(c.args[0] as CanvasImageSource));
    expect(bodyDraws.map((c) => c.args[0])).toEqual(scene.cars.map((c) => bodies.get(c.id)));
    expect(d.filter((c) => c.args[0] === full.wheel)).toHaveLength(10);
    // 5 ombres, toutes avant la première carrosserie.
    const sh = shadows(calls);
    expect(sh).toHaveLength(5);
    expect(calls.indexOf(sh[4])).toBeLessThan(calls.indexOf(bodyDraws[0]));
  });

  test('ordre : ombres, puis effets, puis voitures', () => {
    const { renderer, calls } = setup();
    renderer.setArt(full);
    const effects = { draw: () => { calls.push({ name: 'effects', args: [] }); } } as unknown as Effects;
    calls.length = 0;
    renderer.draw(scene, cameraOnCars(), effects);
    const at = calls.findIndex((c) => c.name === 'effects');
    const lastShadow = calls.indexOf(shadows(calls)[4]);
    const firstBody = calls.findIndex((c) => c.name === 'drawImage' && [...bodies.values()].includes(c.args[0] as CanvasImageSource));
    expect(lastShadow).toBeLessThan(at);
    expect(at).toBeLessThan(firstBody);
  });

  test('étoile : l’image des étoiles chargées est celle qui est dessinée', () => {
    const { renderer, calls } = setup();
    const star = scene.stars.find((s) => s.active)!;
    expect(star).toBeDefined();
    const cam = new Camera(CONFIG);
    cam.update(star.x, star.y, 0, 1 / 60);
    const near = scene.stars.filter((s) => s.active && Math.abs(s.x - cam.x) <= renderer.visibleHalfWidthM(cam) + 1).length;
    renderer.setArt(full);
    calls.length = 0;
    renderer.draw(scene, cam);
    expect(draws(calls).filter((c) => c.args[0] === full.star)).toHaveLength(near);
    expect(near).toBeGreaterThan(0);
    // Sans images : l'étoile par code (aucune image d'étoile).
    const sans = setup();
    sans.renderer.setArt(NO_ART);
    sans.calls.length = 0;
    sans.renderer.draw(scene, cam);
    expect(draws(sans.calls).filter((c) => c.args[0] === full.star)).toHaveLength(0);
  });

  test('setArt à chaud : le dessin passe du code aux images entre deux trames, sans erreur', () => {
    const { renderer, calls } = setup();
    const cam = cameraOnCars();
    calls.length = 0;
    renderer.draw(scene, cam);
    expect(draws(calls)).toHaveLength(2);
    renderer.setArt(full);
    calls.length = 0;
    expect(() => renderer.draw(scene, cam)).not.toThrow();
    expect(draws(calls).length).toBeGreaterThanOrEqual(2 + 5 + 10);
  });
});
