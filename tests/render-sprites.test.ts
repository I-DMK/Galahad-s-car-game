// Dessin des images (tâche 8b ; addendum « présentation » §1.1, §1.5) : carrosserie et roues en images aux poses de
// `CarView`, flammes du turbo, ombre au sol, étoile, et repli par code pièce par pièce. Faux contexte 2D, fausses images
// (`{ name }`) : on vérifie ce qui est dessiné, où, tourné de quoi, et dans quel ordre.
import { CONFIG } from '../src/config';
import type { Art } from '../src/render/assets';
import { NO_ART } from '../src/render/assets';
import { drawCar, drawShadow, flameFrame, flightHeight, shadowScale } from '../src/render/car';
import type { CarView } from '../src/render/renderer';
import { STAR_IMG_CENTER, drawStar } from '../src/render/track';
import { generateTrack } from '../src/track/generate';
import { heightAt, overLava, slopeAt } from '../src/track/query';
import { IDENTITY, fakeCtx, type Call, type Matrix } from './helpers/fake-ctx';
import { alphaCentroid, readPng8 } from './helpers/png';

const PPM = 85.7;
const S = (p: { x: number; y: number }) => ({ x: p.x * 10, y: -p.y * 10 });

const img = (name: string) => ({ name }) as unknown as CanvasImageSource;
const body = img('body');
const wheel = img('wheel');
const flames = [0, 1, 2, 3].map((i) => img(`flame-${i}`));
const star = img('star');
const art = (over: Partial<Art> = {}): Art => ({
  bodies: new Map([['galahad', body]]), wheel, flames, star, loaded: [], failed: [], ...over,
});

const car: CarView = {
  id: 'galahad', name: 'Galahad', color: '#1e5cff', accent: '#e2231a', helmet: '#00ff00', turbo: false,
  x: 10, y: 1, angle: 0.3,
  wheels: [{ x: 9.25, y: 0.4, angle: 1 }, { x: 10.75, y: 0.4, angle: -2 }],
};

const draws = (calls: Call[]) => calls.filter((c) => c.name === 'drawImage');
const before = (calls: Call[], c: Call, n: number) => calls.slice(calls.indexOf(c) - n, calls.indexOf(c)).map((d) => [d.name, ...d.args]);
const rotations = (calls: Call[]) => calls.filter((c) => c.name === 'rotate').map((c) => c.args[0]);

test('carrosserie image : cadre 2,80 × 1,40 m centré sur le châssis, tourné de −angle ; ni casque ni carrosserie par code', () => {
  const { ctx, calls } = fakeCtx();
  drawCar(ctx, car, PPM, 0, S, CONFIG, art());
  const d = draws(calls);
  expect(d.map((c) => c.args[0])).toEqual([body, wheel, wheel]);
  expect(d[0].args.slice(1)).toEqual([-1.4, -0.7, 2.8, 1.4]);
  expect(before(calls, d[0], 3)).toEqual([['translate', 100, -10], ['rotate', -0.3], ['scale', PPM, PPM]]);
  expect(calls.some((c) => c.name === 'fill' && c.fillStyle === car.helmet)).toBe(false);
  expect(calls.some((c) => c.name === 'arcTo')).toBe(false);
});

test('roue image à la position de chaque roue, tournée de −w.angle, par-dessus la carrosserie', () => {
  const { ctx, calls } = fakeCtx();
  drawCar(ctx, car, PPM, 0, S, CONFIG, art());
  const r = CONFIG.WHEEL_RADIUS * PPM;
  car.wheels.forEach((w, k) => {
    const d = draws(calls)[1 + k];
    expect(before(calls, d, 2)).toEqual([['translate', w.x * 10, -w.y * 10], ['rotate', -w.angle]]);
    expect(d.args.slice(1)).toEqual([-r, -r, 2 * r, 2 * r]);
  });
  // Pas de roue par code (pneu, jante, rayons) sous la roue image.
  expect(calls.some((c) => c.name === 'lineTo')).toBe(false);
});

