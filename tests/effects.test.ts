// Effets de particules : logique pure sous node (aucun DOM ; `draw` n'est appelé que sur un faux contexte).
import { CONFIG } from '../src/config';
import { Effects, MAX_PARTICLES } from '../src/render/effects';
import { generateTrack } from '../src/track/generate';
import { fosses, tremplins } from '../src/track/query';
import type { Track } from '../src/track/types';
import { fakeCtx } from './helpers/fake-ctx';

const emptyTrack = { volcanoes: [] } as unknown as Track;

test('spawnSparks ajoute 20 à 40 particules', () => {
  const fx = new Effects(CONFIG);
  fx.spawnSparks(10, 2);
  expect(fx.count).toBeGreaterThanOrEqual(20);
  expect(fx.count).toBeLessThanOrEqual(40);
});

test('update(5) tue toutes les étincelles', () => {
  const fx = new Effects(CONFIG);
  fx.spawnSparks(10, 2);
  fx.update(5, emptyTrack, 10, 20);
  expect(fx.count).toBe(0);
});

test('le plafond est de 300 particules après 50 spawnSparks', () => {
  const fx = new Effects(CONFIG);
  for (let i = 0; i < 50; i++) fx.spawnSparks(0, 0);
  expect(fx.count).toBeLessThanOrEqual(MAX_PARTICLES);
  expect(fx.count).toBe(300);
});

test('spawnDust(x, y, 5) ajoute 10 particules, plafonné à 12', () => {
  const fx = new Effects(CONFIG);
  fx.spawnDust(0, 0, 5);
  expect(fx.count).toBe(10);
  const big = new Effects(CONFIG);
  big.spawnDust(0, 0, 100);
  expect(big.count).toBe(12);
});

test('la poussière disparaît en moins de 1 s', () => {
  const fx = new Effects(CONFIG);
  fx.spawnDust(0, 0, 5);
  fx.update(1.1, emptyTrack, 0, 20);
  expect(fx.count).toBe(0);
});

test('un volcan visible produit bulles et fumée ; hors portée, rien', () => {
  const track = generateTrack(3, 1680, CONFIG);
  const v = track.volcanoes[0];
  expect(v).toBeDefined();
  const near = new Effects(CONFIG);
  for (let i = 0; i < 30; i++) near.update(0.1, track, v.xLava, 20);
  expect(near.count).toBeGreaterThan(0);
  const far = new Effects(CONFIG);
  for (let i = 0; i < 30; i++) far.update(0.1, track, v.xLava + 1000, 20);
  expect(far.count).toBe(0);
});

test('un grand dt unique produit aussi des particules de lave', () => {
  const track = generateTrack(3, 1680, CONFIG);
  const fx = new Effects(CONFIG);
  fx.update(3, track, track.volcanoes[0].xLava, 20);
  expect(fx.count).toBeGreaterThan(0);
  expect(fx.count).toBeLessThanOrEqual(MAX_PARTICLES);
});

test('fosse (tâche 5g) : bulles et fumée au ras du sol (rimY 0, sans changement de code) ; tremplin : au rebord', () => {
  /** y (m) des particules dessinées, en coordonnées du monde (toScreen identité). */
  const ys = (fx: Effects): number[] => {
    const out: number[] = [];
    const ctx = new Proxy({}, {
      get: (_t, prop: string) => (prop === 'arc' ? (_x: number, y: number) => { out.push(y); } : () => {}),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    fx.draw(ctx, (p) => p, 1);
    return out;
  };
  const track = generateTrack(3, 1680, CONFIG);
  const one = (v: Track['volcanoes'][number]) => ({ volcanoes: [v] }) as unknown as Track;
  const f = fosses(track)[0];
  const tr = tremplins(track)[0];
  const atFosse = new Effects(CONFIG);
  atFosse.update(0.51, one(f), f.xLava, 20);
  const yF = ys(atFosse);
  expect(yF.length).toBeGreaterThan(0);
  for (const y of yF) expect(y).toBeCloseTo(f.rimY - 0.15, 9);
  expect(f.rimY).toBe(0);
  const atTremplin = new Effects(CONFIG);
  atTremplin.update(0.51, one(tr), tr.xLava, 20);
  for (const y of ys(atTremplin)) expect(y).toBeCloseTo(CONFIG.RIM_HEIGHT - 0.15, 9);
});

test('rockBurst (tâche 11c) : + 24 particules (14 éclats, 10 grains de poussière), jamais au-delà de MAX_PARTICLES, toutes mortes après 1,2 s', () => {
  const fx = new Effects(CONFIG);
  fx.spawnSparks(0, 0);
  const before = fx.count;
  fx.rockBurst(10, 0.8);
  expect(fx.count).toBe(before + 24);
  const full = new Effects(CONFIG);
  for (let i = 0; i < 20; i++) full.rockBurst(0, 0);
  expect(full.count).toBe(MAX_PARTICLES);
  const fresh = new Effects(CONFIG);
  fresh.rockBurst(10, 0.8);
  for (let i = 0; i < 72; i++) fresh.update(1 / 60, emptyTrack, 10, 20);
  expect(fresh.count).toBe(0);
});

test('rockBurst : les éclats tombent (gravité) et tournent ; dessinés sans fuite d’état', () => {
  const fx = new Effects(CONFIG);
  fx.rockBurst(10, 0.8);
  const { ctx, state } = fakeCtx();
  fx.update(0.3, emptyTrack, 10, 20);
  fx.draw(ctx, (p) => ({ x: p.x * 50, y: -p.y * 50 }), 50);
  expect(state().depth).toBe(0);
  expect(state().globalAlpha).toBe(1);
});
