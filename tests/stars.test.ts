// Étoiles v2 (plan B, tâche 2 ; addendum §1.5) : curseur global sur les zones admissibles, étoiles d'élan
// tirées un volcan sur deux, plancher de STAR_MIN_COUNT, aucune étoile dans [xElanStart, xLava].
import { CONFIG, type Config } from '../src/config';
import { generateTrack } from '../src/track/generate';
import { heightAt } from '../src/track/query';
import { mulberry32 } from '../src/track/rng';
import { placeStars } from '../src/track/stars';
import type { Star, Track } from '../src/track/types';

const LEN = 1680;
const SEEDS_20 = Array.from({ length: 20 }, (_, i) => i);
const SEEDS_50 = Array.from({ length: 50 }, (_, i) => i);
const tracks50 = SEEDS_50.map((seed) => generateTrack(seed, LEN, CONFIG));
const tracks20 = tracks50.slice(0, 20);

const xFinishLimit = (t: Track): number => t.xFinish - CONFIG.FINISH_PLAT_BEFORE;

/** Zones admissibles telles que définies par le plan (tâche 2, point 1), pour vérifier chaque étoile. */
function admissibleZones(t: Track): [number, number][] {
  const zones: [number, number][] = [];
  t.slices.forEach((sl, i) => {
    if (sl.type === 'plat' && i > 0) zones.push([sl.xStart, Math.min(sl.xEnd, xFinishLimit(t))]);
  });
  for (const v of t.volcanoes) {
    zones.push([v.xLancement, v.xElanStart - CONFIG.STAR_ELAN_GAP]);
    zones.push([v.xReception, v.xEnd]);
  }
  return zones.filter(([a, b]) => b - a > 0);
}

const isElanStar = (t: Track, s: Star): boolean =>
  t.volcanoes.some((v) => Math.abs(s.x - (v.xElanStart - CONFIG.STAR_ELAN_OFFSET)) < 1e-9);

describe('constantes', () => {
  test('STAR_STEP_* / STAR_MIN_COUNT / STAR_ELAN_* ; STAR_EXCLUSION_BEFORE_LAVA retirée', () => {
    expect(CONFIG.STAR_STEP_MIN).toBe(80);
    expect(CONFIG.STAR_STEP_MAX).toBe(130);
    expect(CONFIG.STAR_MIN_COUNT).toBe(6);
    expect(CONFIG.STAR_ELAN_OFFSET).toBe(2);
    expect(CONFIG.STAR_ELAN_GAP).toBe(5);
    expect('STAR_EXCLUSION_BEFORE_LAVA' in CONFIG).toBe(false);
  });
});

describe('invariants (graines 0..49, 1 680 m)', () => {
  test('aucune étoile dans [xElanStart, xLava]', () => {
    for (const t of tracks50) {
      for (const s of t.stars) {
        for (const v of t.volcanoes) {
          const inZone = s.x >= v.xElanStart && s.x <= v.xLava;
          expect(inZone, `seed ${t.seed} étoile x=${s.x} élan ${v.xElanStart} lave ${v.xLava}`).toBe(false);
        }
      }
    }
  });

  test('aucune étoile sur le plat de départ', () => {
    for (const t of tracks50) {
      const start = t.slices[0];
      expect(start.type).toBe('plat');
      for (const s of t.stars) {
        expect(s.x, `seed ${t.seed}`).toBeGreaterThan(t.xStart);
        expect(s.x, `seed ${t.seed}`).toBeGreaterThanOrEqual(start.xEnd);
      }
    }
  });

  test("aucune étoile après xFinish − FINISH_PLAT_BEFORE (plat d'arrivée)", () => {
    for (const t of tracks50) {
      for (const s of t.stars) expect(s.x, `seed ${t.seed}`).toBeLessThanOrEqual(xFinishLimit(t));
    }
  });

  test('chaque étoile est dans une zone admissible ou est une étoile d’élan (xElanStart − 2)', () => {
    for (const t of tracks50) {
      const zones = admissibleZones(t);
      for (const s of t.stars) {
        const ok = isElanStar(t, s) || zones.some(([a, b]) => s.x >= a - 1e-9 && s.x <= b + 1e-9);
        expect(ok, `seed ${t.seed} étoile x=${s.x}`).toBe(true);
      }
    }
  });

  test('y = hauteur du sol + 0,6', () => {
    for (const t of tracks50) {
      for (const s of t.stars) expect(s.y - heightAt(t, s.x)).toBeCloseTo(0.6, 9);
    }
  });

  test('ids 0..n−1 dans l’ordre des x, x strictement croissants', () => {
    for (const t of tracks50) {
      t.stars.forEach((s, i) => {
        expect(s.id).toBe(i);
        if (i > 0) expect(s.x, `seed ${t.seed}`).toBeGreaterThan(t.stars[i - 1].x);
      });
    }
  });

  test('déterministe : même graine, mêmes étoiles ; generateTrack les assigne', () => {
    for (const t of tracks50.slice(0, 10)) {
      expect(t.stars).toEqual(generateTrack(t.seed, LEN, CONFIG).stars);
      expect(placeStars(t, mulberry32(7), CONFIG)).toEqual(placeStars(t, mulberry32(7), CONFIG));
    }
  });
});

