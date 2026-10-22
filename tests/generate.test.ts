import { CONFIG, type Config } from '../src/config';
import { defaultTrackLength, generateTrack, parseTrackOptions } from '../src/track/generate';
import { plat } from '../src/track/slices';
import { mulberry32 } from '../src/track/rng';
import type { Slice, SliceType, Track } from '../src/track/types';
import { AP } from './helpers/anciennes-pistes';

/** Tranches tirées : sans les plats étoile, posés sans tirage (tâche 5e, ruling R-F5). */
const drawn = (t: Track): Slice[] => t.slices.filter((s) => s.type !== 'plat-étoile');
/** Tranche volcan : tremplin (`rampe-volcan`) ou fosse (tâche 5g). */
const isVolcano = (type: SliceType): boolean => type === 'rampe-volcan' || type === 'fosse';

const S = CONFIG.TRACK_POINT_SPACING;
const SEEDS = Array.from({ length: 50 }, (_, i) => i);
const LENGTHS = [300, 1680, 6000];
const CASES = SEEDS.flatMap((seed) => LENGTHS.map((len) => [seed, len] as const));

const cache = new Map<string, Track>();
function track(seed: number, len: number): Track {
  const key = `${seed}/${len}`;
  let t = cache.get(key);
  if (!t) { t = generateTrack(seed, len, CONFIG); cache.set(key, t); }
  return t;
}

