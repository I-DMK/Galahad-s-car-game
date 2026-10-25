// Volcans sous élastique (plan B, tâche 7, Step 4 ; Review Focus n° 1 et n° 3 de la tâche, addendum §1.8, spec §7) :
// un copain sous le VRAI élastique (`stepRace` : `stepRubber`, `finalFactor`, plafond et couple), forcé par son
// `rubber` (posé, ou tenu pas à pas) et par la position de Galahad, garé loin devant (cible 1,3) ou loin derrière
// (cible 0,6, plafond « ≤ 1 hors écran devant »). Course à deux voitures dans un monde rogné (≈ 15 fois plus rapide que
// le monde complet, phases.ts) : les trois autres copains, garés derrière la grille dans le protocole du brief, n'y
// toucheraient rien ; ils ne sont pas créés. Neutre de départ coupé (RUBBER_NEUTRAL_SECONDS 0) : l'élastique agit dès
// le premier pas. Familles : Review Focus n° 3 (copain freiné à 0,6), tremplins à 1,3 (pire point sûr, arrêt en − 30,
// lancée à 18,2 m/s), marche 1,3 → 1,0 au pied (fin de turbo), fosses à 1,3 (saut centré, saut le plus tardif permis),
// plats étoile à 1,3 sans saut, départ à 0,6 au pied d'une bosse ou d'une rampe-saut.
import Matter from 'matter-js';
import type { Driver, DriverContext } from '../../src/ai/driver';
import { fosseJumpLead, fosseJumpWanted, fosseLatestLead } from '../../src/cars/jump';
import { PILOTS, GALAHAD, type Pilot } from '../../src/cars/pilots';
import { forbiddenZone } from '../../src/cars/safepoint';
import { newStarStates } from '../../src/cars/stars';
import { newCarState } from '../../src/cars/state';
import { CONFIG, type Config } from '../../src/config';
import { carAngle, carSpeedMps, createCar, newGroundContact, placeCar } from '../../src/physics/car';
import { createStarBodies } from '../../src/physics/stars';
import { physToWorld, toM } from '../../src/physics/units';
import { createWorld, type World } from '../../src/physics/world';
import { chassisX, stepRace, type CarSim, type RaceSim } from '../../src/sim/simulate';
import { heightAt, inVolcanoZone, slopeAt } from '../../src/track/query';
import type { Star, Track, Volcano } from '../../src/track/types';
import { setCarSpeed } from './jump-runs';

const { Composite } = Matter;

/** Configuration des scénarios forcés : neutre de départ coupé, tout le reste de CONFIG. */
export const FORCED: Config = { ...CONFIG, RUBBER_NEUTRAL_SECONDS: 0 };
export const DT = CONFIG.PHYSICS_DT;
/** Garde minimale exigée au-dessus du capteur de lave d'un tremplin (seuil de la 5c, MIN_CLEARANCE de phases.ts). */
export const MIN_GUARD = 0.3;
/** Vitesse au sommet exigée d'un copain freiné qui aborde un tremplin (LIP_SPEED_THRESHOLD + 1, runs.ts). */
export const LIP_MIN = CONFIG.V_JUMP + 1;
/** Pilote du copain des scénarios physiques (sa `base` ne joue pas : cibles forcées). */
export const COPAIN: Pilot = PILOTS[0];

const hex = (n: number): string => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
const SIDE_MARGIN = 40;

/** Monde de la piste réduit aux corps statiques qui touchent [x0, x1] (même principe que `croppedWorld` de phases.ts). */
export function cropped(track: Track, cfg: Config, x0: number, x1: number): World {
  const world = createWorld(track, cfg);
  const ppm = cfg.PIXELS_PER_METER;
  const far = new Set([...world.ground, ...world.lava, world.wall].filter((b) => b.bounds.max.x < x0 * ppm || b.bounds.min.x > x1 * ppm));
  world.engine.world.bodies = world.engine.world.bodies.filter((b) => !far.has(b));
  (Matter.Composite as unknown as { setModified(c: Matter.Composite, m: boolean, p: boolean, ch: boolean): void })
    .setModified(world.engine.world, true, true, false);
  return world;
}

/** m : les bornes du monde rogné sont arrondies à ce pas (vers l'extérieur) : les phases d'un même cas partagent un monde. */
const CROP_STEP = 50;
const worlds = new Map<string, World>();
/**
 * Monde rogné mis en cache (les voitures et les capteurs d'étoile sont retirés après chaque run), bornes arrondies à
 * CROP_STEP. `clearWorlds` vide le cache (après chaque famille : un monde complet par clé, sinon la mémoire déborde).
 */
