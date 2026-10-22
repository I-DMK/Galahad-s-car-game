// Helpers partagés des simulations d'acceptation (tâche 4 du plan B, addendum §1.7) : un monde
// par graine, une voiture seule conduite plein gaz (ou selon un motif) depuis l'arrêt, et la
// lecture du résultat (lave, atterrissage, angle, retournement, blocage, vitesse au sommet).
// La boucle reproduit la partie physique de `stepRace` (sans réapparition ni étoiles) :
// applyDrive → contact au sol débouncé → applyAirLevel → stepWorld → clampVelocities.
import Matter from 'matter-js';
import { forbiddenZone } from '../../src/cars/safepoint';
import { CONFIG, type Config } from '../../src/config';
import {
  applyAirLevel, applyDrive, carAngle, carSpeedMps, clampVelocities, createCar, placeCar,
  updateGroundContact, wheelsBelowChassis, wheelsOnGround, type CarBody, type GroundContact,
} from '../../src/physics/car';
import { mpsToPxPerStep, physToWorld, toPx } from '../../src/physics/units';
import { createWorld, sensorsTouching, stepWorld, type World } from '../../src/physics/world';
import type { SimEvent } from '../../src/sim/simulate';
import { generateTrack } from '../../src/track/generate';
import { heightAt, slopeAt, volcanoAhead } from '../../src/track/query';
import { mulberry32 } from '../../src/track/rng';
import type { Track, Volcano } from '../../src/track/types';

const { Body, Composite } = Matter;

export const TRACK_LENGTH = 1680;
export const STEPS_PER_SECOND = 60;
export const DEG = Math.PI / 180;
/**
 * Vitesse au sommet de référence (m/s, norme de la vitesse du châssis au premier pas où x ≥ xLip)
 * pour le franchissement de la lave, à LAVA_MARGIN 0,8 et capteur +0,3 m : V_JUMP = 10. Le seuil
 * réel n'est pas net : la bissection de `tests/slow/dosage.test.ts` (15 volcans des graines 0 à 2,
 * roues bridées, congé du pied de rampe de la tâche 5c) voit des chutes de 9,75 à 10,14 m/s et des
 * passages dès 9,96. Le cas 2 exige LIP_SPEED_THRESHOLD + 1 (sa vitesse au sommet la plus basse :
 * 12,66, départ à xLancement). Avant le congé, des chutes doigt posé étaient mesurées jusqu'à 11,44 m/s :
 * c'est la direction de la vitesse au sommet (≈ 14° au lieu de ≈ 21°, voiture qui survole la rampe
 * après un rebond au pied) qui décidait ; l'échantillonnage des phases (tests/slow/phases.test.ts) le
 * surveille : 0 chute sur 2 924 + 4 601 historiques (turbo dense, tests/slow/phases-dense.test.ts),
 * garde minimale 0,63 m au-dessus du capteur en fin de turbo au pied (lancée à V_MAX, turbo pris à
 * xLancement − 26, doigt posé ; g0 v2 et g8 v3), 1,72 m hors fin de turbo ; garde ≥ 0,3 m assertée.
 */
export const LIP_SPEED_THRESHOLD: number = CONFIG.V_JUMP;
/** |angle du châssis| maximal à l'atterrissage (cas 2 à 5, cratère). */
export const LANDING_MAX_ANGLE = 45 * DEG;
/**
 * Cas 6 (addendum §1.7) : borne basse de l'arrivée doigt posé. L'addendum disait 120 s ; mesuré
 * 118 à 127 s sur les graines 0 à 4 (registre, tâches 1 à 3) ; amendé [tâche 4] à 110 s.
 */
export const FINISH_MIN_SECONDS = 110;
export const FINISH_MAX_SECONDS = 170;
/** Vol : au moins 0,3 s sans aucun contact avec le sol (roues ni châssis). */
export const FLIGHT_STEPS = 0.3 * STEPS_PER_SECOND;
/** « Deux roues au sol » = chaque roue a touché le sol dans les 0,1 dernière seconde (rebonds à V_MAX). */
export const BOTH_WHEELS_WINDOW = 6;
/** Après l'atterrissage sur la réception, la voiture est encore suivie 1 s (retournement tardif). */
const AFTER_LANDING_SECONDS = 1;

