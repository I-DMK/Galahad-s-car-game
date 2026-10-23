// Harnais de saut (plan B, tâche 5e, Step 6) : Galahad seul, lancé à v m/s dans un monde donné (souvent rogné,
// `croppedWorld` de tests/helpers/phases.ts), saut demandé à un pas donné, par le vrai pas de course `stepRace`
// (contact débouncé, saut, étoiles, réapparitions). Vitesse tenue doigt posé par le facteur de la voiture
// (`CarSim.factor` = v / V_MAX, comme l'élastique). Fenêtre de décollage d'une étoile haute par dichotomie
// de ses deux bords (`windowFor`), à partir de la fenêtre géométrique prédite sur le plat (`predictedWindow`).
import Matter from 'matter-js';
import { GALAHAD } from '../../src/cars/pilots';
import { newStarStates } from '../../src/cars/stars';
import { newCarState } from '../../src/cars/state';
import { activateTurbo } from '../../src/cars/turbo';
import { CONFIG, type Config } from '../../src/config';
import type { CarPose } from '../../src/loop/interpolation';
import { carAngle, createCar, newGroundContact, placeCar } from '../../src/physics/car';
import { createStarBodies } from '../../src/physics/stars';
import { mpsToPxPerStep, toPx } from '../../src/physics/units';
import { createWorld, type World } from '../../src/physics/world';
import { posesOf, stepRace, type CarSim, type RaceSim } from '../../src/sim/simulate';
import { generateTrack } from '../../src/track/generate';
import { heightAt, slopeAt } from '../../src/track/query';
import type { Star, Track } from '../../src/track/types';
import { poseClearance, SENSOR_MARGIN } from './recorded';

const { Body, Composite } = Matter;

/** s : suivi après l'atterrissage pour voir une réapparition (« respawn à l'atterrissage »). */
export const AFTER_LANDING_SECONDS = 3;
/** m : départ de la voiture lancée avant l'étoile visée (≥ 3 s de roulage à 14 m/s avant le saut). */
export const RUN_UP = 45;

const hex = (n: number): string => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;

/** Galahad seul posé à l'arrêt en x0 dans `world`, avec les capteurs des étoiles `stars` (ôtés par `disposeSolo`). */
export function soloSim(world: World, x0: number, stars: Star[], cfg: Config): RaceSim {
  const track = world.track;
  const body = createCar(world, GALAHAD.id, 0, x0, cfg);
  placeCar(body, x0, (x) => heightAt(track, x), slopeAt(track, x0), cfg);
  const state = newCarState(GALAHAD.id, GALAHAD.name, hex(GALAHAD.color), hex(GALAHAD.accent), { x: x0, y: heightAt(track, x0), angle: 0 });
  const car: CarSim = {
    pilot: GALAHAD, body, state, contact: newGroundContact(), airborneSince: null, grounded: false,
    lastGroundedAt: null, jumpFlight: false, invulnerable: false, ghost: false, driver: null, autoJumps: false,
    lavaFalls: track.volcanoes.map(() => 0), factor: 1, throttle: false,
  };
  const starBodies = createStarBodies(world, stars, cfg);
  return { track, world, cars: [car], time: 0, events: [], stars: newStarStates(stars, 1), starBodies, cfg, pilotSeed: 0 };
}

export function disposeSolo(sim: RaceSim): void {
  Composite.remove(sim.world.engine.world, sim.cars[0].body.composite);
  for (const b of sim.starBodies) Composite.remove(sim.world.engine.world, b);
}

/**
 * Toutes les pièces à v m/s le long de la pente locale, roues en roulement sans glissement ; vitesse tenue doigt posé
 * par le facteur de la voiture (`factor`, défaut v / V_MAX, ou 1 pour un départ arrêté).
 */
export function launchSolo(sim: RaceSim, x: number, v: number, cfg: Config, factor?: number): void {
  const car = sim.cars[0];
  const a = slopeAt(sim.track, x);
  const vel = { x: mpsToPxPerStep(v * Math.cos(a)), y: -mpsToPxPerStep(v * Math.sin(a)) };
  for (const p of car.body.parts) Body.setVelocity(p, vel);
  for (const w of car.body.wheels) Body.setAngularVelocity(w, mpsToPxPerStep(v) / toPx(cfg.WHEEL_RADIUS));
  car.factor = factor ?? (v > 0 ? v / cfg.V_MAX : 1);
}

