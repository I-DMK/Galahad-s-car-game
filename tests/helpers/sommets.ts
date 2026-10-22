// Sauts au sommet des tremplins et des rampes-saut, avec la tolérance de sol (plan B, tâche 5e, Steps 11 et 14 ;
// addendum « bouton saut » §6.2, « Tolérance de sol : saut au sommet d'un tremplin »). Pour chaque sommet et chaque
// arrivée : un run sans saut repère le dernier contact de jeu au sommet (pas L), puis un saut est demandé à chaque pas
// de [L − 6, L + JUMP_GROUND_GRACE] (28 sauts). Galahad seul, vrai `stepRace` (`jumpRun`), monde rogné.
import { CONFIG } from '../../src/config';
import type { World } from '../../src/physics/world';
import type { Slice, Track, Volcano } from '../../src/track/types';
import { jumpRun, lastGroundedBefore, type JumpRunResult } from './jump-runs';
import { croppedWorld } from './phases';
import { trackFor } from './runs';

const STEPS = (s: number): number => Math.round(s / CONFIG.PHYSICS_DT);
/** Pas avant le dernier contact de jeu où commence le balayage. */
export const SWEEP_BEFORE = 6;
/** Longueur au sol de la montée d'une rampe (m). */
export const RAMP_RUN = CONFIG.RAMP_LENGTH * Math.cos(CONFIG.RAMP_ANGLE);

/** Une arrivée : départ, lancée, facteur tenu et turbos posés aux x donnés. */
export interface Arrival { id: string; x0: number; v: number; factor?: number; turboAtX?: number[] }

/** Les 4 arrivées d'un tremplin (saut §6.2). */
export function tremplinArrivals(v: Volcano): Arrival[] {
  return [
    { id: 'doigt posé depuis xLancement', x0: v.xLancement, v: 0 },
    { id: 'turbo de l’étoile d’élan', x0: v.xLancement, v: 0, turboAtX: [v.xElanStart - CONFIG.STAR_ELAN_OFFSET] },
    { id: 'lancée à V_MAX en xLancement − 45, turbo à − 26', x0: v.xLancement - 45, v: CONFIG.V_MAX, turboAtX: [v.xLancement - 26] },
    { id: 'turbo permanent', x0: v.xLancement, v: 0, factor: CONFIG.TURBO_FACTOR },
  ];
}

/** Les 2 arrivées d'une rampe-saut : lancée à V_MAX ou en turbo (21 m/s tenus), 45 m avant son pied. */
export function rampArrivals(ramp: Slice): Arrival[] {
  return [
    { id: 'V_MAX', x0: ramp.xStart - 45, v: CONFIG.V_MAX },
    { id: 'turbo', x0: ramp.xStart - 45, v: CONFIG.V_MAX * CONFIG.TURBO_FACTOR },
  ];
}

export interface SummitSweep {
  arrival: string;
  /** Pas du dernier contact de jeu au sommet dans le run sans saut, et sa vitesse (m/s). */
  last: number;
  speedAtLast: number;
  /** Un résultat par pas balayé, de L − SWEEP_BEFORE à L + grâce. */
  runs: { k: number; r: JumpRunResult }[];
}

/** Balayage des sauts au sommet `xSummit` (x du sommet) pour une arrivée, dans `world`. */
export function sweepSummit(world: World, xSummit: number, a: Arrival, maxSeconds: number): SummitSweep {
  const base = { x0: a.x0, v: a.v, factor: a.factor, turboAtX: a.turboAtX, maxSeconds };
  const pilot = jumpRun(world, { ...base, jumpAtStep: null, stopAtX: xSummit + 40 });
  const last = lastGroundedBefore(pilot, xSummit + 3);
  if (last < 0) throw new Error(`aucun contact de jeu avant le sommet ${xSummit.toFixed(1)} (${a.id})`);
  const runs: SummitSweep['runs'] = [];
  for (let k = last - SWEEP_BEFORE; k <= last + STEPS(CONFIG.JUMP_GROUND_GRACE); k++) {
    runs.push({ k, r: jumpRun(world, { ...base, jumpAtStep: k }) });
  }
  return { arrival: a.id, last, speedAtLast: pilot.trace[last].speed, runs };
}

