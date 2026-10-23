import { CONFIG } from '../src/config';
import { generateTrack } from '../src/track/generate';
import {
  fosses, heightAt, inElanZone, inGhostZone, inVolcanoZone, nearestVolcanoZone, nextFosse, sliceAt, slopeAt, tremplins,
  volcanoAhead, volcanoZoneLevel,
} from '../src/track/query';
import type { Track } from '../src/track/types';
import { trackFor } from './helpers/runs';

/** Piste de 3 000 m avec au moins deux tremplins et deux fosses (tâche 5g). */
function makeTrack(): Track {
  for (let seed = 0; seed < 200; seed++) {
    const t = generateTrack(seed, 3000, CONFIG);
    if (tremplins(t).length >= 2 && fosses(t).length >= 2) return t;
  }
  throw new Error('aucune piste avec deux tremplins et deux fosses');
}
const track = makeTrack();
const [t0, t1] = tremplins(track);
const [f0, f1] = fosses(track);

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
    const v = t0;
    const x = (v.xRampStart + v.xLip) / 2;
    expect(slopeAt(track, x)).toBeCloseTo(CONFIG.RAMP_ANGLE, 3);
  });

  test('négative en descente, 0 sur le plat, clampée aux extrémités', () => {
    const v = t0;
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

  test('volcanoAhead trouve aussi les fosses (champ xLava)', () => {
    expect(volcanoAhead(track, f0.xLancement)).toBe(f0);
    expect(volcanoAhead(track, f0.xBord)).toBe(f0);
    expect(volcanoAhead(track, f0.xLava + 0.01)).not.toBe(f0);
  });

  test('nearestVolcanoZone : [xLancement, xEnd)', () => {
    expect(nearestVolcanoZone(track, v0.xLancement - 0.01)).toBeUndefined();
    expect(nearestVolcanoZone(track, v0.xLancement)).toBe(v0);
    expect(nearestVolcanoZone(track, (v0.xLancement + v0.xLava) / 2)).toBe(v0);
    expect(nearestVolcanoZone(track, v0.xLava)).toBe(v0);
    expect(nearestVolcanoZone(track, v0.xEnd - 0.01)).toBe(v0);
    expect(nearestVolcanoZone(track, v0.xEnd)).toBeUndefined();
    expect(nearestVolcanoZone(track, v1.xLava)).toBe(v1);
    expect(nearestVolcanoZone(track, 0)).toBeUndefined();
    // Fosse : de l'approche (xLancement, après le plat de garde) à la fin de la réception.
    expect(nearestVolcanoZone(track, f0.xLancement - 0.01)).toBeUndefined();
    expect(nearestVolcanoZone(track, f0.xLancement)).toBe(f0);
    expect(nearestVolcanoZone(track, f0.xReception)).toBe(f0);
    expect(nearestVolcanoZone(track, f0.xEnd - 0.01)).toBe(f0);
  });

  test('tremplins, fosses : par sorte, dans l’ordre de la piste', () => {
    expect([...tremplins(track), ...fosses(track)].sort((a, b) => a.xLancement - b.xLancement)).toEqual(track.volcanoes);
    expect(tremplins(track).every((v) => v.kind === 'tremplin')).toBe(true);
    expect(fosses(track).every((v) => v.kind === 'fosse')).toBe(true);
  });

  test('nextFosse : première fosse dont le bord amont est strictement devant x', () => {
    expect(nextFosse(track, 0)).toBe(f0);
    expect(nextFosse(track, f0.xLancement)).toBe(f0);
    expect(nextFosse(track, f0.xBord - 0.01)).toBe(f0);
    expect(nextFosse(track, f0.xBord)).toBe(f1);
    expect(nextFosse(track, f0.xReception)).toBe(f1);
    const last = fosses(track)[fosses(track).length - 1];
    expect(nextFosse(track, last.xBord)).toBeUndefined();
  });

  test('inElanZone : [xElanStart, xLip] d’un tremplin, bornes incluses, plat d’élan et rampe seulement', () => {
    expect(inElanZone(track, t0.xElanStart - 0.01)).toBe(false);
    expect(inElanZone(track, t0.xElanStart)).toBe(true);
    expect(inElanZone(track, t0.xRampStart)).toBe(true);
    expect(inElanZone(track, (t0.xRampStart + t0.xLip) / 2)).toBe(true);
    expect(inElanZone(track, t0.xLip)).toBe(true);
    expect(inElanZone(track, t0.xLip + 0.01)).toBe(false);
    expect(inElanZone(track, t0.xLava)).toBe(false);
    expect(inElanZone(track, t0.xReception)).toBe(false);
    expect(inElanZone(track, t0.xLancement)).toBe(false);
    expect(inElanZone(track, t1.xElanStart + 1)).toBe(true);
    expect(inElanZone(track, 0)).toBe(false);
  });

  test('inElanZone : faux sur toute une fosse (tâche 5g : délais FLIP_SECONDS / SIDE_SECONDS sur son approche)', () => {
    const slice = track.slices.find((s) => s.type === 'fosse' && s.xEnd > f0.xLancement)!;
    for (let x = slice.xStart; x <= slice.xEnd; x += 0.1) expect(inElanZone(track, x), `x = ${x}`).toBe(false);
  });

  test('inGhostZone : tremplin, châssis dans [xLancement, xReception + WHEEL_BASE/2 + WHEEL_RADIUS] (voiture entière avant la réception)', () => {
    // La roue arrière dépasse de WHEEL_BASE/2 + WHEEL_RADIUS = 1,2 m derrière le châssis.
    const rear = CONFIG.WHEEL_BASE / 2 + CONFIG.WHEEL_RADIUS;
    expect(rear).toBeCloseTo(1.2, 9);
    expect(inGhostZone(track, t0.xLancement - 0.01, CONFIG)).toBe(false);
    expect(inGhostZone(track, t0.xLancement, CONFIG)).toBe(true);
    expect(inGhostZone(track, t0.xElanStart, CONFIG)).toBe(true);
    expect(inGhostZone(track, t0.xLip, CONFIG)).toBe(true);
    expect(inGhostZone(track, t0.xLava, CONFIG)).toBe(true);
    expect(inGhostZone(track, t0.xReception, CONFIG)).toBe(true);
    expect(inGhostZone(track, t0.xReception + 1, CONFIG)).toBe(true);
    expect(inGhostZone(track, t0.xReception + rear, CONFIG)).toBe(true);
    expect(inGhostZone(track, t0.xReception + rear + 0.01, CONFIG)).toBe(false);
    expect(inGhostZone(track, t0.xEnd - 0.01, CONFIG)).toBe(false);
    expect(inGhostZone(track, t1.xLancement + 1, CONFIG)).toBe(true);
    expect(inGhostZone(track, 0, CONFIG)).toBe(false);
    expect(inGhostZone(track, track.xStart, CONFIG)).toBe(false);
  });

  test('inGhostZone : fosse, châssis dans [xLancement − FOSSE_GUARD, bord aval + FOSSE_GHOST_AFTER] (ruling R-F16, garde comprise depuis le tour 1 de la tâche 6)', () => {
    expect(CONFIG.FOSSE_GHOST_AFTER).toBe(40);
    const slice = sliceAt(track, f0.xLancement);
    expect(slice.type).toBe('fosse');
    expect(f0.xLancement - CONFIG.FOSSE_GUARD).toBeCloseTo(slice.xStart, 6);
    expect(inGhostZone(track, f0.xLancement - CONFIG.FOSSE_GUARD - 0.01, CONFIG)).toBe(false);
    expect(inGhostZone(track, f0.xLancement - CONFIG.FOSSE_GUARD, CONFIG)).toBe(true);
    expect(inGhostZone(track, f0.xLancement - 0.01, CONFIG)).toBe(true);
    expect(inGhostZone(track, f0.xLancement, CONFIG)).toBe(true);
    expect(inGhostZone(track, f0.xBord, CONFIG)).toBe(true);
    expect(inGhostZone(track, f0.xReception, CONFIG)).toBe(true);
    expect(inGhostZone(track, f0.xReception + CONFIG.FOSSE_RESPAWN_AFTER, CONFIG)).toBe(true);
    expect(inGhostZone(track, f0.xReception + 40, CONFIG)).toBe(true);
    expect(inGhostZone(track, f0.xReception + 40.01, CONFIG)).toBe(false);
    expect(inGhostZone(track, f0.xEnd - 0.01, CONFIG)).toBe(false);
  });

  test('piste sans volcan', () => {
    const t = generateTrack(1, 1000, CONFIG, { onlyPlat: true });
    expect(volcanoAhead(t, 10)).toBeUndefined();
    expect(nearestVolcanoZone(t, 10)).toBeUndefined();
    expect(inElanZone(t, 10)).toBe(false);
    expect(inGhostZone(t, 10, CONFIG)).toBe(false);
  });
});

