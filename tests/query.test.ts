import { CONFIG } from '../src/config';
import { generateTrack } from '../src/track/generate';
import { heightAt, inElanZone, nearestVolcanoZone, sliceAt, slopeAt, volcanoAhead } from '../src/track/query';
import type { Track } from '../src/track/types';

function makeTrack(): Track {
  for (let seed = 0; seed < 200; seed++) {
    const t = generateTrack(seed, 3000, CONFIG);
    if (t.volcanoes.length >= 2) return t;
  }
  throw new Error('aucune piste avec deux volcans');
}
const track = makeTrack();

describe('heightAt', () => {
  test('exact aux points, interpolé entre deux points', () => {
    for (let i = 0; i < track.points.length; i += 37) {
      expect(heightAt(track, track.points[i].x)).toBeCloseTo(track.points[i].y, 9);
    }
    const i = track.points.findIndex((p) => p.y > 0.2);
    const a = track.points[i - 1], b = track.points[i];
    expect(heightAt(track, (a.x + b.x) / 2)).toBeCloseTo((a.y + b.y) / 2, 9);
  });

  test('clampé aux extrémités', () => {
    expect(heightAt(track, -50)).toBe(track.points[0].y);
    expect(heightAt(track, track.length + 50)).toBe(track.points[track.points.length - 1].y);
  });
});

describe('slopeAt', () => {
  test('≈ RAMP_ANGLE au milieu de la rampe, positive en montée', () => {
    const v = track.volcanoes[0];
    const x = (v.xRampStart + v.xLip) / 2;
    expect(slopeAt(track, x)).toBeCloseTo(CONFIG.RAMP_ANGLE, 3);
  });

  test('négative en descente, 0 sur le plat, clampée aux extrémités', () => {
    const v = track.volcanoes[0];
    expect(slopeAt(track, v.xLip + 1)).toBeLessThan(0);
    expect(slopeAt(track, v.xElanStart + 1)).toBeCloseTo(0, 9);
    expect(slopeAt(track, -10)).toBeCloseTo(0, 9);
    expect(slopeAt(track, track.length + 10)).toBeCloseTo(0, 9);
  });
});

describe('sliceAt', () => {
  test('renvoie la tranche contenant x, bornes incluses à gauche', () => {
    for (const s of track.slices) {
      expect(sliceAt(track, s.xStart)).toBe(s);
      expect(sliceAt(track, (s.xStart + s.xEnd) / 2)).toBe(s);
    }
  });

  test('clampé aux extrémités', () => {
    expect(sliceAt(track, -5)).toBe(track.slices[0]);
    expect(sliceAt(track, track.length + 5)).toBe(track.slices[track.slices.length - 1]);
  });
});

describe('volcanoAhead / nearestVolcanoZone', () => {
  const [v0, v1] = track.volcanoes;

  test('volcanoAhead : premier volcan dont xLava > x', () => {
    expect(volcanoAhead(track, 0)).toBe(v0);
    expect(volcanoAhead(track, v0.xLava - 0.01)).toBe(v0);
    expect(volcanoAhead(track, v0.xLava)).toBe(v1);
    expect(volcanoAhead(track, v0.xLava + 1)).toBe(v1);
    const last = track.volcanoes[track.volcanoes.length - 1];
    expect(volcanoAhead(track, last.xLava)).toBeUndefined();
    expect(volcanoAhead(track, track.length)).toBeUndefined();
  });

  test('nearestVolcanoZone : [xLancement, xEnd)', () => {
    expect(nearestVolcanoZone(track, v0.xLancement - 0.01)).toBeUndefined();
    expect(nearestVolcanoZone(track, v0.xLancement)).toBe(v0);
    expect(nearestVolcanoZone(track, v0.xElanStart)).toBe(v0);
    expect(nearestVolcanoZone(track, v0.xLava)).toBe(v0);
    expect(nearestVolcanoZone(track, v0.xEnd - 0.01)).toBe(v0);
    expect(nearestVolcanoZone(track, v0.xEnd)).toBeUndefined();
    expect(nearestVolcanoZone(track, v1.xLava)).toBe(v1);
    expect(nearestVolcanoZone(track, 0)).toBeUndefined();
  });

  test('inElanZone : [xElanStart, xLip], bornes incluses, plat d’élan et rampe seulement', () => {
    expect(inElanZone(track, v0.xElanStart - 0.01)).toBe(false);
    expect(inElanZone(track, v0.xElanStart)).toBe(true);
    expect(inElanZone(track, v0.xRampStart)).toBe(true);
    expect(inElanZone(track, (v0.xRampStart + v0.xLip) / 2)).toBe(true);
    expect(inElanZone(track, v0.xLip)).toBe(true);
    expect(inElanZone(track, v0.xLip + 0.01)).toBe(false);
    expect(inElanZone(track, v0.xLava)).toBe(false);
    expect(inElanZone(track, v0.xReception)).toBe(false);
    expect(inElanZone(track, v0.xLancement)).toBe(false);
    expect(inElanZone(track, v1.xElanStart + 1)).toBe(true);
    expect(inElanZone(track, 0)).toBe(false);
  });

  test('piste sans volcan', () => {
    const t = generateTrack(1, 1000, CONFIG, { onlyPlat: true });
    expect(volcanoAhead(t, 10)).toBeUndefined();
    expect(nearestVolcanoZone(t, 10)).toBeUndefined();
    expect(inElanZone(t, 10)).toBe(false);
  });
});
