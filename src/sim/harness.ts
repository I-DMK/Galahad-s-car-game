// Harnais de course sans affichage (tests, simulations, calibrations) : `simulateRace` et ses aides, extraits de
// `simulate.ts` (héritage de la tâche 5b, avancé en 5e : le harnais reçoit la demande de saut de Galahad).
// Sans DOM ; le pas de course reste `stepRace`.
import type Matter from 'matter-js';
import type { Config } from '../config';
import { rankCars } from '../cars/ranking';
import { carSpeedMps } from '../physics/car';
import { inGhostZone } from '../track/query';
import type { Track } from '../track/types';
import {
  chassisX, createRaceSim, GALAHAD_INDEX, stepRace, type RaceSim, type RespawnEvent, type SimEvent, type StarEvent,
} from './simulate';

export interface SimulateResult {
  /** Réapparitions de Galahad. */
  respawns: SimEvent[];
  /** Arrivée de Galahad (s), null s'il n'a pas franchi la ligne. */
  finishedAt: number | null;
  /**
   * Plus long blocage (s) de Galahad : durée maximale, doigt posé, sans avancer de STUCK_DISTANCE
   * depuis une référence qui avance par crans (même cliquet que le chronomètre de blocage) ; remis à
   * zéro par le doigt levé et par chaque réapparition, plus compté après l'arrivée (la voiture freine).
   */
  maxStuckSeconds: number;
  /** Vitesse maximale du châssis de Galahad (m/s). */
  maxSpeed: number;
  /** Étoiles prises par Galahad (copie de `starsByCar.galahad`). */
  starsTaken: StarEvent[];
  /** Par id de voiture (ordre de la grille) : étoiles prises, dans l'ordre de la course. */
  starsByCar: Record<string, StarEvent[]>;
  /** Par id de voiture : étoiles hautes prises (sous-ensemble de `starsByCar`, tâche 5e). */
  highStarsByCar: Record<string, StarEvent[]>;
  /**
   * Première étoile prise dans la course, null si aucune. Si plusieurs voitures en prennent au même pas,
   * `carId` est celle de plus petit index et `firstStarCars` les nomme toutes : une égalité se voit.
   */
  firstStar: { carId: string; t: number } | null;
  /** Ids (ordre des index, sans doublon) des voitures qui ont pris une étoile au pas de `firstStar` ; vide si aucune. */
  firstStarCars: string[];
  /** Temps de course final (s). */
  time: number;
  /** Nombre d'événements 'finish' de Galahad (1 attendu une fois la ligne franchie). */
  finishes: number;
  /** Progression de Galahad (x du châssis, m) à l'instant t (pas le plus proche, borné à la course). */
  progressAt: (t: number) => number;
  /** Vitesse du châssis de Galahad (m/s) à l'instant t (pas le plus proche, borné à la course). */
  speedAt: (t: number) => number;
  /** Classement final (`rankCars`) : ids des voitures, du premier au dernier. */
  ranking: string[];
  /** Par id de voiture : réapparitions, chutes dans la lave, plus long blocage (s, même mesure que `maxStuckSeconds`), arrivée. */
  respawnsByCar: Record<string, RespawnEvent[]>;
  lavaByCar: Record<string, number>;
  maxStuckByCar: Record<string, number>;
  finishedAtByCar: Record<string, number | null>;
  /**
   * Nombre de paires actives (pas × paire de pièces) entre deux voitures dont l'une avait son châssis
   * dans une zone fantôme au début du pas : 0 attendu (contrôle des masques).
   */
  ghostContacts: number;
  /** Indicateurs : durée mur (ms) d'un `stepRace`, maximale et moyenne. */
  maxStepMs: number;
  meanStepMs: number;
}

/**
 * Cliquet de blocage d'une voiture (même règle que le chronomètre de blocage) : durée maximale, doigt
 * posé, sans avancer de STUCK_DISTANCE ; remis à zéro par le doigt levé, l'arrivée et chaque réapparition.
 */
class StuckMeter {
  max = 0;
  private start: number | null = null;

  constructor(private ref: number, private readonly distance: number) {}

  update(t: number, progress: number, throttle: boolean, finished: boolean, respawned: boolean): void {
    if (respawned) {
      if (this.start !== null) this.max = Math.max(this.max, t - this.start);
      this.reset(progress);
    } else if (!throttle || finished || progress - this.ref >= this.distance) {
      this.reset(progress);
    } else {
      this.start ??= t;
      this.max = Math.max(this.max, t - this.start);
    }
  }

  private reset(progress: number): void {
    this.ref = progress;
    this.start = null;
  }
}

/**
 * Paires actives du dernier pas entre pièces de deux voitures différentes, en ids de voitures (une
 * entrée par paire de pièces) ; avec `ids`, seulement celles qui impliquent l'une de ces voitures.
 */
export function carPairsTouching(sim: RaceSim, ids?: ReadonlySet<string>): [string, string][] {
  const carOf = (b: Matter.Body): string | undefined => (b.parent.plugin as { carId?: string } | undefined)?.carId;
  const found: [string, string][] = [];
  for (const pair of sim.world.engine.pairs.list) {
    if (!pair.isActive) continue;
    const a = carOf(pair.bodyA);
    const b = carOf(pair.bodyB);
    if (a === undefined || b === undefined || a === b) continue;
    if (ids === undefined || ids.has(a) || ids.has(b)) found.push([a, b]);
  }
  return found;
}