export interface JumpRunResult {
  /** Un événement 'jump' a eu lieu. */
  jumped: boolean;
  /** Ids des étoiles prises (événements 'star'). */
  starTaken: number[];
  /** Réapparition entre le saut et AFTER_LANDING_SECONDS après l'atterrissage qui le suit. */
  respawnWithin3s: boolean;
  /** Plus haut y du châssis après le saut (m), NaN sans saut. */
  apexY: number;
  /** Pose de Galahad après chaque pas. */
  trace: CarPose[];
  /** x du châssis au début de chaque pas. */
  xs: number[];
  /** Pas du saut, null sans saut. */
  jumpStep: number | null;
  /** Événement 'jump' : x du châssis et hauteur de la poussière (`y`), null sans saut. */
  jumpEvent: { x: number; y: number } | null;
  /**
   * Contact avec la piste (débouncé) de la voiture à chaque pas, tel que le pas l'a utilisé (`CarSim.grounded`) ;
   * Galahad seul : c'est aussi le contact de jeu.
   */
  grounded: boolean[];
  /** Réapparitions du run (raison, instant, x du châssis). */
  respawns: { reason: string; t: number; x: number }[];
  /** Premier atterrissage (événement 'landing') après le saut : x du châssis et angle (rad), null sans atterrissage. */
  landingX: number | null;
  landingAngle: number;
  /** |angle du châssis| a dépassé FLIP_ANGLE après le saut. */
  flippedAfterJump: boolean;
}

export interface JumpRunOptions {
  x0: number;
  /** Lancée (m/s) le long de la pente locale ; 0 = départ arrêté. */
  v: number;
  /** Pas où le saut est demandé (null : jamais). */
  jumpAtStep: number | null;
  maxSeconds: number;
  cfg?: Config;
  stars?: Star[];
  /** Facteur de vitesse tenu doigt posé (défaut v / V_MAX, ou 1 pour un départ arrêté) ; 1,5 = turbo permanent. */
  factor?: number;
  /** Turbo (TURBO_SECONDS) lancé au premier pas où le châssis passe ces x (une fois chacun). */
  turboAtX?: number[];
  /** Turbo lancé au premier pas où le temps du run atteint ces instants (s). */
  turboAtSeconds?: number[];
  /** Arrêt du run quand le châssis dépasse ce x (sans saut ; par défaut, aucun). */
  stopAtX?: number;
}

/**
 * Galahad seul lancé à `v` m/s en `x0` dans `world`, doigt posé, saut demandé au pas `jumpAtStep` (null :
 * jamais ; la demande vit JUMP_BUFFER comme en jeu). Capteurs des étoiles `stars`. S'arrête
 * AFTER_LANDING_SECONDS après l'atterrissage qui suit le saut, ou à `maxSeconds`.
 */
export function jumpRun(world: World, opts: JumpRunOptions): JumpRunResult {
  const cfg = opts.cfg ?? CONFIG;
  const sim = soloSim(world, opts.x0, opts.stars ?? [], cfg);
  try {
    launchSolo(sim, opts.x0, opts.v, cfg, opts.factor);
    const out: JumpRunResult = {
      jumped: false, starTaken: [], respawnWithin3s: false, apexY: NaN, trace: [], xs: [], jumpStep: null, jumpEvent: null,
      grounded: [], respawns: [], landingX: null, landingAngle: NaN, flippedAfterJump: false,
    };
    const car = sim.cars[0];
    const turboX = [...(opts.turboAtX ?? [])].sort((a, b) => a - b);
    const turboT = [...(opts.turboAtSeconds ?? [])].sort((a, b) => a - b);
    const dt = cfg.PHYSICS_DT;
    let stopAt = Infinity;
    for (let i = 0; i < Math.round(opts.maxSeconds / dt) && sim.time < stopAt - 1e-9; i++) {
      const x = car.state.progress;
      if (opts.stopAtX !== undefined && x > opts.stopAtX) break;
      while (turboX.length > 0 && x >= turboX[0]) { turboX.shift(); activateTurbo(car.state, sim.time, cfg); }
      while (turboT.length > 0 && sim.time >= turboT[0] - 1e-9) { turboT.shift(); activateTurbo(car.state, sim.time, cfg); }
      out.xs.push(x);
      stepRace(sim, true, i === opts.jumpAtStep);
      out.grounded.push(car.grounded);
      const pose = posesOf(sim)[0];
      out.trace.push(pose);
      for (const e of sim.events) {
        if (e.type === 'jump') { out.jumped = true; out.jumpStep = i; out.apexY = pose.chassis.y; out.jumpEvent = { x: e.x, y: e.y }; }
        else if (e.type === 'star') out.starTaken.push(e.id);
        else if (e.type === 'landing' && out.jumped && stopAt === Infinity) {
          stopAt = e.t + AFTER_LANDING_SECONDS;
          out.landingX = e.x;
          out.landingAngle = carAngle(car.body);
        } else if (e.type === 'respawn') {
          out.respawns.push({ reason: e.reason, t: e.t, x: e.x });
          if (out.jumped) out.respawnWithin3s = true;
        }
      }
      if (out.jumped) {
        out.apexY = Math.max(out.apexY, pose.chassis.y);
        if (Math.abs(carAngle(car.body)) > cfg.FLIP_ANGLE) out.flippedAfterJump = true;
      }
    }
    return out;
  } finally {
    disposeSolo(sim);
  }
}