test('la carrosserie vient de l’id de la voiture : celle de son pilote, jamais celle d’un autre', () => {
  const malo = img('malo');
  const bodies = new Map([['galahad', body], ['malo', malo]]);
  const { ctx, calls } = fakeCtx();
  drawCar(ctx, { ...car, id: 'malo', name: 'Malo' }, PPM, 0, S, CONFIG, art({ bodies }));
  expect(draws(calls)[0].args[0]).toBe(malo);
  const { ctx: ctx2, calls: calls2 } = fakeCtx();
  drawCar(ctx2, car, PPM, 0, S, CONFIG, art({ bodies }));
  expect(draws(calls2)[0].args[0]).toBe(body);
});

/** Matrice attendue d'une roue image : translation vers son centre écran, puis rotation de −angle (depuis l'identité). */
const wheelMatrix = (w: { x: number; y: number; angle: number }): Matrix => {
  const th = -w.angle;
  return [Math.cos(th), Math.sin(th), -Math.sin(th), Math.cos(th), w.x * 10, -w.y * 10];
};
const closeTo = (m: Matrix, want: Matrix) => m.forEach((v, i) => expect(v, `terme ${i}`).toBeCloseTo(want[i], 9));

describe('état du canvas rendu après chaque pièce (save/restore, globalAlpha)', () => {
  test('roues image : chacune part de l’identité, hors de tout save, et se referme ; rien ne reste à la fin de drawCar', () => {
    const { ctx, calls, state } = fakeCtx();
    drawCar(ctx, { ...car, turbo: true }, PPM, 0.1, S, CONFIG, art());
    const wheels = draws(calls).filter((c) => c.args[0] === wheel);
    expect(wheels).toHaveLength(2);
    car.wheels.forEach((w, k) => {
      // Dessinée dans son propre save (profondeur 1), translate puis rotate depuis l'identité.
      expect(wheels[k].depth, `roue ${k}`).toBe(1);
      closeTo(wheels[k].matrix, wheelMatrix(w));
      const tr = calls.filter((c) => c.name === 'translate').at(-2 + k)!;
      // Le translate de la roue part de l'identité, dans son propre save seulement (profondeur 1) : celle d'avant s'est refermée.
      expect(tr.depth, `translate de la roue ${k}`).toBe(1);
      expect(tr.matrix).toEqual(IDENTITY);
    });
    const st = state();
    expect([st.depth, st.underflows, st.globalAlpha]).toEqual([0, 0, 1]);
    closeTo(st.matrix, IDENTITY);
  });

  test('roues par code, carrosserie par code, flammes par code : même retour à l’identité', () => {
    const { ctx, state } = fakeCtx();
    drawCar(ctx, { ...car, turbo: true }, PPM, 0.1, S, CONFIG, art({ bodies: new Map(), wheel: null, flames: null }));
    const st = state();
    expect([st.depth, st.underflows, st.globalAlpha]).toEqual([0, 0, 1]);
    closeTo(st.matrix, IDENTITY);
  });

  test('étoile image : save/restore équilibrés, transformation rendue', () => {
    const { ctx, state } = fakeCtx();
    drawStar(ctx, 100, 50, 2, PPM, star);
    const st = state();
    expect([st.depth, st.underflows, st.globalAlpha]).toEqual([0, 0, 1]);
    closeTo(st.matrix, IDENTITY);
  });
});

describe('repli par code, image par image', () => {
  test('carrosserie absente : carrosserie par code avec son casque, les roues restent des images', () => {
    const { ctx, calls } = fakeCtx();
    drawCar(ctx, car, PPM, 0, S, CONFIG, art({ bodies: new Map() }));
    expect(draws(calls).map((c) => c.args[0])).toEqual([wheel, wheel]);
    expect(calls.some((c) => c.name === 'fill' && c.fillStyle === car.helmet)).toBe(true);
    expect(calls.some((c) => c.name === 'arcTo')).toBe(true);
  });

  test('une carrosserie d’un autre pilote seulement : la voiture est dessinée par code', () => {
    const { ctx, calls } = fakeCtx();
    drawCar(ctx, { ...car, id: 'pablo' }, PPM, 0, S, CONFIG, art());
    expect(draws(calls).map((c) => c.args[0])).toEqual([wheel, wheel]);
    expect(calls.some((c) => c.name === 'arcTo')).toBe(true);
  });

  test('roue absente : roues par code (rotation −w.angle), carrosserie image', () => {
    const { ctx, calls } = fakeCtx();
    drawCar(ctx, car, PPM, 0, S, CONFIG, art({ wheel: null }));
    expect(draws(calls).map((c) => c.args[0])).toEqual([body]);
    expect(rotations(calls)).toEqual([-0.3, -1, 2]);
  });

  test('sans art ou avec NO_ART : aucune image', () => {
    for (const a of [undefined, NO_ART]) {
      const { ctx, calls } = fakeCtx();
      drawCar(ctx, { ...car, turbo: true }, PPM, 0.4, S, CONFIG, a);
      expect(draws(calls)).toHaveLength(0);
      expect(rotations(calls)).toEqual([-0.3, -1, 2]);
    }
  });
});

