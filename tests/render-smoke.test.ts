// Fumée sans DOM : un faux contexte 2D (tests/helpers/fake-ctx.ts) enregistre les appels de dessin.
import { CONFIG } from '../src/config';
import { Camera } from '../src/render/camera';
import { drawCar } from '../src/render/car';
import type { CarView } from '../src/render/renderer';
import { drawRock, drawStar, drawTrack, ROCK_FILL } from '../src/render/track';
import { generateTrack } from '../src/track/generate';
import { fosses, tremplins } from '../src/track/query';
import { canvasFont } from '../src/ui/font';
import { fakeCtx, type Call } from './helpers/fake-ctx';

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
    id: 'robot', x: 10, y: 1, angle: 0.3,
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

test('drawCar sans échelle de prénom (la course) : prénom en canvasFont(700, 14 × ppm / 57), inchangé par la tâche 10', () => {
  const car: CarView = {
    id: 'malo', x: 10, y: 1, angle: 0, wheels: [], color: '#ff8000', accent: '#3cd2be', helmet: '#ffa040', name: 'Malo', turbo: false,
  };
  const { ctx, calls } = fakeCtx();
  drawCar(ctx, car, 85.7, 0, (p) => p);
  const text = calls.find((c) => c.name === 'fillText')!;
  expect(text).toBeDefined();
  expect(ctx.font).toBe(canvasFont(700, (14 * 85.7) / 57));
  expect(canvasFont(700, (14 * 85.7) / 57)).toBe('700 21px Fredoka, system-ui, sans-serif');
});