/**
 * Dernier pas d'un run dont le contact de jeu est vrai avec le châssis au plus à `xMax` (décollage d'un sommet :
 * dernier contact avant le vol), −1 si aucun.
 */
export function lastGroundedBefore(r: JumpRunResult, xMax: number): number {
  let last = -1;
  r.grounded.forEach((g, i) => { if (g && r.xs[i] <= xMax) last = i; });
  return last;
}

/** Première rampe-saut (graines 0 à 19, `cfg`) précédée d'un plat d'au moins 20 m, sur sa piste sans étoile. */
export function rampSautTrack(cfg: Config = CONFIG): { track: Track; ramp: Track['slices'][number]; seed: number } {
  for (let seed = 0; seed < 20; seed++) {
    const t = generateTrack(seed, 1680, cfg);
    const i = t.slices.findIndex((s, k) => s.type === 'rampe-saut' && k > 1
      && t.slices[k - 1].type === 'plat' && t.slices[k - 1].xEnd - t.slices[k - 1].xStart >= 20);
    if (i >= 0) return { track: { ...t, stars: [] }, ramp: t.slices[i], seed };
  }
  throw new Error('aucune rampe-saut précédée d’un plat de 20 m');
}

const flatWorlds = new WeakMap<Config, World>();
/** Piste plate (tranches `plat` seulement) de 400 m sans étoile, monde mis en cache par objet de configuration. */
function flatWorld(cfg: Config): World {
  let w = flatWorlds.get(cfg);
  if (!w) {
    const track: Track = { ...generateTrack(3, 400, cfg, { onlyPlat: true }), stars: [] };
    w = createWorld(track, cfg);
    flatWorlds.set(cfg, w);
  }
  return w;
}

/**
 * Trajectoire d'un saut sur le plat à `v` m/s : Galahad lancé à v en x = 60 m, doigt posé, saut 2 s plus tard ;
 * poses du pas du saut (première pose : avant le saut) jusqu'au retour au sol, + 0,2 s. Sol à y = 0.
 */
export function flatJumpTrajectory(v: number, cfg: Config = CONFIG): CarPose[] {
  const jumpAt = Math.round(2 / cfg.PHYSICS_DT);
  const r = jumpRun(flatWorld(cfg), { x0: 60, v, jumpAtStep: jumpAt, maxSeconds: 6, cfg });
  if (r.jumpStep !== jumpAt) throw new Error(`flatJumpTrajectory : pas de saut au pas ${jumpAt} (v = ${v})`);
  const before = jumpAt > 0 ? r.trace[jumpAt - 1] : r.trace[0];
  // Retour au sol : premier pas après l'apogée où le châssis repasse à moins de 5 cm de sa hauteur au saut.
  let end = r.trace.length - 1;
  let rising = true;
  for (let i = jumpAt; i < r.trace.length; i++) {
    const y = r.trace[i].chassis.y;
    if (rising && i > jumpAt && y < r.trace[i - 1].chassis.y) rising = false;
    if (!rising && y <= before.chassis.y + 0.05) { end = Math.min(r.trace.length - 1, i + Math.round(0.2 / cfg.PHYSICS_DT)); break; }
  }
  return [before, ...r.trace.slice(jumpAt, end + 1)];
}

/**
 * Fenêtre géométrique prédite sur le plat : distances s (m, châssis au saut → étoile, positive si l'étoile est
 * devant) pour lesquelles la trajectoire `traj` (de `flatJumpTrajectory`), décalée, touche le capteur d'une
 * étoile à `height` m au-dessus du sol, à `margin` près ; balayage au cm. Vide : { sMin: NaN, sMax: NaN }.
 */
export function predictedWindow(
  traj: CarPose[], height: number, cfg: Config = CONFIG, margin = SENSOR_MARGIN,
): { sMin: number; sMax: number } {
  const x0 = traj[0].chassis.x;
  let sMin = NaN;
  let sMax = NaN;
  for (let s = -5; s <= 45; s += 0.01) {
    const star = { x: x0 + s, y: height };
    if (traj.some((p) => Math.abs(p.chassis.x - star.x) <= 3 && poseClearance(p, star, cfg) <= margin)) {
      if (Number.isNaN(sMin)) sMin = s;
      sMax = s;
    }
  }
  return { sMin, sMax };
}