/** Cache par graine d'une configuration (objet `Config`, clé de `WeakMap` : deux objets égaux ne partagent rien). */
function perSeed<T>(cache: WeakMap<Config, Map<number, T>>, cfg: Config): Map<number, T> {
  let m = cache.get(cfg);
  if (!m) { m = new Map(); cache.set(cfg, m); }
  return m;
}

const tracks = new WeakMap<Config, Map<number, Track>>();
/**
 * Piste de longueur par défaut (1 680 m) de la graine, générée avec `cfg` (CONFIG par défaut ; pistes d'avant :
 * `withAnciennesPistes`, tests/helpers/anciennes-pistes.ts), mise en cache par graine et par objet de configuration.
 */
export function trackFor(seed: number, cfg: Config = CONFIG): Track {
  const m = perSeed(tracks, cfg);
  let t = m.get(seed);
  if (!t) {
    t = generateTrack(seed, TRACK_LENGTH, cfg);
    m.set(seed, t);
  }
  return t;
}

/** Première piste (graines 1, 0, 2, …) ayant un volcan, et ce volcan. */
export function firstVolcano(): { track: Track; v: Volcano } {
  for (const seed of [1, 0, 2, 3, 4, 5, 6, 7]) {
    const track = trackFor(seed);
    if (track.volcanoes.length > 0) return { track, v: track.volcanoes[0] };
  }
  throw new Error('aucune piste avec volcan');
}

const worlds = new WeakMap<Config, Map<number, World>>();
/** Un monde par graine et par objet de configuration (piste `trackFor(seed, cfg)`), partagé par les scénarios de la graine. */
export function worldFor(seed: number, cfg: Config = CONFIG): World {
  const m = perSeed(worlds, cfg);
  let world = m.get(seed);
  if (!world) {
    world = createWorld(trackFor(seed, cfg), cfg);
    m.set(seed, world);
  }
  return world;
}

/** Monde neuf (hors cache) d'une piste regénérée avec `cfg` (balayage de dosage). */
export function buildWorld(seed: number, cfg: Config): World {
  return createWorld(generateTrack(seed, TRACK_LENGTH, cfg), cfg);
}

const currentCars = new WeakMap<World, CarBody>();
/** Voiture neuve à l'arrêt en x (posée selon la pente locale) ; la précédente du monde est retirée. */
export function freshCar(world: World, x: number, cfg: Config = CONFIG): CarBody {
  const previous = currentCars.get(world);
  if (previous) Composite.remove(world.engine.world, previous.composite);
  const car = createCar(world, 'galahad', 0, x, cfg);
  placeCar(car, x, (xx) => heightAt(world.track, xx), slopeAt(world.track, x), cfg);
  currentCars.set(world, car);
  return car;
}

/** Lance toutes les parties à v m/s le long de la pente locale, roues en roulement sans glissement. */
export function launch(world: World, car: CarBody, x: number, v: number, cfg: Config = CONFIG): void {
  const a = slopeAt(world.track, x);
  const velocity = { x: mpsToPxPerStep(v * Math.cos(a)), y: -mpsToPxPerStep(v * Math.sin(a)) };
  for (const p of car.parts) Body.setVelocity(p, velocity);
  for (const w of car.wheels) Body.setAngularVelocity(w, mpsToPxPerStep(v) / toPx(cfg.WHEEL_RADIUS));
}

/** Le châssis est-il en contact actif avec un corps non capteur (sol, mur) ? */
export function chassisOnGround(world: World, car: CarBody): boolean {
  for (const pair of world.engine.pairs.list as Matter.Pair[]) {
    if (!pair.isActive) continue;
    const { bodyA, bodyB } = pair;
    if ((bodyA.parent === car.chassis && !bodyB.isSensor) || (bodyB.parent === car.chassis && !bodyA.isSensor)) return true;
  }
  return false;
}

