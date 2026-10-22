// Étoiles v2 (plan B, tâche 2 ; addendum §1.5) : curseur global sur les zones admissibles, étoiles d'élan
// tirées un volcan sur deux, plancher de STAR_MIN_COUNT, aucune étoile dans [xElanStart, xLava].
// Tâche 5g (saut §6.5, ruling R-F6) : fosses (réception seule, étoile de réception à la place de l'étoile d'élan, trou de
// ± STAR_ELAN_GAP autour d'elle) ; demande du papa : aucune étoile basse au début d'une réception, avant
// l'atterrissage le plus long doigt posé (STAR_TREMPLIN_LANDING, STAR_FOSSE_LANDING).
// Tâche 5e : les étoiles hautes s'ajoutent sans rien changer aux étoiles basses ; les règles du curseur, de l'élan
// et du plancher portent sur les étoiles basses (`low`), les étoiles hautes ont leurs tests (tests/high-stars.test.ts).
import { CONFIG, type Config } from '../src/config';
import { generateTrack } from '../src/track/generate';
import { heightAt, sliceAt } from '../src/track/query';
import { mulberry32 } from '../src/track/rng';
import { placeStars } from '../src/track/stars';
import type { Star, Track, Volcano } from '../src/track/types';

const LEN = 1680;
const SEEDS_20 = Array.from({ length: 20 }, (_, i) => i);
const SEEDS_50 = Array.from({ length: 50 }, (_, i) => i);
const tracks50 = SEEDS_50.map((seed) => generateTrack(seed, LEN, CONFIG));
const tracks20 = tracks50.slice(0, 20);

const xFinishLimit = (t: Track): number => t.xFinish - CONFIG.FINISH_PLAT_BEFORE;

/** Étoile de réception d'une fosse (tâche 5g) : bord aval + FOSSE_STAR_AFTER. */
const receptionStar = (v: Volcano): number => v.xReception + CONFIG.FOSSE_STAR_AFTER;
/** Étoile d'élan (tremplin) ou de réception (fosse) d'un volcan. */
const volcanoStar = (v: Volcano): number => (v.kind === 'tremplin' ? v.xElanStart - CONFIG.STAR_ELAN_OFFSET : receptionStar(v));
/** Atterrissage le plus long doigt posé après la réception (demande du papa, tâche 5g). */
const landing = (v: Volcano): number => (v.kind === 'tremplin' ? CONFIG.STAR_TREMPLIN_LANDING : CONFIG.STAR_FOSSE_LANDING);

/**
 * Zones admissibles telles que définies par le plan (tâche 2, point 1 ; tâche 5g, saut §6.5 et demande du papa), pour
 * vérifier chaque étoile : plats ; tremplin, plat de lancement jusqu'à xElanStart − GAP et réception après
 * l'atterrissage ; fosse, réception après l'atterrissage, moins ± GAP autour de l'étoile de réception.
 */
function admissibleZones(t: Track): [number, number][] {
  const zones: [number, number][] = [];
  t.slices.forEach((sl, i) => {
    if (sl.type === 'plat' && i > 0) zones.push([sl.xStart, Math.min(sl.xEnd, xFinishLimit(t))]);
  });
  for (const v of t.volcanoes) {
    if (v.kind === 'tremplin') {
      zones.push([v.xLancement, v.xElanStart - CONFIG.STAR_ELAN_GAP]);
      zones.push([v.xReception + landing(v), v.xEnd]);
    } else {
      const xr = receptionStar(v);
      zones.push([v.xReception + landing(v), xr - CONFIG.STAR_ELAN_GAP], [xr + CONFIG.STAR_ELAN_GAP, v.xEnd]);
    }
  }
  return zones.filter(([a, b]) => b - a > 0);
}

/** Étoiles basses (curseur et élan), sans les étoiles hautes de la tâche 5e. */
const low = (stars: Star[]): Star[] => stars.filter((s) => !s.high);

