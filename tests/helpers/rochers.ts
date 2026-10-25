// Harnais des rochers (plan C, tâche 11c ; spec « rochers » §2 et §6 « Physique »), sur le modèle des fosses
// (`tests/helpers/fosses.ts`) : piste plate de 700 m à rochers choisis (`rockWorld`), run de Galahad seul par le vrai
// `stepRace` (`rockRun` : contact débouncé, tolérance de sol, saut, capteur du rocher, choc, réapparitions), fenêtre de
// saut balayée pas à pas (`rockWindow`, suite lente) et bloc central de 0,4 s autour de l'instant visé par les copains
// (`rockBlock`, CI).
import { rockJumpLead, rockJumpWanted } from '../../src/cars/jump';
import { activateTurbo } from '../../src/cars/turbo';
import { CONFIG, type Config } from '../../src/config';
import { carAngle, carSpeedMps } from '../../src/physics/car';
import { physToWorld } from '../../src/physics/units';
import { createWorld, type World } from '../../src/physics/world';
import { chassisX, GALAHAD_INDEX, stepRace, type RaceSim } from '../../src/sim/simulate';
import { generateTrack } from '../../src/track/generate';
import { heightAt } from '../../src/track/query';
import type { Rock, Track } from '../../src/track/types';
import { disposeSolo, launchSolo, soloSim } from './jump-runs';

/** x (m) du rocher par défaut de la piste plate. */
export const ROCK_X = 250;
/** s : suivi après l'atterrissage qui suit le saut (« passe » = aucun choc ni réapparition jusque-là). */
export const AFTER_LANDING_SECONDS = 3;
/** s : suivi après un choc (réapparition éventuelle). */
export const AFTER_HIT_SECONDS = 5;
/** s : balayage des fenêtres, chaque pas des 2 s qui précèdent le choc du témoin (suite lente). */
export const WINDOW_SWEEP_SECONDS = 2;
/** Pas de part et d'autre de k* du bloc central de la CI : 25 appuis, 0,4 s. */
export const BLOCK_HALF_STEPS = 12;

/** Centre de la fenêtre d'un rocher en s avant xStart (spec §2.2) : `rockJumpLead` (Partie 3). */
export const localRockLead = (v: number, cfg: Config = CONFIG): number => rockJumpLead(v, cfg);

/** Piste plate de 700 m (graine 3, tranches `plat` seulement), sans étoile, avec les rochers aux `xs` donnés (ids 0, 1…). */
export function rockTrack(xs: readonly number[], cfg: Config = CONFIG): Track {
  const rocks: Rock[] = xs.map((xStart, id) => ({ id, xStart, xEnd: xStart + cfg.ROCK_WIDTH }));
  return { ...generateTrack(3, 700, cfg, { onlyPlat: true }), stars: [], rocks };
}

const worlds = new Map<string, World>();
/**
 * Piste plate de 700 m (`generateTrack(3, 700, cfg, { onlyPlat: true })`), étoiles retirées, rochers du générateur
 * remplacés par un rocher en xStart = ROCK_X, ou par `rocks` donnés (`rocks: []` : aucun, témoin) ; monde créé par
 * `createWorld`, mis en cache (les capteurs des rochers sont posés par `soloSim` à chaque run et ôtés après). `rock` :
 * le premier rocher de la piste ; sans rocher, celui qu'il y aurait en ROCK_X (référence des x du témoin, hors piste).
 */
export function rockWorld(opts: { rocks?: { xStart: number }[]; cfg?: Config } = {}): { world: World; rock: Rock } {
  const cfg = opts.cfg ?? CONFIG;
  const xs = (opts.rocks ?? [{ xStart: ROCK_X }]).map((r) => r.xStart);
  const key = `${xs.join(',')}|${cfg === CONFIG ? 'CONFIG' : JSON.stringify(cfg)}`;
  let world = worlds.get(key);
  if (!world) {
    world = createWorld(rockTrack(xs, cfg), cfg);
    worlds.set(key, world);
  }
  const rock = world.track.rocks[0] ?? { id: 0, xStart: ROCK_X, xEnd: ROCK_X + cfg.ROCK_WIDTH };
  return { world, rock };
}