test('drawCar peint le casque avec `helmet` (et plus avec `accent`)', () => {
  const car: CarView = {
    id: 'malo', x: 10, y: 1, angle: 0, wheels: [], color: '#ff8000', accent: '#3cd2be', helmet: '#ffa040', name: 'Malo', turbo: false,
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

test('plots lumineux : aucun à moins de 0,3 m de la lave, de part et d’autre (« overLava » avec marge), alors qu’ailleurs ils sont posés', () => {
  const base = generateTrack(3, 2000, CONFIG);
  const v = base.volcanoes[0];
  const P = Math.ceil(v.xLancement / 10) * 10 + 10;
  const cam = new Camera(CONFIG);
  cam.update(P, 2, 0, 1 / 60);
  const ppm = cam.pxPerMeter(view.h);
  const postsOf = (t: typeof base): number[] => {
    const { ctx, calls } = fakeCtx();
    drawTrack(ctx, t, cam, view, 0);
    return calls.filter((c) => c.name === 'fillRect' && c.fillStyle === '#e8ffff').map((c) => (c.args[0] as number) + 0.04 * ppm);
  };
  const at = (x: number) => cam.worldToScreen({ x, y: 0 }, view.w, view.h).x;
  // Sans volcan en vue : le plot du multiple de 10 m est posé (le contrôle n'est pas vide).
  const free = postsOf({ ...base, volcanoes: [] });
  expect(free.some((x) => Math.abs(x - at(P)) < 1e-6)).toBe(true);
  // Lave dont le bord amont est 0,2 m après le plot, puis dont le bord aval est 0,2 m avant lui : dans la marge de 0,3 m.
  for (const xLava of [P + 0.2 + v.lavaWidth / 2, P - 0.2 - v.lavaWidth / 2]) {
    const posts = postsOf({ ...base, volcanoes: [{ ...v, xLava }] });
    expect(posts.some((x) => Math.abs(x - at(P)) < 1e-6), `lave en ${xLava}`).toBe(false);
    expect(posts.length, 'les autres plots restent').toBeGreaterThan(0);
  }
  // Au-delà de la marge (0,4 m) : le plot est posé.
  const far = postsOf({ ...base, volcanoes: [{ ...v, xLava: P + 0.4 + v.lavaWidth / 2 }] });
  expect(far.some((x) => Math.abs(x - at(P)) < 1e-6)).toBe(true);
});

describe('fosses (tâche 5g, saut §6.7)', () => {
  /**
   * Piste de 1 680 m avec un tremplin et une fosse dont la lave couvre un multiple de 10 m (là où un plot serait planté
   * sans la règle « pas de plot au-dessus de la lave » : le test du plot n'est pas vide).
   */
  const POST = 10;
  const coversPost = (a: number, b: number): boolean => Math.ceil((a - 0.3) / POST) * POST <= b + 0.3;
  const seed = Array.from({ length: 30 }, (_, i) => i).find((s) => {
    const t = generateTrack(s, 1680, CONFIG);
    return tremplins(t).length > 0 && fosses(t).some((f) => coversPost(f.xBord, f.xReception));
  })!;
  const track = generateTrack(seed, 1680, CONFIG);
  const f = fosses(track).find((v) => coversPost(v.xBord, v.xReception))!;
  const tr = tremplins(track)[0];
  const draw = (x: number) => {
    const cam = new Camera(CONFIG);
    cam.update(x, 2, 0, 1 / 60);
    const { ctx, calls } = fakeCtx();
    drawTrack(ctx, track, cam, view, 3.7);
    return { cam, calls };
  };

  test('une fosse et son panneau se dessinent sans erreur : halo (dégradé radial), lave (dégradé linéaire), langues de feu ; triangle jaune à xLancement', () => {
    const { cam, calls: atFosse } = draw(f.xLava);
    const ppm = cam.pxPerMeter(view.h);
    // Deux dégradés pour la fosse : le halo (radial) et la lave (linéaire).
    const radial = atFosse.filter((c) => c.name === 'createRadialGradient');
    expect(radial).toHaveLength(1);
    expect(atFosse.filter((c) => c.name === 'createLinearGradient')).toHaveLength(1);
    // Halo : demi-largeur W/2 + 2 m (fondu sur les côtés), hauteur 3 m (étirement vertical du dégradé).
    const rx = radial[0].args[5] as number;
    expect(rx / ppm).toBeCloseTo(CONFIG.FOSSE_WIDTH / 2 + 2, 6);
    const scale = atFosse.find((c) => c.name === 'scale')!;
    expect(((scale.args[1] as number) * rx) / ppm).toBeCloseTo(3, 6);
    expect(atFosse.some((c) => c.name === 'fill' && (c.fillStyle === '#ff7a1a' || c.fillStyle === '#ffd23f'))).toBe(true);
    // Le panneau est 32 m avant le bord : hors de la vue de la fosse (≈ 22 m de large), dans celle de l'approche.
    const sign = (calls: Call[]) => calls.some((c) => c.name === 'fill' && c.fillStyle === '#ffd400');
    expect(sign(atFosse)).toBe(false);
    expect(sign(draw(f.xLancement).calls)).toBe(true);
    // Pas de panneau devant un tremplin.
    expect(sign(draw(tr.xLancement).calls)).toBe(false);
  });

  test('aucun plot lumineux au-dessus de la lave d’une fosse (la lave couvre un multiple de 10 m : sans la règle, un plot y serait)', () => {
    const { cam, calls } = draw(f.xLava);
    const ppm = cam.pxPerMeter(view.h);
    const [a, b] = [f.xBord - 0.3, f.xReception + 0.3].map((x) => cam.worldToScreen({ x, y: 0 }, view.w, view.h).x);
    const posts = calls.filter((c) => c.name === 'fillRect' && c.fillStyle === '#e8ffff').map((c) => (c.args[0] as number) + 0.04 * ppm);
    expect(posts.length).toBeGreaterThan(0);
    const expected = cam.worldToScreen({ x: Math.ceil((f.xBord - 0.3) / POST) * POST, y: 0 }, view.w, view.h).x;
    expect(expected > a && expected < b).toBe(true);
    for (const x of posts) expect(x > a && x < b, `plot en ${x} px, lave sur [${a}, ${b}] px`).toBe(false);
  });

  test('le cône sombre reste réservé aux tremplins', () => {
    const cone = (calls: Call[]) => calls.some((c) => c.name === 'fill' && c.fillStyle === '#5a4a4a');
    expect(cone(draw(f.xLava).calls)).toBe(false);
    expect(cone(draw(tr.xLava).calls)).toBe(true);
  });

  test('fosse au bord de la vue : dessinée dès que son halo (2 m de part et d’autre) y entre', () => {
    const cam = new Camera(CONFIG);
    cam.update(f.xLava, 2, 0, 1 / 60);
    const half = cam.visibleHalfWidthM(view.w, view.h);
    // Vue dont le bord droit (+ 5 m de marge) tombe 1 m avant le bord amont : le halo (2 m) y entre.
    const { calls } = draw(f.xBord - 1 - 5 - half + (f.xLava - cam.x));
    expect(calls.some((c) => c.name === 'createRadialGradient')).toBe(true);
  });
});

describe('drawRock (tâche 11c, spec « rochers » §5)', () => {
  const S = (x: number, y: number) => ({ x: x * 50, y: -y * 50 });
  const rock = { xStart: 100, xEnd: 103, height: CONFIG.ROCK_HEIGHT };
  const polygon = (calls: Call[]) => {
    // Le polygone du rocher : le premier chemin rempli de la couleur du rocher (moveTo + lineTo jusqu'au fill).
    const fill = calls.findIndex((c) => c.name === 'fill' && c.fillStyle === ROCK_FILL);
    const begin = calls.slice(0, fill).map((c) => c.name).lastIndexOf('beginPath');
    return calls.slice(begin, fill).filter((c) => c.name === 'moveTo' || c.name === 'lineTo').map((c) => ({ x: c.args[0] as number, y: c.args[1] as number }));
  };

  test('polygone de 7 à 9 sommets, dans la boîte [xStart, xEnd] × [sol, sol + height], qui touche le haut ; déterministe par id ; état du canvas restauré', () => {
    for (let id = 0; id < 20; id++) {
      const { ctx, calls, state } = fakeCtx();
      drawRock(ctx, rock, id, 0, 50, S);
      const pts = polygon(calls);
      expect(pts.length, `id ${id}`).toBeGreaterThanOrEqual(7);
      expect(pts.length, `id ${id}`).toBeLessThanOrEqual(9);
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(rock.xStart * 50 - 1e-9);
        expect(p.x).toBeLessThanOrEqual(rock.xEnd * 50 + 1e-9);
        expect(-p.y).toBeGreaterThanOrEqual(-1e-9);
        expect(-p.y).toBeLessThanOrEqual(rock.height * 50 + 1e-9);
      }
      expect(Math.max(...pts.map((p) => -p.y))).toBeCloseTo(rock.height * 50, 6);
      const { ctx: ctx2, calls: calls2 } = fakeCtx();
      drawRock(ctx2, rock, id, 0, 50, S);
      expect(polygon(calls2)).toEqual(pts);
      expect(state().depth).toBe(0);
      expect(state().underflows).toBe(0);
      expect(state().globalAlpha).toBe(1);
      // Ombre portée au sol (ellipse), pas noire opaque (les ombres des voitures sont '#000000').
      expect(calls.some((c) => c.name === 'ellipse')).toBe(true);
    }
    const shapes = new Set(Array.from({ length: 6 }, (_, id) => {
      const { ctx, calls } = fakeCtx();
      drawRock(ctx, rock, id, 0, 50, S);
      return JSON.stringify(polygon(calls));
    }));
    expect(shapes.size).toBeGreaterThan(1);
  });
});
