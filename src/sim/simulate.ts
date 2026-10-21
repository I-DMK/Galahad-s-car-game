// Pas de course : relie la physique (matter-js) à l'état de course. Sans DOM : utilisable sous node
// (tests, simulations), et par la boucle de jeu (`src/game.ts`). Réapparitions branchées (10b),
// ligne d'arrivée (11), étoiles et turbo (12) ; course à 5 voitures dans un seul monde, grille de
// départ, chocs réels hors des zones fantômes des volcans et respawn groupé (tâche 5b du plan B).
import Matter from 'matter-js';
import type { Config } from '../config';
import { GALAHAD, drawPilots, type Pilot } from '../cars/pilots';
import { rankCars } from '../cars/ranking';
import {
  applyRespawnToState, chooseRespawnTarget, shiftTarget, updateRespawnTimers, type RespawnReason,
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
import { heightAt, inElanZone, inGhostZone, slopeAt } from '../track/query';
import type { Track } from '../track/types';

/** Chaque événement porte l'id (`CarState.id`) de la voiture concernée. */
export type SimEvent =
  /** `x` : position du châssis (m) au moment de la décision, avant téléportation vers `target`. */
  | { type: 'respawn'; carId: string; t: number; reason: RespawnReason; x: number; target: SafePoint }
  | { type: 'landing'; carId: string; t: number; x: number; strength: number }
  | { type: 'star'; carId: string; t: number; id: number }
  | { type: 'finish'; carId: string; t: number };

export type RespawnEvent = Extract<SimEvent, { type: 'respawn' }>;

/** Pilote automatique : doigt posé à l'instant t ? (`speed` : vitesse du châssis, m/s). */
export type Driver = (ctx: { t: number; state: CarState; track: Track; speed: number }) => boolean;

/** Une voiture de la course : pilote, corps physique et état de course. */
export interface CarSim {
  pilot: Pilot;
  body: CarBody;
  state: CarState;
  /** Contact au sol de jeu (anti-rebond) de `body`. */
  contact: GroundContact;
  /** Instant (s) où plus aucune roue ne touche le sol, null si au moins une roue touche. */
  airborneSince: number | null;
  /** Collisions avec les autres voitures coupées (après une réapparition) ; levé par `releaseInvulnerability`. */
  invulnerable: boolean;
  /**
   * Fantôme : châssis dans la zone [xLancement, xReception] d'un volcan (`inGhostZone`), ou sorti de la
   * zone mais encore engagé dans une autre voiture (`updateGhost`). Les voitures se traversent.
   */
  ghost: boolean;
  /** Pilote automatique d'un robot ; null pour Galahad (doigt de l'enfant, argument de `stepRace`). */
  driver: Driver | null;
  /** Facteur de vitesse du pilote, multiplié au turbo (élastique, tâche 7) ; 1 en 5b. */
  factor: number;
  /** Doigt posé au dernier pas (décision du driver, ou de l'enfant pour Galahad ; false après l'arrivée). */
  throttle: boolean;
}

export interface RaceSim {
  track: Track;
  world: World;
  /** Galahad = cars[0] ; le robot de rang n = cars[n] (ordre de la grille). */
  cars: CarSim[];
  /** Temps de course (s), PHYSICS_DT par pas. */
  time: number;
  /** Événements du dernier pas (vidés au début de chaque pas). */
  events: SimEvent[];
  /** État des étoiles, dans l'ordre de `track.stars` ; une étoile prise l'est pour toutes les voitures. */
  stars: StarState[];
  /** Capteurs des étoiles, même ordre que `stars`. */
  starBodies: Matter.Body[];
  cfg: Config;
  /** Graine du tirage des copains (`drawPilots`), mémorisée pour rejouer la même course. */
  pilotSeed: number;
}

/** Durée minimale en l'air (s) pour qu'un retour au sol compte comme atterrissage. */
const LANDING_MIN_AIRTIME = 0.3;

/** 0x1e5cff → '#1e5cff'. */
function colorHex(n: number): string {
  return `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
}

const newContact = (): GroundContact => ({ groundedUntil: [-1, -1] });

/**
 * Graine des pilotes dérivée de la graine de piste, entier de [0, 2³²) quel que soit `?seed=`
 * (`drawPilots` refuse le reste), et décorrélée du premier tirage de la piste.
 */
const defaultPilotSeed = (track: Track): number => (track.seed ^ 0x9e3779b9) >>> 0;

/**
 * Driver provisoire de la tâche 5b : doigt posé dès rank × START_DELAY_PER_RANK (départ échelonné de
 * la grille). La conduite des robots (lever de pied, zone volcan) arrive en tâche 6.
 */
function holdAfterStartDelay(rank: number, cfg: Config): Driver {
  const start = rank * cfg.START_DELAY_PER_RANK;
  return ({ t }) => t >= start;
}

/** Voiture de rang `rank` posée sur la grille : xStart − 2 − rank × GRID_SPACING_FACTOR × CAR_LENGTH. */
function createCarSim(world: World, track: Track, pilot: Pilot, rank: number, cfg: Config): CarSim {
  const x0 = track.xStart - 2 - rank * cfg.GRID_SPACING_FACTOR * cfg.CAR_LENGTH;
  const body = createCar(world, pilot.id, rank, x0, cfg);
  const start: SafePoint = { x: x0, y: heightAt(track, x0), angle: 0 };
  const state = newCarState(pilot.id, pilot.name, colorHex(pilot.color), colorHex(pilot.accent), start);
  state.progress = physToWorld(body.chassis.position).x;
  return {
    pilot, body, state, contact: newContact(), airborneSince: null, invulnerable: false, ghost: false,
    driver: rank === 0 ? null : holdAfterStartDelay(rank, cfg), factor: 1, throttle: false,
  };
}

/**
 * Course sur `track`. Par défaut (`robots: false`) Galahad roule seul, comme au plan A ; avec
 * `robots: true`, les 4 copains tirés par `drawPilots(pilotSeed)` partent derrière lui sur la grille.
 * `pilotSeed` par défaut : dérivée de `track.seed` (même piste → mêmes copains).
 */
export function createRaceSim(
  track: Track, cfg: Config, opts: { pilotSeed?: number; robots?: boolean } = {},
): RaceSim {
  const world = createWorld(track, cfg);
  const pilotSeed = opts.pilotSeed ?? defaultPilotSeed(track);
  const pilots = [GALAHAD, ...(opts.robots ? drawPilots(pilotSeed) : [])];
  const cars = pilots.map((pilot, rank) => createCarSim(world, track, pilot, rank, cfg));
  const stars = newStarStates(track.stars);
  const starBodies = createStarBodies(world, track.stars, cfg);
  return { track, world, cars, time: 0, events: [], stars, starBodies, cfg, pilotSeed };
}

/**
 * Un pas fixe de PHYSICS_DT pour toutes les voitures : pour chacune, état fantôme (`updateGhost`),
 * conduite (doigt de Galahad = `galahadThrottle`, robots = leur driver ; vitesse × turbo × `factor`),
 * contact au sol et mise à plat en l'air ; un seul pas physique ; puis, voiture par voiture dans
 * l'ordre des index : bornage des vitesses, progression, étoiles, arrivée, invulnérabilité et réapparition.
 * Après son arrivée (`state.finishedAt` défini), une voiture freine (FINISH_BRAKE) et ne réapparaît
 * plus jamais (elle s'arrête sur le plat avant le mur de fin). Une étoile active touchée est prise
 * (pour toutes les voitures, réapparition STAR_RESPAWN_SECONDS plus tard) et lance TURBO_SECONDS de
 * turbo à la voiture qui l'a prise.
 */
export function stepRace(sim: RaceSim, galahadThrottle: boolean): void {
  const { cfg, world, track, time: t } = sim;
  const h = (x: number) => heightAt(track, x);
  sim.events = [];
  const onGround = sim.cars.map((car) => {
    const { body, state } = car;
    updateGhost(sim, car);
    if (state.finishedAt !== null) {
      car.throttle = false;
      applyBrake(body, cfg.FINISH_BRAKE);
    } else {
      car.throttle = car.driver ? car.driver({ t, state, track, speed: carSpeedMps(body) }) : galahadThrottle;
      applyDrive(body, car.throttle, turboFactor(state, t, cfg) * car.factor, cfg);
    }
    const grounded = updateGroundContact(world.engine, body, car.contact, t, h, cfg);
    detectLanding(sim, car, grounded[0] || grounded[1]);
    applyAirLevel(body, grounded, cfg);
    return grounded;
  });
  stepWorld(world);
  sim.cars.forEach((car, i) => {
    const { state } = car;
    const finished = state.finishedAt !== null;
    clampVelocities(car.body, cfg);
    state.progress = physToWorld(car.body.chassis.position).x;
    collectStars(sim, car);
    if (!finished && state.progress >= track.xFinish) {
      state.finishedAt = t;
      sim.events.push({ type: 'finish', carId: state.id, t });
    }
    releaseInvulnerability(sim, car);
    if (state.finishedAt === null) observeAndRespawn(sim, car, onGround[i]);
  });
  syncStarBodies(sim.starBodies, sim.stars, t, cfg);
  sim.time += cfg.PHYSICS_DT;
}

/** Atterrissage : retour au sol après au moins LANDING_MIN_AIRTIME en l'air. */
function detectLanding(sim: RaceSim, car: CarSim, grounded: boolean): void {
  const { time: t, cfg } = sim;
  if (!grounded) {
    car.airborneSince ??= t;
  } else if (car.airborneSince !== null) {
    if (t - car.airborneSince >= LANDING_MIN_AIRTIME) {
      const { chassis } = car.body;
      const strength = Math.abs(toM(chassis.velocity.y) / cfg.PHYSICS_DT);
      sim.events.push({ type: 'landing', carId: car.state.id, t, x: physToWorld(chassis.position).x, strength });
    }
    car.airborneSince = null;
  }
}

/**
 * Prend les étoiles actives touchées par la voiture ce pas-ci : une étoile prise est aussitôt inactive
 * pour les voitures suivantes (les capteurs sont alignés sur l'état à la fin du pas).
 */
function collectStars(sim: RaceSim, car: CarSim): void {
  const { cfg, time: t } = sim;
  for (const sensor of sensorsTouching(sim.world.engine, car.body.parts)) {
    if (sensor.label !== 'star') continue;
    const i = sim.starBodies.indexOf(sensor);
    const star = sim.stars[i];
    if (!star || !isStarActive(star, t, cfg)) continue;
    takeStar(star, t);
    activateTurbo(car.state, t, cfg);
    sim.events.push({ type: 'star', carId: car.state.id, t, id: star.id });
  }
}

/** Toutes les voitures de la course sauf `car`. */
function otherCars(sim: RaceSim, car: CarSim): CarSim[] {
  return sim.cars.filter((c) => c !== car);
}

/** x du châssis (m). */
const chassisX = (car: CarSim): number => physToWorld(car.body.chassis.position).x;

/** Point posé au sol en x : hauteur et angle du sol local. */
const groundPoint = (track: Track, x: number): SafePoint => ({ x, y: heightAt(track, x), angle: slopeAt(track, x) });

/** Une pièce de la voiture (châssis ou roue, toutes filtrées CAT.CAR) chevauche-t-elle une pièce d'une autre voiture ? */
function overlapsOtherCar(sim: RaceSim, car: CarSim): boolean {
  const others = otherCars(sim, car).flatMap((c) => c.body.parts);
  return car.body.parts.some((p) => Matter.Query.collides(p, others).length > 0);
}

/**
 * Masque de collision de la voiture, posé ici seulement : sans les autres voitures si elle est
 * fantôme OU invulnérable, normal sinon. Appelé à chaque changement de l'un des deux états.
 */
function syncMask(car: CarSim): void {
  setCarInvulnerable(car.body, car.ghost || car.invulnerable);
}

/**
 * Avant le pas physique : fantôme si le châssis est dans une zone fantôme ; en sortant de la zone, la
 * voiture le reste tant qu'une de ses pièces chevauche une autre voiture, sans plafond de durée
 * (rétablir la collision sur un chevauchement donnerait une impulsion).
 */
function updateGhost(sim: RaceSim, car: CarSim): void {
  const ghost = inGhostZone(sim.track, chassisX(car)) || (car.ghost && overlapsOtherCar(sim, car));
  if (ghost === car.ghost) return;
  car.ghost = ghost;
  syncMask(car);
}

/**
 * Lève l'invulnérabilité à partir de `invulnerableUntil` si aucune pièce de la voiture ne chevauche une
 * pièce d'une autre voiture, et de toute façon à `invulnerableUntil + (RESPAWN_INVULN_MAX − RESPAWN_INVULN)`.
 * Une voiture fantôme garde son masque sans voitures (`syncMask`).
 */
function releaseInvulnerability(sim: RaceSim, car: CarSim): void {
  if (!car.invulnerable) return;
  const { cfg, time: t } = sim;
  const { state } = car;
  if (t < state.invulnerableUntil) return;
  if (!overlapsOtherCar(sim, car) || t >= state.invulnerableUntil + (cfg.RESPAWN_INVULN_MAX - cfg.RESPAWN_INVULN)) {
    car.invulnerable = false;
    syncMask(car);
  }
}

/**
 * Après le pas physique (t = instant du pas) : mémorise un point sûr si la position s'y prête,
 * met à jour les chronomètres de réapparition et, si l'un d'eux se déclenche, repose la voiture
 * aussitôt (entre deux pas physiques), invulnérable, et émet l'événement 'respawn'. La cible est
 * décalée vers l'amont si un autre châssis l'occupe (respawn groupé, `shiftTarget`) ; les voitures
 * déjà replacées pendant ce pas comptent (ordre des index).
 */
function observeAndRespawn(sim: RaceSim, car: CarSim, onGround: [boolean, boolean]): void {
  const { cfg, track, world, time: t } = sim;
  const { body, state } = car;
  const x = state.progress;
  const angle = carAngle(body);
  const groundY = heightAt(track, x);
  const groundSlope = slopeAt(track, x);
  const candidate = { x, t, bothWheelsOnGround: onGround[0] && onGround[1], carAngle: angle, groundSlope };
  if (isSafePointCandidate(candidate, state, track, cfg)) {
    state.safePoint = { x, y: groundY, angle: groundSlope };
    state.lastSafePointAt = t;
  }
  const reason = updateRespawnTimers(state, {
    t,
    angle,
    throttle: car.throttle,
    progress: x,
    y: physToWorld(body.chassis.position).y,
    groundY,
    speedMps: carSpeedMps(body),
    onLava: sensorsTouching(world.engine, body.parts).some((b) => b.label === 'lava'),
    inElanZone: inElanZone(track, x),
  }, cfg);
  if (reason === null) return;
  const { point, lavaX, consecutive } = chooseRespawnTarget(state, track, cfg, reason);
  const target = shiftTarget(point, otherCars(sim, car).map(chassisX), track, cfg);
  placeInvulnerable(sim, car, target, lavaX, consecutive);
  sim.events.push({ type: 'respawn', carId: state.id, t, reason, x, target: { ...target } });
}

/**
 * Pose la voiture à l'arrêt sur `target` (roues au sol), invulnérable RESPAWN_INVULN, et remet son état
 * comme après une réapparition (chronomètres à zéro, point sûr = cible, série « même volcan » =
 * `lavaX` / `consecutive`) ; contact au sol et chronomètre d'envol remis à zéro.
 */
function placeInvulnerable(sim: RaceSim, car: CarSim, target: SafePoint, lavaX: number | null, consecutive: number): void {
  const { cfg, track } = sim;
  placeCar(car.body, target.x, (x) => heightAt(track, x), target.angle, cfg);
  car.invulnerable = true;
  syncMask(car);
  // applyRespawnToState garde la cible par référence (nouveau point sûr) : copie dédiée.
  applyRespawnToState(car.state, { ...target }, lavaX, consecutive, sim.time, cfg);
  car.contact.groundedUntil = [-1, -1];
  car.airborneSince = null;
}

/**
 * Garde-fou (après une exception dans `stepRace`) : remplace chaque voiture, dans l'ordre des index,
 * par une neuve, posée invulnérable comme après une réapparition (`placeInvulnerable`, série « même
 * volcan » conservée). Une voiture en course repart de son point sûr, décalé vers l'amont s'il est
 * occupé par une voiture déjà reconstruite dans cet appel (`shiftTarget` ; les anciennes positions ne
 * comptent pas). Une voiture arrivée est reconstruite sur place, au sol (elle ne réapparaît plus :
 * renvoyée à son point sûr, elle resterait garée avant la ligne) ; si son x n'est plus un nombre fini,
 * sur la ligne d'arrivée.
 */
export function rebuildCars(sim: RaceSim): void {
  const { world, cfg, track } = sim;
  const rebuilt: number[] = [];
  for (const car of sim.cars) {
    const { state } = car;
    const xNow = chassisX(car);
    Matter.Composite.remove(world.engine.world, car.body.composite, true);
    const target = state.finishedAt !== null
      ? groundPoint(track, Number.isFinite(xNow) ? xNow : track.xFinish)
      : shiftTarget(state.safePoint, rebuilt, track, cfg);
    car.body = createCar(world, car.body.id, car.body.index, target.x, cfg);
    placeInvulnerable(sim, car, target, state.lastRespawnLavaX, state.consecutiveRespawns);
    rebuilt.push(target.x);
  }
}

/** Vue de rendu de la voiture d'index `index` (monde : m, y vers le haut ; angles positifs anti-horaires). */
export function carView(sim: RaceSim, index: number): CarView {
  const { body, state, pilot } = sim.cars[index];
  const c = physToWorld(body.chassis.position);
  return {
    x: c.x,
    y: c.y,
    angle: carAngle(body),
    // Angle Matter : y vers le bas, sens horaire ; le renderer attend la convention y vers le haut.
    wheels: body.wheels.map((w) => ({ ...physToWorld(w.position), angle: -w.angle })),
    color: state.color,
    accent: state.accent,
    helmet: colorHex(pilot.helmet),
    name: state.name,
    turbo: turboFactor(state, sim.time, sim.cfg) > 1,
  };
}

/** Scène de rendu : toutes les voitures, Galahad en dernier (dessiné au-dessus des copains). */
export function sceneOf(sim: RaceSim): Scene {
  return {
    track: sim.track,
    cars: sim.cars.map((_, i) => carView(sim, i)).reverse(),
    stars: sim.track.stars.map((s, i) => ({ x: s.x, y: s.y, active: isStarActive(sim.stars[i], sim.time, sim.cfg) })),
    t: sim.time,
  };
}

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
  /** Étoiles prises par Galahad. */
  starsTaken: SimEvent[];
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

/** Paires actives du dernier pas entre pièces de deux voitures différentes dont l'une est dans `ids`. */
function carPairsTouching(sim: RaceSim, ids: ReadonlySet<string>): number {
  const carOf = (b: Matter.Body): string | undefined => (b.parent.plugin as { carId?: string } | undefined)?.carId;
  let n = 0;
  for (const pair of sim.world.engine.pairs.list) {
    if (!pair.isActive) continue;
    const a = carOf(pair.bodyA);
    const b = carOf(pair.bodyB);
    if (a !== undefined && b !== undefined && a !== b && (ids.has(a) || ids.has(b))) n++;
  }
  return n;
}

/**
 * Course sans affichage : `throttle(t)` décide du doigt de Galahad à chaque pas (les robots suivent
 * leur driver). S'arrête `stopAfterFinish` secondes (défaut FINISH_COAST_SECONDS) après l'arrivée de
 * Galahad, ou à `maxSeconds`. `robots` et `pilotSeed` : comme `createRaceSim` (Galahad seul par défaut).
 */
export function simulateRace(
  track: Track,
  opts: {
    throttle: (t: number) => boolean; maxSeconds: number; cfg: Config;
    robots?: boolean; pilotSeed?: number; stopAfterFinish?: number;
  },
): SimulateResult {
  const { cfg } = opts;
  const sim = createRaceSim(track, cfg, { robots: opts.robots, pilotSeed: opts.pilotSeed });
  const galahad = sim.cars[0];
  const stopAfterFinish = opts.stopAfterFinish ?? cfg.FINISH_COAST_SECONDS;
  const steps = Math.round(opts.maxSeconds / cfg.PHYSICS_DT);
  const samples: number[] = [galahad.state.progress];
  const speeds: number[] = [carSpeedMps(galahad.body)];
  const ids = sim.cars.map((c) => c.state.id);
  const respawnsByCar: Record<string, RespawnEvent[]> = Object.fromEntries(ids.map((id) => [id, []]));
  const lavaByCar: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const stuck = sim.cars.map((c) => new StuckMeter(c.state.progress, cfg.STUCK_DISTANCE));
  const starsTaken: SimEvent[] = [];
  let finishes = 0;
  let maxSpeed = 0;
  let ghostContacts = 0;
  let maxStepMs = 0;
  let totalStepMs = 0;
  let stepsDone = 0;
  for (let i = 0; i < steps; i++) {
    const t = sim.time;
    const throttle = opts.throttle(t);
    const inZone = sim.cars.length > 1 ? new Set(sim.cars.filter((c) => inGhostZone(track, chassisX(c))).map((c) => c.state.id)) : null;
    const t0 = performance.now();
    stepRace(sim, throttle);
    const ms = performance.now() - t0;
    maxStepMs = Math.max(maxStepMs, ms);
    totalStepMs += ms;
    stepsDone++;
    if (inZone !== null && inZone.size > 0) ghostContacts += carPairsTouching(sim, inZone);
    const respawned = new Set<string>();
    for (const e of sim.events) {
      const mine = e.carId === galahad.state.id;
      if (e.type === 'respawn') {
        respawnsByCar[e.carId].push(e);
        if (e.reason === 'lava') lavaByCar[e.carId]++;
        respawned.add(e.carId);
      } else if (e.type === 'star' && mine) starsTaken.push(e);
      else if (e.type === 'finish' && mine) finishes++;
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
    maxStuckSeconds: stuck[0].max, maxSpeed, starsTaken, time: sim.time, progressAt: at(samples), speedAt: at(speeds),
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