export interface StepState {
  x: number;
  /** Contact brut de chaque roue [arrière, avant] ce pas-ci. */
  wheels: [boolean, boolean];
  chassis: boolean;
  lava: boolean;
}

/** Contact au sol débouncé d'une voiture (comme dans le pas de course), à créer par run. */
export const newContact = (): GroundContact => ({ groundedUntil: [-1, -1], trackUntil: [-1, -1] });

/**
 * Un pas de conduite : applyDrive(throttle, factor) → contact débouncé (t en s, comme stepRace) →
 * applyAirLevel → stepWorld → clampVelocities, puis lecture des contacts bruts et de la lave.
 */
export function step(
  world: World, car: CarBody, throttle: boolean, factor: number, contact: GroundContact, t: number,
  cfg: Config = CONFIG,
): StepState {
  applyDrive(car, throttle, factor, cfg);
  const onGround = updateGroundContact(world.engine, car, contact, t, (x) => heightAt(world.track, x), cfg);
  applyAirLevel(car, onGround, cfg);
  stepWorld(world);
  clampVelocities(car, cfg);
  return {
    x: physToWorld(car.chassis.position).x,
    wheels: wheelsOnGround(world.engine, car),
    chassis: chassisOnGround(world, car),
    lava: sensorsTouching(world.engine, car.parts).some((b) => b.label === 'lava'),
  };
}

/**
 * Suit un saut à partir de xTakeoff : vol = FLIGHT_STEPS pas consécutifs sans aucun contact ;
 * contact = premier pas où une partie touche le sol après le début du vol ; atterrissage =
 * premier pas où les deux roues ont touché le sol (depuis le début du vol) dans la fenêtre.
 */
export class JumpTracker {
  private streak = 0;
  private lastWheelContact = [-Infinity, -Infinity];
  flightStart = 0;
  touchStep = 0;
  landStep = 0;

  constructor(private readonly xTakeoff: number) {}

  /** À appeler à chaque pas i (1, 2, …). */
  update(i: number, s: StepState): void {
    s.wheels.forEach((on, k) => { if (on) this.lastWheelContact[k] = i; });
    if (this.landStep) return;
    if (!this.flightStart) {
      if (s.x < this.xTakeoff) return;
      this.streak = s.wheels[0] || s.wheels[1] || s.chassis ? 0 : this.streak + 1;
      if (this.streak >= FLIGHT_STEPS) this.flightStart = i - this.streak + 1;
      return;
    }
    if (!this.touchStep && (s.wheels[0] || s.wheels[1] || s.chassis)) this.touchStep = i;
    if (this.lastWheelContact.every((t) => t >= this.flightStart && t > i - BOTH_WHEELS_WINDOW)) this.landStep = i;
  }
}

export interface RunOptions {
  /** Doigt posé à l'instant t (s depuis le départ du run), x = châssis au début du pas (m). */
  throttle: (t: number, x: number) => boolean;
  /** Turbo (TURBO_FACTOR pendant TURBO_SECONDS) lancé au premier pas où x ≥ turboAt. */
  turboAt?: number;
  /** Turbo pendant tout le run (facteur TURBO_FACTOR), comme une suite d'étoiles sans trou. */
  turboPermanent?: boolean;
  /**
   * Choc simulé : à chaque pas tant que x < `x`, le vecteur vitesse de chaque partie est ramené à la
   * norme `v` m/s (Body.setVelocity, direction conservée). La rotation des roues n'est pas touchée :
   * un choc ne coupe pas le moteur, les roues patinent et la voiture repart au frottement (mesure du
   * cas 4 avec roues aussi bridées, tâche 4, pied d'avant le congé : 10,26 m/s au sommet, passe le volcan
   * mais sous la marge +1 m/s).
   * `wheels: true` bride aussi la rotation des roues au roulement à `v` (sonde de bissection : sans
   * cela, la roue arrière à plein régime pousse encore sur l'arête après la lecture au sommet et la
   * vitesse réelle de décollage dépasse chaotiquement la vitesse lue, jusqu'à +0,3 m/s).
   */
  speedCapUntil?: { x: number; v: number; wheels?: boolean };
  /** Arrêter le run dès la lecture de `lipSpeed` (mesure seule, pas d'issue). */
  stopAtLip?: boolean;
  /** Lancée initiale (m/s, `launch` le long de la pente locale) ; départ arrêté par défaut. */
  launchSpeed?: number;
  /** Volcan visé (xRampStart, xLip, xReception) ; par défaut le premier dont la lave est devant x0. */
  volcano?: Volcano;
  maxSeconds: number;
  /** Configuration de la voiture (celle de la piste du monde) ; CONFIG par défaut. */
  cfg?: Config;
  /** Observateur appelé à chaque pas i (1, 2, …), après le pas physique et avant la lecture de l'issue. */
  onStep?: (i: number, s: StepState, car: CarBody) => void;
}

