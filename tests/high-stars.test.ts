// Étoiles hautes ajoutées (plan B, tâche 5e, Step 7 ; addendum « bouton saut » §2 amendé [plan], décision P1) :
// placement statique, graines 0 à 49, pistes de 1 680 m. Les règles sont revérifiées ici à partir des tranches,
// indépendamment de src/track/stars.ts. Le nombre d'étoiles hautes par course n'a pas encore de seuil : sa
// moyenne et le nombre de pistes qui en ont sont imprimés ; les seuils arrivent au Step 10, après la calibration
// (Step 9, validée par le papa).
import { CONFIG, type Config } from '../src/config';
import { simulateRace } from '../src/sim/harness';
import { AP } from './helpers/anciennes-pistes';
import type { SimEvent } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { heightAt, sliceAt } from '../src/track/query';
import { mulberry32 } from '../src/track/rng';
import { chooseHighStars, highStarCandidates, placeStars } from '../src/track/stars';
import type { Slice, SliceType, Star, Track } from '../src/track/types';

const LEN = 1680;
const SEEDS = Array.from({ length: 50 }, (_, i) => i);
const tracks = SEEDS.map((seed) => generateTrack(seed, LEN, CONFIG));
/** Mêmes pistes que CONFIG, sans étoiles hautes : les étoiles basses doivent y être les mêmes (décision P1). */
const OFF: Config = { ...CONFIG, STAR_HIGH_PER_RACE: 0 };
const tracksOff = SEEDS.map((seed) => generateTrack(seed, LEN, OFF));
/** Pistes d'avant (tâche 5e, Step 10) : celles de e02dcae sans étoiles hautes, figées par `PRE_5E_STARS`. */
const tracksPre = SEEDS.map((seed) => generateTrack(seed, LEN, AP));

const high = (stars: Star[]): Star[] => stars.filter((s) => s.high);
const low = (stars: Star[]): Star[] => stars.filter((s) => !s.high);

/**
 * sha1 des Float64 (id, x, y) des étoiles des graines 0 à 49, code d'avant la tâche 5e (HEAD ab5aa5d, avant le Step 7),
 * redonné par les pistes d'avant (`withAnciennesPistes`, Step 10).
 */
const PRE_5E_STARS = { count: 451, sha1: 'ad06a1aa695ab09290913d715c871d1e25288091' };

interface Hash { update(data: Uint8Array): Hash; digest(encoding: 'hex'): string }
const sha1 = (): Hash => (globalThis as unknown as {
  process: { getBuiltinModule(id: 'node:crypto'): { createHash(a: string): Hash } };
}).process.getBuiltinModule('node:crypto').createHash('sha1');

/** Dégagements recalculés ici : [fin, fin + dégagement] après chaque rampe-saut, bosses, double-bosse ou cratère. */
function clearances(t: Track, cfg: Config = CONFIG): [number, number][] {
  const bump: SliceType[] = ['bosses', 'double-bosse', 'cratère'];
  return t.slices.flatMap((sl): [number, number][] => {
    if (sl.type === 'rampe-saut') return [[sl.xEnd, sl.xEnd + cfg.STAR_HIGH_RAMP_CLEARANCE]];
    if (bump.includes(sl.type)) return [[sl.xEnd, sl.xEnd + cfg.STAR_HIGH_BUMP_CLEARANCE]];
    return [];
  });
}
const inOpen = (x: number, [a, b]: [number, number]): boolean => x > a + 1e-9 && x < b - 1e-9;

