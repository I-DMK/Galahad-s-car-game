// Pas de course : relie la physique (matter-js) à l'état de course. Sans DOM : utilisable sous node
// (tests, simulations), et par la boucle de jeu (`src/game.ts`). Réapparitions branchées (10b),
// ligne d'arrivée (11), étoiles et turbo (12).
import Matter from 'matter-js';
import type { Config } from '../config';
import {
  applyRespawnToState, chooseRespawnTarget, updateRespawnTimers, type RespawnReason,
} from '../cars/respawn';
import { isSafePointCandidate } from '../cars/safepoint';
import { isStarActive, newStarStates, takeStar, type StarState } from '../cars/stars';
import { newCarState, type CarState, type SafePoint } from '../cars/state';
import { activateTurbo, turboFactor } from '../cars/turbo';
import {
  applyAirLevel, applyBrake, applyDrive, carAngle, carSpeedMps, clampVelocities, createCar, placeCar,
  setCarInvulnerable, updateGroundContact, type CarBody, type GroundContact,
} from '../physics/car';
import { createStarBodies, syncStarBodies } from '../physics/stars';
import { physToWorld, toM } from '../physics/units';
import { createWorld, sensorsTouching, stepWorld, type World } from '../physics/world';
import type { CarView, Scene } from '../render/renderer';
import { heightAt, inElanZone, slopeAt } from '../track/query';
import type { Track } from '../track/types';

export type SimEvent =
  /** `x` : position du châssis (m) au moment de la décision, avant téléportation vers `target`. */
  | { type: 'respawn'; t: number; reason: RespawnReason; x: number; target: SafePoint }
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
  /** Collisions entre voitures coupées (après une réapparition) ; levé par `releaseInvulnerability`. */
  invulnerable: boolean;
  /** Châssis des autres voitures (vide au plan A) : l'invulnérabilité dure tant qu'un d'eux chevauche. */
  others: Matter.Body[];
  /** État des étoiles, dans l'ordre de `track.stars`. */
  stars: StarState[];
  /** Capteurs des étoiles, même ordre que `stars`. */
  starBodies: Matter.Body[];
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
  const stars = newStarStates(track.stars);
  const starBodies = createStarBodies(world, track.stars, cfg);
  return {
    track, world, car, state, contact: newContact(), time: 0, events: [], airborneSince: null,
    invulnerable: false, others: [], stars, starBodies, cfg,
  };
}

/**
 * Un pas fixe de PHYSICS_DT. Après l'arrivée (`state.finishedAt` défini), `throttle` est ignoré :
 * les roues sont freinées à chaque pas (FINISH_BRAKE) et la voiture ne réapparaît plus jamais
 * (elle s'arrête sur le plat avant le mur de fin). Une étoile active touchée après le pas physique
 * est prise (réapparition STAR_RESPAWN_SECONDS plus tard) et lance TURBO_SECONDS de turbo.
 */
export function stepRace(sim: RaceSim, throttle: boolean): void {
  const { car, cfg, world } = sim;
  const h = (x: number) => heightAt(sim.track, x);
  sim.events = [];
  const finished = sim.state.finishedAt !== null;
  if (finished) applyBrake(car, cfg.FINISH_BRAKE);
  else applyDrive(car, throttle, turboFactor(sim.state, sim.time, cfg), cfg);
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
  collectStars(sim);
  if (!finished && sim.state.progress >= sim.track.xFinish) {
    sim.state.finishedAt = sim.time;
    sim.events.push({ type: 'finish', t: sim.time });
  }
  releaseInvulnerability(sim);
  if (sim.state.finishedAt === null) observeAndRespawn(sim, throttle, onGround);
  sim.time += cfg.PHYSICS_DT;
}

/** Prend les étoiles actives touchées par la voiture ce pas-ci, puis aligne les capteurs sur leur état. */
function collectStars(sim: RaceSim): void {
  const { cfg, time: t } = sim;
  for (const sensor of sensorsTouching(sim.world.engine, sim.car.parts)) {
    if (sensor.label !== 'star') continue;
    const i = sim.starBodies.indexOf(sensor);
    const star = sim.stars[i];
    if (!star || !isStarActive(star, t, cfg)) continue;
    takeStar(star, t);
    activateTurbo(sim.state, t, cfg);
    sim.events.push({ type: 'star', t, id: star.id });
  }
  syncStarBodies(sim.starBodies, sim.stars, t, cfg);
}

/**
 * Lève l'invulnérabilité à partir de `invulnerableUntil` si aucun autre châssis ne chevauche la
 * voiture, et de toute façon à `invulnerableUntil + (RESPAWN_INVULN_MAX − RESPAWN_INVULN)`.
 */
function releaseInvulnerability(sim: RaceSim): void {
  if (!sim.invulnerable) return;
  const { state, cfg, time: t } = sim;
  if (t < state.invulnerableUntil) return;
  const free = Matter.Query.collides(sim.car.chassis, sim.others).length === 0;
  if (free || t >= state.invulnerableUntil + (cfg.RESPAWN_INVULN_MAX - cfg.RESPAWN_INVULN)) {
    setCarInvulnerable(sim.car, false);
    sim.invulnerable = false;
  }
}

/**
 * Après le pas physique (t = instant du pas) : mémorise un point sûr si la position s'y prête,
 * met à jour les chronomètres de réapparition et, si l'un d'eux se déclenche, repose la voiture
 * aussitôt (entre deux pas physiques), invulnérable, et émet l'événement 'respawn'.
 */