describe('flammes du turbo (addendum §1.5)', () => {
  const T = 1.5 / 14; // image 1 de la boucle
  const turbo = { ...car, turbo: true };

  test('carrosserie image : flamme à l’accroche du gabarit, dessinée juste avant la carrosserie', () => {
    const { ctx, calls } = fakeCtx();
    drawCar(ctx, turbo, PPM, T, S, CONFIG, art());
    const d = draws(calls);
    expect(d.map((c) => c.args[0])).toEqual([flames[1], body, wheel, wheel]);
    const args = d[0].args.slice(1) as number[];
    [-2.17, -0.68, 1.2, 1.2].forEach((v, i) => expect(args[i]).toBeCloseTo(v, 9));
    expect(calls.indexOf(d[1]) - calls.indexOf(d[0])).toBe(1);
  });

  test('carrosserie par code : flamme à l’arrière de la carrosserie par code (−L/2 ; +0,08)', () => {
    const { ctx, calls } = fakeCtx();
    drawCar(ctx, turbo, PPM, T, S, CONFIG, art({ bodies: new Map() }));
    const d = draws(calls);
    expect(d.map((c) => c.args[0])).toEqual([flames[1], wheel, wheel]);
    const args = d[0].args.slice(1) as number[];
    [-1.96, -0.52, 1.2, 1.2].forEach((v, i) => expect(args[i]).toBeCloseTo(v, 9));
  });

  test('l’image change avec le temps : celle de flameFrame(t), dans l’ordre des 4', () => {
    for (let k = 0; k < 8; k++) {
      const { ctx, calls } = fakeCtx();
      drawCar(ctx, turbo, PPM, (k + 0.5) / 14, S, CONFIG, art());
      expect(draws(calls)[0].args[0]).toBe(flames[k % 4]);
    }
  });

  test('flammes absentes : flammes par code (orange), aucune image de flamme', () => {
    const { ctx, calls } = fakeCtx();
    drawCar(ctx, turbo, PPM, T, S, CONFIG, art({ flames: null }));
    expect(calls.some((c) => c.name === 'fill' && c.fillStyle === '#ff7a00')).toBe(true);
    expect(draws(calls).map((c) => c.args[0])).toEqual([body, wheel, wheel]);
  });

  test('une image de flamme manquante dans le tableau, à chacun des 4 index : jamais de drawImage(undefined), flammes par code', () => {
    for (let k = 0; k < 4; k++) {
      const holey = flames.map((f, i) => (i === k ? undefined : f)) as unknown as CanvasImageSource[];
      const { ctx, calls } = fakeCtx();
      drawCar(ctx, turbo, PPM, (k + 0.5) / 14, S, CONFIG, art({ flames: holey }));
      for (const d of draws(calls)) expect(d.args[0], `image ${k}`).toBeTruthy();
      expect(calls.some((c) => c.name === 'fill' && c.fillStyle === '#ff7a00'), `flammes par code, index ${k}`).toBe(true);
    }
  });

  test('flammes par code : accrochées à l’arrière de la carrosserie dessinée, −1,31 m (image) ou −L/2 (code)', () => {
    const firstMoveTo = (a: Art) => {
      const { ctx, calls } = fakeCtx();
      drawCar(ctx, turbo, PPM, T, S, CONFIG, a);
      return calls.find((c) => c.name === 'moveTo')!.args as number[];
    };
    // Première pointe de flamme : moveTo(x + 0,02 ; y − 0,09), y = ancrage − 0,14.
    const img = firstMoveTo(art({ flames: null }));
    expect(img[0]).toBeCloseTo(-1.31 + 0.02, 9);
    expect(img[1]).toBeCloseTo(-0.08 - 0.14 - 0.09, 9);
    const code = firstMoveTo(art({ flames: null, bodies: new Map() }));
    expect(code[0]).toBeCloseTo(-CONFIG.CAR_LENGTH / 2 + 0.02, 9);
    expect(code[1]).toBeCloseTo(0.08 - 0.14 - 0.09, 9);
  });

  test('sans turbo : aucune flamme', () => {
    const { ctx, calls } = fakeCtx();
    drawCar(ctx, car, PPM, T, S, CONFIG, art());
    expect(draws(calls).map((c) => c.args[0])).toEqual([body, wheel, wheel]);
    expect(calls.some((c) => c.name === 'fill' && c.fillStyle === '#ff7a00')).toBe(false);
  });
});