export interface RunResult {
  /** Une partie de la voiture a touché un capteur de lave (le run s'arrête là). */
  lava: boolean;
  /** x du châssis au premier atterrissage deux roues après le sommet du volcan visé, null sinon. */
  landX: number | null;
  /** Angle du châssis (rad) à cet atterrissage, NaN sans atterrissage. */
  landAngle: number;
  /** |angle| > FLIP_ANGLE à un pas quelconque du run. */
  flipped: boolean;
  /** Fin du run : chaque roue sous l'axe du châssis. */
  wheelsBelow: boolean;
  /** Plus long blocage (s) doigt posé sans avancer de STUCK_DISTANCE (même cliquet que simulateRace). */
  maxStuck: number;
  /** Vitesse (m/s) au premier pas où le châssis passe xLip du volcan visé, null si jamais atteint. */
  lipSpeed: number | null;
  /**
   * Vitesse (m/s) au premier pas où le châssis passe xRampStart (pied nominal de la rampe), null sinon.
   * Avec le congé (tâche 5c), ce point est sur la courbe, ≈ 0,19 m plus haut, 1,94 m après son début.
   */
  rampSpeed: number | null;
  /** Durée du run (s). */
  seconds: number;
}

/**
 * Voiture neuve à l'arrêt en x0 (ou lancée à `launchSpeed`), conduite selon `throttle(t)` vers le premier volcan dont la lave
 * est devant x0 (`volcanoAhead`), jusqu'à la lave, 1 s après l'atterrissage deux roues sur le plat
 * de réception (x ≥ xReception), ou maxSeconds. Un atterrissage avant la réception (vallée, flanc)
 * est enregistré mais ne termine pas le run : la lave ou le temps tranchent.
 */
