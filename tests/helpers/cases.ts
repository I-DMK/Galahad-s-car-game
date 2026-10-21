// Cas 1 à 5 de l'addendum §1.7 (« arriver lancé ») et scénario « turbo permanent », partagés par
// tests/volcans.test.ts (graines 0 à 2), tests/slow/volcans-slow.test.ts (graines 3 à 9) et
// tests/slow/dosage.test.ts (cfg surchargé).
//
// Ruling (tour de correction 1) : un départ arrêté à une position relative fixe sur une géométrie de
// volcan identique donne une seule trajectoire (vitesse au sommet identique à 1e-8 près sur les 43
// volcans des graines 0 à 9). Les cas 1, 2, 4, 5 et turbo permanent ne tournent donc que sur le
// premier volcan de chaque graine ; seul le cas 3 (relief précédent) varie et tourne sur tous.
import { CONFIG, type Config } from '../../src/config';
import type { World } from '../../src/physics/world';
import type { Track, Volcano } from '../../src/track/types';
import {
  LANDING_MAX_ANGLE, LIP_SPEED_THRESHOLD, describeRun, f2, runFrom, worldFor, worstSafePoint,
  type RunOptions, type RunResult,
} from './runs';

export type CaseId = 1 | 2 | 3 | 4 | 5 | 'turbo';
export const ALL_CASES: CaseId[] = [1, 2, 3, 4, 5, 'turbo'];
/** Cas à trajectoire unique : premier volcan de la graine seulement. */
export const FIRST_VOLCANO_CASES: CaseId[] = [1, 2, 4, 5, 'turbo'];

export interface Scenario { name: string; x0: number; opts: RunOptions }

const always = () => true;
const RUN_SECONDS = 20;
/** Cas 3 : arrêt 60 m avant xLancement quand la tranche précédente est bosses ou double-bosse. */
const CASE3_BEFORE = 60;
const CASE3_PREVIOUS = ['bosses', 'double-bosse'] as const;
/** Cas 4 : vitesse ramenée à 8 m/s jusqu'à xElanStart (vrai pire choc : en fin de plat de lancement). */
const CASE4_SPEED = 8;
const CASE4_UNTIL = 0;
/** Cas 5 : turbo pris à l'étoile d'élan (xElanStart − STAR_ELAN_OFFSET). */
const CASE5_TURBO_BEFORE = CONFIG.STAR_ELAN_OFFSET;

export const CASE_TITLES: Record<CaseId, string> = {
  1: 'cas 1 : arrêt au début du plat d’élan, doigt posé → lave avant la réception',
  2: 'cas 2 : arrêt au pire point sûr et au début du plat de lancement, doigt posé → passe, atterrit sur la réception',
  3: 'cas 3 : lancée après bosses ou double-bosse (arrêt 60 m avant le lancement) → passe',
  4: 'cas 4 : choc simulé (8 m/s jusqu’à xElanStart) → passe',
  5: 'cas 5 : turbo pris à l’étoile d’élan → passe, atterrit avant la fin de la tranche',
  turbo: 'turbo permanent depuis le début du plat de lancement → passe, atterrit avant la fin de la tranche',
};