export interface RockRunOptions {
  x0: number;
  /** Lancée (m/s, tenue doigt posé par le facteur de la voiture, comme `jumpRun`) ou départ arrêté. */
  v: number | 'arrêt';
  /** Appui de saut au pas k (une fois), ou jamais (null). */
  pressAtStep: number | null;
  /** Turbo (TURBO_SECONDS) lancé au premier pas où le châssis passe ce x. */
  turboAtX?: number;
  /** Durée maximale (s), défaut 14. */
  maxSeconds?: number;
  /** Suivi après un choc (s), défaut AFTER_HIT_SECONDS. */
  afterHitSeconds?: number;
  /** Garde x et vitesse de chaque pas (sinon seulement x, pour `tAt`). */
  trace?: boolean;
  cfg?: Config;
}

export interface RockRunResult {
  /** Au moins un événement 'rock' (n'importe quel rocher de la piste). */
  hit: boolean;
  /** Événements 'rock' du run. */
  hits: number;
  /** Pas, x du châssis et vitesse (début du pas) du premier choc ; null / NaN sans choc. */
  hitStep: number | null;
  hitX: number | null;
  hitSpeed: number;
  /** Vitesse du châssis à la fin du pas qui suit le premier choc (m/s), NaN sans choc. */
  speedAfterHit: number;
  /** Hauteur du châssis au-dessus du sol au premier choc (m), NaN sans choc ; plus basse ensuite (m), Infinity sans choc. */
  hitHeight: number;
  minHeightAfterHit: number;
  /** La voiture était fantôme au pas du premier choc. */
  ghostAtHit: boolean;
  /** Tous les chocs du run : id du rocher, pas et vitesse (début du pas), dans l'ordre. */
  hitList: { id: number; step: number; speed: number }[];
  /** Une réapparition (le run s'arrête là). */
  respawn: boolean;
  /** |angle du châssis| a dépassé FLIP_ANGLE à un pas du run. */
  flipped: boolean;
  /** x du châssis au saut (événement 'jump') et au premier atterrissage qui le suit, null sinon. */
  jumpX: number | null;
  landX: number | null;
  /** Saut, aucun 'rock', aucune réapparition, châssis au-delà de xEnd + CAR_LENGTH. */
  passed: boolean;
  /** x du châssis au début de chaque pas ; vitesse (option `trace`). */
  xs: number[];
  speeds: number[];
  /** Pas où la voiture finit invulnérable (traversable). */
  invulnerableSteps: number;
  /** Premier et dernier pas (fin de pas) où elle l'est ; null si jamais. */
  invulnerableFrom: number | null;
  invulnerableTo: number | null;
  /** x maximal du châssis (m). */
  xMax: number;
  /** Instant (s) du premier pas où le châssis atteint x, null s'il ne l'atteint pas. */
  tAt: (x: number) => number | null;
}

/**
 * Galahad seul, posé en x0, lancé à v (tenue par `factor`) ou arrêté, doigt posé, turbo forcé à un x, appui au pas k, par
 * le vrai `stepRace` ; s'arrête AFTER_LANDING_SECONDS après l'atterrissage qui suit le saut, `afterHitSeconds` après un
 * choc, à une réapparition, ou à `maxSeconds` (14). `passed` = saut, aucun 'rock', aucune réapparition, châssis au-delà de
 * xEnd + CAR_LENGTH.
 */
