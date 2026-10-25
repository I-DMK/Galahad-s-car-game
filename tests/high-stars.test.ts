// Étoiles hautes ajoutées (plan B, tâche 5e, Steps 7 et 13 ; addendum « bouton saut » §2 amendé [plan] et §6.6,
// décisions P1, P7 et Q-F4) : placement statique, graines 0 à 49, pistes de 1 680 m. Exactement 3 étoiles hautes par
// course, celles des 3 plats étoile, à + 32 m de leur début. Les règles des plats ordinaires (5e, Step 7) restent
// testées sur une fixture à plafond 5 (`STAR_HIGH_PER_RACE` 5), pour un éventuel changement d'avis. Les règles sont
// revérifiées ici à partir des tranches, indépendamment de src/track/stars.ts.
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
/** Fixture à plafond 5 : les 3 étoiles des plats étoile, plus des étoiles sur des plats ordinaires (règle du Step 7). */
const CAP5: Config = { ...CONFIG, STAR_HIGH_PER_RACE: 5 };
const tracks5 = SEEDS.map((seed) => generateTrack(seed, LEN, CAP5));
/** Étoile de plat étoile : à STAR_HIGH_BUMP_CLEARANCE + STAR_HIGH_TAKEOFF_ROOM (32 m) du début de son plat. */
const FLAT_STAR_AT = CONFIG.STAR_HIGH_BUMP_CLEARANCE + CONFIG.STAR_HIGH_TAKEOFF_ROOM;
const starFlats = (t: Track): Slice[] => t.slices.filter((sl) => sl.type === 'plat-étoile');
const onStarFlat = (t: Track, x: number): boolean => starFlats(t).some((f) => x >= f.xStart - 1e-9 && x <= f.xEnd + 1e-9);
/** Étoiles hautes des plats ordinaires (pas sur un plat étoile). */
const ordinary = (t: Track): Star[] => high(t.stars).filter((s) => !onStarFlat(t, s.x));
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
  test('exactement 3 étoiles hautes par piste (Q-F4), une par plat étoile, à + 32 m de son début, y = sol + 3,90', () => {
    expect(CONFIG.STAR_HIGH_PER_RACE).toBe(3);
    expect(FLAT_STAR_AT).toBe(32);
    for (const t of tracks) {
      const hs = high(t.stars);
      const fs = starFlats(t);
      expect(hs, `graine ${t.seed}`).toHaveLength(3);
      expect(fs, `graine ${t.seed}`).toHaveLength(3);
      hs.forEach((s, k) => {
        expect(s.x, `graine ${t.seed}, plat étoile ${k}`).toBeCloseTo(fs[k].xStart + FLAT_STAR_AT, 9);
        expect(s.y - heightAt(t, s.x), `graine ${t.seed}`).toBeCloseTo(3.9, 9);
      });
    }
    // Plats ordinaires seuls (STAR_FLATS_PER_RACE 0, plafond 3, règle du Step 7) : moyenne imprimée.
    const counts = SEEDS.map((seed) => high(generateTrack(seed, LEN, { ...CONFIG, STAR_FLATS_PER_RACE: 0 }).stars).length);
    console.log(`étoiles hautes des plats ordinaires seuls (sans plat étoile, plafond 3, jeu 50 / 12 / 20 / 25) : moyenne `
      + `${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(2)}, pistes avec au moins une ${counts.filter((n) => n > 0).length}/50`);
  });

  test('aucune étoile basse sur un plat étoile ; les étoiles basses restent à STAR_HIGH_GAP au moins de toute étoile haute', () => {
    for (const t of tracks) {
      for (const s of low(t.stars)) {
        expect(onStarFlat(t, s.x), `graine ${t.seed}, étoile basse x = ${s.x.toFixed(2)}`).toBe(false);
        for (const h of high(t.stars)) expect(Math.abs(s.x - h.x), `graine ${t.seed}`).toBeGreaterThanOrEqual(CONFIG.STAR_HIGH_GAP - 1e-9);
      }
    }
  });

  test('plafond 5 (fixture) : les 3 des plats étoile toujours présentes, les autres à ≥ 45 m de toute étoile haute, sur des plats ordinaires', () => {
    let extra = 0;
    tracks5.forEach((t, k) => {
      const flatsX = high(tracks[k].stars).map((s) => s.x);
      const hs = high(t.stars).map((s) => s.x);
      expect(hs.length, `graine ${t.seed}`).toBeLessThanOrEqual(5);
      for (const x of flatsX) expect(hs, `graine ${t.seed}`).toContain(x);
      for (const s of ordinary(t)) {
        extra++;
        // À élan + atterrissage (45 m) au moins de toute autre étoile haute, de plat étoile ou de plat ordinaire.
        for (const x of hs.filter((h) => h !== s.x)) {
          expect(Math.abs(s.x - x), `graine ${t.seed}, étoile x = ${s.x.toFixed(1)}`)
            .toBeGreaterThanOrEqual(CONFIG.STAR_HIGH_TAKEOFF_ROOM + CONFIG.STAR_HIGH_LANDING_ROOM - 1e-9);
        }
      }
      const xy = (stars: Star[]) => low(stars).map(({ x, y }) => ({ x, y }));
      expect(xy(t.stars), `graine ${t.seed} : étoiles basses inchangées`).toEqual(xy(tracks[k].stars));
    });
    console.log(`plafond 5 : ${extra} étoiles hautes sur des plats ordinaires (graines 0 à 49)`);
    expect(extra).toBeGreaterThan(10);
  });

  test('plats ordinaires (plafond 5) : chaque étoile haute est sur une tranche plat éligible (ni départ, ni arrivée, ni juste après un volcan), hors dégagements, à STAR_HIGH_GAP au moins de toute étoile basse', () => {
    let seen = 0;
    for (const t of tracks5) {
      const cl = clearances(t);
      const lows = low(t.stars);
      for (const s of ordinary(t)) {
        seen++;
        // Intervalle fermé : une étoile peut être au bout exact de son segment (graine 15, x = 224,6, juste avant des bosses).
        const sl = t.slices.find((x) => x.type === 'plat' && s.x >= x.xStart - 1e-9 && s.x <= x.xEnd + 1e-9) ?? sliceAt(t, s.x);
        const i = t.slices.indexOf(sl);
        const where = `graine ${t.seed}, étoile haute x = ${s.x.toFixed(2)} (${sl.type} [${sl.xStart.toFixed(1)}, ${sl.xEnd.toFixed(1)}])`;
        expect(sl.type, where).toBe('plat');
        expect(i, where).toBeGreaterThan(0);
        // Décision du papa (relectures de la 5e) : pas sur un plat juste après un volcan, comme les plats étoile.
        expect(t.slices[i - 1].type, where).not.toBe('rampe-volcan');
        expect(t.slices[i - 1].type, where).not.toBe('fosse');
        expect(sl.xEnd, where).toBeLessThan(t.xFinish - 1e-9);
        for (const c of cl) expect(inOpen(s.x, c), `${where} dans le dégagement [${c[0].toFixed(1)}, ${c[1].toFixed(1)}]`).toBe(false);
        for (const b of lows) expect(Math.abs(s.x - b.x), `${where}, étoile basse ${b.x.toFixed(2)}`).toBeGreaterThanOrEqual(CONFIG.STAR_HIGH_GAP - 1e-9);
      }
    }
    expect(seen).toBeGreaterThan(10);
  });

  // Les étoiles des plats étoile suivent la règle d'insertion du plat étoile (§6.6 : 12 m d'entrée, jamais juste après une
  // rampe-saut, tests/generate.test.ts), pas celle des dégagements des plats ordinaires : graine 5, l'élan de l'étoile en
  // 863,8 chevauche les 50 m de dégagement d'une rampe-saut finie 64,8 m avant (portée mesurée à 21 m/s : 36,6 m).
  test('plats ordinaires (plafond 5) : [x − TAKEOFF_ROOM, x + LANDING_ROOM] est du terrain permis, après la zone de départ (xStart + D_LANCE), ni rampe-saut, ni rampe-volcan, ni fosse, ni dégagement', () => {
    for (const t of tracks5) {
      const cl = clearances(t);
      for (const s of ordinary(t)) {
        const a = s.x - CONFIG.STAR_HIGH_TAKEOFF_ROOM;
        const b = s.x + CONFIG.STAR_HIGH_LANDING_ROOM;
        expect(a, `graine ${t.seed}, étoile haute x = ${s.x.toFixed(2)} : élan dans la zone de départ`).toBeGreaterThanOrEqual(t.xStart + CONFIG.D_LANCE - 1e-9);
        for (let p = a + 1e-6; p <= b - 1e-6; p += Math.min(0.1, b - 1e-6 - p) || 0.1) {
          const type = sliceAt(t, p).type;
          const where = `graine ${t.seed}, étoile haute x = ${s.x.toFixed(2)}, terrain en ${p.toFixed(2)} (${type})`;
          expect(type === 'rampe-saut' || type === 'rampe-volcan' || type === 'fosse', where).toBe(false);
          for (const c of cl) expect(inOpen(p, c), `${where} dans le dégagement [${c[0].toFixed(1)}, ${c[1].toFixed(1)}]`).toBe(false);
          if (p >= b - 1e-6) break;
        }
      }
    }
  });

  test('aucune étoile haute dans [xLancement, xLava] d’un volcan', () => {
    for (const t of [...tracks, ...tracks5]) {
      for (const s of high(t.stars)) {
        for (const v of t.volcanoes) expect(s.x >= v.xLancement && s.x <= v.xLava, `graine ${t.seed} x = ${s.x}`).toBe(false);
      }
    }
  });

  test('aucune étoile haute dans une tranche fosse (garde, approche, fosse, réception ; tâche 5g, saut §6.5)', () => {
    let fosses = 0;
    for (const t of [...tracks, ...tracks5]) {
      const fs = t.slices.filter((sl) => sl.type === 'fosse');
      fosses += fs.length;
      for (const s of high(t.stars)) {
        for (const sl of fs) expect(s.x >= sl.xStart && s.x <= sl.xEnd, `graine ${t.seed} x = ${s.x}`).toBe(false);
      }
    }
    expect(fosses).toBeGreaterThan(100);
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

describe('pistes courtes (graines 0 à 199) : étoiles hautes de repli sur les plats ordinaires', () => {
  const SHORT = [300, 600, 1000] as const;
  const short = SHORT.map((len) => ({ len, ts: Array.from({ length: 200 }, (_, seed) => generateTrack(seed, len, CONFIG)) }));

  test('jamais sur un plat juste après un volcan, à 45 m au moins les unes des autres ; nombres imprimés', () => {
    const away = CONFIG.STAR_HIGH_TAKEOFF_ROOM + CONFIG.STAR_HIGH_LANDING_ROOM;
    const lines: string[] = [];
    for (const { len, ts } of short) {
      const flatsN: number[] = [];
      const highN: number[] = [];
      for (const t of ts) {
        const hs = high(t.stars);
        flatsN.push(starFlats(t).length);
        highN.push(hs.length);
        expect(hs.length, `graine ${t.seed}, ${len} m`).toBeLessThanOrEqual(CONFIG.STAR_HIGH_PER_RACE);
        for (const s of ordinary(t)) {
          const sl = t.slices.find((x) => x.type === 'plat' && s.x >= x.xStart - 1e-9 && s.x <= x.xEnd + 1e-9)!;
          const i = t.slices.indexOf(sl);
          expect(t.slices[i - 1].type, `graine ${t.seed}, ${len} m, étoile haute x = ${s.x.toFixed(1)}`).not.toMatch(/^(rampe-volcan|fosse)$/);
        }
        hs.forEach((s, k) => {
          if (k > 0) expect(s.x - hs[k - 1].x, `graine ${t.seed}, ${len} m`).toBeGreaterThanOrEqual(away - 1e-9);
        });
      }
      const range = (xs: number[]) => `${Math.min(...xs)} à ${Math.max(...xs)} (moyenne ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)})`;
      lines.push(`${len} m : plats étoile ${range(flatsN)}, étoiles hautes ${range(highN)}`);
    }
    console.log(`pistes courtes, graines 0 à 199 : ${lines.join(' ; ')}`);
  });
});

describe('choix et fusion', () => {
  test('sans plat étoile, plus de candidates que STAR_HIGH_PER_RACE : tirage sans remise par le rng de piste, candidates à 45 m au moins entre elles, dans l’ordre de la piste', () => {
    let drawn = 0;
    for (const t of SEEDS.map((seed) => generateTrack(seed, LEN, { ...CONFIG, STAR_FLATS_PER_RACE: 0 }))) {
      const lowXs = low(t.stars).map((s) => s.x);
      const cands = highStarCandidates(t, lowXs, CONFIG);
      for (const n of [1, 2]) {
        const cfg = { ...CONFIG, STAR_HIGH_PER_RACE: n };
        const a = chooseHighStars(t, lowXs, mulberry32(t.seed), cfg);
        expect(a).toEqual(chooseHighStars(t, lowXs, mulberry32(t.seed), cfg));
        expect(a.length).toBeLessThanOrEqual(Math.min(n, cands.length));
        if (cands.length > 0) expect(a.length).toBeGreaterThan(0);
        for (const x of a) expect(cands).toContain(x);
        for (const x of a) for (const y of a.filter((z) => z !== x)) expect(Math.abs(x - y)).toBeGreaterThanOrEqual(CONFIG.STAR_HIGH_TAKEOFF_ROOM + CONFIG.STAR_HIGH_LANDING_ROOM - 1e-9);
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
      slices, volcanoes: [], stars: [], rocks: [], xStart: 21.5, xFinish: 400, xWall: 460,
    };
    // Pas de curseur (pas immense), pas de volcan : aucune étoile basse. Élan et atterrissage de 15 m, dégagement de
    // bosses de 12 m : la fixture ne dépend pas du jeu retenu dans config.ts.
    const cfg: Config = {
      ...CONFIG, STAR_STEP_MIN: 1e5, STAR_STEP_MAX: 1e5,
      STAR_HIGH_TAKEOFF_ROOM: 15, STAR_HIGH_LANDING_ROOM: 15, STAR_HIGH_BUMP_CLEARANCE: 12,
    };
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