describe('nombre d’étoiles (graines 0..19, 1 680 m)', () => {
  test('entre 6 et 14 (cible 8 à 12, addendum §1.5)', () => {
    const counts = tracks20.map((t) => t.stars.length);
    for (const t of tracks20) {
      expect(t.stars.length, `seed ${t.seed} : ${counts.join(' ')}`).toBeGreaterThanOrEqual(6);
      expect(t.stars.length, `seed ${t.seed} : ${counts.join(' ')}`).toBeLessThanOrEqual(14);
    }
  });
});

describe('curseur global', () => {
  test('piste onlyPlat : écarts entre étoiles tous dans [STAR_STEP_MIN, STAR_STEP_MAX]', () => {
    for (const seed of SEEDS_20) {
      const t = generateTrack(seed, LEN, CONFIG, { onlyPlat: true });
      expect(t.volcanoes).toEqual([]);
      expect(t.stars.length).toBeGreaterThanOrEqual(6);
      // Première étoile à un pas du début de la première zone admissible (fin du plat de départ).
      const first = t.stars[0].x - t.slices[0].xEnd;
      expect(first, `seed ${seed}`).toBeGreaterThanOrEqual(CONFIG.STAR_STEP_MIN - 1e-9);
      expect(first, `seed ${seed}`).toBeLessThanOrEqual(CONFIG.STAR_STEP_MAX + 1e-9);
      for (let i = 1; i < t.stars.length; i++) {
        const gap = t.stars[i].x - t.stars[i - 1].x;
        expect(gap, `seed ${seed} étoile ${i}`).toBeGreaterThanOrEqual(CONFIG.STAR_STEP_MIN - 1e-9);
        expect(gap, `seed ${seed} étoile ${i}`).toBeLessThanOrEqual(CONFIG.STAR_STEP_MAX + 1e-9);
      }
      // Pas de place pour une étoile de plus avant le plat d'arrivée.
      expect(xFinishLimit(t) - t.stars[t.stars.length - 1].x).toBeLessThan(CONFIG.STAR_STEP_MAX);
    }
  });

  test('pas tirés dans [STAR_STEP_MIN, STAR_STEP_MAX] : rng = 0 → pas minimal, rng → 1 → pas maximal', () => {
    const t = generateTrack(3, LEN, CONFIG, { onlyPlat: true });
    const atMin = placeStars(t, () => 0, CONFIG);
    const atMax = placeStars(t, () => 1 - 1e-12, CONFIG);
    for (let i = 1; i < atMin.length; i++) expect(atMin[i].x - atMin[i - 1].x).toBeCloseTo(CONFIG.STAR_STEP_MIN, 9);
    for (let i = 1; i < atMax.length; i++) expect(atMax[i].x - atMax[i - 1].x).toBeCloseTo(CONFIG.STAR_STEP_MAX, 6);
    expect(atMin.length).toBeGreaterThan(atMax.length);
  });

  test('la distance ne s’accumule que sur les zones admissibles (plat, lancement, réception)', () => {
    // Chaque étoile du curseur se trouve dans une zone admissible : les bosses, rampes-sauts, double-bosses,
    // l'élan, la rampe, la vallée et le volcan n'en reçoivent jamais. rng = 0,99 : aucune étoile d'élan tirée
    // (seules celles du plancher, à xElanStart − 2, peuvent s'ajouter).
    for (const t of tracks20) {
      const zones = admissibleZones(t);
      for (const s of placeStars(t, () => 0.99, CONFIG)) {
        if (isElanStar(t, s)) continue;
        expect(zones.some(([a, b]) => s.x >= a - 1e-9 && s.x <= b + 1e-9), `seed ${t.seed} x=${s.x}`).toBe(true);
      }
    }
  });
});