test('flameFrame : 14 images/s en boucle de 4, toujours dans [0, 3] (même pour un temps négatif)', () => {
  expect(flameFrame(0)).toBe(0);
  expect(flameFrame(0.5 / 14)).toBe(0);
  expect(flameFrame(1.5 / 14)).toBe(1);
  expect(flameFrame(3.5 / 14)).toBe(3);
  expect(flameFrame(4.5 / 14)).toBe(0);
  // Scene.t < 0 au départ : sim.time − (1 − α)·dt. Un index négatif donnerait drawImage(undefined), qui lève.
  expect(flameFrame(-0.5 / 14)).toBe(3);
  for (const t of [1e6 + 0.5 / 14, -1e6 - 0.3, -1e-9, 123.456]) {
    const f = flameFrame(t);
    expect(Number.isInteger(f) && f >= 0 && f <= 3, `t = ${t} → ${f}`).toBe(true);
  }
});

describe('ombre au sol (addendum §1.5)', () => {
  const track = generateTrack(1, 1680, CONFIG);
  const R = CONFIG.WHEEL_RADIUS;
  const x0 = track.xStart - 2;
  /** Voiture dont les deux roues sont à `lift` mètres au-dessus du sol (0 : posées à heightAt + R). */
  const carAt = (x: number, lift: number, extra: Partial<CarView> = {}): CarView => ({
    ...car, x, y: heightAt(track, x) + R + 0.25 + lift, angle: 0,
    wheels: [-0.75, 0.75].map((dx) => ({ x: x + dx, y: heightAt(track, x + dx) + R + lift, angle: 0 })),
    ...extra,
  });
  const ground = (x: number) => S({ x, y: heightAt(track, x) });

  /** Premier x (pas de 0,1 m) dont la pente vérifie `ok`, hors de la lave. */
  const findX = (ok: (slope: number) => boolean): number => {
    for (let x = track.xStart; x < track.xWall; x += 0.1) if (ok(slopeAt(track, x)) && !overLava(track, x)) return x;
    throw new Error('pente introuvable');
  };

  test('flightHeight : la roue la plus basse au-dessus du sol, jamais négative, 0 sans roue', () => {
    expect(flightHeight({ ...carAt(x0, 1), y: 50 }, track, R)).toBeCloseTo(1, 9); // les roues comptent, pas le châssis
    expect(flightHeight(carAt(x0, 0), track, R)).toBeCloseTo(0, 9);
    expect(flightHeight(carAt(x0, 1.5), track, R)).toBeCloseTo(1.5, 9);
    expect(flightHeight(carAt(x0, -0.3), track, R)).toBe(0);
    const a = carAt(x0, 1);
    const tilted = { ...a, wheels: [a.wheels[0], { ...a.wheels[1], y: a.wheels[1].y + 1 }] };
    expect(flightHeight(tilted, track, R)).toBeCloseTo(1, 9);
    expect(flightHeight(carAt(x0, 1, { wheels: [] }), track, R)).toBe(0);
  });

  test('shadowScale : 1 au sol, 0,5 à 1,5 m, 1/3 à 3 m, strictement décroissante', () => {
    expect(shadowScale(0)).toBe(1);
    expect(shadowScale(1.5)).toBeCloseTo(0.5, 12);
    expect(shadowScale(3)).toBeCloseTo(1 / 3, 12);
    const hs = [0, 0.5, 1, 2, 5, 20];
    for (let i = 1; i < hs.length; i++) expect(shadowScale(hs[i])).toBeLessThan(shadowScale(hs[i - 1]));
  });

  test('au sol : ellipse noire de 1,2 × 0,15 m posée sur le sol sous le châssis, inclinée de la pente', () => {
    const { ctx, calls } = fakeCtx();
    drawShadow(ctx, carAt(x0, 0), track, PPM, S);
    expect(calls.map((c) => c.name)).toEqual(['save', 'beginPath', 'ellipse', 'fill', 'restore']);
    const e = calls.find((c) => c.name === 'ellipse')!;
    const g = ground(x0);
    const want = [g.x, g.y, 1.2 * PPM, 0.15 * PPM, -slopeAt(track, x0), 0, 2 * Math.PI];
    want.forEach((v, i) => expect(e.args[i] as number, `argument ${i}`).toBeCloseTo(v, 9));
    const fill = calls.find((c) => c.name === 'fill')!;
    expect(fill.fillStyle).toBe('#000000');
    expect(fill.globalAlpha as number).toBeCloseTo(0.45, 9);
  });

  test('sur une montée comme sur une descente : l’ellipse suit la pente (rotation −slopeAt, de signe contraire à celui de la pente)', () => {
    const up = findX((s) => s > 0.25);
    const down = findX((s) => s < -0.25);
    for (const [x, sign] of [[up, -1], [down, 1]] as const) {
      const { ctx, calls } = fakeCtx();
      drawShadow(ctx, carAt(x, 0), track, PPM, S);
      const e = calls.find((c) => c.name === 'ellipse')!;
      const g = ground(x);
      expect(e.args[0] as number).toBeCloseTo(g.x, 9);
      expect(e.args[1] as number).toBeCloseTo(g.y, 9);
      expect(e.args[4] as number).toBeCloseTo(-slopeAt(track, x), 9);
      expect(Math.sign(e.args[4] as number), `pente ${slopeAt(track, x)}`).toBe(sign);
      expect(Math.abs(e.args[4] as number)).toBeGreaterThan(0.25);
    }
  });

  test('l’ombre rend l’état : globalAlpha à 1, pile vide, transformation inchangée (au sol et en vol)', () => {
    for (const lift of [0, 1.5, 4]) {
      const { ctx, calls, state } = fakeCtx();
      drawShadow(ctx, carAt(x0, lift), track, PPM, S);
      expect(calls.find((c) => c.name === 'fill')!.globalAlpha as number).toBeCloseTo(0.45 / (1 + lift / 1.5), 9);
      const st = state();
      expect([st.globalAlpha, st.depth, st.underflows], `vol ${lift} m`).toEqual([1, 0, 0]);
      expect(st.matrix).toEqual(IDENTITY);
    }
  });

  test('la hauteur de l’ombre vient des roues, pas du châssis : roues posées sous un châssis haut, l’ombre reste pleine', () => {
    const { ctx, calls } = fakeCtx();
    drawShadow(ctx, { ...carAt(x0, 0), y: heightAt(track, x0) + 20 }, track, PPM, S);
    const e = calls.find((c) => c.name === 'ellipse')!;
    expect(e.args[2] as number).toBeCloseTo(1.2 * PPM, 9);
    expect(calls.find((c) => c.name === 'fill')!.globalAlpha as number).toBeCloseTo(0.45, 9);
  });

  test('en vol à 1,5 m : moitié moins large, moitié moins sombre, toujours posée sur le sol', () => {
    const { ctx, calls } = fakeCtx();
    drawShadow(ctx, carAt(x0, 1.5), track, PPM, S);
    const e = calls.find((c) => c.name === 'ellipse')!;
    const g = ground(x0);
    expect(e.args[0] as number).toBeCloseTo(g.x, 9);
    expect(e.args[1] as number).toBeCloseTo(g.y, 9);
    expect(e.args[2] as number).toBeCloseTo(1.2 * PPM * 0.5, 9);
    expect(e.args[3] as number).toBeCloseTo(0.15 * PPM * 0.5, 9);
    expect(calls.find((c) => c.name === 'fill')!.globalAlpha as number).toBeCloseTo(0.45 * 0.5, 9);
  });

  test('au-dessus de la lave (tremplin ou fosse) : pas d’ombre, car heightAt y est le fond, sous la lave dessinée', () => {
    expect(track.volcanoes.length).toBeGreaterThan(0);
    for (const v of track.volcanoes) {
      const over = fakeCtx();
      drawShadow(over.ctx, carAt(v.xLava, 5), track, PPM, S);
      expect(over.calls.some((c) => c.name === 'ellipse'), `${v.kind} en ${v.xLava}`).toBe(false);
      // Sur toute la largeur de la lave (pas seulement au centre) : pas d'ombre ; juste de part et d'autre : une ombre.
      for (const x of [v.xLava - 0.4 * v.lavaWidth, v.xLava + 0.4 * v.lavaWidth]) {
        const inside = fakeCtx();
        drawShadow(inside.ctx, carAt(x, 0), track, PPM, S);
        expect(inside.calls.some((c) => c.name === 'ellipse'), `${v.kind} en xLava ± 0,4·largeur`).toBe(false);
      }
      for (const x of [v.xLava - v.lavaWidth / 2 - 0.05, v.xLava + v.lavaWidth / 2 + 0.05, v.xLava - v.lavaWidth / 2 - 0.5]) {
        const beside = fakeCtx();
        drawShadow(beside.ctx, carAt(x, 0), track, PPM, S);
        expect(beside.calls.some((c) => c.name === 'ellipse'), `${v.kind} à côté, ${x}`).toBe(true);
      }
    }
  });
});

