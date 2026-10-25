// Rochers (plan C, tâche 11c ; spec « rochers » §3, décisions Q-C4 et Q-C4 bis du papa) : places possibles sur les plats
// ordinaires et les réceptions de fosse, puis au plus ROCKS_PER_RACE tirés sur le rng de la piste APRÈS tous les autres
// tirages (terrain et étoiles inchangés au bit près). Pur : ni DOM, ni matter-js.
import type { Config } from '../config';
import type { Rock, Slice, Track } from './types';

const EPS = 1e-9;

const isVolcanoSlice = (sl: Slice): boolean => sl.type === 'rampe-volcan' || sl.type === 'fosse';

/** Plus grand élément de `xs` (triés) qui soit ≤ x, null s'il n'y en a pas. */
function lastAtMost(xs: readonly number[], x: number): number | null {
  let out: number | null = null;
  for (const v of xs) {
    if (v > x + EPS) break;
    out = v;
  }
  return out;
}

/** Plus petit élément de `xs` (triés) qui soit ≥ x, null s'il n'y en a pas. */
function firstAtLeast(xs: readonly number[], x: number): number | null {
  for (const v of xs) if (v >= x - EPS) return v;
  return null;
}

/**
 * Places possibles (xStart d'un rocher), une par plat ordinaire éligible et par réception de fosse, dans l'ordre de la
 * piste (spec §3) :
 * - plat ordinaire : tranche `plat` hors plat de départ (indice 0), hors plat d'arrivée en entier (xEnd ≤ xFinish −
 *   FINISH_PLAT_BEFORE), d'au moins ROCK_MIN_PLAT, qui ne suit pas un volcan (tremplin ou fosse) ; xStart dans
 *   [lo, hi] avec lo = max(début du plat, xStart de la piste + D_LANCE, fin de la dernière rampe-saut d'abscisse ≤ début du
 *   plat + ROCK_RAMP_CLEARANCE, dernière étoile haute d'abscisse ≤ début du plat + ROCK_HIGH_STAR_LANDING) et hi =
 *   min(fin du plat − ROCK_WIDTH, début de la prochaine tranche volcan − ROCK_VOLCANO_GAP − ROCK_WIDTH) ;
 * - réception de fosse : lo = bord aval + FOSSE_STAR_AFTER + ROCK_STAR_GAP (10 m après l'étoile de réception), hi = fin de
 *   la tranche − ROCK_WIDTH − 5, mêmes dégagements (rampe-saut, étoile haute, prochaine tranche volcan) ;
 * - position : le point de [lo, hi] le plus proche du centre (balayage à TRACK_POINT_SPACING, le côté amont d'abord à
 *   distance égale) sans étoile basse dans ]x − ROCK_STAR_GAP, x + ROCK_WIDTH + ROCK_STAR_GAP[ ; aucun, ou hi < lo : pas
 *   de candidate ;
 * - espacement : glouton dans l'ordre de la piste, une place à moins de ROCK_SPACING de la dernière retenue est écartée.
 */
export function rockCandidates(track: Track, cfg: Config): number[] {
  const W = cfg.ROCK_WIDTH;
  const rampEnds = track.slices.filter((sl) => sl.type === 'rampe-saut').map((sl) => sl.xEnd);
  const volcanoStarts = track.slices.filter(isVolcanoSlice).map((sl) => sl.xStart);
  const highXs = track.stars.filter((s) => s.high).map((s) => s.x).sort((a, b) => a - b);
  const lowXs = track.stars.filter((s) => !s.high).map((s) => s.x);
  const startClear = track.xStart + cfg.D_LANCE;

  /** Bornes [lo, hi] d'une place commençant en `from` (référence des dégagements amont) et finissant en `to`. */
  const bounds = (from: number, to: number, lo0: number, hi0: number): [number, number] => {
    let lo = Math.max(lo0, startClear);
    const ramp = lastAtMost(rampEnds, from);
    if (ramp !== null) lo = Math.max(lo, ramp + cfg.ROCK_RAMP_CLEARANCE);
    const high = lastAtMost(highXs, from);
    if (high !== null) lo = Math.max(lo, high + cfg.ROCK_HIGH_STAR_LANDING);
    let hi = hi0;
    const volcano = firstAtLeast(volcanoStarts, to);
    if (volcano !== null) hi = Math.min(hi, volcano - cfg.ROCK_VOLCANO_GAP - W);
    return [lo, hi];
  };

  const places: [number, number][] = [];
  const limit = track.xFinish - cfg.FINISH_PLAT_BEFORE;
  track.slices.forEach((sl, i) => {
    if (sl.type === 'plat') {
      if (i === 0 || sl.xEnd > limit + EPS || sl.xEnd - sl.xStart < cfg.ROCK_MIN_PLAT - EPS) return;
      if (isVolcanoSlice(track.slices[i - 1])) return;
      places.push(bounds(sl.xStart, sl.xEnd, sl.xStart, sl.xEnd - W));
    } else if (sl.type === 'fosse') {
      const f = track.volcanoes.find((v) => v.kind === 'fosse' && Math.abs(v.xEnd - sl.xEnd) < EPS);
      if (!f) return;
      places.push(bounds(f.xReception, f.xEnd, f.xReception + cfg.FOSSE_STAR_AFTER + cfg.ROCK_STAR_GAP, f.xEnd - W - 5));
    }
  });

  const free = (x: number): boolean =>
    lowXs.every((s) => !(s > x - cfg.ROCK_STAR_GAP && s < x + W + cfg.ROCK_STAR_GAP));
  const out: number[] = [];
  const step = cfg.TRACK_POINT_SPACING;
  for (const [lo, hi] of places) {
    if (hi < lo - EPS) continue;
    const centre = (lo + hi) / 2;
    let x: number | null = null;
    for (let k = 0; centre - k * step >= lo - EPS || centre + k * step <= hi + EPS; k++) {
      const below = centre - k * step;
      const above = centre + k * step;
      if (below >= lo - EPS && free(below)) { x = below; break; }
      if (above <= hi + EPS && free(above)) { x = above; break; }
    }
    if (x === null) continue;
    if (out.length > 0 && Math.abs(x - out[out.length - 1]) < cfg.ROCK_SPACING - EPS) continue;
    out.push(x);
  }
  return out;
}

/**
 * Rochers d'une piste, au plus ROCKS_PER_RACE (0 : aucun, et aucun tirage) : toutes les candidates s'il y en a au plus
 * ROCKS_PER_RACE, sinon ROCKS_PER_RACE tirées sans remise par `rng` (Fisher-Yates partiel, comme `chooseHighStars`) ;
 * résultat dans l'ordre de la piste, ids 0, 1, 2…, xEnd = xStart + ROCK_WIDTH. À appeler après `placeStars` (spec §3).
 */
export function placeRocks(track: Track, rng: () => number, cfg: Config): Rock[] {
  const n = cfg.ROCKS_PER_RACE;
  if (!Number.isInteger(n) || n < 0) throw new Error(`placeRocks : ROCKS_PER_RACE ${n} doit être un entier ≥ 0`);
  if (n === 0) return [];
  const cands = rockCandidates(track, cfg);
  if (cands.length > n) {
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(rng() * (cands.length - i));
      [cands[i], cands[j]] = [cands[j], cands[i]];
    }
    cands.length = n;
    cands.sort((a, b) => a - b);
  }
  return cands.map((xStart, id) => ({ id, xStart, xEnd: xStart + cfg.ROCK_WIDTH }));
}
