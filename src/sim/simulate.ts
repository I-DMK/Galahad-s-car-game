// Pas de course : relie la physique (matter-js) à l'état de course. Sans DOM : utilisable sous node
// (tests, simulations), et par la boucle de jeu (`src/game.ts`). Réapparitions branchées (10b),
// ligne d'arrivée (11), étoiles et turbo (12) ; course à 5 voitures dans un seul monde, grille de
// départ, chocs réels hors des zones fantômes des volcans et respawn groupé (tâche 5b du plan B) ; conduite des
// robots par leur driver (tâche 6 : `ai/driver.ts`) ; élastique des copains (tâche 7 : `ai/rubberband.ts`).
import Matter from 'matter-js';
import { makeRobotDriver, type Driver, type DriverContext, type OtherCar } from '../ai/driver';
import { finalFactor, onScreen, stepRubber } from '../ai/rubberband';
import type { Config } from '../config';
import { canJump, wantsJump } from '../cars/jump';
import { GALAHAD, drawPilots, type Pilot } from '../cars/pilots';
import {
  applyRespawnToState, chooseRespawnTarget, shiftTarget, updateRespawnTimers, type RespawnReason,
} from '../cars/respawn';
import { isSafePointCandidate } from '../cars/safepoint';
import { isStarActiveFor, newStarStates, takeStarFor, type StarState } from '../cars/stars';
import { newCarState, type CarState, type SafePoint } from '../cars/state';
import { activateTurbo, turboFactor } from '../cars/turbo';
import type { CarPose } from '../loop/interpolation';
import {
  applyAirLevel, applyBrake, applyDrive, applyJump, carAngle, carSpeedMps, clampVelocities, createCar, newGroundContact,
  onTrack, placeCar, setCarInvulnerable, updateGroundContact, type CarBody, type GroundContact,
} from '../physics/car';
import { createStarBodies, syncStarBodies } from '../physics/stars';
import { physToWorld, toM } from '../physics/units';
import { MAX_CARS, createWorld, sensorsTouching, stepWorld, type World } from '../physics/world';
import type { CarView, Scene } from '../render/renderer';
import { heightAt, inElanZone, inGhostZone, inNoJumpZone, slopeAt } from '../track/query';
import type { Track } from '../track/types';

/** Chaque événement porte l'id (`CarState.id`) de la voiture concernée. */
export type SimEvent =
  /** `x` : position du châssis (m) au moment de la décision, avant téléportation vers `target`. */
  | { type: 'respawn'; carId: string; t: number; reason: RespawnReason; x: number; target: SafePoint }
  | { type: 'landing'; carId: string; t: number; x: number; strength: number }
  | { type: 'star'; carId: string; t: number; id: number }
  | { type: 'finish'; carId: string; t: number }
  /**
   * Saut (tâche 5e) : `x` = position du châssis (m) au moment du saut ; `y` = hauteur de la poussière : le sol en x si
   * la voiture touchait la piste, sinon la hauteur du châssis (saut dans la tolérance, en l'air).
   */
  | { type: 'jump'; carId: string; t: number; x: number; y: number };

export type RespawnEvent = Extract<SimEvent, { type: 'respawn' }>;
export type StarEvent = Extract<SimEvent, { type: 'star' }>;