export function rockRun(world: World, rock: Rock, opts: RockRunOptions): RockRunResult {
  const cfg = opts.cfg ?? CONFIG;
  const dt = cfg.PHYSICS_DT;
  const sim: RaceSim = soloSim(world, opts.x0, [], cfg);
  try {
    launchSolo(sim, opts.x0, opts.v === 'arrêt' ? 0 : opts.v, cfg);
    const car = sim.cars[GALAHAD_INDEX];
    const xs: number[] = [];
    const out: RockRunResult = {
      hit: false, hits: 0, hitStep: null, hitX: null, hitSpeed: NaN, speedAfterHit: NaN, hitHeight: NaN,
      minHeightAfterHit: Infinity, ghostAtHit: false, hitList: [], respawn: false, flipped: false,
      jumpX: null, landX: null, passed: false, xs, speeds: [], invulnerableSteps: 0, invulnerableFrom: null,
      invulnerableTo: null, xMax: -Infinity,
      tAt: (x) => { const k = xs.findIndex((u) => u >= x); return k < 0 ? null : k * dt; },
    };
    let turboArmed = opts.turboAtX !== undefined;
    let stopAt = Infinity;
    let jumped = false;
    const maxSteps = Math.round((opts.maxSeconds ?? 14) / dt);
    for (let i = 0; i < maxSteps && sim.time < stopAt - 1e-9; i++) {
      const x = chassisX(car);
      const v = carSpeedMps(car.body);
      xs.push(x);
      if (opts.trace) out.speeds.push(v);
      if (turboArmed && x >= opts.turboAtX!) { turboArmed = false; activateTurbo(car.state, sim.time, cfg); }
      stepRace(sim, true, opts.pressAtStep === i);
      if (out.hitStep !== null && i === out.hitStep + 1) out.speedAfterHit = carSpeedMps(car.body);
      out.xMax = Math.max(out.xMax, chassisX(car));
      const p = physToWorld(car.body.chassis.position);
      const height = p.y - heightAt(world.track, p.x);
      if (out.hit) out.minHeightAfterHit = Math.min(out.minHeightAfterHit, height);
      if (Math.abs(carAngle(car.body)) > cfg.FLIP_ANGLE) out.flipped = true;
      if (car.invulnerable) {
        out.invulnerableSteps++;
        out.invulnerableFrom ??= i;
        out.invulnerableTo = i;
      }
      let stop = false;
      for (const e of sim.events) {
        if (e.type === 'jump' && !jumped) { jumped = true; out.jumpX = e.x; }
        else if (e.type === 'landing' && jumped && out.landX === null) {
          out.landX = e.x;
          stopAt = Math.min(stopAt, e.t + AFTER_LANDING_SECONDS);
        } else if (e.type === 'rock') {
          out.hits++;
          out.hitList.push({ id: e.id, step: i, speed: v });
          if (!out.hit) {
            out.hit = true;
            out.hitStep = i;
            out.hitX = e.x;
            out.hitSpeed = v;
            out.hitHeight = height;
            out.ghostAtHit = car.ghost;
            stopAt = Math.max(e.t + (opts.afterHitSeconds ?? AFTER_HIT_SECONDS), stopAt === Infinity ? 0 : stopAt);
          }
        } else if (e.type === 'respawn') { out.respawn = true; stop = true; }
      }
      if (stop) break;
    }
    out.passed = jumped && !out.hit && !out.respawn && out.xMax >= rock.xEnd + cfg.CAR_LENGTH;
    return out;
  } finally {
    disposeSolo(sim);
  }
}

/**
 * Le run passe-t-il au-dessus du rocher `rock` (piste à plusieurs rochers) : saut, aucun choc contre lui, aucune
 * réapparition, châssis au-delà de son xEnd + CAR_LENGTH.
 */
export const passedRock = (r: RockRunResult, rock: Rock, cfg: Config = CONFIG): boolean =>
  r.jumpX !== null && !r.hitList.some((h) => h.id === rock.id) && !r.respawn && r.xMax >= rock.xEnd + cfg.CAR_LENGTH;

/** Instant (s) avant xStart, à la vitesse du moment : (xStart − x) / max(v, 1), comme `rockJumpLead`. */
export const leadOf = (rock: Rock, x: number, v: number): number => (rock.xStart - x) / Math.max(v, 1);

/** Départ d'un cas de fenêtre : lancé à v trois secondes et demie avant le rocher, ou arrêté 30 m avant. */
export function rockStart(rock: Rock, v: number | 'arrêt'): number {
  return v === 'arrêt' ? rock.xStart - 30 : rock.xStart - 3.5 * v;
}

export interface RockWindow {
  /** Fenêtre principale (le plus long morceau d'appuis qui passent), en s. */
  seconds: number;
  /** Morceaux (pas consécutifs qui passent). */
  pieces: number;
  /** Bords de la fenêtre principale, en s avant xStart (vitesse du témoin) : premier appui (tôt) et dernier (tard). */
  leadFrom: number; leadTo: number;
  runs: number;
  /** Vitesse du témoin au pas du choc (m/s). */
  hitSpeed: number;
}

