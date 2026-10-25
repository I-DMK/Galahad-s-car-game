// Rochers posés par le générateur (plan C, tâche 11c ; spec « rochers » §3 et §6 « Statique »).
// La fixture `tests/fixtures/pistes-base.json` est le hash du terrain et des étoiles des pistes à BASE (9a0744a), avant
// tout changement du générateur : les rochers sont tirés après tout le reste, terrain et étoiles ne bougent pas.
import { CONFIG, type Config } from '../src/config';
import { generateTrack } from '../src/track/generate';
import { fosses, heightAt, nextRock } from '../src/track/query';
import { placeRocks, rockCandidates } from '../src/track/rocks';
import type { Fosse, Rock, Slice, Track } from '../src/track/types';
import BASE from './fixtures/pistes-base.json';
import { terrainHash } from './helpers/fingerprint';

const SANS_ROCHER: Config = { ...CONFIG, ROCKS_PER_RACE: 0 };
const FIXTURE = BASE as Record<string, string[]>;

test.each([[1680, 50], [300, 20], [600, 20], [1000, 20]])('%i m : terrain et étoiles identiques à BASE, avec CONFIG et avec ROCKS_PER_RACE = 0', (len, n) => {
  const expected = FIXTURE[String(len)];
  expect(expected).toHaveLength(n);
  for (let seed = 0; seed < n; seed++) {
    expect(terrainHash(generateTrack(seed, len, CONFIG)), `graine ${seed}, CONFIG`).toBe(expected[seed]);
    expect(terrainHash(generateTrack(seed, len, SANS_ROCHER)), `graine ${seed}, ROCKS_PER_RACE 0`).toBe(expected[seed]);
  }
});

// ——— Tests statiques des rochers (spec §3, §6 « Statique »), graines 0 à 49, 1 680 m ———

const SEEDS = Array.from({ length: 50 }, (_, i) => i);
const TRACKS = SEEDS.map((seed) => generateTrack(seed, 1680, CONFIG));
const EPS = 1e-9;
const isVolcanoSlice = (sl: Slice): boolean => sl.type === 'rampe-volcan' || sl.type === 'fosse';

/** Place d'un rocher : plat ordinaire éligible (indice de tranche) ou réception de fosse ; null si aucune. */
function placeOf(track: Track, rock: Rock): { kind: 'plat'; slice: Slice } | { kind: 'fosse'; f: Fosse } | null {
  const i = track.slices.findIndex((sl) => sl.xStart <= rock.xStart + EPS && rock.xEnd <= sl.xEnd + EPS);
  if (i < 0) return null;
  const sl = track.slices[i];
  if (sl.type === 'plat') {
    const ok = i > 0 && sl.xEnd - sl.xStart >= CONFIG.ROCK_MIN_PLAT - EPS && !isVolcanoSlice(track.slices[i - 1])
      && sl.xEnd <= track.xFinish - CONFIG.FINISH_PLAT_BEFORE + EPS;
    return ok ? { kind: 'plat', slice: sl } : null;
  }
  if (sl.type === 'fosse') {
    const f = fosses(track).find((v) => Math.abs(v.xEnd - sl.xEnd) < EPS);
    const ok = f !== undefined && rock.xStart >= f.xReception + CONFIG.FOSSE_STAR_AFTER + CONFIG.ROCK_STAR_GAP - EPS
      && rock.xEnd <= f.xEnd - 5 + EPS;
    return ok && f ? { kind: 'fosse', f } : null;
  }
  return null;
}

