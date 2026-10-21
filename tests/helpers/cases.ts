// Cas 1 à 5 de l'addendum §1.7 (« arriver lancé »), partagés par tests/volcans.test.ts (graines
// 0 à 2), tests/slow/volcans-slow.test.ts (graines 3 à 9) et tests/slow/dosage.test.ts (cfg surchargé).
import { CONFIG, type Config } from '../../src/config';
import type { World } from '../../src/physics/world';
import type { Track, Volcano } from '../../src/track/types';
import {
  DEG, LIP_SPEED_THRESHOLD, describeRun, f2, runFrom, worldFor, worstSafePoint, type RunOptions, type RunResult,
} from './runs';

export type CaseId = 1 | 2 | 3 | 4 | 5;

export interface Scenario { name: string; x0: number; opts: RunOptions }

const always = () => true;
const RUN_SECONDS = 20;
/** Cas 3 : arrêt 60 m avant xLancement quand la tranche précédente est bosses ou rampe-saut. */
const CASE3_BEFORE = 60;
/** Cas 4 : vitesse ramenée à 8 m/s jusqu'à xElanStart − 15 (choc inélastique simulé). */
const CASE4_SPEED = 8;
const CASE4_UNTIL = 15;
/** Cas 5 : turbo pris à xElanStart − 2 (étoile d'élan, STAR_ELAN_OFFSET). */
const CASE5_TURBO_BEFORE = 2;

export const CASE_TITLES: Record<CaseId, string> = {
  1: 'cas 1 : arrêt au début du plat d’élan, doigt posé → lave avant la réception',
  2: 'cas 2 : arrêt au pire point sûr et au début du plat de lancement, doigt posé → passe, atterrit sur la réception',
  3: 'cas 3 : lancée après bosses ou rampe-saut (arrêt 60 m avant le lancement) → passe',
  4: 'cas 4 : choc simulé (8 m/s jusqu’à xElanStart − 15) → passe',
  5: 'cas 5 : turbo pris à xElanStart − 2 → passe, atterrit avant la fin de la tranche',
};

/** Scénarios (départ, options) du cas pour un volcan ; vide quand le motif n'existe pas (cas 3). */
export function scenariosFor(caseId: CaseId, track: Track, v: Volcano, cfg: Config = CONFIG): Scenario[] {
  const base: RunOptions = { throttle: always, maxSeconds: RUN_SECONDS, cfg };
  switch (caseId) {
    case 1:
      return [{ name: 'arrêt à xElanStart', x0: v.xElanStart, opts: base }];
    case 2:
      return [
        { name: 'pire point sûr (xLancement + 5)', x0: worstSafePoint(v, cfg), opts: base },
        { name: 'début du plat de lancement', x0: v.xLancement, opts: base },
      ];
    case 3: {
      const i = track.slices.findIndex((s) => s.xStart === v.xLancement);
      const prev = i > 0 ? track.slices[i - 1] : undefined;
      if (!prev || (prev.type !== 'bosses' && prev.type !== 'rampe-saut')) return [];
      const x0 = Math.max(v.xLancement - CASE3_BEFORE, prev.xStart);
      return [{ name: `lancée après ${prev.type} (arrêt ${(v.xLancement - x0).toFixed(1)} m avant)`, x0, opts: { ...base, maxSeconds: RUN_SECONDS + 10 } }];
    }
    case 4:
      return [{
        name: `choc à ${CASE4_SPEED} m/s jusqu’à xElanStart − ${CASE4_UNTIL}`,
        x0: worstSafePoint(v, cfg),
        opts: { ...base, speedCapUntil: { x: v.xElanStart - CASE4_UNTIL, v: CASE4_SPEED } },
      }];
    case 5:
      return [{ name: `turbo à xElanStart − ${CASE5_TURBO_BEFORE}`, x0: v.xLancement, opts: { ...base, turboAt: v.xElanStart - CASE5_TURBO_BEFORE } }];
  }
}