describe('étoiles hautes, graines 0 à 49 (1 680 m)', () => {
  test('0 ≤ n ≤ STAR_HIGH_PER_RACE par piste ; moyenne et pistes avec au moins une étoile haute imprimées (seuils au Step 10)', () => {
    const counts = tracks.map((t) => high(t.stars).length);
    for (const t of tracks) {
      const n = high(t.stars).length;
      expect(n, `graine ${t.seed}`).toBeGreaterThanOrEqual(0);
      expect(n, `graine ${t.seed}`).toBeLessThanOrEqual(CONFIG.STAR_HIGH_PER_RACE);
    }
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const withOne = counts.filter((n) => n > 0).length;
    const cands = tracks.map((t) => highStarCandidates(t, low(t.stars).map((s) => s.x), CONFIG).length);
    console.log(`étoiles hautes par course (graines 0 à 49, valeurs de départ PROVISOIRES) : moyenne ${mean.toFixed(2)}, `
      + `min ${Math.min(...counts)}, max ${Math.max(...counts)}, pistes avec au moins une ${withOne}/50 ; `
      + `par graine ${counts.join(' ')} ; candidates ${cands.join(' ')}`);
  });

  test('chaque étoile haute est sur une tranche plat éligible (ni départ ni arrivée), hors dégagements, à STAR_HIGH_GAP au moins de toute étoile basse', () => {
    let seen = 0;
    for (const t of tracks) {
      const cl = clearances(t);
      const lows = low(t.stars);
      for (const s of high(t.stars)) {
        seen++;
        const sl = sliceAt(t, s.x);
        const i = t.slices.indexOf(sl);
        const where = `graine ${t.seed}, étoile haute x = ${s.x.toFixed(2)} (${sl.type} [${sl.xStart.toFixed(1)}, ${sl.xEnd.toFixed(1)}])`;
        expect(sl.type, where).toBe('plat');
        expect(i, where).toBeGreaterThan(0);
        expect(sl.xEnd, where).toBeLessThan(t.xFinish - 1e-9);
        for (const c of cl) expect(inOpen(s.x, c), `${where} dans le dégagement [${c[0].toFixed(1)}, ${c[1].toFixed(1)}]`).toBe(false);
        for (const b of lows) expect(Math.abs(s.x - b.x), `${where}, étoile basse ${b.x.toFixed(2)}`).toBeGreaterThanOrEqual(CONFIG.STAR_HIGH_GAP - 1e-9);
      }
    }
    expect(seen).toBeGreaterThan(10);
  });

  test('[x − TAKEOFF_ROOM, x + LANDING_ROOM] est du terrain permis : après la zone de départ (xStart + D_LANCE), ni rampe-saut, ni rampe-volcan, ni dégagement', () => {
    for (const t of tracks) {
      const cl = clearances(t);
      for (const s of high(t.stars)) {
        const a = s.x - CONFIG.STAR_HIGH_TAKEOFF_ROOM;
        const b = s.x + CONFIG.STAR_HIGH_LANDING_ROOM;
        expect(a, `graine ${t.seed}, étoile haute x = ${s.x.toFixed(2)} : élan dans la zone de départ`).toBeGreaterThanOrEqual(t.xStart + CONFIG.D_LANCE - 1e-9);
        for (let p = a + 1e-6; p <= b - 1e-6; p += Math.min(0.1, b - 1e-6 - p) || 0.1) {
          const type = sliceAt(t, p).type;
          const where = `graine ${t.seed}, étoile haute x = ${s.x.toFixed(2)}, terrain en ${p.toFixed(2)} (${type})`;
          expect(type === 'rampe-saut' || type === 'rampe-volcan', where).toBe(false);
          for (const c of cl) expect(inOpen(p, c), `${where} dans le dégagement [${c[0].toFixed(1)}, ${c[1].toFixed(1)}]`).toBe(false);
          if (p >= b - 1e-6) break;
        }
      }
    }
  });

  test('aucune étoile haute dans [xLancement, xLava] d’un volcan', () => {
    for (const t of tracks) {
      for (const s of high(t.stars)) {
        for (const v of t.volcanoes) expect(s.x >= v.xLancement && s.x <= v.xLava, `graine ${t.seed} x = ${s.x}`).toBe(false);
      }
    }
  });

  test('y = sol + STAR_HIGH_Y pour les hautes, sol + 0,6 pour les basses ; ids 0..n−1 dans l’ordre des x', () => {
    for (const t of tracks) {
      for (const s of t.stars) {
        expect(s.y - heightAt(t, s.x), `graine ${t.seed} x = ${s.x}`).toBeCloseTo(s.high ? CONFIG.STAR_HIGH_Y : 0.6, 9);
      }
      t.stars.forEach((s, i) => {
        expect(s.id).toBe(i);
        if (i > 0) expect(s.x).toBeGreaterThan(t.stars[i - 1].x);
      });
    }
  });

  test('déterminisme : même graine, mêmes étoiles (hautes comprises)', () => {
    for (const t of tracks.slice(0, 10)) expect(generateTrack(t.seed, LEN, CONFIG).stars).toEqual(t.stars);
  });
});