/**
 * Fenêtre entière (suite lente) : témoin sans saut jusqu'au pas du choc kHit, puis un appui à chaque pas de
 * [kHit − WINDOW_SWEEP_SECONDS, kHit] ; le premier pas balayé doit échouer (sinon la fenêtre déborde : erreur).
 */
export function rockWindow(world: World, rock: Rock, v: number | 'arrêt', opts: { turboAtX?: number; x0?: number; cfg?: Config } = {}): RockWindow {
  const cfg = opts.cfg ?? CONFIG;
  const base = { x0: opts.x0 ?? rockStart(rock, v), v, turboAtX: opts.turboAtX, cfg, maxSeconds: 14 + 30 / Math.max(1, v === 'arrêt' ? 1 : v) };
  const witness = rockRun(world, rock, { ...base, pressAtStep: null, trace: true });
  if (witness.hitStep === null) throw new Error(`rockWindow : le témoin sans saut ne touche pas le rocher (en ${rock.xStart}, v = ${v})`);
  const kHit = witness.hitStep;
  const k0 = Math.max(0, kHit - Math.round(WINDOW_SWEEP_SECONDS / cfg.PHYSICS_DT));
  const ok: boolean[] = [];
  for (let k = k0; k <= kHit; k++) ok.push(rockRun(world, rock, { ...base, pressAtStep: k }).passed);
  if (ok[0]) throw new Error(`rockWindow : le premier pas balayé passe (fenêtre plus longue que ${WINDOW_SWEEP_SECONDS} s), v = ${v}`);
  const pieces: { a: number; b: number }[] = [];
  ok.forEach((p, i) => {
    if (!p) return;
    const last = pieces[pieces.length - 1];
    if (last && last.b === i - 1) last.b = i;
    else pieces.push({ a: i, b: i });
  });
  const main = pieces.reduce<{ a: number; b: number } | null>((best, p) => (best === null || p.b - p.a > best.b - best.a ? p : best), null);
  const lead = (i: number): number => leadOf(rock, witness.xs[k0 + i], witness.speeds[k0 + i]);
  return {
    seconds: main ? (main.b - main.a + 1) * cfg.PHYSICS_DT : 0,
    pieces: pieces.length,
    leadFrom: main ? lead(main.a) : NaN,
    leadTo: main ? lead(main.b) : NaN,
    runs: ok.length + 1,
    hitSpeed: witness.hitSpeed,
  };
}

export interface RockBlock {
  /** Premier pas visé sur le témoin, et son instant avant xStart (s). */
  kStar: number; leadStar: number;
  /** Appuis qui passent, sur `runs − 1` (le témoin compte dans `runs`). */
  passed: number;
  runs: number;
  /** Pas (relatifs à k*) des appuis qui échouent. */
  failed: number[];
}

/** CI : k* = premier pas du témoin où `rockJumpWanted` est vrai (centre de la fenêtre) ; un appui à chaque pas de [k* − 12, k* + 12]. */
export function rockBlock(world: World, rock: Rock, v: number | 'arrêt', opts: { turboAtX?: number; x0?: number; cfg?: Config } = {}): RockBlock {
  const cfg = opts.cfg ?? CONFIG;
  const base = { x0: opts.x0 ?? rockStart(rock, v), v, turboAtX: opts.turboAtX, cfg };
  const witness = rockRun(world, rock, { ...base, pressAtStep: null, trace: true });
  const kStar = witness.xs.findIndex((x, k) => x < rock.xStart && rockJumpWanted(world.track, x, witness.speeds[k], cfg));
  if (kStar < 0 || witness.hitStep === null) throw new Error(`rockBlock : témoin sans k* ou sans choc (rocher en ${rock.xStart}, v = ${v})`);
  let passed = 0;
  const failed: number[] = [];
  for (let d = -BLOCK_HALF_STEPS; d <= BLOCK_HALF_STEPS; d++) {
    if (rockRun(world, rock, { ...base, pressAtStep: kStar + d }).passed) passed++;
    else failed.push(d);
  }
  return { kStar, leadStar: leadOf(rock, witness.xs[kStar], witness.speeds[kStar]), passed, runs: 2 * BLOCK_HALF_STEPS + 2, failed };
}

/** Position du châssis (m) d'une voiture de la course. */
export const chassisPos = (sim: RaceSim, i: number): { x: number; y: number } => physToWorld(sim.cars[i].body.chassis.position);