describe('inVolcanoZone (tâche 7, ruling R7-13 : une seule définition pour le driver et l’élastique)', () => {
  test('vrai sur [xLancement, xLava] des tremplins et des fosses des graines 0 à 9, bornes incluses ; faux à ± 1 cm', () => {
    let n = 0;
    for (let seed = 0; seed < 10; seed++) {
      const t = trackFor(seed);
      for (const v of t.volcanoes) {
        const what = `g${seed} ${v.kind} ${v.xLancement.toFixed(1)}`;
        expect(inVolcanoZone(t, v.xLancement), what).toBe(true);
        expect(inVolcanoZone(t, v.xLava), what).toBe(true);
        expect(inVolcanoZone(t, (v.xLancement + v.xLava) / 2), what).toBe(true);
        expect(inVolcanoZone(t, v.xLancement - 0.01), what).toBe(false);
        expect(inVolcanoZone(t, v.xLava + 0.01), what).toBe(false);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(30);
  });

  test('volcanoZoneLevel (tour 1, une seule définition, un seul balayage) : 2 sur [xLancement, xLava], 1 sur la pré-zone [xLancement − 40, xLancement[, 0 à ± 1 cm hors des bornes (graines 0 à 9)', () => {
    for (let seed = 0; seed < 10; seed++) {
      const t = trackFor(seed);
      for (const v of t.volcanoes) {
        const what = `g${seed} ${v.kind} ${v.xLancement.toFixed(1)}`;
        expect(volcanoZoneLevel(t, v.xLancement, 40), what).toBe(2);
        expect(volcanoZoneLevel(t, v.xLava, 40), what).toBe(2);
        expect(volcanoZoneLevel(t, v.xLancement - 0.01, 40), what).toBe(1);
        expect(volcanoZoneLevel(t, v.xLancement - 40, 40), what).toBe(1);
        expect(volcanoZoneLevel(t, v.xLancement - 40.01, 40), what).toBe(0);
        expect(volcanoZoneLevel(t, v.xLava + 0.01, 40), what).toBe(0);
        // Sans marge : la zone seule, comme inVolcanoZone.
        expect(volcanoZoneLevel(t, v.xLancement - 0.01), what).toBe(0);
        expect(volcanoZoneLevel(t, v.xLancement), what).toBe(2);
      }
    }
  });

  test('fosse : la garde n’en fait pas partie ; tremplin : l’élan et la rampe en font partie', () => {
    expect(inVolcanoZone(track, f0.xLancement - CONFIG.FOSSE_GUARD)).toBe(false);
    expect(inVolcanoZone(track, f0.xBord)).toBe(true);
    expect(inVolcanoZone(track, t0.xElanStart)).toBe(true);
    expect(inVolcanoZone(track, t0.xLip)).toBe(true);
    expect(inVolcanoZone(track, t0.xReception)).toBe(false);
    expect(inVolcanoZone(generateTrack(1, 1000, CONFIG, { onlyPlat: true }), 10)).toBe(false);
  });
});
