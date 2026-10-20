// Effets de particules : logique pure sous node (aucun DOM, `draw` n'est pas appelé).
import { CONFIG } from '../src/config';
import { Effects, MAX_PARTICLES } from '../src/render/effects';
import { generateTrack } from '../src/track/generate';
import type { Track } from '../src/track/types';

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