/** Étoile d'élan d'un tremplin ou de réception d'une fosse (hors curseur). */
const isElanStar = (t: Track, s: Star): boolean =>
  t.volcanoes.some((v) => Math.abs(s.x - volcanoStar(v)) < 1e-9);

describe('invariants (graines 0..49, 1 680 m)', () => {
  test('aucune étoile dans [xElanStart, xLava] d’un tremplin', () => {
    for (const t of tracks50) {
      for (const s of t.stars) {
        for (const v of t.volcanoes) {
          if (v.kind !== 'tremplin') continue;
          const inZone = s.x >= v.xElanStart && s.x <= v.xLava;
          expect(inZone, `seed ${t.seed} étoile x=${s.x} élan ${v.xElanStart} lave ${v.xLava}`).toBe(false);
        }
      }
    }
  });

  test('fosse : aucune étoile dans [début de la tranche, xReception) (ni garde, ni approche, ni lave)', () => {
    let n = 0;
    for (const t of tracks50) {
      for (const sl of t.slices) {
        if (sl.type !== 'fosse') continue;
        n++;
        const f = t.volcanoes.find((v) => v.kind === 'fosse' && Math.abs(v.xEnd - sl.xEnd) < 1e-9)!;
        for (const s of t.stars) expect(s.x >= sl.xStart && s.x < f.xReception, `seed ${t.seed} étoile x=${s.x}`).toBe(false);
      }
    }
    expect(n).toBeGreaterThan(60);
  });

  test('demande du papa (tâche 5g) : aucune étoile basse dans [xReception, xReception + atterrissage) d’un volcan, sauf l’étoile de réception d’une fosse, au-delà', () => {
    expect(CONFIG.FOSSE_STAR_AFTER).toBeGreaterThanOrEqual(CONFIG.STAR_FOSSE_LANDING);
    let reception = 0;
    for (const t of tracks50) {
      for (const v of t.volcanoes) {
        for (const s of low(t.stars)) {
          expect(s.x >= v.xReception && s.x < v.xReception + landing(v), `seed ${t.seed} ${v.kind} en ${v.xReception.toFixed(1)} : étoile x=${s.x.toFixed(1)}`).toBe(false);
          if (s.x >= v.xReception && s.x <= v.xEnd) reception++;
        }
      }
    }
    // Les réceptions portent encore des étoiles (étoiles de réception des fosses, curseur au-delà de l'atterrissage).
    expect(reception).toBeGreaterThan(40);
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

  // Les plats étoile (tâche 5e, Step 13) ne sont pas des zones admissibles : leurs étoiles sont hautes (tests/high-stars.test.ts).
  test('chaque étoile basse est dans une zone admissible ou est une étoile d’élan (xElanStart − 2)', () => {
    for (const t of tracks50) {
      const zones = admissibleZones(t);
      for (const s of low(t.stars)) {
        const ok = isElanStar(t, s) || zones.some(([a, b]) => s.x >= a - 1e-9 && s.x <= b + 1e-9);
        expect(ok, `seed ${t.seed} étoile x=${s.x}`).toBe(true);
      }
    }
  });

  test('y = hauteur du sol + 0,6 (étoiles basses)', () => {
    for (const t of tracks50) {
      for (const s of low(t.stars)) expect(s.y - heightAt(t, s.x)).toBeCloseTo(0.6, 9);
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
  // Le plancher de 6 n'est garanti ici que parce que ces graines ont ≥ 2 volcans (le plancher n'ajoute que des
  // étoiles d'élan ; une piste sans volcan peut en avoir moins, jusqu'à 0) : ne pas étendre ce test à 0..49.
  test('entre 6 et 14 (cible 8 à 12, addendum §1.5)', () => {
    const counts = tracks20.map((t) => low(t.stars).length);
    for (const t of tracks20) {
      expect(low(t.stars).length, `seed ${t.seed} : ${counts.join(' ')}`).toBeGreaterThanOrEqual(6);
      expect(low(t.stars).length, `seed ${t.seed} : ${counts.join(' ')}`).toBeLessThanOrEqual(14);
    }
  });
});

describe('curseur global', () => {
  test('piste onlyPlat : écarts entre étoiles tous dans [STAR_STEP_MIN, STAR_STEP_MAX]', () => {
    for (const seed of SEEDS_20) {
      const t0 = generateTrack(seed, LEN, CONFIG, { onlyPlat: true });
      const t = { ...t0, stars: low(t0.stars) };
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
    const atMin = low(placeStars(t, () => 0, CONFIG));
    const atMax = low(placeStars(t, () => 1 - 1e-12, CONFIG));
    for (let i = 1; i < atMin.length; i++) expect(atMin[i].x - atMin[i - 1].x).toBeCloseTo(CONFIG.STAR_STEP_MIN, 9);
    for (let i = 1; i < atMax.length; i++) expect(atMax[i].x - atMax[i - 1].x).toBeCloseTo(CONFIG.STAR_STEP_MAX, 6);
    expect(atMin.length).toBeGreaterThan(atMax.length);
  });

  test('la distance admissible cumulée entre deux étoiles de curseur consécutives est dans [STAR_STEP_MIN, STAR_STEP_MAX]', () => {
    // Vérification indépendante de l'implémentation : longueur admissible de [x1, x2] sommée tranche par tranche
    // à partir de `sliceAt` et des volcans (plat hors départ et hors plat d'arrivée en entier ; dans une tranche
    // rampe-volcan, seulement [xLancement, xElanStart − GAP] et la réception après l'atterrissage ; dans une fosse, la
    // réception après l'atterrissage, moins ± GAP autour de l'étoile de réception).
    const admissibleLength = (t: Track, x1: number, x2: number): number => {
      const overlap = (a: number, b: number): number => Math.max(0, Math.min(b, x2) - Math.max(a, x1));
      let len = 0;
      for (let x = x1; x < x2; ) {
        const sl = sliceAt(t, x);
        if (sl.type === 'plat' && sl.xStart > 0) len += overlap(sl.xStart, Math.min(sl.xEnd, xFinishLimit(t)));
        if (sl.type === 'rampe-volcan' || sl.type === 'fosse') {
          const v = t.volcanoes.find((w) => Math.abs(w.xEnd - sl.xEnd) < 1e-9)!;
          if (v.kind === 'tremplin') {
            len += overlap(v.xLancement, v.xElanStart - CONFIG.STAR_ELAN_GAP) + overlap(v.xReception + landing(v), v.xEnd);
          } else {
            const xr = receptionStar(v);
            len += overlap(v.xReception + landing(v), xr - CONFIG.STAR_ELAN_GAP) + overlap(xr + CONFIG.STAR_ELAN_GAP, v.xEnd);
          }
        }
        x = sl.xEnd + 1e-9;
      }
      return len;
    };
    let seen = 0;
    for (const t of tracks20) {
      const cursor = low(t.stars).filter((s) => !isElanStar(t, s));
      expect(cursor.length, `seed ${t.seed}`).toBeGreaterThan(0);
      for (let i = 1; i < cursor.length; i++) {
        const len = admissibleLength(t, cursor[i - 1].x, cursor[i].x);
        expect(len, `seed ${t.seed} ${cursor[i - 1].x} → ${cursor[i].x}`).toBeGreaterThanOrEqual(CONFIG.STAR_STEP_MIN - 1e-6);
        expect(len, `seed ${t.seed} ${cursor[i - 1].x} → ${cursor[i].x}`).toBeLessThanOrEqual(CONFIG.STAR_STEP_MAX + 1e-6);
        seen++;
      }
      // Et du début de la première zone admissible (fin du plat de départ) à la première étoile du curseur.
      const first = admissibleLength(t, t.slices[0].xEnd, cursor[0].x);
      expect(first, `seed ${t.seed}`).toBeGreaterThanOrEqual(CONFIG.STAR_STEP_MIN - 1e-6);
      expect(first, `seed ${t.seed}`).toBeLessThanOrEqual(CONFIG.STAR_STEP_MAX + 1e-6);
      // Queue : après la dernière étoile du curseur, la longueur admissible restante avant le plat d'arrivée ne
      // laisse pas la place d'un pas entier (un curseur qui s'arrêterait trop tôt serait vu ici).
      const tail = admissibleLength(t, cursor[cursor.length - 1].x, xFinishLimit(t));
      expect(tail, `seed ${t.seed}`).toBeLessThan(CONFIG.STAR_STEP_MAX);
    }
    expect(seen).toBeGreaterThan(50);
  });

  test('pas invalide ou étoile d’élan mal placée : erreur explicite (jamais de boucle infinie)', () => {
    const t = tracks20[0];
    const rng = mulberry32(1);
    expect(() => placeStars(t, rng, { ...CONFIG, STAR_STEP_MIN: 0 })).toThrow(/pas invalide/);
    expect(() => placeStars(t, rng, { ...CONFIG, STAR_STEP_MIN: 100, STAR_STEP_MAX: 50 })).toThrow(/pas invalide/);
    expect(() => placeStars(t, rng, { ...CONFIG, STAR_ELAN_GAP: 2 })).toThrow(/STAR_ELAN_GAP/);
    expect(() => placeStars(t, rng, { ...CONFIG, STAR_ELAN_GAP: 1, STAR_ELAN_OFFSET: 2 })).toThrow(/STAR_ELAN_GAP/);
    expect(() => placeStars(t, rng, { ...CONFIG, STAR_ELAN_OFFSET: -1 })).toThrow(/STAR_ELAN_GAP/);
    // Offset 0 : l'étoile d'élan tomberait exactement sur xElanStart, dans l'intervalle interdit [xElanStart, xLava].
    expect(() => placeStars(t, rng, { ...CONFIG, STAR_ELAN_OFFSET: 0 })).toThrow(/STAR_ELAN_GAP/);
    // Pas calculé ≤ 0 (rng hors [0, 1) ou NaN) : erreur, jamais de boucle sans fin.
    expect(() => placeStars(t, () => -2, CONFIG)).toThrow(/pas calculé invalide/);
    expect(() => placeStars(t, () => NaN, CONFIG)).toThrow(/pas calculé invalide/);
    expect(() => placeStars(t, rng, CONFIG)).not.toThrow();
  });
});

describe('plancher', () => {
  const cfg: Config = { ...CONFIG, STAR_STEP_MIN: 100_000, STAR_STEP_MAX: 100_000 };
  test('aucune étoile du curseur ni d’élan tirée → min(6, nVolcans) étoiles d’élan (tremplin) ou de réception (fosse), dans l’ordre de la piste', () => {
    let fosses = 0;
    for (const t of tracks50) {
      const stars = low(placeStars(t, () => 0.99, cfg));
      const n = Math.min(cfg.STAR_MIN_COUNT, t.volcanoes.length);
      expect(stars.length, `seed ${t.seed}`).toBe(n);
      stars.forEach((s, i) => {
        // Ids renumérotés sur toutes les étoiles (hautes comprises, tâche 5e) : croissants, pas forcément 0..n−1.
        if (i > 0) expect(s.id).toBeGreaterThan(stars[i - 1].id);
        if (t.volcanoes[i].kind === 'fosse') fosses++;
        expect(s.x).toBeCloseTo(volcanoStar(t.volcanoes[i]), 9);
        expect(s.y).toBeCloseTo(heightAt(t, s.x) + 0.6, 9);
      });
    }
    expect(fosses).toBeGreaterThan(30);
  });

  test('sans volcan, le plancher ne peut rien ajouter', () => {
    const t = generateTrack(5, LEN, CONFIG, { onlyPlat: true });
    expect(low(placeStars(t, () => 0.99, cfg))).toEqual([]);
  });

  test('le plancher complète seulement jusqu’à STAR_MIN_COUNT', () => {
    // rng = 0.2 : étoile d'élan tirée à chaque volcan (0,2 < 0,5) → déjà nVolcans étoiles ; le plancher
    // n'ajoute rien de plus (il ne peut que viser des volcans sans étoile d'élan).
    for (const t of tracks50) {
      const stars = low(placeStars(t, () => 0.2, cfg));
      expect(stars.length, `seed ${t.seed}`).toBe(t.volcanoes.length);
    }
  });
});

describe('étoiles d’élan (tremplins) et de réception (fosses)', () => {
  test('rng = 0 : chaque fosse a son étoile de réception à bord aval + FOSSE_STAR_AFTER (25 m), aucune autre étoile basse à moins de STAR_ELAN_GAP', () => {
    expect(CONFIG.FOSSE_STAR_AFTER).toBe(25);
    let n = 0;
    for (const t of tracks50) {
      const stars = low(placeStars(t, () => 0, CONFIG));
      for (const v of t.volcanoes) {
        if (v.kind !== 'fosse') continue;
        n++;
        const xr = receptionStar(v);
        const own = stars.filter((s) => Math.abs(s.x - xr) < 1e-9);
        expect(own.length, `seed ${t.seed} fosse ${v.xBord}`).toBe(1);
        for (const s of stars) {
          if (s !== own[0]) expect(Math.abs(s.x - xr), `seed ${t.seed} étoile x=${s.x}`).toBeGreaterThanOrEqual(CONFIG.STAR_ELAN_GAP - 1e-9);
        }
      }
    }
    expect(n).toBeGreaterThan(60);
  });

  test('tirée 1 fosse sur 2, comme l’étoile d’élan (même tirage) : CONFIG, graines 0 à 49', () => {
    let fosses = 0;
    let withStar = 0;
    for (const t of tracks50) {
      for (const v of t.volcanoes) {
        if (v.kind !== 'fosse') continue;
        fosses++;
        if (t.stars.some((s) => Math.abs(s.x - receptionStar(v)) < 1e-9)) withStar++;
      }
    }
    console.log(`étoiles de réception (graines 0 à 49) : ${withStar} sur ${fosses} fosses`);
    expect(withStar / fosses).toBeGreaterThan(0.3);
    expect(withStar / fosses).toBeLessThan(0.8);
  });

  test('rng = 0 : chaque tremplin a son étoile à xElanStart − 2, aucune autre à moins de 3 m, aucune dans [xElanStart, xLava]', () => {
    for (const t of tracks50) {
      const stars = low(placeStars(t, () => 0, CONFIG));
      for (const v of t.volcanoes) {
        if (v.kind !== 'tremplin') continue;
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
        // Ids renumérotés sur toutes les étoiles (hautes comprises, tâche 5e) : croissants, pas forcément 0..n−1.
        if (i > 0) expect(s.id).toBeGreaterThan(stars[i - 1].id);
        if (i > 0) expect(s.x).toBeGreaterThan(stars[i - 1].x);
      });
    }
  });

  test('rng ≥ 0,5 sur le tirage : aucune étoile d’élan hors plancher', () => {
    for (const t of tracks50) {
      const stars = low(placeStars(t, () => 0.5, CONFIG));
      const elan = stars.filter((s) => isElanStar(t, s));
      // Le plancher n'intervient que si le curseur en a posé moins de 6.
      if (stars.length - elan.length >= CONFIG.STAR_MIN_COUNT) expect(elan, `seed ${t.seed}`).toEqual([]);
      else expect(stars.length, `seed ${t.seed}`).toBe(Math.min(CONFIG.STAR_MIN_COUNT, (stars.length - elan.length) + t.volcanoes.length));
    }
  });
});
