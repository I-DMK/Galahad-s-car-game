import { CONFIG } from '../src/config';
import { defaultTrackLength, generateTrack, parseTrackOptions } from '../src/track/generate';
import { plat } from '../src/track/slices';
import { mulberry32 } from '../src/track/rng';
import type { Slice, Track } from '../src/track/types';
import { AP } from './helpers/anciennes-pistes';

/** Tranches tirées : sans les plats étoile, posés sans tirage (tâche 5e, ruling R-F5). */
const drawn = (t: Track): Slice[] => t.slices.filter((s) => s.type !== 'plat-étoile');

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

  test('jamais deux rampe-volcan consécutives (plats étoile ignorés) ; volcanoes cohérents avec les tranches', () => {
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      const d = drawn(t);
      for (let i = 1; i < d.length; i++) {
        expect(d[i].type === 'rampe-volcan' && d[i - 1].type === 'rampe-volcan').toBe(false);
      }
      const vs = t.slices.filter((s) => s.type === 'rampe-volcan');
      expect(t.volcanoes).toHaveLength(vs.length);
      vs.forEach((s, k) => {
        const v = t.volcanoes[k];
        expect(v.xLancement).toBe(s.xStart);
        expect(v.xEnd).toBeCloseTo(s.xEnd, 9);
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

  test('aucun volcan n’est précédé d’une rampe-saut, plats étoile ignorés (graines 0 à 49, 1 680 m)', () => {
    for (const seed of SEEDS) {
      const d = drawn(track(seed, 1680));
      for (let i = 1; i < d.length; i++) {
        if (d[i].type === 'rampe-volcan') expect(d[i - 1].type, `seed ${seed}, tranche tirée ${i}`).not.toBe('rampe-saut');
      }
    }
  });

  // Tâche 5e : les plats étoile prennent ≈ 171 m à longueur constante ; « 3 à 7 » devient « 2 à 7 » (saut §6.3).
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
    expect([...types].sort()).toEqual(['bosses', 'double-bosse', 'plat', 'plat-étoile', 'rampe-saut', 'rampe-volcan']);
  });

  test('longueur non multiple de la maille : longueur à moins d une maille de la cible', () => {
    const t = generateTrack(3, 913.37, CONFIG);
    expect(Math.abs(t.length - 913.37)).toBeLessThan(S);
    expect(t.xWall - t.xFinish).toBeCloseTo(CONFIG.AFTER_FINISH, 9);
  });
});

describe('plats étoile (tâche 5e, saut §6.6, ruling R-F8)', () => {
  const flats = (t: Track): Slice[] => t.slices.filter((s) => s.type === 'plat-étoile');

  test('N plats étoile : 3 à 1 680 m (graines 0 à 49) et à 6 000 m (graines 0 à 19), 1 à 600 m, 0 à 300 m', () => {
    for (const seed of SEEDS) expect(flats(track(seed, 1680)), `graine ${seed}`).toHaveLength(3);
    for (const seed of SEEDS.slice(0, 20)) expect(flats(track(seed, 6000)), `graine ${seed}`).toHaveLength(3);
    for (const seed of SEEDS) {
      expect(flats(generateTrack(seed, 600, CONFIG)), `graine ${seed}`).toHaveLength(1);
      expect(flats(track(seed, 300)), `graine ${seed}`).toHaveLength(0);
    }
  });

  test('longueur STAR_FLAT_LENGTH (57 m) à une maille près, hauteur 0, jamais juste après une rampe-saut', () => {
    expect(CONFIG.STAR_FLAT_LENGTH).toBe(CONFIG.STAR_HIGH_BUMP_CLEARANCE + CONFIG.STAR_HIGH_TAKEOFF_ROOM + CONFIG.STAR_HIGH_LANDING_ROOM);
    expect(CONFIG.STAR_FLAT_LENGTH).toBe(57);
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      t.slices.forEach((s, i) => {
        if (s.type !== 'plat-étoile') return;
        expect(Math.abs(s.xEnd - s.xStart - CONFIG.STAR_FLAT_LENGTH), `graine ${seed}`).toBeLessThanOrEqual(S + 1e-9);
        expect(t.slices[i - 1].type, `graine ${seed}, plat étoile en ${s.xStart}`).not.toBe('rampe-saut');
        expect(t.points.filter((p) => p.x >= s.xStart - 1e-9 && p.x <= s.xEnd + 1e-9 && p.y !== 0)).toEqual([]);
      });
    }
  });

  test('le k-ième plat étoile commence à la première frontière ≥ a_k permise (frontières sautées : après une rampe-saut seulement)', () => {
    for (const [seed, len] of CASES) {
      const t = track(seed, len);
      const x0 = t.slices[0].xEnd;
      const limit = len - CONFIG.FINISH_PLAT_BEFORE - CONFIG.AFTER_FINISH;
      const fs = flats(t);
      const n = fs.length;
      fs.forEach((f, k) => {
        const a = x0 + ((k + 0.5) * (limit - x0)) / n;
        const where = `graine ${seed}, ${len} m, plat étoile ${k} en ${f.xStart.toFixed(1)} (ancre ${a.toFixed(1)})`;
        expect(f.xStart, where).toBeGreaterThanOrEqual(a - 1e-9);
        // Toute frontière de [a_k, début du plat étoile[ suit une rampe-saut (frontière refusée).
        const skipped = t.slices.filter((s) => s.xEnd >= a - 1e-9 && s.xEnd < f.xStart - 1e-9);
        for (const s of skipped) expect(s.type, where).toBe('rampe-saut');
      });
    }
  });

  test('la suite des tranches tirées a un préfixe commun d’au moins 20 tranches avec les pistes d’avant (graines 0 à 49)', () => {
    const prefixes = SEEDS.map((seed) => {
      const now = drawn(track(seed, 1680));
      const before = generateTrack(seed, 1680, AP).slices;
      let k = 0;
      while (k < now.length && k < before.length && now[k].type === before[k].type
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
