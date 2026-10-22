// Fumée sans DOM : un faux contexte 2D enregistre les appels de dessin.
import { CONFIG } from '../src/config';
import { Camera } from '../src/render/camera';
import { drawCar } from '../src/render/car';
import type { CarView } from '../src/render/renderer';
import { drawStar, drawTrack } from '../src/render/track';
import { generateTrack } from '../src/track/generate';
import { fosses, tremplins } from '../src/track/query';

/** Appel de méthode du contexte, avec le fillStyle courant au moment de l'appel. */
type Call = { name: string; args: unknown[]; fillStyle?: unknown };
function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => {
        calls.push({ name: prop, args, fillStyle: target.fillStyle });
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
    color: '#1e5cff', accent: '#e2231a', helmet: '#00ff00', name: 'Robot', turbo: true,
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

test('drawCar peint le casque avec `helmet` (et plus avec `accent`)', () => {
  const car: CarView = {
    x: 10, y: 1, angle: 0, wheels: [], color: '#ff8000', accent: '#3cd2be', helmet: '#ffa040', name: 'Malo', turbo: false,
  };
  const { ctx, calls } = fakeCtx();
  drawCar(ctx, car, 85.7, 0, (p) => p);
  // Premier disque dessiné : le casque du pilote (avant la carrosserie, qui en cache le bas).
  const firstArcFill = calls.find((c, i) => c.name === 'fill' && calls.slice(0, i).some((d) => d.name === 'arc'));
  expect(firstArcFill?.fillStyle).toBe('#ffa040');
  // L'accent reste sur l'aileron et les bandes.
  expect(calls.filter((c) => c.name === 'fillRect').map((c) => c.fillStyle)).toContain('#3cd2be');
});

test('drawStar ne lève pas', () => {
  const { ctx, calls } = fakeCtx();
  drawStar(ctx, 100, 100, 2, 85.7);
  expect(calls.filter((c) => c.name === 'lineTo')).toHaveLength(9);
});

describe('fosses (tâche 5g, saut §6.7)', () => {
  /** Piste de 1 680 m avec un tremplin et une fosse, et la première fosse, le premier tremplin. */
  const seed = [0, 1, 2, 3, 4, 5].find((s) => {
    const t = generateTrack(s, 1680, CONFIG);
    return fosses(t).length > 0 && tremplins(t).length > 0;
  })!;
  const track = generateTrack(seed, 1680, CONFIG);
  const f = fosses(track)[0];
  const tr = tremplins(track)[0];
  const draw = (x: number) => {
    const cam = new Camera(CONFIG);
    cam.update(x, 2, 0, 1 / 60);
    const { ctx, calls } = fakeCtx();
    drawTrack(ctx, track, cam, view, 3.7);
    return { cam, calls };
  };

  test('une fosse et son panneau se dessinent sans erreur : halo (dégradé), lave, langues de feu ; triangle jaune à xLancement', () => {
    const atFosse = draw(f.xLava).calls;
    expect(atFosse.some((c) => c.name === 'createLinearGradient')).toBe(true);
    expect(atFosse.some((c) => c.name === 'fill' && (c.fillStyle === '#ff7a1a' || c.fillStyle === '#ffd23f'))).toBe(true);
    // Le panneau est 32 m avant le bord : hors de la vue de la fosse (≈ 22 m de large), dans celle de l'approche.
    const sign = (calls: Call[]) => calls.some((c) => c.name === 'fill' && c.fillStyle === '#ffd400');
    expect(sign(atFosse)).toBe(false);
    expect(sign(draw(f.xLancement).calls)).toBe(true);
    // Pas de panneau devant un tremplin.
    expect(sign(draw(tr.xLancement).calls)).toBe(false);
  });

  test('aucun plot lumineux au-dessus de la lave d’une fosse', () => {
    const { cam, calls } = draw(f.xLava);
    const ppm = cam.pxPerMeter(view.h);
    const [a, b] = [f.xBord - 0.3, f.xReception + 0.3].map((x) => cam.worldToScreen({ x, y: 0 }, view.w, view.h).x);
    const posts = calls.filter((c) => c.name === 'fillRect' && c.fillStyle === '#e8ffff').map((c) => (c.args[0] as number) + 0.04 * ppm);
    expect(posts.length).toBeGreaterThan(0);
    for (const x of posts) expect(x > a && x < b, `plot en ${x} px, lave sur [${a}, ${b}] px`).toBe(false);
  });

  test('le cône sombre reste réservé aux tremplins', () => {
    const cone = (calls: Call[]) => calls.some((c) => c.name === 'fill' && c.fillStyle === '#5a4a4a');
    expect(cone(draw(f.xLava).calls)).toBe(false);
    expect(cone(draw(tr.xLava).calls)).toBe(true);
  });
});