/** Monde rogné autour d'une tranche : `before` m avant son début, `after` m après sa fin. */
export const worldAround = (track: Track, x0: number, x1: number, before: number, after: number): World =>
  croppedWorld(track, CONFIG, x0 - before, x1 + after);

export const isLava = (r: JumpRunResult): boolean => r.respawns.some((e) => e.reason === 'lava');
export const otherRespawn = (r: JumpRunResult): boolean => r.respawns.some((e) => e.reason !== 'lava');

/** Résumé d'un balayage de tremplin : sauts, chutes, autres réapparitions, marge d'atterrissage avant `xEnd`. */
export interface TremplinRow {
  seed: number; vi: number; arrival: string; speedAtLast: number; jumps: number; jumped: number;
  lava: number; other: number; minMarginToEnd: number; marginAtLast: number;
}

export function tremplinRow(seed: number, vi: number, v: Volcano, s: SummitSweep): TremplinRow {
  const margins = s.runs.map(({ r }) => (r.landingX === null ? NaN : v.xEnd - r.landingX));
  const atLast = s.runs.find(({ k }) => k === s.last);
  return {
    seed, vi, arrival: s.arrival, speedAtLast: s.speedAtLast, jumps: s.runs.length,
    jumped: s.runs.filter(({ r }) => r.jumped).length,
    lava: s.runs.filter(({ r }) => isLava(r)).length,
    other: s.runs.filter(({ r }) => otherRespawn(r)).length,
    minMarginToEnd: Math.min(...margins.map((m) => (Number.isNaN(m) ? -Infinity : m))),
    marginAtLast: atLast?.r.landingX != null ? v.xEnd - atLast.r.landingX : NaN,
  };
}

const f1 = (n: number): string => (Number.isFinite(n) ? n.toFixed(1) : '—');

/**
 * Tremplins des graines `seeds` (pistes de CONFIG) : pour chaque tremplin et chaque arrivée, saut à chaque pas de
 * [dernier contact de jeu − 6 pas, dernier contact + 0,35 s]. Imprime chutes, autres réapparitions et marge
 * d'atterrissage avant `xEnd`. Step 11 : mesure (seuls les comptes sont assertés : chaque pas balayé saute).
 */
export function registerSautVolcan(seeds: readonly number[]): void {
  test(`sauts au sommet des tremplins, tolérance de sol, graines ${seeds[0]} à ${seeds[seeds.length - 1]}`, () => {
    const t0 = performance.now();
    const rows: TremplinRow[] = [];
    for (const seed of seeds) {
      const track = trackFor(seed);
      track.volcanoes.forEach((v, vi) => {
        const world = worldAround(track, v.xLancement, v.xEnd, 60, 120);
        for (const a of tremplinArrivals(v)) rows.push(tremplinRow(seed, vi, v, sweepSummit(world, v.xLip, a, 14)));
      });
    }
    const by = (id: string) => rows.filter((r) => r.arrival === id);
    const lines = tremplinArrivals(trackFor(seeds[0]).volcanoes[0]).map(({ id }) => {
      const rs = by(id);
      return `${id} : ${rs.length} tremplins, ${rs.reduce((s, r) => s + r.jumps, 0)} sauts, lave ${rs.reduce((s, r) => s + r.lava, 0)}, `
        + `autres réapparitions ${rs.reduce((s, r) => s + r.other, 0)}, marge min avant xEnd ${f1(Math.min(...rs.map((r) => r.minMarginToEnd)))} m `
        + `(au dernier contact ${f1(Math.min(...rs.map((r) => r.marginAtLast)))} m), vitesse au dernier contact ≤ ${f1(Math.max(...rs.map((r) => r.speedAtLast)))} m/s`;
    });
    console.log(`sauts au sommet des tremplins, graines ${seeds.join(', ')} (${((performance.now() - t0) / 60_000).toFixed(1)} min) :\n${lines.join('\n')}`);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.jumped, `g${r.seed} volcan ${r.vi} ${r.arrival}`).toBe(r.jumps);
  });
}