function worldFor(track: Track, x0: number, x1: number): World {
  const lo = Math.floor(x0 / CROP_STEP) * CROP_STEP;
  const hi = Math.ceil(x1 / CROP_STEP) * CROP_STEP;
  const key = `${track.seed}:${lo}:${hi}`;
  let w = worlds.get(key);
  if (!w) {
    // Un monde rogné garde ses tableaux de corps complets (World.ground, lava) : au plus 24 en mémoire.
    if (worlds.size >= 24) worlds.clear();
    w = cropped(track, CONFIG, lo, hi);
    worlds.set(key, w);
  }
  return w;
}
export function clearWorlds(): void {
  worlds.clear();
}

/** Voiture posée à l'arrêt en x (index de grille `index` : catégorie de collision). */
function carAt(world: World, pilot: Pilot, index: number, x: number, cfg: Config): CarSim {
  const track = world.track;
  const body = createCar(world, pilot.id, index, x, cfg);
  placeCar(body, x, (u) => heightAt(track, u), slopeAt(track, x), cfg);
  const state = newCarState(pilot.id, pilot.name, hex(pilot.color), hex(pilot.accent), { x, y: heightAt(track, x), angle: 0 });
  return {
    pilot, body, state, contact: newGroundContact(), airborneSince: null, grounded: false, lastGroundedAt: null,
    jumpFlight: false, invulnerable: false, ghost: false, driver: null, autoJumps: index !== 0,
    lavaFalls: track.volcanoes.map(() => 0), factor: 1, throttle: false, started: false,
    rubber: index === 0 ? null : 1, speedFactor: 1, torqueFactor: 1, onScreen: false,
  };
}

/**
 * Course à deux voitures : Galahad garé en xG (index 0, sans élastique), le copain en xC (index 1, sous élastique). La
 * piste de la course ne garde que les étoiles `stars` (capteurs, états et contexte du driver alignés sur elles), sans
 * rocher (tâche 11c).
 */
export function duoSim(world: World, xG: number, xC: number, stars: Star[], driver: Driver, cfg: Config = FORCED): RaceSim {
  const g = carAt(world, GALAHAD, 0, xG, cfg);
  const c = carAt(world, COPAIN, 1, xC, cfg);
  c.driver = driver;
  const starBodies = createStarBodies(world, stars, cfg);
  // Sans rocher (tâche 11c) : la course ne garde que les étoiles données ; piste, états et capteurs alignés.
  const track: Track = { ...world.track, stars, rocks: [] };
  return {
    track, world, cars: [g, c], time: 0, events: [], stars: newStarStates(stars, 2), starBodies, rocks: [], rockBodies: [], cfg,
    pilotSeed: 0,
  };
}

export function disposeDuo(sim: RaceSim): void {
  for (const c of sim.cars) Composite.remove(sim.world.engine.world, c.body.composite);
  for (const b of sim.starBodies) Composite.remove(sim.world.engine.world, b);
}

/** Copain doigt posé, sans saut. */
export const POSE: Driver = () => ({ throttle: true, jump: false });

/**
 * Copain doigt posé qui saute aux fosses par la formule des copains (`fosseJumpWanted`, erreur `error(v)` en s) :
 * 0 = saut centré ; `latestError` = le saut le plus tardif permis (règle du tour 2 de la tâche 6).
 */
export const fosseDriver = (track: Track, error: (v: number) => number, cfg: Config = FORCED): Driver =>
  (ctx) => ({ throttle: true, jump: fosseJumpWanted(track, ctx.x, ctx.speed, cfg, error(ctx.speed)) });
/** Erreur du saut le plus tardif permis à la vitesse v : visée = fosseLatestLead(v) (+ 1e-9, pas de bascule). */
export const latestError = (v: number, cfg: Config = FORCED): number => fosseLatestLead(v, cfg) - fosseJumpLead(v, cfg) + 1e-9;