describe('generateTrack (seeds 0..49 × longueurs 300, 1680, 6000)', () => {
  test('déterminisme : même graine, même piste', () => {
    for (const [seed, len] of CASES) {
      expect(JSON.stringify(generateTrack(seed, len, CONFIG))).toBe(JSON.stringify(track(seed, len)));
    }
  });

  test('des graines différentes donnent des pistes différentes', () => {
    expect(track(1, 1680).points).not.toEqual(track(2, 1680).points);
  });

  test('longueur = cible (à une maille près), espacement 0,2, départ en (0, 0)', () => {
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      expect(t.seed).toBe(seed);
      expect(t.targetLength).toBe(len);
      expect(Math.abs(t.length - len)).toBeLessThan(S);
      expect(t.points[0]).toEqual({ x: 0, y: 0 });
      expect(t.length).toBe(t.points[t.points.length - 1].x);
      for (let i = 1; i < t.points.length; i++) {
        if (Math.abs(t.points[i].x - t.points[i - 1].x - S) > 1e-9) throw new Error(`seed ${seed} len ${len} : espacement au point ${i}`);
      }
    }
  });

  test('pente ≤ MAX_SLOPE hors exemptPointIndices', () => {
    const tanMax = Math.tan(CONFIG.MAX_SLOPE);
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      const exempt = new Set(t.exemptPointIndices);
      for (const i of exempt) {
        expect(i).toBeGreaterThanOrEqual(1);
        expect(i).toBeLessThan(t.points.length);
      }
      for (let i = 1; i < t.points.length; i++) {
        if (exempt.has(i)) continue;
        const slope = Math.abs(t.points[i].y - t.points[i - 1].y) / (t.points[i].x - t.points[i - 1].x);
        if (slope > tanMax + 1e-9) throw new Error(`seed ${seed} len ${len} : pente ${slope} au point ${i}`);
      }
    }
  });

  test('aucune lave dans [0, 15 %) ni [90 %, 100 %] ; volcans entièrement dans [15 %, 90 %]', () => {
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      for (const v of t.volcanoes) {
        expect(v.xLancement).toBeGreaterThanOrEqual(0.15 * len - 1e-9);
        expect(v.xEnd).toBeLessThanOrEqual(0.9 * len + 1e-9);
        expect(v.xLava - v.lavaWidth / 2).toBeGreaterThanOrEqual(0.15 * len);
        expect(v.xLava + v.lavaWidth / 2).toBeLessThan(0.9 * len);
      }
    }
  });

  test('jamais deux volcans consécutifs, tremplin ou fosse (plats étoile ignorés) ; volcanoes cohérents avec les tranches', () => {
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      const d = drawn(t);
      for (let i = 1; i < d.length; i++) {
        expect(isVolcano(d[i].type) && isVolcano(d[i - 1].type), `seed ${seed} len ${len}, tranche tirée ${i}`).toBe(false);
      }
      const vs = t.slices.filter((s) => isVolcano(s.type));
      expect(t.volcanoes).toHaveLength(vs.length);
      vs.forEach((s, k) => {
        const v = t.volcanoes[k];
        expect(v.kind).toBe(s.type === 'fosse' ? 'fosse' : 'tremplin');
        expect(v.xEnd).toBeCloseTo(s.xEnd, 9);
        if (v.kind === 'fosse') {
          // Fosse : garde de FOSSE_GUARD, approche, lave de FOSSE_WIDTH au ras du sol, réception.
          expect(v.xLancement - s.xStart).toBeCloseTo(CONFIG.FOSSE_GUARD, 9);
          expect(v.xBord).toBeGreaterThan(v.xLancement);
          expect(v.xLava - v.xBord).toBeCloseTo(CONFIG.FOSSE_WIDTH / 2, 9);
          expect(v.xReception - v.xBord).toBeCloseTo(CONFIG.FOSSE_WIDTH, 9);
          expect(v.lavaWidth).toBeCloseTo(CONFIG.FOSSE_WIDTH, 9);
          expect(v.rimY).toBe(0);
          expect(v.xReception).toBeLessThan(v.xEnd);
          return;
        }
        expect(v.xLancement).toBe(s.xStart);
        expect(v.xElanStart - v.xLancement).toBeCloseTo(CONFIG.LANCEMENT_LENGTH, 9);
        expect(v.xRampStart - v.xElanStart).toBeCloseTo(CONFIG.L_ELAN, 9);
        expect(v.xLancement).toBeLessThan(v.xElanStart);
        expect(v.xElanStart).toBeLessThan(v.xRampStart);
        expect(v.xRampStart).toBeLessThan(v.xLip);
        expect(v.xLip).toBeLessThan(v.xLava);
        expect(v.xLava).toBeLessThan(v.xReception);
        expect(v.xReception).toBeLessThan(v.xEnd);
      });
    }
  });

  test('tranches contiguës de 0 à xWall, plat final ≥ FINISH_PLAT_BEFORE', () => {
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      expect(t.slices[0].xStart).toBe(0);
      for (let i = 1; i < t.slices.length; i++) expect(t.slices[i].xStart).toBeCloseTo(t.slices[i - 1].xEnd, 9);
      expect(t.slices[t.slices.length - 1].xEnd).toBeCloseTo(t.xWall, 9);
      expect(t.xWall).toBe(t.length);
      expect(t.xWall - t.xFinish).toBeCloseTo(CONFIG.AFTER_FINISH, 9);
      const finalPlat = t.slices[t.slices.length - 2];
      expect(finalPlat.type).toBe('plat');
      expect(finalPlat.xEnd - finalPlat.xStart).toBeGreaterThanOrEqual(CONFIG.FINISH_PLAT_BEFORE - 1e-9);
    }
  });

  test('hauteur 0 sur [xFinish − 20, xWall]', () => {
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      const bad = t.points.filter((p) => p.x >= t.xFinish - CONFIG.FINISH_PLAT_BEFORE - 1e-9 && p.y !== 0);
      expect(bad).toEqual([]);
    }
  });

  test('START_LENGTH de plat au début, xStart = START_LENGTH − 5', () => {
    const startLen = plat(mulberry32(0), CONFIG, CONFIG.START_LENGTH).length;
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      expect(t.xStart).toBeCloseTo(CONFIG.START_LENGTH - 5, 9);
      expect(t.slices[0].type).toBe('plat');
      expect(t.slices[0].xEnd).toBeCloseTo(startLen, 9);
      expect(t.points.filter((p) => p.x <= startLen + 1e-9 && p.y !== 0)).toEqual([]);
    }
  });

  test('exemptPointIndices triés et sans doublon', () => {
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      const sorted = [...t.exemptPointIndices].sort((a, b) => a - b);
      expect(t.exemptPointIndices).toEqual(sorted);
      expect(new Set(t.exemptPointIndices).size).toBe(sorted.length);
    }
  });

  test('aucun volcan (tremplin ou fosse) n’est précédé d’une rampe-saut ni d’un volcan, plats étoile ignorés (graines 0 à 49, 1 680 m)', () => {
    for (const seed of SEEDS) {
      const d = drawn(track(seed, 1680));
      for (let i = 1; i < d.length; i++) {
        if (!isVolcano(d[i].type)) continue;
        expect(d[i - 1].type, `seed ${seed}, tranche tirée ${i}`).not.toBe('rampe-saut');
        expect(isVolcano(d[i - 1].type), `seed ${seed}, tranche tirée ${i}`).toBe(false);
      }
    }
  });

  // Tâche 5e : les plats étoile prennent ≈ 171 m à longueur constante ; « 3 à 7 » devient « 2 à 7 » (saut §6.3).
  // Tour 2 de la 5g (poids de tirage des volcans 4) : graines 0 à 19, 2 à 5 ; sur les graines 0 à 49, la graine 39 n'a
  // qu'un volcan (un tremplin) : les tests qui veulent 2 volcans ou une fosse les cherchent, ou portent sur 0 à 19.
  test('2 à 7 volcans par piste de 1 680 m sur les graines 0 à 19', () => {
    const counts = SEEDS.slice(0, 20).map((seed) => track(seed, 1680).volcanoes.length);
    console.log(`volcans par piste de 1 680 m (graines 0 à 19) : ${counts.join(' ')} ; moyenne ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(2)}`);
    for (const [seed, n] of counts.entries()) {
      expect(n, `seed ${seed} : ${n} volcans (${counts.join(' ')})`).toBeGreaterThanOrEqual(2);
      expect(n, `seed ${seed} : ${n} volcans (${counts.join(' ')})`).toBeLessThanOrEqual(7);
    }
  });

  test('onlyPlat : hauteur 0 partout, que des plat', () => {
    for (const [seed, len] of CASES) {
      const t = generateTrack(seed, len, CONFIG, { onlyPlat: true });
      expect(t.points.every((p) => p.y === 0)).toBe(true);
      expect(t.slices.every((s) => s.type === 'plat')).toBe(true);
      expect(t.volcanoes).toEqual([]);
      expect(t.exemptPointIndices).toEqual([]);
    }
  });

  test('chaque type de tranche et les volcans apparaissent sur les longues pistes', () => {
    const types = new Set<string>();
    for (const seed of SEEDS) for (const s of track(seed, 6000).slices) types.add(s.type);
    expect([...types].sort()).toEqual(['bosses', 'double-bosse', 'fosse', 'plat', 'plat-étoile', 'rampe-saut', 'rampe-volcan']);
  });

  test('longueur non multiple de la maille : longueur à moins d une maille de la cible', () => {
    const t = generateTrack(3, 913.37, CONFIG);
    expect(Math.abs(t.length - 913.37)).toBeLessThan(S);
    expect(t.xWall - t.xFinish).toBeCloseTo(CONFIG.AFTER_FINISH, 9);
  });
});