describe('rochers posés par le générateur (graines 0 à 49, 1 680 m)', () => {
  test('au plus 4 rochers par piste, 4 sur au moins 30 pistes sur 50, aucune piste à 0 ; ids 0, 1, 2… dans l’ordre de la piste', () => {
    const counts = TRACKS.map((t) => t.rocks.length);
    const hist = [0, 1, 2, 3, 4].map((n) => counts.filter((c) => c === n).length);
    console.log(`rochers par piste (graines 0 à 49) : ${hist.map((h, n) => `${n} → ${h}`).join(', ')} ; moyenne ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(2)}`);
    for (const t of TRACKS) {
      expect(t.rocks.length, `graine ${t.seed}`).toBeLessThanOrEqual(CONFIG.ROCKS_PER_RACE);
      expect(t.rocks.length, `graine ${t.seed}`).toBeGreaterThan(0);
      t.rocks.forEach((r, k) => {
        expect(r.id).toBe(k);
        if (k > 0) expect(r.xStart).toBeGreaterThan(t.rocks[k - 1].xStart);
      });
      // Les rochers sont des candidates (toutes s'il y en a au plus ROCKS_PER_RACE).
      const cands = rockCandidates(t, CONFIG);
      for (const r of t.rocks) expect(cands).toContain(r.xStart);
      if (cands.length <= CONFIG.ROCKS_PER_RACE) expect(t.rocks.map((r) => r.xStart)).toEqual(cands);
    }
    expect(hist[4]).toBeGreaterThanOrEqual(30);
  });

  test('chaque rocher : largeur ROCK_WIDTH, sur un plat ordinaire éligible (≥ 20 m, pas après un volcan, pas le plat d’arrivée) ou une réception de fosse (xStart ≥ bord aval + 35, xEnd ≤ xEnd − 5) ; sol à 0 sous tout le rocher', () => {
    let onPlat = 0;
    let onFosse = 0;
    for (const t of TRACKS) {
      for (const r of t.rocks) {
        const where = `graine ${t.seed}, rocher ${r.id} en ${r.xStart.toFixed(1)}`;
        expect(r.xEnd - r.xStart, where).toBeCloseTo(CONFIG.ROCK_WIDTH, 9);
        const place = placeOf(t, r);
        expect(place, where).not.toBeNull();
        if (place?.kind === 'plat') onPlat++; else onFosse++;
        for (const p of t.points) if (p.x >= r.xStart - EPS && p.x <= r.xEnd + EPS) expect(p.y, where).toBe(0);
        expect(heightAt(t, r.xStart), where).toBe(0);
        expect(heightAt(t, r.xEnd), where).toBe(0);
      }
    }
    console.log(`rochers sur un plat ordinaire : ${onPlat}, sur une réception de fosse : ${onFosse}`);
  });

  test('dégagements : ≥ D_LANCE après xStart ; ≥ 50 m après la fin de toute rampe-saut ; ≥ 60 m avant le début de toute tranche volcan ; ≥ 30 m après toute étoile haute ; ≥ 10 m de toute étoile basse ; ≥ 60 m entre deux rochers', () => {
    for (const t of TRACKS) {
      t.rocks.forEach((r, k) => {
        const where = `graine ${t.seed}, rocher ${r.id} en ${r.xStart.toFixed(1)}`;
        expect(r.xStart, where).toBeGreaterThanOrEqual(t.xStart + CONFIG.D_LANCE - EPS);
        for (const sl of t.slices) {
          if (sl.type === 'rampe-saut' && sl.xEnd <= r.xStart + EPS) expect(r.xStart - sl.xEnd, where).toBeGreaterThanOrEqual(CONFIG.ROCK_RAMP_CLEARANCE - EPS);
          if (isVolcanoSlice(sl) && sl.xStart >= r.xEnd - EPS) expect(sl.xStart - r.xEnd, where).toBeGreaterThanOrEqual(CONFIG.ROCK_VOLCANO_GAP - EPS);
        }
        for (const s of t.stars) {
          if (s.high && s.x <= r.xStart + EPS) expect(r.xStart - s.x, where).toBeGreaterThanOrEqual(CONFIG.ROCK_HIGH_STAR_LANDING - EPS);
          if (!s.high) {
            const inside = s.x > r.xStart - CONFIG.ROCK_STAR_GAP + EPS && s.x < r.xEnd + CONFIG.ROCK_STAR_GAP - EPS;
            expect(inside, `${where}, étoile basse en ${s.x.toFixed(1)}`).toBe(false);
          }
        }
        if (k > 0) expect(r.xStart - t.rocks[k - 1].xStart, where).toBeGreaterThanOrEqual(CONFIG.ROCK_SPACING - EPS);
      });
    }
  });

  test('déterminisme : deux générations identiques ; ENCORE (même graine) donne les mêmes rochers', () => {
    for (const seed of SEEDS) {
      const again = generateTrack(seed, 1680, CONFIG);
      expect(again.rocks).toEqual(TRACKS[seed].rocks);
      expect(JSON.stringify(again)).toBe(JSON.stringify(TRACKS[seed]));
    }
  });

  test('ROCKS_PER_RACE = 0 : rocks vide ; pistes courtes (?len=300) : 0 ou plus, aucune exception, au plus ROCKS_PER_RACE', () => {
    for (const seed of SEEDS) expect(generateTrack(seed, 1680, SANS_ROCHER).rocks).toEqual([]);
    const short: number[] = [];
    for (const len of [300, 600, 1000]) {
      for (let seed = 0; seed < 20; seed++) {
        const t = generateTrack(seed, len, CONFIG);
        expect(t.rocks.length).toBeLessThanOrEqual(CONFIG.ROCKS_PER_RACE);
        if (len === 300) short.push(t.rocks.length);
      }
    }
    console.log(`rochers à 300 m (graines 0 à 19) : ${short.join(' ')}`);
    expect(() => placeRocks(TRACKS[0], () => 0.5, { ...CONFIG, ROCKS_PER_RACE: 1.5 })).toThrow();
  });

  test('rockCandidates : 4,20 ± 0,3 candidates par piste en moyenne sur les graines 0 à 49 (prototype de la spec : 4,20, 2 à 7) ; imprimé', () => {
    const n = TRACKS.map((t) => rockCandidates(t, CONFIG).length);
    const mean = n.reduce((a, b) => a + b, 0) / n.length;
    console.log(`candidates par piste : moyenne ${mean.toFixed(2)}, de ${Math.min(...n)} à ${Math.max(...n)} ; par graine ${n.join(' ')}`);
    expect(Math.min(...n)).toBeGreaterThan(0);
    expect(Math.abs(mean - 4.2)).toBeLessThanOrEqual(0.3);
  });

  test('nextRock : premier rocher strictement devant x, undefined après le dernier', () => {
    const t = TRACKS.find((tr) => tr.rocks.length >= 2)!;
    const [r0, r1] = t.rocks;
    expect(nextRock(t, 0)).toBe(r0);
    expect(nextRock(t, r0.xStart - 0.01)).toBe(r0);
    expect(nextRock(t, r0.xStart)).toBe(r1);
    expect(nextRock(t, t.rocks[t.rocks.length - 1].xStart)).toBeUndefined();
    expect(nextRock({ ...t, rocks: [] }, 0)).toBeUndefined();
  });

  test('placeRocks : plus de candidates que ROCKS_PER_RACE → tirage sans remise, ordre de la piste ; ROCKS_PER_RACE = 0 → aucun tirage', () => {
    const t = TRACKS.find((tr) => rockCandidates(tr, CONFIG).length > CONFIG.ROCKS_PER_RACE)!;
    let draws = 0;
    const rng = (): number => { draws++; return 0.999; };
    const rocks = placeRocks(t, rng, CONFIG);
    expect(rocks).toHaveLength(CONFIG.ROCKS_PER_RACE);
    expect(draws).toBe(CONFIG.ROCKS_PER_RACE);
    expect(rocks.map((r) => r.xStart)).toEqual([...rocks.map((r) => r.xStart)].sort((a, b) => a - b));
    draws = 0;
    expect(placeRocks(t, rng, SANS_ROCHER)).toEqual([]);
    expect(draws).toBe(0);
  });
});