/** Assertions communes aux cas 2 à 5 : pas de lave, réception atteinte, posée à plat, jamais retournée. */
export function expectPasses(r: RunResult, v: Volcano, where: string, requireMargin = true): void {
  expect(r.lava, where).toBe(false);
  expect(r.landX, where).not.toBeNull();
  expect(r.landX!, where).toBeGreaterThanOrEqual(v.xReception);
  expect(Math.abs(r.landAngle), where).toBeLessThan(45 * DEG);
  expect(r.flipped, where).toBe(false);
  expect(r.wheelsBelow, where).toBe(true);
  expect(r.lipSpeed, where).not.toBeNull();
  if (requireMargin) expect(r.lipSpeed!, where).toBeGreaterThanOrEqual(LIP_SPEED_THRESHOLD + 1);
}

/** Cas 1 : la voiture tombe dans la lave avant d'atteindre la réception. */
export function expectFalls(r: RunResult, v: Volcano, where: string): void {
  expect(r.lava, where).toBe(true);
  if (r.landX !== null) expect(r.landX, where).toBeLessThan(v.xReception);
}

/** Vitesse au sommet min / max observée par cas (pour le rapport de calibration). */
export interface LipStats { min: number; max: number; runs: number; volcanoes: number }
const newStats = (): LipStats => ({ min: Infinity, max: -Infinity, runs: 0, volcanoes: 0 });
function record(stats: LipStats, r: RunResult): void {
  stats.runs++;
  if (r.lipSpeed !== null) {
    stats.min = Math.min(stats.min, r.lipSpeed);
    stats.max = Math.max(stats.max, r.lipSpeed);
  }
}

/**
 * Joue le cas sur toutes les rampe-volcan de la piste du monde et vérifie chaque run à 100 %.
 * Renvoie les statistiques de vitesse au sommet.
 */
export function runCase(caseId: CaseId, seed: number, world: World, cfg: Config = CONFIG): LipStats {
  const stats = newStats();
  const { track } = world;
  for (const v of track.volcanoes) {
    const scenarios = scenariosFor(caseId, track, v, cfg);
    if (scenarios.length) stats.volcanoes++;
    for (const sc of scenarios) {
      const r = runFrom(world, sc.x0, sc.opts);
      record(stats, r);
      const where = describeRun(seed, v, sc.name, r);
      if (caseId === 1) expectFalls(r, v, where);
      else {
        expectPasses(r, v, where);
        if (caseId === 5) expect(r.landX!, where).toBeLessThan(v.xEnd);
      }
    }
  }
  return stats;
}

/**
 * Déclare un test par (cas, graine) sur les mondes CONFIG, puis imprime le tableau des vitesses au
 * sommet (min / max par cas, toutes graines confondues) à la fin du fichier.
 */
export function registerVolcanoCases(seedsByCase: Record<CaseId, number[]>): void {
  const totals: Record<CaseId, LipStats> = { 1: newStats(), 2: newStats(), 3: newStats(), 4: newStats(), 5: newStats() };
  for (const caseId of [1, 2, 3, 4, 5] as CaseId[]) {
    const seeds = seedsByCase[caseId];
    if (!seeds.length) continue;
    describe(CASE_TITLES[caseId], () => {
      test.each(seeds)('seed %i', (seed) => {
        const world = worldFor(seed);
        expect(world.track.volcanoes.length).toBeGreaterThan(0);
        const s = runCase(caseId, seed, world);
        const t = totals[caseId];
        t.runs += s.runs;
        t.volcanoes += s.volcanoes;
        t.min = Math.min(t.min, s.min);
        t.max = Math.max(t.max, s.max);
      });
    });
  }
  afterAll(() => {
    const lines = ([1, 2, 3, 4, 5] as CaseId[])
      .filter((c) => seedsByCase[c].length)
      .map((c) => `cas ${c} (graines ${seedsByCase[c].join(',')}) : ${totals[c].volcanoes} volcans, ${totals[c].runs} runs, sommet ${f2(totals[c].min)}–${f2(totals[c].max)} m/s`);
    console.log(`vitesse au sommet par cas\n${lines.join('\n')}`);
  });
}