describe('plats étoile (tâche 5e, saut §6.6, ruling R-F8)', () => {
  const flats = (t: Track): Slice[] => t.slices.filter((s) => s.type === 'plat-étoile');

  /** Graines 0 à 999 à 1 680 m (génération seule, ≈ 0,7 s) : garantie des 3 plats étoile (relecture de la 5e, graine 128). */
  const WIDE = Array.from({ length: 1000 }, (_, i) => i);
  const wide = new Map<number, Track>();
  const wideTrack = (seed: number): Track => {
    let t = wide.get(seed);
    if (!t) { t = seed < 50 ? track(seed, 1680) : generateTrack(seed, 1680, CONFIG); wide.set(seed, t); }
    return t;
  };

  /** Fin de la dernière rampe-saut qui finit au plus tard en x, ou null. */
  const lastRampSautEnd = (t: Track, x: number): number | null => {
    const ends = t.slices.filter((s) => s.type === 'rampe-saut' && s.xEnd <= x + 1e-9).map((s) => s.xEnd);
    return ends.length ? ends[ends.length - 1] : null;
  };
  /** Élan de l'étoile d'un plat étoile qui commencerait en x : [x + STAR_HIGH_BUMP_CLEARANCE, x★]. */
  const takeoffAt = (x: number): number => x + CONFIG.STAR_HIGH_BUMP_CLEARANCE;
  /**
   * Frontière en x refusée à un plat étoile : la dernière tranche tirée avant x est une rampe-saut ou un volcan, ou
   * l'élan de son étoile tomberait dans les STAR_HIGH_RAMP_CLEARANCE après la dernière rampe-saut.
   */
  const refusedAt = (t: Track, x: number): boolean => {
    const before = drawn(t).filter((s) => s.xEnd <= x + 1e-9);
    const last = before[before.length - 1];
    if (last.type === 'rampe-saut' || isVolcano(last.type)) return true;
    const r = lastRampSautEnd(t, x);
    return r !== null && takeoffAt(x) < r + CONFIG.STAR_HIGH_RAMP_CLEARANCE - 1e-9;
  };

  test('N plats étoile : 3 à 1 680 m (graines 0 à 999) et à 6 000 m (graines 0 à 19), 2 à 1 000 m, 1 à 600 m, 0 à 300 m', () => {
    for (const seed of WIDE) expect(flats(wideTrack(seed)), `graine ${seed}`).toHaveLength(3);
    for (const seed of SEEDS.slice(0, 20)) expect(flats(track(seed, 6000)), `graine ${seed}`).toHaveLength(3);
    for (const seed of SEEDS) {
      expect(flats(generateTrack(seed, 1000, CONFIG)), `graine ${seed}`).toHaveLength(2);
      expect(flats(generateTrack(seed, 600, CONFIG)), `graine ${seed}`).toHaveLength(1);
      expect(flats(track(seed, 300)), `graine ${seed}`).toHaveLength(0);
    }
  });

  test('STAR_FLAT_LENGTH incohérente avec les dégagements : refusée', () => {
    expect(() => generateTrack(0, 1680, { ...CONFIG, STAR_FLAT_LENGTH: 50 })).toThrow(/STAR_FLAT_LENGTH/);
    expect(() => generateTrack(0, 1680, { ...CONFIG, STAR_HIGH_TAKEOFF_ROOM: 25 })).toThrow(/STAR_FLAT_LENGTH/);
  });

  test('longueur STAR_FLAT_LENGTH (57 m) à une maille près, hauteur 0, jamais juste après une rampe-saut ni un volcan', () => {
    expect(CONFIG.STAR_FLAT_LENGTH).toBe(CONFIG.STAR_HIGH_BUMP_CLEARANCE + CONFIG.STAR_HIGH_TAKEOFF_ROOM + CONFIG.STAR_HIGH_LANDING_ROOM);
    expect(CONFIG.STAR_FLAT_LENGTH).toBe(57);
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      t.slices.forEach((s, i) => {
        if (s.type !== 'plat-étoile') return;
        expect(Math.abs(s.xEnd - s.xStart - CONFIG.STAR_FLAT_LENGTH), `graine ${seed}`).toBeLessThanOrEqual(S + 1e-9);
        expect(t.slices[i - 1].type, `graine ${seed}, plat étoile en ${s.xStart}`).not.toBe('rampe-saut');
        // Décision du papa (relectures de la 5e) : pas juste après un volcan (chocs à la sortie des réceptions).
        expect(isVolcano(t.slices[i - 1].type), `graine ${seed}, plat étoile en ${s.xStart}`).toBe(false);
        expect(t.points.filter((p) => p.x >= s.xStart - 1e-9 && p.x <= s.xEnd + 1e-9 && p.y !== 0)).toEqual([]);
      });
    }
  });

  test('élan de l’étoile d’un plat étoile hors des STAR_HIGH_RAMP_CLEARANCE après une rampe-saut (graines 0 à 999)', () => {
    let refusedByRule = 0;
    for (const seed of WIDE) {
      const t = wideTrack(seed);
      for (const f of flats(t)) {
        const r = lastRampSautEnd(t, f.xStart);
        if (r !== null) expect(takeoffAt(f.xStart), `graine ${seed}, plat étoile en ${f.xStart.toFixed(1)}`).toBeGreaterThanOrEqual(r + CONFIG.STAR_HIGH_RAMP_CLEARANCE - 1e-9);
      }
      // Frontières refusées par la seule règle de l'élan (rampe-saut puis plat court) : la règle sert.
      for (const s of drawn(t)) {
        const last = drawn(t).filter((d) => d.xEnd <= s.xEnd + 1e-9).pop()!;
        if (last.type !== 'rampe-saut' && !isVolcano(last.type) && refusedAt(t, s.xEnd)) refusedByRule++;
      }
    }
    expect(refusedByRule).toBeGreaterThan(0);
  });

  test('le k-ième plat étoile commence à la première frontière ≥ a_k permise ; ancres sans jeu, sauf rares graines (jeu j × STAR_FLAT_LENGTH)', () => {
    const slackUsed: string[] = [];
    const check = (seed: number, len: number, t: Track): void => {
      const x0 = t.slices[0].xEnd;
      const limit = len - CONFIG.FINISH_PLAT_BEFORE - CONFIG.AFTER_FINISH;
      const fs = flats(t);
      const n = fs.length;
      const fits = (j: number): boolean => fs.every((f, k) => {
        const a = x0 + ((k + 0.5) * Math.max(0, limit - j * CONFIG.STAR_FLAT_LENGTH - x0)) / n;
        if (f.xStart < a - 1e-9) return false;
        // Toute frontière de [a_k, début du plat étoile[ est refusée (`refusedAt`), sauf celle où le plat étoile
        // précédent a été posé (une frontière sert au plus un plat étoile : graine 504, deux plats étoile accolés).
        const used = fs.slice(0, k).map((g) => g.xStart);
        return t.slices.filter((s) => s.xEnd >= a - 1e-9 && s.xEnd < f.xStart - 1e-9 && !used.some((u) => Math.abs(u - s.xEnd) < 1e-9))
          .every((s) => refusedAt(t, s.xEnd));
      });
      const j = Array.from({ length: 12 }, (_, i) => i).find(fits);
      expect(j, `graine ${seed}, ${len} m : aucun jeu j × STAR_FLAT_LENGTH (j < 12) n'explique la pose`).toBeDefined();
      if (j! > 0) slackUsed.push(`g${seed}/${len} : j = ${j}`);
    };
    for (const [seed, len] of CASES) check(seed, len, track(seed, len));
    for (const seed of WIDE.slice(50)) check(seed, 1680, wideTrack(seed));
    console.log(`plats étoile posés avec du jeu sur les ancres (graines 0 à 49 × 300, 1 680, 6 000 m ; 50 à 999 à 1 680 m) : ${slackUsed.length} (${slackUsed.join(' ; ')})`);
    // Les graines de l'empreinte (0, 1, 2 à 1 680 m) sont posées sans jeu.
    expect(slackUsed.filter((x) => /^g[012]\/1680/.test(x))).toEqual([]);
  });

  // Effet des plats étoile seuls : tremplin permis après une double-bosse et poids de tirage des volcans d'avant (le refus
  // du tour 1 de la 5g change la suite tirée plus tôt, voir le bloc des fosses ; le poids 4 du tour 2 la change dès le
  // premier tirage).
  test('la suite des tranches tirées a un préfixe commun d’au moins 20 tranches avec les pistes d’avant (graines 0 à 49)', () => {
    const prefixes = SEEDS.map((seed) => {
      const now = drawn(generateTrack(seed, 1680, { ...CONFIG, TREMPLIN_AFTER_DOUBLE_BOSSE: 1, VOLCANO_WEIGHT: 3 }));
      const before = generateTrack(seed, 1680, AP).slices;
      let k = 0;
      // Une fosse est une rampe-volcan typée par l'alternance (tâche 5g) : même tirage.
      const same = (a: SliceType, b: SliceType): boolean => (a === 'fosse' ? 'rampe-volcan' : a) === b;
      while (k < now.length && k < before.length && same(now[k].type, before[k].type)
        && Math.abs((now[k].xEnd - now[k].xStart) - (before[k].xEnd - before[k].xStart)) < 1e-6) k++;
      return k;
    });
    console.log(`préfixe commun des tranches tirées (graines 0 à 49) : min ${Math.min(...prefixes)}, moyenne ${(prefixes.reduce((a, b) => a + b, 0) / prefixes.length).toFixed(1)}`);
    for (const [seed, k] of prefixes.entries()) expect(k, `graine ${seed}`).toBeGreaterThanOrEqual(20);
  });

  test('onlyPlat : ni plat étoile ni volcan', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const t = generateTrack(seed, 1680, CONFIG, { onlyPlat: true });
      expect(flats(t)).toEqual([]);
      expect(t.volcanoes).toEqual([]);
    }
  });
});

