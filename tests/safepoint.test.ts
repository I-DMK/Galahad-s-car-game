import { CONFIG } from '../src/config';
import { forbiddenZone, isSafePointCandidate } from '../src/cars/safepoint';
import { newCarState } from '../src/cars/state';
import { generateTrack } from '../src/track/generate';
import type { Track } from '../src/track/types';

const DEG = Math.PI / 180;

function makeTrack(): Track {
  for (let seed = 0; seed < 10; seed++) {
    const t = generateTrack(seed, 1680, CONFIG);
    if (t.volcanoes.length >= 1) return t;
  }
  throw new Error('aucune piste avec volcan');
}
const track = makeTrack();
const v = track.volcanoes[0];
const [zoneStart, zoneEnd] = forbiddenZone(v, CONFIG);

function state() {
  const s = newCarState('a', 'A', '#fff', '#000', { x: 0, y: 0, angle: 0 });
  s.lastSafePointAt = 0;
  return s;
}
// Un instant et une position acceptables par défaut, hors de toute zone interdite.
const okX = track.xStart + 1;
const ok = { x: okX, t: 1, bothWheelsOnGround: true, carAngle: 0, groundSlope: 0 };

describe('forbiddenZone', () => {
  test('= [élan + 25 %, réception)', () => {
    expect(zoneStart).toBeCloseTo(v.xElanStart + (1 - CONFIG.ELAN_SAFE_FRACTION) * (v.xRampStart - v.xElanStart), 9);
    expect(zoneEnd).toBe(v.xReception);
    expect(zoneStart).toBeGreaterThan(v.xElanStart);
    expect(zoneStart).toBeLessThan(v.xRampStart);
  });
});

describe('isSafePointCandidate', () => {
  test('sanity : le cas de base est accepté', () => {
    expect(track.volcanoes.some((w) => okX >= forbiddenZone(w, CONFIG)[0] && okX < forbiddenZone(w, CONFIG)[1])).toBe(false);
    expect(isSafePointCandidate(ok, state(), track, CONFIG)).toBe(true);
  });

  test('refusé : moins de 0,5 s depuis le dernier point sûr', () => {
    const s = state();
    s.lastSafePointAt = 0.8;
    expect(isSafePointCandidate({ ...ok, t: 1.2 }, s, track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, t: 1.3 }, s, track, CONFIG)).toBe(true);
  });

  test('refusé : une roue en l’air', () => {
    expect(isSafePointCandidate({ ...ok, bothWheelsOnGround: false }, state(), track, CONFIG)).toBe(false);
  });

  test('refusé : voiture inclinée de 20° ou plus', () => {
    expect(isSafePointCandidate({ ...ok, carAngle: 25 * DEG }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, carAngle: -25 * DEG }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, carAngle: 15 * DEG }, state(), track, CONFIG)).toBe(true);
  });

  test('refusé : pente de 15°', () => {
    expect(isSafePointCandidate({ ...ok, groundSlope: 15 * DEG }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, groundSlope: -15 * DEG }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, groundSlope: 5 * DEG }, state(), track, CONFIG)).toBe(true);
  });

  test('refusé : dans la zone interdite (demi-ouverte)', () => {
    const mid = (zoneStart + zoneEnd) / 2;
    expect(isSafePointCandidate({ ...ok, x: mid }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: zoneStart }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: v.xLava - 1 }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: zoneEnd }, state(), track, CONFIG)).toBe(true);
  });

  test('accepté : plat de réception et premier quart de l’élan', () => {
    expect(isSafePointCandidate({ ...ok, x: v.xReception + 3 }, state(), track, CONFIG)).toBe(true);
    expect(isSafePointCandidate({ ...ok, x: v.xElanStart + 0.1 * (zoneStart - v.xElanStart) }, state(), track, CONFIG)).toBe(true);
    expect(isSafePointCandidate({ ...ok, x: zoneStart - 0.01 }, state(), track, CONFIG)).toBe(true);
  });
});
