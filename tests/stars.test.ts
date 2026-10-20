import { CONFIG } from '../src/config';
import { generateTrack } from '../src/track/generate';
import { heightAt } from '../src/track/query';
import { mulberry32 } from '../src/track/rng';
import { placeStars } from '../src/track/stars';

const SEEDS = Array.from({ length: 50 }, (_, i) => i);
const LEN = 1680;
const tracks = SEEDS.map((seed) => generateTrack(seed, LEN, CONFIG));

describe('placement des étoiles (seeds 0..49, 1 680 m)', () => {
  test('aucune étoile à moins de STAR_EXCLUSION_BEFORE_LAVA avant une lave', () => {
    for (const t of tracks) {
      for (const s of t.stars) {
        for (const v of t.volcanoes) {
          const inZone = s.x >= v.xLava - CONFIG.STAR_EXCLUSION_BEFORE_LAVA && s.x <= v.xLava;
          expect(inZone, `seed ${t.seed} étoile x=${s.x} lave ${v.xLava}`).toBe(false);
        }
      }
    }
  });

  test("aucune étoile sur le plat d'arrivée", () => {
    for (const t of tracks) {
      for (const s of t.stars) expect(s.x).toBeLessThan(t.xFinish - CONFIG.FINISH_PLAT_BEFORE);
    }
  });

  test('aucune étoile sur le plat de départ', () => {
    for (const t of tracks) {
      for (const s of t.stars) expect(s.x).toBeGreaterThan(t.xStart);
    }
  });

  test('au moins 5 étoiles pour 1 680 m', () => {
    for (const t of tracks) expect(t.stars.length, `seed ${t.seed}`).toBeGreaterThanOrEqual(5);
  });

  test('y = hauteur du sol + 0,6', () => {
    for (const t of tracks) {
      for (const s of t.stars) expect(s.y - heightAt(t, s.x)).toBeCloseTo(0.6, 9);
    }
  });

  test('ids uniques, croissants à partir de 0, dans l’ordre des x', () => {
    for (const t of tracks) {
      t.stars.forEach((s, i) => {
        expect(s.id).toBe(i);
        if (i > 0) expect(s.x).toBeGreaterThan(t.stars[i - 1].x);
      });
    }
  });

  test('déterministe : même graine, mêmes étoiles ; generateTrack les assigne', () => {
    for (const t of tracks.slice(0, 10)) {
      expect(t.stars).toEqual(generateTrack(t.seed, LEN, CONFIG).stars);
      expect(placeStars(t, mulberry32(7), CONFIG)).toEqual(placeStars(t, mulberry32(7), CONFIG));
    }
  });
});