describe('fosses (tâche 5g, saut §6.3, rulings R-F2, R-F3, R-F5)', () => {
  /** Mêmes pistes sans fosse (FOSSE_PERIOD 0) : la suite tirée doit être la même, à l'échange tremplin / fosse près. */
  const NO_FOSSE: Config = { ...CONFIG, FOSSE_PERIOD: 0 };
  /**
   * Tremplin permis après une double-bosse (comme avant le tour 1 de la 5g) : le refus dépend de la sorte du volcan
   * suivant, donc de l'alternance ; sans lui, FOSSE_PERIOD ne change que la sorte des volcans.
   */
  const DB_OK: Config = { ...CONFIG, TREMPLIN_AFTER_DOUBLE_BOSSE: 1 };

  test('alternance : deux volcans consécutifs de la piste sont de sortes différentes ; au moins une fosse et un tremplin dès 2 volcans', () => {
    expect(CONFIG.FOSSE_PERIOD).toBe(2);
    for (const [seed, len] of CASES) {
      const vs = track(seed, len).volcanoes;
      for (let i = 1; i < vs.length; i++) expect(vs[i].kind, `seed ${seed} len ${len}, volcan ${i}`).not.toBe(vs[i - 1].kind);
      if (vs.length >= 2) {
        expect(vs.some((v) => v.kind === 'fosse'), `seed ${seed} len ${len}`).toBe(true);
        expect(vs.some((v) => v.kind === 'tremplin'), `seed ${seed} len ${len}`).toBe(true);
      }
    }
  });

  test('les deux phases existent (premier volcan tremplin ou fosse), à peu près à parts égales (graines 0 à 49, 1 680 m)', () => {
    const firsts = SEEDS.map((seed) => track(seed, 1680).volcanoes[0]?.kind);
    const nf = firsts.filter((k) => k === 'fosse').length;
    const nt = firsts.filter((k) => k === 'tremplin').length;
    console.log(`premier volcan (graines 0 à 49) : fosse ${nf}, tremplin ${nt}`);
    expect(nf).toBeGreaterThanOrEqual(10);
    expect(nt).toBeGreaterThanOrEqual(10);
  });

  test('même suite de tranches tirées et mêmes x qu’avec FOSSE_PERIOD 0, à l’échange tremplin / fosse près (le rng de la piste n’est pas touché ; tremplin permis après une double-bosse des deux côtés)', () => {
    for (const [seed, len] of CASES) {
      const a = generateTrack(seed, len, DB_OK);
      const b = generateTrack(seed, len, { ...DB_OK, FOSSE_PERIOD: 0 });
      expect(b.volcanoes.every((v) => v.kind === 'tremplin')).toBe(true);
      expect(a.slices.map((s) => (s.type === 'fosse' ? 'rampe-volcan' : s.type)), `seed ${seed} len ${len}`).toEqual(b.slices.map((s) => s.type));
      a.slices.forEach((s, i) => {
        expect(s.xStart, `seed ${seed} len ${len}, tranche ${i}`).toBe(b.slices[i].xStart);
        expect(s.xEnd, `seed ${seed} len ${len}, tranche ${i}`).toBe(b.slices[i].xEnd);
      });
    }
  });

  test('volcans par piste de 1 680 m (graines 0 à 49) : fosses et tremplins comptés ; 15 % à 90 % de la cible', () => {
    const counts = SEEDS.map((seed) => track(seed, 1680).volcanoes);
    const fosses = counts.reduce((n, vs) => n + vs.filter((v) => v.kind === 'fosse').length, 0);
    const tremplins = counts.reduce((n, vs) => n + vs.filter((v) => v.kind === 'tremplin').length, 0);
    console.log(`volcans par course (graines 0 à 49) : ${((fosses + tremplins) / 50).toFixed(2)} [${Math.min(...counts.map((c) => c.length))}, ${Math.max(...counts.map((c) => c.length))}], `
      + `fosses ${(fosses / 50).toFixed(2)}, tremplins ${(tremplins / 50).toFixed(2)}`);
    expect(fosses).toBeGreaterThan(60);
    expect(tremplins).toBeGreaterThan(60);
  });

  test('FOSSE_PERIOD invalide : erreur explicite ; FOSSE_PERIOD 0 : aucune fosse', () => {
    expect(() => generateTrack(0, 1680, { ...CONFIG, FOSSE_PERIOD: -1 })).toThrow(/FOSSE_PERIOD/);
    expect(() => generateTrack(0, 1680, { ...CONFIG, FOSSE_PERIOD: 1.5 })).toThrow(/FOSSE_PERIOD/);
    for (const seed of SEEDS.slice(0, 10)) expect(generateTrack(seed, 1680, NO_FOSSE).slices.some((s) => s.type === 'fosse')).toBe(false);
    // FOSSE_PERIOD 1 : tous les volcans sont des fosses.
    for (const seed of SEEDS.slice(0, 10)) expect(generateTrack(seed, 1680, { ...CONFIG, FOSSE_PERIOD: 1 }).volcanoes.every((v) => v.kind === 'fosse')).toBe(true);
  });

  test('décision du papa (tour 1 de la 5g) : jamais de tremplin juste après une double-bosse (graines 0 à 199, 1 680 m) ; une fosse y reste permise', () => {
    let fossesAfter = 0;
    let refusedWouldBe = 0;
    for (let seed = 0; seed < 200; seed++) {
      const d = drawn(seed < 50 ? track(seed, 1680) : generateTrack(seed, 1680, CONFIG));
      for (let i = 1; i < d.length; i++) {
        if (d[i - 1].type !== 'double-bosse') continue;
        expect(d[i].type, `graine ${seed}, tranche tirée ${i}`).not.toBe('rampe-volcan');
        if (d[i].type === 'fosse') fossesAfter++;
      }
      // Avec la règle levée, des tremplins suivaient une double-bosse : le refus sert.
      if (seed < 50) {
        const old = drawn(generateTrack(seed, 1680, DB_OK));
        for (let i = 1; i < old.length; i++) if (old[i - 1].type === 'double-bosse' && old[i].type === 'rampe-volcan') refusedWouldBe++;
      }
    }
    console.log(`double-bosse puis volcan (graines 0 à 199) : ${fossesAfter} fosses, 0 tremplin ; règle levée (graines 0 à 49) : ${refusedWouldBe} tremplins`);
    expect(fossesAfter).toBeGreaterThan(10);
    expect(refusedWouldBe).toBeGreaterThan(0);
    expect(() => generateTrack(0, 1680, CONFIG)).not.toThrow();
  });

  test('plats étoile : jamais juste après une fosse non plus (décision du papa)', () => {
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      t.slices.forEach((s, i) => {
        if (s.type === 'plat-étoile') expect(t.slices[i - 1].type, `seed ${seed} len ${len}`).not.toBe('fosse');
      });
    }
  });
});