export function runFrom(world: World, x0: number, opts: RunOptions): RunResult {
  const cfg = opts.cfg ?? CONFIG;
  const v = opts.volcano ?? volcanoAhead(world.track, x0);
  const car = freshCar(world, x0, cfg);
  if (opts.launchSpeed !== undefined) launch(world, car, x0, opts.launchSpeed, cfg);
  const contact = newContact();
  const jump = v ? new JumpTracker(v.xLip) : null;
  const run: RunResult = {
    lava: false, landX: null, landAngle: NaN, flipped: false, wheelsBelow: false, maxStuck: 0, lipSpeed: null,
    rampSpeed: null, seconds: 0,
  };
  const dt = cfg.PHYSICS_DT;
  const maxSteps = Math.round(opts.maxSeconds / dt);
  const capV = opts.speedCapUntil ? mpsToPxPerStep(opts.speedCapUntil.v) : 0;
  const capOmega = capV / toPx(cfg.WHEEL_RADIUS);
  let turboUntil = opts.turboPermanent ? Infinity : -Infinity;
  let turboArmed = opts.turboAt !== undefined;
  let stuckRef = x0;
  let stuckStart: number | null = null;
  let landedAt: number | null = null;
  let x = x0;
  for (let i = 1; i <= maxSteps; i++) {
    const t = (i - 1) * dt;
    const throttle = opts.throttle(t, x);
    const factor = t < turboUntil ? cfg.TURBO_FACTOR : 1;
    const s = step(world, car, throttle, factor, contact, t, cfg);
    x = s.x;
    run.seconds = i * dt;
    if (opts.speedCapUntil && s.x < opts.speedCapUntil.x) {
      for (const p of car.parts) {
        const n = Math.hypot(p.velocity.x, p.velocity.y);
        if (n > capV) Body.setVelocity(p, { x: (p.velocity.x * capV) / n, y: (p.velocity.y * capV) / n });
      }
      if (opts.speedCapUntil.wheels) {
        for (const w of car.wheels) if (w.angularVelocity > capOmega) Body.setAngularVelocity(w, capOmega);
      }
    }
    opts.onStep?.(i, s, car);
    if (turboArmed && s.x >= opts.turboAt!) { turboUntil = t + cfg.TURBO_SECONDS; turboArmed = false; }
    if (v && run.rampSpeed === null && s.x >= v.xRampStart) run.rampSpeed = carSpeedMps(car);
    if (v && run.lipSpeed === null && s.x >= v.xLip) {
      run.lipSpeed = carSpeedMps(car);
      if (opts.stopAtLip) break;
    }
    const angle = carAngle(car);
    if (Math.abs(angle) > cfg.FLIP_ANGLE) run.flipped = true;
    if (!throttle || s.x - stuckRef >= cfg.STUCK_DISTANCE) {
      stuckRef = s.x;
      stuckStart = null;
    } else {
      stuckStart ??= t;
      run.maxStuck = Math.max(run.maxStuck, t - stuckStart);
    }
    if (s.lava) { run.lava = true; break; }
    if (jump && v) {
      jump.update(i, s);
      if (jump.landStep === i) {
        run.landX = s.x;
        run.landAngle = angle;
        if (s.x >= v.xReception) landedAt = i;
      }
    }
    if (landedAt !== null && i - landedAt >= AFTER_LANDING_SECONDS * STEPS_PER_SECOND) break;
  }
  run.wheelsBelow = wheelsBelowChassis(car);
  return run;
}

/**
 * Motif « doigt levé p du temps » (cas 7 de l'addendum §1.7) : tranches de 1 s, levé quand
 * `mulberry32(seed)() < p` pour la tranche ; déterministe, graine du motif = graine de piste.
 */
export function liftedPattern(seed: number, p: number): (t: number) => boolean {
  const rng = mulberry32(seed);
  const lifted: boolean[] = [];
  return (t: number): boolean => {
    const k = Math.max(0, Math.floor(t));
    while (lifted.length <= k) lifted.push(rng() < p);
    return !lifted[k];
  };
}

/** Pire point sûr : 1 cm avant la zone interdite [xLancement + SAFE_LANCEMENT_MARGIN, xReception[ (addendum §1.6). */
export const worstSafePoint = (v: Volcano, cfg: Config = CONFIG): number => forbiddenZone(v, cfg)[0] - 0.01;

/** Réapparitions d'une course simulée, lisibles dans un message d'assertion. */
export const describeRespawns = (rs: SimEvent[]): string[] =>
  rs.map((e) => (e.type === 'respawn' ? `${e.reason}@t=${e.t.toFixed(1)} x=${e.x.toFixed(1)}→${e.target.x.toFixed(1)}` : e.type));

export const f1 = (n: number | null): string => (n === null ? 'null' : Number.isFinite(n) ? n.toFixed(1) : '—');
export const f2 = (n: number | null): string => (n === null ? 'null' : Number.isFinite(n) ? n.toFixed(2) : '—');

/** Résumé d'un run pour les messages d'assertion. */
export function describeRun(seed: number, v: Volcano, name: string, r: RunResult): string {
  return `seed ${seed}, volcan en x = ${f1(v.xLancement)}, ${name} : pied de rampe ${f2(r.rampSpeed)}, sommet ${f2(r.lipSpeed)} m/s, `
    + `lave ${r.lava}, atterrissage ${f1(r.landX)} à ${f1(r.landAngle / DEG)}°, retournée ${r.flipped}, `
    + `blocage ${f2(r.maxStuck)} s, ${f1(r.seconds)} s (lave ${f1(v.xLava)}, réception [${f1(v.xReception)} ; ${f1(v.xEnd)}])`;
}
