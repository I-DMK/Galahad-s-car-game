// @vitest-environment jsdom
// Câblage de `Game` (tâche 5f du plan B) : la vraie boucle d'images du jeu, sous jsdom, avec un faux
// requestAnimationFrame et le dessin intercepté. À chaque image, la scène passée au renderer doit avoir
// les voitures aux poses interpolées entre les deux derniers pas (sans traînée pour une voiture réapparue),
// `Scene.t` = sim.time − (1 − α)·dt, et la caméra doit suivre la pose dessinée de Galahad au temps réel.
// Les attendus sont recalculés ici, à côté de `Game`, depuis l'état de la course après chaque pas.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CONFIG } from '../src/config';
import { Game } from '../src/game';
import { cameraTarget } from '../src/loop/frame';
import { lerpCarPose, type CarPose } from '../src/loop/interpolation';
import { placeCar } from '../src/physics/car';
import { Camera } from '../src/render/camera';
import { Renderer, type Scene } from '../src/render/renderer';
import { posesOf, type RaceSim } from '../src/sim/simulate';
import { heightAt } from '../src/track/query';

const DT = CONFIG.PHYSICS_DT;

interface Drawn { scene: Scene; camX: number; camY: number }

let raf: FrameRequestCallback | null = null;
let drawn: Drawn[] = [];

beforeEach(() => {
  raf = null;
  drawn = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { raf = cb; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as unknown as RenderingContext);
  vi.spyOn(Renderer.prototype, 'resize').mockImplementation(() => {});
  vi.spyOn(Renderer.prototype, 'draw').mockImplementation((scene: Scene, camera: Camera) => {
    drawn.push({ scene, camX: camera.x, camY: camera.y });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** Doigt posé (pointeur 1) : la vraie entrée `Throttle` de `Game`. */
function pressFinger(): void {
  const ev = new Event('pointerdown', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'pointerId', { value: 1 });
  window.dispatchEvent(ev);
}

/** Index des voitures dont un événement 'respawn' figure dans le dernier pas (lu directement dans `sim.events`). */
function respawned(sim: RaceSim): Set<number> {
  const ids = new Set(sim.events.filter((e) => e.type === 'respawn').map((e) => e.carId));
  return new Set(sim.cars.flatMap((c, i) => (ids.has(c.state.id) ? [i] : [])));
}

test('Game : voitures interpolées, sans traînée à une réapparition, Scene.t en retard d’un pas, caméra sur la pose dessinée', () => {
  const canvas = document.createElement('canvas');
  const hud = document.createElement('div');
  document.body.append(canvas, hud);
  const game = new Game(canvas, hud, { seed: 1, length: 1680, debug: false });
  const internals = game as unknown as { sim: RaceSim; loop: { acc: number; history: { reset(p: CarPose[]): void } }; step: (...a: unknown[]) => unknown };
  const { sim } = internals;
  // Galahad posé sur la lave du premier volcan : il réapparaît pendant le test.
  const v = sim.track.volcanoes[0];
  placeCar(sim.cars[0].body, v.xLava, (x) => heightAt(sim.track, x), 0, CONFIG);
  internals.loop.history.reset(posesOf(sim));

  // Poses après chaque pas de `Game.step`, et voitures réapparues pendant ce pas.
  const after: { poses: CarPose[]; teleported: Set<number> }[] = [{ poses: posesOf(sim), teleported: new Set() }];
  const step = internals.step.bind(game);
  internals.step = (...args: unknown[]) => {
    const t0 = sim.time;
    const out = step(...args);
    if (sim.time > t0) after.push({ poses: posesOf(sim), teleported: respawned(sim) });
    return out;
  };

  pressFinger();
  game.start();
  const camera = new Camera(CONFIG);
  let now = 0;
  let teleportFramesChecked = 0;
  let interpolatedFrames = 0;
  for (let f = 0; f < 240; f++) {
    // 1,5 pas par image : alternance d'images à 1 pas (α = 0,5) et à 2 pas (α ≈ 0).
    const elapsedMs = 1.5 * DT * 1000;
    now += elapsedMs;
    const frame = raf!;
    const before = after.length;
    frame(now);
    expect(drawn).toHaveLength(f + 1);
    const { scene, camX, camY } = drawn[f];
    const alpha = Math.min(1, internals.loop.acc / DT);
    const prev = after[after.length - 2] ?? after[after.length - 1];
    const cur = after[after.length - 1];
    const steppedThisFrame = after.length > before;
    const expected = cur.poses.map((c, i) =>
      cur.teleported.has(i) || after.length < 2 ? c : lerpCarPose(prev.poses[i], c, alpha));
    const cars = [...scene.cars].reverse();
    cars.forEach((c, i) => {
      expect(c.x, `image ${f}, voiture ${i}`).toBeCloseTo(expected[i].chassis.x, 9);
      expect(c.y, `image ${f}, voiture ${i}`).toBeCloseTo(expected[i].chassis.y, 9);
      expect(c.angle, `image ${f}, voiture ${i}`).toBeCloseTo(expected[i].chassis.angle, 9);
      expect(c.wheels[1].x, `image ${f}, voiture ${i}`).toBeCloseTo(expected[i].wheels[1].x, 9);
    });
    expect(scene.t, `image ${f}`).toBeCloseTo(sim.time - (1 - alpha) * DT, 12);
    const target = cameraTarget(expected[0], (x) => heightAt(sim.track, x));
    camera.update(target.x, target.y, target.speed, elapsedMs / 1000);
    expect(camX, `image ${f}`).toBeCloseTo(camera.x, 9);
    expect(camY, `image ${f}`).toBeCloseTo(camera.y, 9);
    if (steppedThisFrame && cur.teleported.has(0)) teleportFramesChecked++;
    if (alpha > 0.1 && alpha < 0.9 && Math.abs(cur.poses[0].chassis.x - prev.poses[0].chassis.x) > 0.01) interpolatedFrames++;
  }
  // Contrôles vivants : la réapparition de Galahad tombe en dernier pas d'une image, et l'interpolation
  // dessine bien entre deux pas distincts.
  expect(teleportFramesChecked).toBeGreaterThanOrEqual(1);
  expect(interpolatedFrames).toBeGreaterThan(20);
});