describe('defaultTrackLength / parseTrackOptions', () => {
  const DEF = CONFIG.V_CRUISE * CONFIG.RACE_TARGET_SECONDS;

  test('longueur par défaut = V_CRUISE × RACE_TARGET_SECONDS', () => {
    expect(defaultTrackLength(CONFIG)).toBeCloseTo(DEF, 9);
    expect(defaultTrackLength(CONFIG)).toBeCloseTo(1680, 9);
  });

  test('seed et len valides', () => {
    expect(parseTrackOptions('?seed=5&len=900', CONFIG)).toEqual({ seed: 5, length: 900, debug: false });
    expect(parseTrackOptions('seed=5&len=900', CONFIG)).toEqual({ seed: 5, length: 900, debug: false });
  });

  test('défauts : seed 1, longueur par défaut', () => {
    expect(parseTrackOptions('', CONFIG)).toEqual({ seed: 1, length: DEF, debug: false });
    expect(parseTrackOptions('?', CONFIG)).toEqual({ seed: 1, length: DEF, debug: false });
  });

  test('len borné à [300, 6000], NaN → défaut', () => {
    expect(parseTrackOptions('?len=50', CONFIG).length).toBe(300);
    expect(parseTrackOptions('?len=-1', CONFIG).length).toBe(300);
    expect(parseTrackOptions('?len=99999', CONFIG).length).toBe(6000);
    expect(parseTrackOptions('?len=abc', CONFIG).length).toBeCloseTo(DEF, 9);
  });

  test('seed invalide ou négative → 1', () => {
    expect(parseTrackOptions('?seed=abc', CONFIG).seed).toBe(1);
    expect(parseTrackOptions('?seed=-3', CONFIG).seed).toBe(1);
    expect(parseTrackOptions('?seed=0', CONFIG).seed).toBe(0);
    expect(parseTrackOptions('?seed=7.9', CONFIG).seed).toBe(7);
  });

  test('debug=1 seulement', () => {
    expect(parseTrackOptions('?debug=1', CONFIG).debug).toBe(true);
    expect(parseTrackOptions('?debug=0', CONFIG).debug).toBe(false);
    expect(parseTrackOptions('?debug=true', CONFIG).debug).toBe(false);
  });
});