describe('étoiles basses inchangées (décision P1 : les étoiles hautes s’ajoutent)', () => {
  test('pistes d’avant (ANCIENNES_PISTES) : étoiles égales au code d’avant la tâche 5e (id, x, y au bit près), toutes high: false', () => {
    const h = sha1();
    let count = 0;
    for (const t of tracksPre) {
      expect(t.stars.every((s) => s.high === false), `graine ${t.seed}`).toBe(true);
      count += t.stars.length;
      h.update(new Uint8Array(Float64Array.from(t.stars.flatMap((s) => [s.id, s.x, s.y])).buffer));
    }
    expect({ count, sha1: h.digest('hex') }).toEqual(PRE_5E_STARS);
  });

  test(`x, y et nombre des étoiles basses identiques entre STAR_HIGH_PER_RACE 0 et ${CONFIG.STAR_HIGH_PER_RACE}`, () => {
    tracks.forEach((t, k) => {
      const off = tracksOff[k].stars;
      const on = low(t.stars);
      expect(on.length, `graine ${t.seed}`).toBe(off.length);
      on.forEach((s, i) => {
        expect(s.x, `graine ${t.seed}`).toBe(off[i].x);
        expect(s.y, `graine ${t.seed}`).toBe(off[i].y);
      });
    });
  });
});