/** Une voiture de la course : pilote, corps physique et état de course. */
export interface CarSim {
  pilot: Pilot;
  body: CarBody;
  state: CarState;
  /** Contact au sol de jeu (anti-rebond) de `body`, et contact avec la piste seule (`trackUntil`). */
  contact: GroundContact;
  /** Instant (s) où plus aucune roue ne touche le sol (contact de jeu), null si au moins une roue touche. */
  airborneSince: number | null;
  /**
   * Au moins une roue sur la piste (sol, mur, écart roue-sol ; jamais une autre voiture) au dernier pas, au sens du
   * contact débouncé (tâche 5e) ; faux à la création et après une téléportation.
   */
  grounded: boolean;
  /**
   * Instant (s) du dernier pas où une roue touchait la piste (`grounded`) ; null à la création et après une
   * téléportation. Tolérance de sol du saut (décision P11) : `canJump` le compare à JUMP_GROUND_GRACE. Le toit d'un
   * copain ne compte pas (décision du papa, relectures de la 5e) : pas de nouveau saut depuis une autre voiture.
   */
  lastGroundedAt: number | null;
  /**
   * En vol de son propre saut : vrai au saut, faux au premier retour au sol (contact de jeu) qui le suit et à une
   * téléportation. Le chronomètre « bloquée » ne compte pas pendant ce vol (`jumpFlight`).
   */
  jumpFlight: boolean;
  /** Collisions avec les autres voitures coupées (après une réapparition) ; levé par `releaseInvulnerability`. */
  invulnerable: boolean;
  /**
   * Fantôme : châssis dans la zone fantôme d'un volcan (`inGhostZone`) : tremplin, de xLancement jusqu'à ce que la roue
   * arrière ait passé xReception (châssis ≤ xReception + WHEEL_BASE/2 + WHEEL_RADIUS, tâche 5b) ; fosse, jusqu'au bord
   * aval + FOSSE_GHOST_AFTER (tâche 5g) ; ou sorti de la zone mais encore engagé dans une autre voiture (`updateGhost`).
   * Les voitures se traversent.
   */
  ghost: boolean;
  /** Pilote automatique d'un robot (`makeRobotDriver`, tâche 6) ; null pour Galahad (doigt et saut de l'enfant, arguments de `stepRace`). */
  driver: Driver | null;
  /**
   * Les demandes de saut viennent d'un pilote automatique (copains ; Galahad dans la variante « sauteur » du rattrapage) :
   * jamais de saut dans [xLancement, xReception] d'un tremplin (garde de `updateJump`, demande en mémoire comprise).
   * Faux pour le doigt de l'enfant : un saut mal placé dans l'élan se paie (addendum « bouton saut » §0).
   */
  autoJumps: boolean;
  /** Chutes dans la lave de cette voiture, par volcan (indice dans `track.volcanoes`) : tentative à une fosse (tâche 6). */
  lavaFalls: number[];
  /**
   * Multiplicateur imposé du plafond de vitesse (tests, mesures ; 1 en jeu), multiplié au turbo ; lu seulement quand
   * l'élastique est coupé (`rubber === null`) : Galahad, ou un copain dont un test impose la vitesse (`launchSolo`).
   */
  factor: number;
  /**
   * Élastique du copain après la rampe (tâche 7, `stepRubber`) : 1 à la création ; null = coupé (Galahad toujours ; copain
   * dont un test impose `factor`, ruling R7-3). Gardé à une réapparition, figé après l'arrivée.
   */
  rubber: number | null;
  /**
   * Facteurs appliqués au dernier pas de conduite (`applyDrive`), pour toute voiture (mesures, tests) : plafond de vitesse
   * et couple. Copain sous élastique : `finalFactor` aux deux ; sans élastique : turbo × `factor`, et couple 1
   * (Galahad : 1 toujours). Inchangés après l'arrivée.
   */
  speedFactor: number;
  torqueFactor: number;
  /**
   * Copain sous élastique à l'écran au début du dernier pas (`onScreen(gap, vitesse de Galahad)`, les valeurs mêmes de
   * `finalFactor`, ruling R7-16) ; faux pour Galahad, pour un copain sans élastique et après l'arrivée.
   */
  onScreen: boolean;
  /** Doigt posé au dernier pas (décision du driver, ou de l'enfant pour Galahad ; false après l'arrivée). */
  throttle: boolean;
}

/** Index de Galahad dans `RaceSim.cars` : l'écran montre les étoiles telles qu'il les voit. */
export const GALAHAD_INDEX = 0;