export interface JumpWindow {
  /** Temps avant l'étoile (s) du premier et du dernier saut qui la prennent sans réapparition (start ≥ end). */
  start: number;
  end: number;
  /** Durée de la fenêtre (s) : nombre de pas de saut gagnants × PHYSICS_DT ; 0 si aucun. */
  seconds: number;
  /** Centre de la fenêtre en temps avant l'étoile (s) : futur JUMP_STAR_LEAD de la tâche 6. */
  centreLead: number;
  /** Runs simulés (pilote compris). */
  runs: number;
  /** Une réapparition a été vue sur au moins un saut qui prend l'étoile. */
  respawnSeen: boolean;
}

/**
 * Fenêtre de décollage réelle de l'étoile `star` à `v` m/s, dans `world` (qui doit couvrir
 * [star.x − RUN_UP, star.x + v × 9 s]) : un run pilote sans saut donne x au début de chaque pas ; le centre
 * prédit (`predictedWindow` sur la trajectoire plate `traj`) donne un pas gagnant, cherché à ± la largeur
 * prédite s'il ne l'est pas ; puis dichotomie de chaque bord (pas gagnant = 'jump' + 'star' de cette étoile
 * + aucune réapparition jusqu'à 3 s après l'atterrissage). Suppose l'ensemble des pas gagnants d'un seul tenant.
 */
export function windowFor(world: World, star: Star, v: number, cfg: Config = CONFIG, traj?: CarPose[]): JumpWindow {
  const dt = cfg.PHYSICS_DT;
  const flat = traj ?? flatJumpTrajectory(v, cfg);
  const height = star.y - heightAt(world.track, star.x);
  const pred = predictedWindow(flat, height, cfg);
  const x0 = star.x - RUN_UP;
  const maxSeconds = RUN_UP / v + 9;
  let runs = 0;
  let respawnSeen = false;
  const pilot = jumpRun(world, { x0, v, jumpAtStep: null, maxSeconds: RUN_UP / v + 1, cfg, stars: [star] });
  runs++;
  const xs = pilot.xs;
  const stepAt = (s: number): number => {
    const i = xs.findIndex((x) => x >= star.x - s);
    return i < 0 ? xs.length - 1 : i;
  };
  const passStep = stepAt(0);
  const memo = new Map<number, boolean>();
  const good = (k: number): boolean => {
    if (k < 1) return false;
    let g = memo.get(k);
    if (g === undefined) {
      const r = jumpRun(world, { x0, v, jumpAtStep: k, maxSeconds, cfg, stars: [star] });
      runs++;
      const taken = r.jumped && r.starTaken.includes(star.id);
      if (taken && r.respawnWithin3s) respawnSeen = true;
      g = taken && !r.respawnWithin3s;
      memo.set(k, g);
    }
    return g;
  };
  const empty = (): JumpWindow => ({ start: NaN, end: NaN, seconds: 0, centreLead: NaN, runs, respawnSeen });
  // Fenêtre prédite vide : centre au temps avant l'étoile de l'apogée (≈ 1 s), recherche limitée à ± 12 pas.
  const predicted = !Number.isNaN(pred.sMin);
  const halfSteps = predicted ? Math.ceil((pred.sMax - pred.sMin) / 2 / (v * dt)) + 3 : 6;
  let centre = predicted ? stepAt((pred.sMin + pred.sMax) / 2) : stepAt(v);
  if (!good(centre)) {
    let found: number | null = null;
    for (let d = 1; d <= halfSteps + 6 && found === null; d++) {
      if (good(centre - d)) found = centre - d;
      else if (good(centre + d)) found = centre + d;
    }
    if (found === null) return empty();
    centre = found;
  }
  // Bord gauche : premier pas gagnant ; `lo` perdant, `hi` gagnant.
  let lo = centre - 2 * halfSteps;
  while (good(lo) && lo > 1) lo -= halfSteps;
  let hi = centre;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (good(mid)) hi = mid; else lo = mid;
  }
  const first = hi;
  // Bord droit : dernier pas gagnant ; `lo2` gagnant, `hi2` perdant.
  let hi2 = centre + 2 * halfSteps;
  while (good(hi2)) hi2 += halfSteps;
  let lo2 = centre;
  while (hi2 - lo2 > 1) {
    const mid = (lo2 + hi2) >> 1;
    if (good(mid)) lo2 = mid; else hi2 = mid;
  }
  const last = lo2;
  const start = (passStep - first) * dt;
  const end = (passStep - last) * dt;
  return { start, end, seconds: (last - first + 1) * dt, centreLead: (start + end) / 2, runs, respawnSeen };
}