/** Mesures d'un run. */
export interface ElasticRun {
  /** Réapparitions du copain (raisons). */
  respawns: string[];
  lava: number;
  /** Facteur appliqué minimal et élastique minimal aux pas dont le x de départ est dans [xLancement, xLava]. */
  minZoneFactor: number; minZoneRubber: number; zoneSteps: number;
  /** Facteur appliqué au premier pas. */
  firstFactor: number;
  /** Facteur appliqué au pas du saut (null sans saut). */
  jumpFactor: number | null;
  /** Vitesse (m/s) du copain aux marques (premier pas où x ≥ la marque). */
  speedAt: Record<string, number>;
  /** Vitesse maximale du châssis, vx maximale. */
  maxSpeed: number; maxVx: number;
  /** Premier atterrissage après `xLandAfter` : x du châssis ; null sans atterrissage. */
  landX: number | null;
  /** Saut du copain : x du châssis et vitesse ; null sans saut. */
  jumpX: number | null; jumpSpeed: number | null;
  /** Garde minimale au-dessus du capteur de lave (`lava`), Infinity si rien n'est passé au-dessus. */
  guard: number;
  /** |angle| maximal du châssis après l'atterrissage, retournement (> FLIP_ANGLE). */
  maxAngleAfter: number; flipped: boolean;
  /** Étoiles prises par le copain ; plus haut point du châssis au-dessus du sol dans `topRange`. */
  starsTaken: number; topMax: number;
  /** Facteur appliqué maximal, et maximal hors des zones [xLancement, xLava] (où le clamp le relève à 1). */
  maxFactor: number;
  maxFactorOutZone: number;
  /** Pas de demande de saut (driver) faits en l'air au-delà de la tolérance de sol : le saut ne pouvait pas partir. */
  lateAirborne: boolean;
  seconds: number;
}

export interface ElasticRunOptions {
  track: Track;
  /** Départ du copain, sa lancée (m/s, le long de la pente ; 0 = arrêté) et son élastique au départ. */
  x0: number; v0: number; rubber0: number;
  /** Galahad garé en xG. */
  xG: number;
  /** Arrêt quand le châssis dépasse xStop, au plus maxSeconds ; atterrissage compté après xLandAfter. */
  xStop: number; maxSeconds: number; xLandAfter: number;
  driver?: Driver;
  stars?: Star[];
  /** Élastique tenu à cette valeur avant chaque pas (copain forcé par `rubber`), ou laissé à l'élastique (undefined). */
  holdRubber?: (x: number) => number | undefined;
  /** Turbo actif dès le départ, jusqu'au premier pas où le châssis passe ce x (fin du turbo), ou tout du long (Infinity). */
  turboUntilX?: number;
  /** Volcan observé (zone [xLancement, xLava] et capteur de lave pour la garde). */
  volcano?: Volcano;
  marks?: Record<string, number>;
  topRange?: [number, number];
  /** Arrêt 3 s après l'atterrissage qui suit xLandAfter. */
  stopAfterLanding?: boolean;
}