export interface RaceSim {
  track: Track;
  world: World;
  /** Galahad = cars[GALAHAD_INDEX] = cars[0] ; le robot de rang n = cars[n] (ordre de la grille). */
  cars: CarSim[];
  /** Temps de course (s), PHYSICS_DT par pas. */
  time: number;
  /** Événements du dernier pas (vidés au début de chaque pas). */
  events: SimEvent[];
  /**
   * État des étoiles, dans l'ordre de `track.stars`, tenu par voiture (une case de `takenAt` par index de
   * `cars`) : une étoile prise ne l'est que pour la voiture qui l'a prise (tâche 5d).
   */
  stars: StarState[];
  /** Capteurs des étoiles, même ordre que `stars` ; masque = voitures pour qui l'étoile est active (`syncStarBodies`). */
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

/**
 * Graine des pilotes dérivée de la graine de piste, entier de [0, 2³²) quel que soit `?seed=`
 * (`drawPilots` refuse le reste), et décorrélée du premier tirage de la piste.
 */
const defaultPilotSeed = (track: Track): number => (track.seed ^ 0x9e3779b9) >>> 0;

/**
 * Voiture de rang `rank` posée sur la grille : xStart − 2 − rank × GRID_SPACING_FACTOR × CAR_LENGTH. Un copain (rang ≥ 1)
 * reçoit son driver (`makeRobotDriver`, graine dérivée de `pilotSeed` et du rang).
 */
function createCarSim(world: World, track: Track, pilot: Pilot, rank: number, pilotSeed: number, cfg: Config): CarSim {
  const x0 = track.xStart - 2 - rank * cfg.GRID_SPACING_FACTOR * cfg.CAR_LENGTH;
  const body = createCar(world, pilot.id, rank, x0, cfg);
  const start: SafePoint = { x: x0, y: heightAt(track, x0), angle: 0 };
  const state = newCarState(pilot.id, pilot.name, colorHex(pilot.color), colorHex(pilot.accent), start);
  state.progress = physToWorld(body.chassis.position).x;
  return {
    pilot, body, state, contact: newGroundContact(), airborneSince: null, grounded: false, lastGroundedAt: null,
    jumpFlight: false, invulnerable: false, ghost: false,
    driver: rank === 0 ? null : makeRobotDriver(pilot, rank, track, pilotSeed, cfg), autoJumps: rank !== 0,
    lavaFalls: track.volcanoes.map(() => 0), factor: 1, throttle: false,
    rubber: rank === 0 ? null : 1, speedFactor: 1, torqueFactor: 1, onScreen: false,
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
  if (pilots.length > MAX_CARS) {
    throw new RangeError(`createRaceSim : ${pilots.length} voitures (Galahad + ${pilots.length - 1} copains), au plus MAX_CARS = ${MAX_CARS} (une catégorie de collision par voiture)`);
  }
  const cars = pilots.map((pilot, rank) => createCarSim(world, track, pilot, rank, pilotSeed, cfg));
  const stars = newStarStates(track.stars, cars.length);
  const starBodies = createStarBodies(world, track.stars, cfg);
  return { track, world, cars, time: 0, events: [], stars, starBodies, cfg, pilotSeed };
}

/**
 * Un pas fixe de PHYSICS_DT pour toutes les voitures : instantané des voitures pris avant tout (`snapshotCars`) pour les
 * contextes des drivers ; pour chacune, état fantôme (`updateGhost`), conduite (Galahad : doigt `galahadThrottle` et
 * nouvelle demande de saut `galahadJump` ; robots : la réponse de leur driver, `fillContext` ; facteurs de `drive`),
 * contact au sol, mise à plat en l'air et saut (`updateJump`, sur le contact avec la piste seule ; garde des demandes
 * d'un pilote automatique, `autoJumps`) ;
 * un seul pas physique ; puis, voiture par voiture dans
 * l'ordre des index : bornage des vitesses, progression, étoiles, arrivée, invulnérabilité et réapparition.
 * Après son arrivée (`state.finishedAt` défini), une voiture freine (FINISH_BRAKE) et ne réapparaît
 * plus jamais (elle s'arrête sur le plat avant le mur de fin). Une étoile touchée par une voiture pour qui
 * elle est active est prise pour cette voiture seule (réapparition pour elle STAR_RESPAWN_SECONDS plus
 * tard ; les autres peuvent la prendre) et lui lance TURBO_SECONDS de turbo. Les capteurs sont alignés
 * sur l'état des étoiles à la fin du pas (`syncStarBodies`).
 */
export function stepRace(sim: RaceSim, galahadThrottle: boolean, galahadJump = false): void {
  const { cfg, world, track, time: t } = sim;
  const h = (x: number) => heightAt(track, x);
  sim.events = [];
  // Contextes pris avant toute conduite, pour les seules voitures conduites par leur driver : la réponse d'un driver ne
  // dépend pas de l'ordre des voitures.
  const cache = sim.cars.some(drivenNow) ? driverCache(sim) : null;
  if (cache) snapshotCars(sim, cache);
  // Élastique (tâche 7, ruling R7-7) : x et vitesse du châssis de Galahad au début du pas, avant toute conduite (son saut
  // change sa vitesse dans la boucle) ; sans copain sous élastique, rien n'est lu.
  const galahad = sim.cars[GALAHAD_INDEX];
  const elastic = sim.cars.some(rubberNow);
  const gx = elastic ? chassisX(galahad) : 0;
  const vG = elastic ? carSpeedMps(galahad.body) : 0;
  const onGround = sim.cars.map((car, i) => {
    const { body, state } = car;
    updateGhost(sim, car);
    let jump = car.driver ? false : galahadJump;
    if (state.finishedAt !== null) {
      car.throttle = false;
      car.onScreen = false;
      applyBrake(body, cfg.FINISH_BRAKE);
    } else {
      if (car.driver) {
        const order = car.driver(fillContext(sim, cache!, i));
        car.throttle = order.throttle;
        jump = order.jump;
      } else {
        car.throttle = galahadThrottle;
      }
      drive(sim, car, gx, vG);
    }
    const grounded = updateGroundContact(world.engine, body, car.contact, t, h, cfg);
    detectLanding(sim, car, grounded[0] || grounded[1]);
    applyAirLevel(body, grounded, cfg);
    updateJump(sim, car, jump, onTrack(car.contact, t));
    return grounded;
  });
  stepWorld(world);
  sim.cars.forEach((car, i) => {
    const { state } = car;
    const finished = state.finishedAt !== null;
    clampVelocities(car.body, cfg);
    state.progress = physToWorld(car.body.chassis.position).x;
    collectStars(sim, car, i);
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

/**
 * Saut d'une voiture, après son contact au sol et avant le pas physique (tâche 5e) : le contact du pas avec la piste
 * seule (`onTrack`, jamais une autre voiture) date `lastGroundedAt` ; une nouvelle demande (`request`) est datée de
 * t ; si elle est encore valable (`wantsJump`, mémoire JUMP_BUFFER) et que la voiture peut sauter (`canJump` :
 * contact avec la piste dans les JUMP_GROUND_GRACE précédentes, délai écoulé, course pas finie pour elle),
 * `applyJump`, événement 'jump', vol de saut (`jumpFlight`) ; une demande servie ou périmée est oubliée. Sans
 * demande, rien ne touche la physique. Garde : une voiture dont les demandes viennent d'un pilote automatique
 * (`autoJumps`) ne saute jamais dans `inNoJumpZone`, et y oublie sa demande en mémoire.
 */
function updateJump(sim: RaceSim, car: CarSim, request: boolean, onTrackNow: boolean): void {
  const { cfg, time: t } = sim;
  const { state, body } = car;
  car.grounded = onTrackNow;
  if (onTrackNow) car.lastGroundedAt = t;
  // Garde (tâche 6, addendum « bouton saut » §3) : jamais de saut d'un pilote automatique dans [xLancement, xReception]
  // d'un tremplin, ni par une demande du pas ni par une demande gardée en mémoire (JUMP_BUFFER).
  if (car.autoJumps && inNoJumpZone(sim.track, chassisX(car))) {
    state.jumpRequestedAt = null;
    return;
  }
  if (request) state.jumpRequestedAt = t;
  if (state.jumpRequestedAt === null) return;
  if (!wantsJump(state.jumpRequestedAt, t, cfg)) {
    state.jumpRequestedAt = null;
    return;
  }
  if (!canJump({ lastJumpAt: state.lastJumpAt, lastGroundedAt: car.lastGroundedAt, finished: state.finishedAt !== null, t }, cfg)) return;
  applyJump(body, cfg);
  state.lastJumpAt = t;
  state.jumpRequestedAt = null;
  car.jumpFlight = true;
  const p = physToWorld(body.chassis.position);
  sim.events.push({ type: 'jump', carId: state.id, t, x: p.x, y: onTrackNow ? heightAt(sim.track, p.x) : p.y });
}

/**
 * Vol d'un saut pour le chronomètre « bloquée » (relecture adversariale de la 5e) : depuis le saut jusqu'au retour
 * au sol qui le suit (`CarSim.jumpFlight`), au plus deux fois la durée d'un saut depuis l'arrêt (2 × 2 JUMP_VY /
 * GRAVITY ≈ 4,0 s) : une voiture posée sur son châssis, roues en l'air, après un saut, redevient « bloquée ». Un
 * saut depuis l'arrêt, gaz posé, vole ≈ 2,02 s sans avancer, plus que STUCK_SECONDS : compté, il renvoyait la
 * voiture au point sûr à l'atterrissage et remettait à zéro la série « même volcan ».
 */
function jumpFlight(car: CarSim, t: number, cfg: Config): boolean {
  const since = car.state.lastJumpAt;
  return car.jumpFlight && since !== null && t - since <= (4 * cfg.JUMP_VY) / cfg.GRAVITY;
}

/**
 * Bouton prêt pour la voiture d'index `index` à l'instant du prochain pas : elle pourrait sauter (`canJump`).
 * Faux en l'air au-delà de JUMP_GROUND_GRACE après le dernier contact de jeu, pendant le délai JUMP_COOLDOWN,
 * après une téléportation jusqu'au premier contact, et après son arrivée.
 */
export function jumpReady(sim: RaceSim, index: number): boolean {
  const car = sim.cars[index];
  const { state } = car;
  return canJump({ lastJumpAt: state.lastJumpAt, lastGroundedAt: car.lastGroundedAt, finished: state.finishedAt !== null, t: sim.time }, sim.cfg);
}

/**
 * Atterrissage : retour au sol après au moins LANDING_MIN_AIRTIME en l'air. Tout retour au sol (contact de jeu)
 * après un décollage clôt le vol d'un saut (`jumpFlight`).
 */
function detectLanding(sim: RaceSim, car: CarSim, grounded: boolean): void {
  const { time: t, cfg } = sim;
  if (!grounded) {
    car.airborneSince ??= t;
  } else if (car.airborneSince !== null) {
    car.jumpFlight = false;
    if (t - car.airborneSince >= LANDING_MIN_AIRTIME) {
      const { chassis } = car.body;
      const strength = Math.abs(toM(chassis.velocity.y) / cfg.PHYSICS_DT);
      sim.events.push({ type: 'landing', carId: car.state.id, t, x: physToWorld(chassis.position).x, strength });
    }
    car.airborneSince = null;
  }
}

/**
 * Prend, pour la voiture d'index `index` seule, les étoiles touchées ce pas-ci qui sont actives pour elle :
 * la décision se fait voiture par voiture, une prise ne change rien pour les autres (même au même pas).
 */
function collectStars(sim: RaceSim, car: CarSim, index: number): void {
  const { cfg, time: t } = sim;
  for (const sensor of sensorsTouching(sim.world.engine, car.body.parts)) {
    if (sensor.label !== 'star') continue;
    const i = sim.starBodies.indexOf(sensor);
    const star = sim.stars[i];
    if (!star || !isStarActiveFor(star, index, t, cfg)) continue;
    takeStarFor(star, index, t);
    activateTurbo(car.state, t, cfg);
    sim.events.push({ type: 'star', carId: car.state.id, t, id: star.id });
  }
}

/** Voiture conduite par son driver à ce pas : un copain pas encore arrivé. */
const drivenNow = (car: CarSim): boolean => car.driver !== null && car.state.finishedAt === null;
/** Copain sous élastique à ce pas : élastique non coupé, pas encore arrivé. */
const rubberNow = (car: CarSim): boolean => car.rubber !== null && car.state.finishedAt === null;

/**
 * Conduite d'une voiture pas encore arrivée (tâche 7), doigt `car.throttle` déjà décidé. Sans élastique (`rubber ===
 * null` : Galahad, ou un copain d'un test) : plafond turbo × `factor`, couple 1, exactement le pas d'avant la tâche 7.
 * Copain sous élastique : écart à Galahad au début du pas (`gx`, x de son châssis ; `vG`, sa vitesse), élastique du pas
 * (`stepRubber` : cible, plancher, rampe, clamp de zone), puis facteur final (`finalFactor` : turbo plafonné à 1,3, ≤ 1
 * hors écran devant) au plafond ET au couple. Facteurs appliqués et `onScreen` notés dans la voiture.
 */
function drive(sim: RaceSim, car: CarSim, gx: number, vG: number): void {
  const { cfg, track, time: t } = sim;
  const turbo = turboFactor(car.state, t, cfg);
  if (car.rubber === null) {
    const f = turbo * car.factor;
    applyDrive(car.body, car.throttle, f, 1, cfg);
    car.speedFactor = f;
    car.torqueFactor = 1;
    car.onScreen = false;
    return;
  }
  const x = chassisX(car);
  const gap = x - gx;
  car.rubber = stepRubber(car.rubber, t, gap, car.pilot.base, x, track, cfg);
  const f = finalFactor(car.rubber, turbo, gap, vG, cfg);
  applyDrive(car.body, car.throttle, f, f, cfg);
  car.speedFactor = f;
  car.torqueFactor = f;
  car.onScreen = onScreen(gap, vG, cfg);
}

/** Contexte d'un driver et ses objets internes, réutilisés d'un pas à l'autre (aucune allocation par pas). */
interface DriverSlot {
  ctx: DriverContext;
  others: OtherCar[];
  star: { index: number; x: number; available: boolean };
  fosse: { xBord: number; index: number; attempt: 1 | 2 };
  /** Curseur dans `highStars` : première étoile haute strictement devant le dernier x vu. */
  starCursor: number;
}
/**
 * Par course : un emplacement par voiture (ordre des index), les indices (dans `track.stars`) des étoiles hautes, et
 * l'instantané des voitures pris au début du pas (x, vitesse, doigt, traversable).
 */
interface DriverCache {
  slots: DriverSlot[];
  highStars: number[];
  xs: number[]; speeds: number[]; throttles: boolean[]; traversables: boolean[];
}
const driverCaches = new WeakMap<RaceSim, DriverCache>();

function driverCache(sim: RaceSim): DriverCache {
  let cache = driverCaches.get(sim);
  if (cache && cache.slots.length === sim.cars.length) return cache;
  const n = sim.cars.length;
  const slots = sim.cars.map((car, index): DriverSlot => {
    const others = sim.cars.flatMap((_, j) => (j === index ? [] : [{ index: j, x: 0, speed: 0, throttle: false, traversable: false }]));
    const ctx: DriverContext = {
      t: 0, state: car.state, track: sim.track, speed: 0, x: 0, traversable: false, others, nextHighStar: null, nextFosse: null,
    };
    return { ctx, others, star: { index: -1, x: 0, available: false }, fosse: { xBord: 0, index: -1, attempt: 1 }, starCursor: 0 };
  });
  cache = {
    slots,
    highStars: sim.track.stars.flatMap((s, k) => (s.high ? [k] : [])),
    xs: new Array<number>(n).fill(0), speeds: new Array<number>(n).fill(0),
    throttles: new Array<boolean>(n).fill(false), traversables: new Array<boolean>(n).fill(false),
  };
  driverCaches.set(sim, cache);
  return cache;
}

/** Instantané de toutes les voitures au début du pas : x et vitesse du châssis, doigt du pas précédent, traversable. */
function snapshotCars(sim: RaceSim, cache: DriverCache): void {
  sim.cars.forEach((car, i) => {
    cache.xs[i] = chassisX(car);
    cache.speeds[i] = carSpeedMps(car.body);
    cache.throttles[i] = car.throttle;
    cache.traversables[i] = car.ghost || car.invulnerable;
  });
}

/**
 * Contexte du driver de la voiture d'index `i` (`DriverContext`), d'après l'instantané : t, état, x et vitesse,
 * traversable, autres voitures (ordre des index), étoile haute la plus proche devant à moins de JUMP_LOOKAHEAD (curseur
 * sur les étoiles hautes ; disponibilité pour cette voiture), prochaine fosse devant à moins de JUMP_LOOKAHEAD (bord
 * amont, rang parmi les fosses, tentative : 2 si la voiture est déjà tombée dans cette fosse, `CarSim.lavaFalls`).
 */
function fillContext(sim: RaceSim, cache: DriverCache, i: number): DriverContext {
  const { cfg, track, time: t } = sim;
  const slot = cache.slots[i];
  const { ctx, star, fosse } = slot;
  const x = cache.xs[i];
  ctx.t = t;
  ctx.state = sim.cars[i].state;
  ctx.x = x;
  ctx.speed = cache.speeds[i];
  ctx.traversable = cache.traversables[i];
  for (const o of slot.others) {
    o.x = cache.xs[o.index];
    o.speed = cache.speeds[o.index];
    o.throttle = cache.throttles[o.index];
    o.traversable = cache.traversables[o.index];
  }
  const hs = cache.highStars;
  let c = slot.starCursor;
  while (c < hs.length && track.stars[hs[c]].x <= x) c++;
  while (c > 0 && track.stars[hs[c - 1]].x > x) c--;
  slot.starCursor = c;
  ctx.nextHighStar = null;
  if (c < hs.length && track.stars[hs[c]].x - x <= cfg.JUMP_LOOKAHEAD) {
    star.index = hs[c];
    star.x = track.stars[hs[c]].x;
    star.available = isStarActiveFor(sim.stars[hs[c]], i, t, cfg);
    ctx.nextHighStar = star;
  }
  ctx.nextFosse = null;
  let rank = 0;
  for (let vi = 0; vi < track.volcanoes.length; vi++) {
    const v = track.volcanoes[vi];
    if (v.kind !== 'fosse') continue;
    if (v.xBord > x) {
      if (v.xBord - x <= cfg.JUMP_LOOKAHEAD) {
        fosse.xBord = v.xBord;
        fosse.index = rank;
        fosse.attempt = sim.cars[i].lavaFalls[vi] >= 1 ? 2 : 1;
        ctx.nextFosse = fosse;
      }
      break;
    }
    rank++;
  }
  return ctx;
}

/**
 * Contexte du driver de la voiture d'index `index` à l'état courant, tel que `stepRace` le passerait au pas suivant
 * (variante « Galahad sauteur » du rattrapage : un driver de copain décide du saut de Galahad ; tests). Objet réutilisé.
 */
export function driverContext(sim: RaceSim, index: number): DriverContext {
  const cache = driverCache(sim);
  snapshotCars(sim, cache);
  return fillContext(sim, cache, index);
}

/** Toutes les voitures de la course sauf `car`. */
function otherCars(sim: RaceSim, car: CarSim): CarSim[] {
  return sim.cars.filter((c) => c !== car);
}

/** x du châssis (m). */
export const chassisX = (car: CarSim): number => physToWorld(car.body.chassis.position).x;

/** Point posé au sol en x : hauteur et angle du sol local. */
const groundPoint = (track: Track, x: number): SafePoint => ({ x, y: heightAt(track, x), angle: slopeAt(track, x) });

/** Une pièce de la voiture (châssis ou roue, chacune de la catégorie de sa voiture) chevauche-t-elle une pièce d'une autre voiture ? */
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
  const ghost = inGhostZone(sim.track, chassisX(car), sim.cfg) || (car.ghost && overlapsOtherCar(sim, car));
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
 * décalée vers l'amont si un autre châssis l'occupe (respawn groupé, `shiftTarget`), vers l'aval pour la cible
 * d'après une fosse (2e chute de suite, tâche 5g) ; les voitures
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
    // Le vol d'un saut ne compte pas comme un blocage (`jumpFlight`).
    throttle: car.throttle && !jumpFlight(car, t, cfg),
    progress: x,
    y: physToWorld(body.chassis.position).y,
    groundY,
    speedMps: carSpeedMps(body),
    onLava: sensorsTouching(world.engine, body.parts).some((b) => b.label === 'lava'),
    inElanZone: inElanZone(track, x),
  }, cfg);
  if (reason === null) return;
  const { point, lavaX, consecutive, direction, volcano } = chooseRespawnTarget(state, track, cfg, reason, x);
  // Chutes par volcan (tentative d'un copain à une fosse) : le volcan retenu pour la série, une seule source.
  if (volcano) car.lavaFalls[track.volcanoes.indexOf(volcano)]++;
  const target = shiftTarget(point, otherCars(sim, car).map(chassisX), track, cfg, direction);
  placeInvulnerable(sim, car, target, lavaX, consecutive);
  sim.events.push({ type: 'respawn', carId: state.id, t, reason, x, target: { ...target } });
}

/**
 * Pose la voiture à l'arrêt sur `target` (roues au sol), invulnérable RESPAWN_INVULN, et remet son état
 * comme après une réapparition (chronomètres à zéro, point sûr = cible, série « même volcan » =
 * `lavaX` / `consecutive`) ; contact au sol et chronomètre d'envol remis à zéro. Une pose est une
 * téléportation, pas une sortie de zone en roulant : l'état fantôme est recalculé à la cible, sans
 * rétention par chevauchement (hors zone, c'est l'invulnérabilité, plafonnée, qui gouverne).
 */
function placeInvulnerable(sim: RaceSim, car: CarSim, target: SafePoint, lavaX: number | null, consecutive: number): void {
  const { cfg, track } = sim;
  placeCar(car.body, target.x, (x) => heightAt(track, x), target.angle, cfg);
  car.ghost = inGhostZone(track, target.x, cfg);
  car.invulnerable = true;
  syncMask(car);
  // applyRespawnToState garde la cible par référence (nouveau point sûr) : copie dédiée.
  applyRespawnToState(car.state, { ...target }, lavaX, consecutive, sim.time, cfg);
  car.contact = newGroundContact();
  car.airborneSince = null;
  // Une téléportation oublie la demande de saut en attente et le contact d'avant (tâche 5e) : pas de saut surprise
  // au point sûr, ni de saut de tolérance sur un contact d'avant la téléportation, ni de vol de saut en cours.
  car.state.jumpRequestedAt = null;
  car.grounded = false;
  car.lastGroundedAt = null;
  car.jumpFlight = false;
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

/** Pose de rendu de la voiture d'index `index` au dernier pas (monde : m, y vers le haut ; angles anti-horaires). */
function poseOf(car: CarSim): CarPose {
  const { body } = car;
  return {
    chassis: { ...physToWorld(body.chassis.position), angle: carAngle(body) },
    // Angle Matter : y vers le bas, sens horaire ; le renderer attend la convention y vers le haut.
    wheels: body.wheels.map((w) => ({ ...physToWorld(w.position), angle: -w.angle })),
    speed: carSpeedMps(body),
  };
}

/** Poses de rendu de toutes les voitures au dernier pas, dans l'ordre des index (Galahad en premier). */
export function posesOf(sim: RaceSim): CarPose[] {
  return sim.cars.map(poseOf);
}

/** Ensemble vide partagé (aucune réapparition au dernier pas, le cas courant) : jamais modifié. */
const NO_TELEPORT: ReadonlySet<number> = new Set();

/**
 * Index des voitures téléportées pendant le dernier pas (événement 'respawn' dans `sim.events`) ; sans
 * réapparition, un ensemble vide partagé (pas d'allocation).
 */
export function teleportedOf(sim: RaceSim): ReadonlySet<number> {
  if (!sim.events.some((e) => e.type === 'respawn')) return NO_TELEPORT;
  const out = new Set<number>();
  for (const e of sim.events) {
    if (e.type !== 'respawn') continue;
    const i = sim.cars.findIndex((c) => c.state.id === e.carId);
    if (i >= 0) out.add(i);
  }
  return out;
}

/**
 * Vue de rendu de la voiture d'index `index` (monde : m, y vers le haut ; angles positifs anti-horaires),
 * à la pose `pose` (interpolée) ou, sans pose, à celle du dernier pas.
 */
export function carView(sim: RaceSim, index: number, pose?: CarPose): CarView {
  const car = sim.cars[index];
  const { state, pilot } = car;
  const p = pose ?? poseOf(car);
  return {
    x: p.chassis.x,
    y: p.chassis.y,
    angle: p.chassis.angle,
    // Poses neuves à chaque image (`PoseHistory.at`, `poseOf`) : partagées, sans copie.
    wheels: p.wheels,
    color: state.color,
    accent: state.accent,
    helmet: colorHex(pilot.helmet),
    name: state.name,
    turbo: turboFactor(state, sim.time, sim.cfg) > 1,
  };
}

/**
 * Scène de rendu : toutes les voitures, Galahad en dernier (dessiné au-dessus des copains). Sans poses :
 * état du dernier pas. Avec poses et alpha : voitures aux poses données (interpolées, `runFrame`) et
 * `Scene.t` = sim.time − (1 − alpha) × PHYSICS_DT (même latence que les voitures) ; étoiles et turbo
 * gardent le temps de simulation. Étoiles : état vu par Galahad (index 0) ; une prise par un copain n'y
 * laisse aucun signe (décision P5 du plan B).
 */
export function sceneOf(sim: RaceSim, poses?: CarPose[], alpha = 1): Scene {
  return {
    track: sim.track,
    cars: sim.cars.map((_, i) => carView(sim, i, poses?.[i])).reverse(),
    stars: sim.track.stars.map((s, i) => ({ x: s.x, y: s.y, active: isStarActiveFor(sim.stars[i], GALAHAD_INDEX, sim.time, sim.cfg) })),
    t: poses === undefined ? sim.time : sim.time - (1 - alpha) * sim.cfg.PHYSICS_DT,
  };
}