/**
 * Course sans affichage : `throttle(t)` décide du doigt de Galahad à chaque pas (les robots suivent
 * leur driver), `jump(t, sim)` de sa demande de saut (tâche 5e ; défaut : jamais, et `stepRace` est alors
 * appelé sans demande, comme avant la 5e). S'arrête `stopAfterFinish` secondes (défaut FINISH_COAST_SECONDS) après l'arrivée de
 * Galahad, ou à `maxSeconds`. `robots` et `pilotSeed` : comme `createRaceSim` (Galahad seul par défaut).
 * `onStep` : observateur appelé après chaque pas (`sim.events` = événements du pas), sans effet sur la course.
 */
export function simulateRace(
  track: Track,
  opts: {
    throttle: (t: number) => boolean; maxSeconds: number; cfg: Config;
    jump?: (t: number, sim: RaceSim) => boolean;
    robots?: boolean; pilotSeed?: number; stopAfterFinish?: number;
    onStep?: (sim: RaceSim) => void;
  },
): SimulateResult {
  const { cfg } = opts;
  const sim = createRaceSim(track, cfg, { robots: opts.robots, pilotSeed: opts.pilotSeed });
  const galahad = sim.cars[GALAHAD_INDEX];
  const stopAfterFinish = opts.stopAfterFinish ?? cfg.FINISH_COAST_SECONDS;
  const steps = Math.round(opts.maxSeconds / cfg.PHYSICS_DT);
  const samples: number[] = [galahad.state.progress];
  const speeds: number[] = [carSpeedMps(galahad.body)];
  const ids = sim.cars.map((c) => c.state.id);
  const respawnsByCar: Record<string, RespawnEvent[]> = Object.fromEntries(ids.map((id) => [id, []]));
  const lavaByCar: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const starsByCar: Record<string, StarEvent[]> = Object.fromEntries(ids.map((id) => [id, []]));
  const highStarsByCar: Record<string, StarEvent[]> = Object.fromEntries(ids.map((id) => [id, []]));
  const highIds = new Set(track.stars.filter((s) => s.high).map((s) => s.id));
  let firstStar: SimulateResult['firstStar'] = null;
  const firstStarCars: string[] = [];
  const stuck = sim.cars.map((c) => new StuckMeter(c.state.progress, cfg.STUCK_DISTANCE));
  let finishes = 0;
  let maxSpeed = 0;
  let ghostContacts = 0;
  let maxStepMs = 0;
  let totalStepMs = 0;
  let stepsDone = 0;
  for (let i = 0; i < steps; i++) {
    const t = sim.time;
    const throttle = opts.throttle(t);
    const jump = opts.jump?.(t, sim) ?? false;
    const inZone = sim.cars.length > 1 ? new Set(sim.cars.filter((c) => inGhostZone(track, chassisX(c), cfg)).map((c) => c.state.id)) : null;
    const t0 = performance.now();
    stepRace(sim, throttle, jump);
    const ms = performance.now() - t0;
    maxStepMs = Math.max(maxStepMs, ms);
    totalStepMs += ms;
    stepsDone++;
    if (inZone !== null && inZone.size > 0) ghostContacts += carPairsTouching(sim, inZone).length;
    opts.onStep?.(sim);
    const respawned = new Set<string>();
    for (const e of sim.events) {
      const mine = e.carId === galahad.state.id;
      if (e.type === 'respawn') {
        respawnsByCar[e.carId].push(e);
        if (e.reason === 'lava') lavaByCar[e.carId]++;
        respawned.add(e.carId);
      } else if (e.type === 'star') {
        // Événements d'un pas dans l'ordre des index : le premier est la plus petite index.
        starsByCar[e.carId].push(e);
        if (highIds.has(e.id)) highStarsByCar[e.carId].push(e);
        firstStar ??= { carId: e.carId, t: e.t };
        if (e.t === firstStar.t && !firstStarCars.includes(e.carId)) firstStarCars.push(e.carId);
      } else if (e.type === 'finish' && mine) finishes++;
    }
    sim.cars.forEach((c, k) => {
      stuck[k].update(t, c.state.progress, c.throttle, c.state.finishedAt !== null, respawned.has(c.state.id));
    });
    const v = carSpeedMps(galahad.body);
    samples.push(galahad.state.progress);
    speeds.push(v);
    maxSpeed = Math.max(maxSpeed, v);
    const done = galahad.state.finishedAt;
    if (done !== null && sim.time >= done + stopAfterFinish - 1e-9) break;
  }
  const at = (values: number[]) => (t: number): number => {
    const i = Math.round(t / cfg.PHYSICS_DT);
    return values[Math.min(values.length - 1, Math.max(0, i))];
  };
  const ranking = rankCars(sim.cars.map((c, index) => ({ index, progress: c.state.progress, finishedAt: c.state.finishedAt })));
  return {
    respawns: respawnsByCar[galahad.state.id], finishedAt: galahad.state.finishedAt, finishes,
    maxStuckSeconds: stuck[GALAHAD_INDEX].max, maxSpeed, starsTaken: [...starsByCar[galahad.state.id]], time: sim.time,
    progressAt: at(samples), speedAt: at(speeds),
    starsByCar,
    highStarsByCar,
    firstStar,
    firstStarCars,
    ranking: ranking.map((i) => ids[i]),
    respawnsByCar,
    lavaByCar,
    maxStuckByCar: Object.fromEntries(ids.map((id, k) => [id, stuck[k].max])),
    finishedAtByCar: Object.fromEntries(sim.cars.map((c) => [c.state.id, c.state.finishedAt])),
    ghostContacts,
    maxStepMs,
    meanStepMs: stepsDone > 0 ? totalStepMs / stepsDone : 0,
  };
}
