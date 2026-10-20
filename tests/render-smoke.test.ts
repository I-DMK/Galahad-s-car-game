// Fumée sans DOM : un faux contexte 2D enregistre les appels de dessin.
import { CONFIG } from '../src/config';
import { Camera } from '../src/render/camera';
import { drawCar } from '../src/render/car';
import type { CarView } from '../src/render/renderer';
import { drawStar, drawTrack } from '../src/render/track';
import { generateTrack } from '../src/track/generate';

type Call = { name: string; args: unknown[] };
function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => {
        calls.push({ name: prop, args });
        return prop.startsWith('create') ? gradient : undefined;
      };
    },
    set(target, prop: string, value) { target[prop] = value; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const view = { w: 1920, h: 1200, scale: 1.5 };

test('drawTrack ne parcourt que la portion visible (± 5 m)', () => {
  const track = generateTrack(3, 2000, CONFIG);
  const cam = new Camera(CONFIG);
  cam.update(track.volcanoes[0]?.xLava ?? 500, 2, 0, 1 / 60);
  const { ctx, calls } = fakeCtx();
  drawTrack(ctx, track, cam, view, 1.2);
  const ppm = cam.pxPerMeter(view.h);
  const xs = calls.filter((c) => c.name === 'lineTo').map((c) => c.args[0] as number);
  expect(xs.length).toBeGreaterThan(100);
  expect(xs.length).toBeLessThan(2 * ((view.w / ppm + 12) / CONFIG.TRACK_POINT_SPACING) + 200);
  for (const x of xs) {
    expect(x).toBeGreaterThan(-6 * ppm);
    expect(x).toBeLessThan(view.w + 6 * ppm);
  }
});

test('drawTrack dessine la fin de piste (arrivée, mur) sans erreur', () => {
  const track = generateTrack(3, 2000, CONFIG);
  const cam = new Camera(CONFIG);
  cam.update(track.xWall, 3, 0, 1 / 60);
  const { ctx, calls } = fakeCtx();
  drawTrack(ctx, track, cam, view, 0);
  expect(calls.some((c) => c.name === 'strokeRect')).toBe(true); // mur
});

test('drawCar tourne la carrosserie de −angle (nez en haut = anti-horaire à l’écran)', () => {
  const car: CarView = {
    x: 10, y: 1, angle: 0.3,
    wheels: [{ x: 9.25, y: 0.4, angle: 1 }, { x: 10.75, y: 0.4, angle: 1 }],
    color: '#1e5cff', accent: '#e2231a', name: 'Robot', turbo: true,
  };
  const { ctx, calls } = fakeCtx();
  drawCar(ctx, car, 85.7, 0.5, (p) => ({ x: p.x * 10, y: -p.y * 10 }));
  const rotations = calls.filter((c) => c.name === 'rotate').map((c) => c.args[0]);
  expect(rotations).toEqual([-0.3, -1, -1]);
  expect(calls.some((c) => c.name === 'fillText' && c.args[0] === 'Robot')).toBe(true);
  const { ctx: ctx2, calls: calls2 } = fakeCtx();
  drawCar(ctx2, { ...car, name: 'Galahad' }, 85.7, 0.5, (p) => p);
  expect(calls2.some((c) => c.name === 'fillText')).toBe(false);
});

test('drawStar ne lève pas', () => {
  const { ctx, calls } = fakeCtx();
  drawStar(ctx, 100, 100, 2, 85.7);
  expect(calls.filter((c) => c.name === 'lineTo')).toHaveLength(9);
});