/** Scénarios (départ, options) du cas pour un volcan ; vide quand le motif n'existe pas (cas 3). */
export function scenariosFor(caseId: CaseId, track: Track, v: Volcano, cfg: Config = CONFIG): Scenario[] {
  const base: RunOptions = { throttle: always, maxSeconds: RUN_SECONDS, cfg, volcano: v };
  switch (caseId) {
    case 1:
      return [{ name: 'arrêt à xElanStart', x0: v.xElanStart, opts: base }];
    case 2:
      return [
        { name: 'pire point sûr (xLancement + 4,99)', x0: worstSafePoint(v, cfg), opts: base },
        { name: 'début du plat de lancement', x0: v.xLancement, opts: base },
      ];
    case 3: {
      const i = track.slices.findIndex((s) => s.xStart === v.xLancement);
      const prev = i > 0 ? track.slices[i - 1] : undefined;
      if (!prev || !(CASE3_PREVIOUS as readonly string[]).includes(prev.type)) return [];
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
    case 'turbo':
      return [{ name: 'turbo permanent', x0: v.xLancement, opts: { ...base, turboPermanent: true } }];
  }
}

/** Le volcan est passé : pas de lave, atterrissage deux roues sur la réception, posée à plat, jamais retournée. */
export function passesVolcano(r: RunResult, v: Volcano): boolean {
  return !r.lava && r.landX !== null && r.landX >= v.xReception && Math.abs(r.landAngle) < LANDING_MAX_ANGLE
    && !r.flipped && r.wheelsBelow;
}

/** Assertions des cas 2 à 5 (détaillées pour le message) : `passesVolcano` plus la marge au sommet. */
export function expectPasses(r: RunResult, v: Volcano, where: string): void {
  expect(r.lava, where).toBe(false);
  expect(r.landX, where).not.toBeNull();
  expect(r.landX!, where).toBeGreaterThanOrEqual(v.xReception);
  expect(Math.abs(r.landAngle), where).toBeLessThan(LANDING_MAX_ANGLE);
  expect(r.flipped, where).toBe(false);
  expect(r.wheelsBelow, where).toBe(true);
  expect(passesVolcano(r, v), where).toBe(true);
  expect(r.lipSpeed, where).not.toBeNull();
  expect(r.lipSpeed!, where).toBeGreaterThanOrEqual(LIP_SPEED_THRESHOLD + 1);
}

/** Cas 1 : la voiture tombe dans la lave avant d'atteindre la réception. */
export function expectFalls(r: RunResult, v: Volcano, where: string): void {
  expect(r.lava, where).toBe(true);
  if (r.landX !== null) expect(r.landX, where).toBeLessThan(v.xReception);
}

/** Vitesse au sommet min / max observée par cas (pour le rapport de calibration). */
export interface LipStats { min: number; max: number; runs: number; volcanoes: number; landToEndMin: number }
const newStats = (): LipStats => ({ min: Infinity, max: -Infinity, runs: 0, volcanoes: 0, landToEndMin: Infinity });
function record(stats: LipStats, r: RunResult, v: Volcano): void {
  stats.runs++;
  if (r.lipSpeed !== null) {
    stats.min = Math.min(stats.min, r.lipSpeed);
    stats.max = Math.max(stats.max, r.lipSpeed);
  }
  if (r.landX !== null) stats.landToEndMin = Math.min(stats.landToEndMin, v.xEnd - r.landX);
}

/**
 * Joue le cas sur les rampe-volcan de la piste du monde (le premier volcan seulement pour les cas à
 * trajectoire unique) et vérifie chaque run à 100 %. Renvoie les statistiques de vitesse au sommet.
 */
export function runCase(caseId: CaseId, seed: number, world: World, cfg: Config = CONFIG): LipStats {
  const stats = newStats();
  const { track } = world;
  const volcanoes = FIRST_VOLCANO_CASES.includes(caseId) ? track.volcanoes.slice(0, 1) : track.volcanoes;
  for (const v of volcanoes) {
    const scenarios = scenariosFor(caseId, track, v, cfg);
    if (scenarios.length) stats.volcanoes++;
    for (const sc of scenarios) {
      const r = runFrom(world, sc.x0, sc.opts);
      record(stats, r, v);
      const where = describeRun(seed, v, sc.name, r);
      if (caseId === 1) expectFalls(r, v, where);
      else {
        expectPasses(r, v, where);
        if (caseId === 5 || caseId === 'turbo') expect(r.landX!, where).toBeLessThan(v.xEnd);
      }
    }
  }
  return stats;
}

/**
 * Déclare un test par (cas, graine) sur les mondes CONFIG, un test « au moins un run » pour le cas 3
 * (jamais un cas vide silencieux), puis imprime le tableau des vitesses au sommet à la fin du fichier.
 */
export function registerVolcanoCases(seedsByCase: Record<CaseId, number[]>): void {
  const totals = Object.fromEntries(ALL_CASES.map((c) => [c, newStats()])) as Record<CaseId, LipStats>;
  const runsBySeed: Record<CaseId, Map<number, number>> = Object.fromEntries(ALL_CASES.map((c) => [c, new Map()])) as Record<CaseId, Map<number, number>>;
  for (const caseId of ALL_CASES) {
    const seeds = seedsByCase[caseId];
    if (!seeds.length) continue;
    describe(CASE_TITLES[caseId], () => {
      test.each(seeds)('seed %i', (seed) => {
        const world = worldFor(seed);
        expect(world.track.volcanoes.length).toBeGreaterThan(0);
        const s = runCase(caseId, seed, world);
        runsBySeed[caseId].set(seed, s.runs);
        const t = totals[caseId];
        t.runs += s.runs;
        t.volcanoes += s.volcanoes;
        t.min = Math.min(t.min, s.min);
        t.max = Math.max(t.max, s.max);
        t.landToEndMin = Math.min(t.landToEndMin, s.landToEndMin);
      });
      if (caseId === 3) {
        test(`au moins un run sur les graines ${seeds.join(', ')}`, () => {
          expect(totals[3].runs, `runs par graine : ${JSON.stringify([...runsBySeed[3]])}`).toBeGreaterThan(0);
        });
      }
    });
  }
  afterAll(() => {
    const lines = ALL_CASES
      .filter((c) => seedsByCase[c].length)
      .map((c) => `cas ${c} (graines ${seedsByCase[c].join(',')}) : ${totals[c].volcanoes} volcans, ${totals[c].runs} runs `
        + `(par graine ${[...runsBySeed[c]].map(([s, n]) => `${s}:${n}`).join(' ')}), sommet ${f2(totals[c].min)}–${f2(totals[c].max)} m/s, `
        + `atterrissage au plus près de xEnd : ${f2(totals[c].landToEndMin)} m avant`);
    console.log(`vitesse au sommet par cas\n${lines.join('\n')}`);
  });
}