describe('étoile (addendum §1.5)', () => {
  test('image : halo gardé, image tournée de t × 0,8 sur 1 m, sans la forme par code', () => {
    const { ctx, calls } = fakeCtx();
    drawStar(ctx, 100, 50, 2, PPM, star);
    expect(calls.filter((c) => c.name === 'createRadialGradient')).toHaveLength(1);
    expect(calls.filter((c) => c.name === 'lineTo')).toHaveLength(0);
    const d = draws(calls);
    expect(d).toHaveLength(1);
    expect(d[0].args).toEqual([star, -STAR_IMG_CENTER.x * PPM, -STAR_IMG_CENTER.y * PPM, PPM, PPM]);
    expect(before(calls, d[0], 2)).toEqual([['translate', 100, 50], ['rotate', 1.6]]);
    expect(calls.at(-1)!.name).toBe('restore');
  });

  test('l’image tourne autour de son centre de gravité (mesuré sur l’alpha de star.png), qui reste en (x, y) à toute rotation', () => {
    interface NodeFs { readFileSync(p: string): Uint8Array }
    const fs = (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): NodeFs } }).process.getBuiltinModule('node:fs');
    const png = readPng8(fs.readFileSync('public/sprites/star.png'));
    const c = alphaCentroid(png);
    const fx = c.x / png.width, fy = c.y / png.height;
    // Constantes de track.ts = mesure (à 0,5 mm près sur 1 m) ; la boîte, elle, a son centre à (0,5 ; 0,5) : 5 cm plus haut.
    expect(STAR_IMG_CENTER.x).toBeCloseTo(fx, 3);
    expect(STAR_IMG_CENTER.y).toBeCloseTo(fy, 3);
    expect(Math.abs(fy - 0.5) * 100, 'écart du centre de gravité au centre de la boîte (cm)').toBeGreaterThan(4);
    for (const t of [0, 0.7, 2, 5.3, 11]) {
      const { ctx, calls } = fakeCtx();
      drawStar(ctx, 100, 50, t, PPM, star);
      const d = draws(calls)[0];
      const [, dx, dy, w, h] = d.args as number[];
      // Point de l'image (centre de gravité), dans le repère local du dessin, puis passé par la matrice courante.
      const lx = dx + fx * w, ly = dy + fy * h;
      const [a, b, cc, dd, e, f] = d.matrix;
      expect(a * lx + cc * ly + e, `x à t = ${t}`).toBeCloseTo(100, 1);
      expect(b * lx + dd * ly + f, `y à t = ${t}`).toBeCloseTo(50, 1);
    }
  });

  test('sans image : l’étoile jaune par code d’aujourd’hui (9 lineTo), aucune image', () => {
    const { ctx, calls } = fakeCtx();
    drawStar(ctx, 100, 50, 2, PPM);
    expect(calls.filter((c) => c.name === 'lineTo')).toHaveLength(9);
    expect(draws(calls)).toHaveLength(0);
    const { ctx: ctx2, calls: calls2 } = fakeCtx();
    drawStar(ctx2, 100, 50, 2, PPM, null);
    expect(calls2.filter((c) => c.name === 'lineTo')).toHaveLength(9);
  });
});