/** Joue un run (voir le module) et le mesure. Monde rogné en cache ; voitures retirées à la fin. */
export function elasticRun(o: ElasticRunOptions): ElasticRun {
  const { track } = o;
  const lo = Math.min(o.x0, o.xG) - SIDE_MARGIN;
  const hi = Math.max(o.xStop, o.xG) + SIDE_MARGIN;
  const world = worldFor(track, lo, hi);
  const sim = duoSim(world, o.xG, o.x0, o.stars ?? [], o.driver ?? POSE);
  const c = sim.cars[1];
  if (o.v0 > 0) setCarSpeed(c, track, o.x0, o.v0, FORCED);
  c.rubber = o.rubber0;
  if (o.turboUntilX !== undefined) c.state.turboUntil = Infinity;
  const r: ElasticRun = {
    respawns: [], lava: 0, minZoneFactor: Infinity, minZoneRubber: Infinity, zoneSteps: 0, firstFactor: NaN, jumpFactor: null,
    speedAt: {}, maxSpeed: 0, maxVx: 0, landX: null, jumpX: null, jumpSpeed: null, guard: Infinity, maxAngleAfter: 0,
    flipped: false, starsTaken: 0, topMax: -Infinity, maxFactor: 0, maxFactorOutZone: 0, lateAirborne: false, seconds: 0,
  };
  const v = o.volcano;
  const R = FORCED.WHEEL_RADIUS;
  const sensor = v ? { x0: v.xLava - v.lavaWidth / 2, x1: v.xLava + v.lavaWidth / 2, top: v.rimY + FORCED.LAVA_SENSOR_ABOVE_RIM } : null;
  const guardFrom = v ? (v.kind === 'tremplin' ? v.xLip : v.xLancement) : Infinity;
  let landT: number | null = null;
  const steps = Math.round(o.maxSeconds / DT);
  for (let i = 0; i < steps; i++) {
    const x = chassisX(c);
    const speed = carSpeedMps(c.body);
    if (o.marks) for (const [k, mx] of Object.entries(o.marks)) if (x >= mx && r.speedAt[k] === undefined) r.speedAt[k] = speed;
    if (o.turboUntilX !== undefined && x >= o.turboUntilX && c.state.turboUntil > sim.time) c.state.turboUntil = sim.time;
    const held = o.holdRubber?.(x);
    if (held !== undefined) c.rubber = held;
    const wanted = c.driver ? c.driver({ ...ctxOf(sim, x, speed) }).jump : false;
    const grace = c.lastGroundedAt === null || sim.time - c.lastGroundedAt > FORCED.JUMP_GROUND_GRACE;
    stepRace(sim, false);
    if (wanted && grace && r.jumpX === null) r.lateAirborne = true;
    if (i === 0) r.firstFactor = c.speedFactor;
    r.maxFactor = Math.max(r.maxFactor, c.speedFactor);
    if (!inVolcanoZone(track, x)) r.maxFactorOutZone = Math.max(r.maxFactorOutZone, c.speedFactor);
    if (v && x >= v.xLancement && x <= v.xLava) {
      r.zoneSteps++;
      r.minZoneFactor = Math.min(r.minZoneFactor, c.speedFactor);
      r.minZoneRubber = Math.min(r.minZoneRubber, c.rubber ?? NaN);
    }
    const p = physToWorld(c.body.chassis.position);
    r.maxSpeed = Math.max(r.maxSpeed, carSpeedMps(c.body));
    r.maxVx = Math.max(r.maxVx, toM(c.body.chassis.velocity.x) / DT);
    if (sensor && p.x >= guardFrom) {
      for (const w of c.body.wheels) {
        const q = physToWorld(w.position);
        if (q.x + R >= sensor.x0 && q.x - R <= sensor.x1) r.guard = Math.min(r.guard, q.y - R - sensor.top);
      }
      let cx0 = Infinity; let cx1 = -Infinity; let cy = Infinity;
      for (const q of c.body.chassis.vertices) {
        const w = physToWorld(q);
        cx0 = Math.min(cx0, w.x); cx1 = Math.max(cx1, w.x); cy = Math.min(cy, w.y);
      }
      if (cx1 >= sensor.x0 && cx0 <= sensor.x1) r.guard = Math.min(r.guard, cy - sensor.top);
    }
    if (o.topRange && p.x >= o.topRange[0] && p.x <= o.topRange[1]) {
      for (const q of c.body.chassis.vertices) { const w = physToWorld(q); r.topMax = Math.max(r.topMax, w.y - heightAt(track, w.x)); }
    }
    for (const e of sim.events) {
      if (e.carId !== c.state.id) continue;
      if (e.type === 'respawn') { r.respawns.push(e.reason); if (e.reason === 'lava') r.lava++; }
      if (e.type === 'star') r.starsTaken++;
      if (e.type === 'jump') { r.jumpX = e.x; r.jumpSpeed = speed; r.jumpFactor = c.speedFactor; }
      if (e.type === 'landing' && r.landX === null && e.x > o.xLandAfter) { r.landX = e.x; landT = sim.time; }
    }
    if (landT !== null) {
      const a = Math.abs(carAngle(c.body));
      r.maxAngleAfter = Math.max(r.maxAngleAfter, a);
      if (a > FORCED.FLIP_ANGLE) r.flipped = true;
    }
    r.seconds = sim.time;
    if (r.respawns.length > 0) break;
    if (o.stopAfterLanding !== false && landT !== null && sim.time > landT + 3) break;
    if (p.x > o.xStop) break;
  }
  disposeDuo(sim);
  return r;
}

/**
 * Contexte minimal pour rejouer la demande de saut d'un driver de ce module (`fosseDriver`, `POSE`), qui ne lit que x et la
 * vitesse : sert à savoir si une demande tombe pendant un vol (au-delà de la tolérance de sol), sans effet sur la course.
 */
function ctxOf(sim: RaceSim, x: number, speed: number): DriverContext {
  return { t: sim.time, state: sim.cars[1].state, track: sim.track, speed, x, traversable: false, others: [], nextHighStar: null, nextFosse: null, nextRock: null };
}

/** Pire point sûr d'un volcan : 1 cm avant sa zone interdite (comme `worstSafePoint` de runs.ts). */
export const worstSafe = (v: Volcano): number => forbiddenZone(v, CONFIG)[0] - 0.01;

/** Galahad garé loin devant (cible 1,3 : écart < −43 m tout du long) ou loin derrière (cible 0,6, hors écran devant). */
export const AHEAD = 120;
export const BEHIND = 150;

export const f1 = (n: number | null | undefined): string => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(1));
export const f2 = (n: number | null | undefined): string => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(2));
export const range = (xs: number[]): string => (xs.length ? `${f2(Math.min(...xs))} à ${f2(Math.max(...xs))}` : '—');