function observeAndRespawn(sim: RaceSim, throttle: boolean, onGround: [boolean, boolean]): void {
  const { car, cfg, state, track, world, time: t } = sim;
  const x = state.progress;
  const angle = carAngle(car);
  const candidate = {
    x, t, bothWheelsOnGround: onGround[0] && onGround[1], carAngle: angle, groundSlope: slopeAt(track, x),
  };
  if (isSafePointCandidate(candidate, state, track, cfg)) {
    state.safePoint = { x, y: heightAt(track, x), angle: slopeAt(track, x) };
    state.lastSafePointAt = t;
  }
  const reason = updateRespawnTimers(state, {
    t,
    angle,
    throttle,
    progress: x,
    y: physToWorld(car.chassis.position).y,
    groundY: heightAt(track, x),
    speedMps: carSpeedMps(car),
    onLava: sensorsTouching(world.engine, car.parts).some((b) => b.label === 'lava'),
    inElanZone: inElanZone(track, x),
  }, cfg);
  if (reason === null) return;
  const { point, lavaX, consecutive } = chooseRespawnTarget(state, track, cfg);
  placeCar(car, point.x, (xx) => heightAt(track, xx), point.angle, cfg);
  setCarInvulnerable(car, true);
  sim.invulnerable = true;
  // applyRespawnToState garde la cible par référence (nouveau point sûr) : copie dédiée.
  applyRespawnToState(state, { ...point }, lavaX, consecutive, t, cfg);
  sim.contact.groundedUntil = [-1, -1];
  sim.airborneSince = null;
  sim.events.push({ type: 'respawn', t, reason, x, target: { ...point } });
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
  sim.invulnerable = false;
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
    turbo: turboFactor(state, sim.time, sim.cfg) > 1,
  };
}

export function sceneOf(sim: RaceSim): Scene {
  return {
    track: sim.track,
    cars: [carView(sim)],
    stars: sim.track.stars.map((s, i) => ({ x: s.x, y: s.y, active: isStarActive(sim.stars[i], sim.time, sim.cfg) })),
    t: sim.time,
  };
}

export interface SimulateResult {
  respawns: SimEvent[];
  finishedAt: number | null;
  /**
   * Plus long blocage (s) : durée maximale, doigt posé, sans avancer de STUCK_DISTANCE depuis une
   * référence qui avance par crans (même cliquet que le chronomètre de blocage) ; remis à zéro par
   * le doigt levé et par chaque réapparition, plus compté après l'arrivée (la voiture freine).
   */
  maxStuckSeconds: number;
  /** Vitesse maximale du châssis (m/s). */
  maxSpeed: number;
  starsTaken: SimEvent[];
  /** Temps de course final (s). */
  time: number;
  /** Nombre d'événements 'finish' reçus (1 attendu une fois la ligne franchie). */
  finishes: number;
  /** Progression (x du châssis, m) à l'instant t (pas le plus proche, borné à la course). */
  progressAt: (t: number) => number;
  /** Vitesse du châssis (m/s) à l'instant t (pas le plus proche, borné à la course). */
  speedAt: (t: number) => number;
}

/** Course sans affichage, `throttle(t)` décide du doigt à chaque pas, pendant au plus `maxSeconds`. */
export function simulateRace(
  track: Track, opts: { throttle: (t: number) => boolean; maxSeconds: number; cfg: Config },
): SimulateResult {
  const { cfg } = opts;
  const sim = createRaceSim(track, cfg);
  const steps = Math.round(opts.maxSeconds / cfg.PHYSICS_DT);
  const samples: number[] = [sim.state.progress];
  const speeds: number[] = [carSpeedMps(sim.car)];
  const respawns: SimEvent[] = [];
  const starsTaken: SimEvent[] = [];
  let finishes = 0;
  let maxSpeed = 0;
  let stuckRef = sim.state.progress;
  let stuckStart: number | null = null;
  let maxStuckSeconds = 0;
  for (let i = 0; i < steps; i++) {
    const t = sim.time;
    const throttle = opts.throttle(t);
    stepRace(sim, throttle);
    let respawned = false;
    for (const e of sim.events) {
      if (e.type === 'respawn') { respawns.push(e); respawned = true; }
      else if (e.type === 'star') starsTaken.push(e);
      else if (e.type === 'finish') finishes++;
    }
    const p = sim.state.progress;
    if (respawned) {
      if (stuckStart !== null) maxStuckSeconds = Math.max(maxStuckSeconds, t - stuckStart);
      stuckRef = p;
      stuckStart = null;
    } else if (!throttle || sim.state.finishedAt !== null || p - stuckRef >= cfg.STUCK_DISTANCE) {
      stuckRef = p;
      stuckStart = null;
    } else {
      stuckStart ??= t;
      maxStuckSeconds = Math.max(maxStuckSeconds, t - stuckStart);
    }
    const v = carSpeedMps(sim.car);
    samples.push(p);
    speeds.push(v);
    maxSpeed = Math.max(maxSpeed, v);
  }
  const at = (values: number[]) => (t: number): number => {
    const i = Math.round(t / cfg.PHYSICS_DT);
    return values[Math.min(values.length - 1, Math.max(0, i))];
  };
  return {
    respawns, finishedAt: sim.state.finishedAt, finishes, maxStuckSeconds, maxSpeed, starsTaken,
    time: sim.time, progressAt: at(samples), speedAt: at(speeds),
  };
}