describe('choix et fusion', () => {
  test('plus de candidates que STAR_HIGH_PER_RACE : tirage sans remise par le rng de piste, dans l’ordre de la piste', () => {
    let drawn = 0;
    for (const t of tracks) {
      const lowXs = low(t.stars).map((s) => s.x);
      const cands = highStarCandidates(t, lowXs, CONFIG);
      for (const n of [1, 2]) {
        const cfg = { ...CONFIG, STAR_HIGH_PER_RACE: n };
        const a = chooseHighStars(t, lowXs, mulberry32(t.seed), cfg);
        expect(a).toEqual(chooseHighStars(t, lowXs, mulberry32(t.seed), cfg));
        expect(a.length).toBe(Math.min(n, cands.length));
        for (const x of a) expect(cands).toContain(x);
        expect(new Set(a).size).toBe(a.length);
        expect([...a].sort((p, q) => p - q)).toEqual(a);
        if (cands.length > n) drawn++;
      }
      expect(chooseHighStars(t, lowXs, () => { throw new Error('aucun tirage attendu'); }, { ...CONFIG, STAR_HIGH_PER_RACE: 0 })).toEqual([]);
    }
    expect(drawn).toBeGreaterThan(0);
  });

  test('STAR_HIGH_PER_RACE non entier ou négatif : erreur explicite', () => {
    const t = tracks[0];
    expect(() => placeStars(t, mulberry32(1), { ...CONFIG, STAR_HIGH_PER_RACE: -1 })).toThrow(/STAR_HIGH_PER_RACE/);
    expect(() => placeStars(t, mulberry32(1), { ...CONFIG, STAR_HIGH_PER_RACE: 1.5 })).toThrow(/STAR_HIGH_PER_RACE/);
  });

  test('plats voisins fusionnés (fixture) : une seule étoile haute, à cheval sur deux tranches plat consécutives', () => {
    // Départ, bosses, deux plats de 35 m, rampe-saut, plat d'arrivée. Dégagement des bosses [40, 52] ; segment
    // fusionné [52, 110] ; admissible [52 + 15, 110 − 15] = [67, 95] → étoile en 81, élan dans le premier plat,
    // atterrissage dans le second. Séparés, les deux plats donneraient deux candidates (71 et 85).
    const slices: Slice[] = [
      { type: 'plat', xStart: 0, xEnd: 26.5 },
      { type: 'bosses', xStart: 26.5, xEnd: 40 },
      { type: 'plat', xStart: 40, xEnd: 75 },
      { type: 'plat', xStart: 75, xEnd: 110 },
      { type: 'rampe-saut', xStart: 110, xEnd: 130 },
      { type: 'plat', xStart: 130, xEnd: 400 },
      { type: 'plat', xStart: 400, xEnd: 460 },
    ];
    const t: Track = {
      seed: 0, targetLength: 460, length: 460, points: [{ x: 0, y: 0 }, { x: 460, y: 0 }], exemptPointIndices: [],
      slices, volcanoes: [], stars: [], xStart: 21.5, xFinish: 400, xWall: 460,
    };
    // Pas de curseur (pas immense), pas de volcan : aucune étoile basse.
    const cfg: Config = { ...CONFIG, STAR_STEP_MIN: 1e5, STAR_STEP_MAX: 1e5 };
    const stars = placeStars(t, mulberry32(3), cfg);
    expect(stars).toHaveLength(1);
    const [s] = stars;
    expect(s.high).toBe(true);
    expect(s.x).toBeCloseTo(81, 9);
    expect(s.y).toBeCloseTo(cfg.STAR_HIGH_Y, 9);
    expect(sliceAt(t, s.x - cfg.STAR_HIGH_TAKEOFF_ROOM).xStart).toBe(40);
    expect(sliceAt(t, s.x + cfg.STAR_HIGH_LANDING_ROOM).xStart).toBe(75);
    // Une étoile basse au centre : l'étoile haute recule au point admissible le plus proche (à STAR_HIGH_GAP).
    expect(highStarCandidates(t, [81], cfg)).toEqual([81 - cfg.STAR_HIGH_GAP]);
    // Plus aucun point admissible : pas de candidate.
    expect(highStarCandidates(t, [70, 90], { ...cfg, STAR_HIGH_GAP: 13 })).toEqual([]);
  });
});

describe('harnais simulateRace (tâche 5e)', () => {
  test('highStarsByCar : les « star » des étoiles marquées hautes, et elles seules ; option jump : demande de Galahad à chaque pas', () => {
    // Graine 1 sans ses étoiles hautes, la première étoile basse marquée « haute » (elle reste à 0,6 m : doigt posé la prend).
    const base = tracks[1];
    const lows = low(base.stars).map((s, id) => ({ ...s, id }));
    const t: Track = { ...base, stars: lows.map((s, i) => (i === 0 ? { ...s, high: true } : s)) };
    const jumps: SimEvent[] = [];
    const r = simulateRace(t, {
      throttle: () => true, maxSeconds: 60, cfg: CONFIG,
      jump: (time) => time >= 1 && time < 1 + CONFIG.PHYSICS_DT / 2,
      onStep: (sim) => jumps.push(...sim.events.filter((e) => e.type === 'jump')),
    });
    expect(jumps).toHaveLength(1);
    expect(jumps[0].t).toBeCloseTo(1, 9);
    const all = r.starsByCar.galahad;
    expect(all.length).toBeGreaterThan(1);
    expect(r.highStarsByCar.galahad).toEqual(all.filter((e) => e.id === 0));
    expect(r.highStarsByCar.galahad.length).toBe(1);
  });
});