describe('plancher', () => {
  const cfg: Config = { ...CONFIG, STAR_STEP_MIN: 100_000, STAR_STEP_MAX: 100_000 };
  test('aucune étoile du curseur ni d’élan tirée → min(6, nVolcans) étoiles d’élan, dans l’ordre de la piste', () => {
    for (const t of tracks50) {
      const stars = placeStars(t, () => 0.99, cfg);
      const n = Math.min(cfg.STAR_MIN_COUNT, t.volcanoes.length);
      expect(stars.length, `seed ${t.seed}`).toBe(n);
      stars.forEach((s, i) => {
        expect(s.id).toBe(i);
        expect(s.x).toBeCloseTo(t.volcanoes[i].xElanStart - cfg.STAR_ELAN_OFFSET, 9);
        expect(s.y).toBeCloseTo(heightAt(t, s.x) + 0.6, 9);
      });
    }
  });

  test('sans volcan, le plancher ne peut rien ajouter', () => {
    const t = generateTrack(5, LEN, CONFIG, { onlyPlat: true });
    expect(placeStars(t, () => 0.99, cfg)).toEqual([]);
  });

  test('le plancher complète seulement jusqu’à STAR_MIN_COUNT', () => {
    // rng = 0.2 : étoile d'élan tirée à chaque volcan (0,2 < 0,5) → déjà nVolcans étoiles ; le plancher
    // n'ajoute rien de plus (il ne peut que viser des volcans sans étoile d'élan).
    for (const t of tracks50) {
      const stars = placeStars(t, () => 0.2, cfg);
      expect(stars.length, `seed ${t.seed}`).toBe(t.volcanoes.length);
    }
  });
});

describe('étoiles d’élan', () => {
  test('rng = 0 : chaque volcan a son étoile à xElanStart − 2, aucune autre à moins de 3 m, aucune dans [xElanStart, xLava]', () => {
    for (const t of tracks50) {
      const stars = placeStars(t, () => 0, CONFIG);
      for (const v of t.volcanoes) {
        const xe = v.xElanStart - CONFIG.STAR_ELAN_OFFSET;
        const elan = stars.filter((s) => Math.abs(s.x - xe) < 1e-9);
        expect(elan.length, `seed ${t.seed} volcan ${v.xLancement}`).toBe(1);
        for (const s of stars) {
          if (s === elan[0]) continue;
          expect(Math.abs(s.x - xe), `seed ${t.seed} étoile x=${s.x} élan ${xe}`)
            .toBeGreaterThanOrEqual(CONFIG.STAR_ELAN_GAP - CONFIG.STAR_ELAN_OFFSET - 1e-9);
          expect(s.x >= v.xElanStart && s.x <= v.xLava, `seed ${t.seed} étoile x=${s.x}`).toBe(false);
        }
      }
      stars.forEach((s, i) => {
        expect(s.id).toBe(i);
        if (i > 0) expect(s.x).toBeGreaterThan(stars[i - 1].x);
      });
    }
  });

  test('rng ≥ 0,5 sur le tirage : aucune étoile d’élan hors plancher', () => {
    for (const t of tracks50) {
      const stars = placeStars(t, () => 0.5, CONFIG);
      const elan = stars.filter((s) => isElanStar(t, s));
      // Le plancher n'intervient que si le curseur en a posé moins de 6.
      if (stars.length - elan.length >= CONFIG.STAR_MIN_COUNT) expect(elan, `seed ${t.seed}`).toEqual([]);
      else expect(stars.length, `seed ${t.seed}`).toBe(Math.min(CONFIG.STAR_MIN_COUNT, (stars.length - elan.length) + t.volcanoes.length));
    }
  });
});
