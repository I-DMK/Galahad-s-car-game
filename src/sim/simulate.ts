// Pas de course : relie la physique (matter-js) à l'état de course. Sans DOM : utilisable sous node
// (tests, simulations), et par la boucle de jeu (`src/game.ts`). Les tâches 10b/11/12 étendent `stepRace`
// (réapparitions, arrivée, étoiles).
import Matter from 'matter-js';
import type { Config } from '../config';
import { newCarState, type CarState, type SafePoint } from '../cars/state';
import {
  applyAirLevel, applyDrive, carAngle, carSpeedMps, clampVelocities, createCar, placeCar,
  updateGroundContact, type CarBody, type GroundContact,
} from '../physics/car';
import { physToWorld, toM } from '../physics/units';
import { createWorld, stepWorld, type World } from '../physics/world';
import type { CarView, Scene } from '../render/renderer';
import { heightAt } from '../track/query';
import type { Track } from '../track/types';

export type SimEvent =
  | { type: 'respawn'; t: number; reason: string; target: SafePoint }
  | { type: 'landing'; t: number; x: number; strength: number }
  | { type: 'star'; t: number; id: number }
  | { type: 'finish'; t: number };

export interface RaceSim {
  track: Track;
  world: World;
  car: CarBody;
  state: CarState;
  /** Contact au sol de jeu (anti-rebond) de `car`. */
  contact: GroundContact;
  /** Temps de course (s), PHYSICS_DT par pas. */
  time: number;
  /** Événements du dernier pas (vidés au début de chaque pas). */
  events: SimEvent[];
  /** Instant (s) où plus aucune roue ne touche le sol, null si au moins une roue touche. */
  airborneSince: number | null;
  cfg: Config;
}

const CAR_ID = 'galahad';
const CAR_NAME = 'Galahad';
/** Durée minimale en l'air (s) pour qu'un retour au sol compte comme atterrissage. */
const LANDING_MIN_AIRTIME = 0.3;

/** 0x1e5cff → '#1e5cff'. */
function colorHex(n: number): string {
  return `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
}

const newContact = (): GroundContact => ({ groundedUntil: [-1, -1] });

export function createRaceSim(track: Track, cfg: Config): RaceSim {
  const world = createWorld(track, cfg);
  const x0 = track.xStart - 2;
  const car = createCar(world, CAR_ID, 0, x0, cfg);
  const start: SafePoint = { x: x0, y: heightAt(track, x0), angle: 0 };
  const state = newCarState(CAR_ID, CAR_NAME, colorHex(cfg.GALAHAD_COLOR), colorHex(cfg.GALAHAD_ACCENT), start);
  state.progress = physToWorld(car.chassis.position).x;
  return { track, world, car, state, contact: newContact(), time: 0, events: [], airborneSince: null, cfg };
}

/** Un pas fixe de PHYSICS_DT. */
export function stepRace(sim: RaceSim, throttle: boolean): void {
  const { car, cfg, world } = sim;
  const h = (x: number) => heightAt(sim.track, x);
  sim.events = [];
  applyDrive(car, throttle, 1, cfg);
  const onGround = updateGroundContact(world.engine, car, sim.contact, sim.time, h, cfg);
  const grounded = onGround[0] || onGround[1];
  if (!grounded) {
    sim.airborneSince ??= sim.time;
  } else if (sim.airborneSince !== null) {
    if (sim.time - sim.airborneSince >= LANDING_MIN_AIRTIME) {
      const strength = Math.abs(toM(car.chassis.velocity.y) / cfg.PHYSICS_DT);
      sim.events.push({ type: 'landing', t: sim.time, x: physToWorld(car.chassis.position).x, strength });
    }
    sim.airborneSince = null;
  }
  applyAirLevel(car, onGround, cfg);
  stepWorld(world);
  clampVelocities(car, cfg);
  sim.state.progress = physToWorld(car.chassis.position).x;
  sim.time += cfg.PHYSICS_DT;
}

/**
 * Garde-fou : remplace la voiture par une neuve posée au point sûr (après une exception dans
 * `stepRace`) ; contact au sol et chronomètre d'envol remis à zéro.
 */
export function rebuildCar(sim: RaceSim): void {
  const { world, cfg, state } = sim;
  Matter.Composite.remove(world.engine.world, sim.car.composite, true);
  const sp = state.safePoint;
  const car = createCar(world, sim.car.id, sim.car.index, sp.x, cfg);
  placeCar(car, sp.x, (x) => heightAt(sim.track, x), sp.angle, cfg);
  sim.car = car;
  sim.contact = newContact();
  sim.airborneSince = null;
  state.progress = physToWorld(car.chassis.position).x;
}

/** Vue de rendu de la voiture (monde : m, y vers le haut ; angles positifs anti-horaires). */
export function carView(sim: RaceSim): CarView {
  const { car, state } = sim;
  const c = physToWorld(car.chassis.position);
  return {
    x: c.x,
    y: c.y,
    angle: carAngle(car),
    // Angle Matter : y vers le bas, sens horaire ; le renderer attend la convention y vers le haut.
    wheels: car.wheels.map((w) => ({ ...physToWorld(w.position), angle: -w.angle })),
    color: state.color,
    accent: state.accent,
    name: state.name,
    turbo: false,
  };
}

export function sceneOf(sim: RaceSim): Scene {
  return {
    track: sim.track,
    cars: [carView(sim)],
    // Collecte des étoiles : tâche 12.
    stars: sim.track.stars.map((s) => ({ x: s.x, y: s.y, active: true })),
    t: sim.time,
  };
}

export interface SimulateResult {
  respawns: SimEvent[];
  finishedAt: number | null;
  /** Plus long blocage (s). TODO tâche 10b : mesurer (gaz, < STUCK_DISTANCE en STUCK_SECONDS). */
  maxStuckSeconds: number;
  /** Vitesse maximale du châssis (m/s). */
  maxSpeed: number;
  starsTaken: SimEvent[];
  /** Temps de course final (s). */
  time: number;
  /** Progression (x du châssis, m) à l'instant t (pas le plus proche, borné à la course). */
  progressAt: (t: number) => number;
}

/** Course sans affichage, `throttle(t)` décide du doigt à chaque pas, pendant au plus `maxSeconds`. */
export function simulateRace(
  track: Track, opts: { throttle: (t: number) => boolean; maxSeconds: number; cfg: Config },
): SimulateResult {
  const { cfg } = opts;
  const sim = createRaceSim(track, cfg);
  const steps = Math.round(opts.maxSeconds / cfg.PHYSICS_DT);
  const samples: number[] = [sim.state.progress];
  const respawns: SimEvent[] = [];
  const starsTaken: SimEvent[] = [];
  let finishedAt: number | null = null;
  let maxSpeed = 0;
  for (let i = 0; i < steps; i++) {
    stepRace(sim, opts.throttle(sim.time));
    for (const e of sim.events) {
      if (e.type === 'respawn') respawns.push(e);
      else if (e.type === 'star') starsTaken.push(e);
      else if (e.type === 'finish' && finishedAt === null) finishedAt = e.t;
    }
    samples.push(sim.state.progress);
    maxSpeed = Math.max(maxSpeed, carSpeedMps(sim.car));
  }
  const progressAt = (t: number): number => {
    const i = Math.round(t / cfg.PHYSICS_DT);
    return samples[Math.min(samples.length - 1, Math.max(0, i))];
  };
  return { respawns, finishedAt, maxStuckSeconds: 0, maxSpeed, starsTaken, time: sim.time, progressAt };
}
