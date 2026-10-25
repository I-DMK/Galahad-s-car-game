// Harnais des fosses de lave (plan B, tâche 5g ; addendum « bouton saut » §6.2). Piste plate à une fosse (`fossePiste`),
// run de Galahad seul par le vrai `stepRace` (`fosseRun` : contact débouncé, tolérance de sol, saut, capteur de lave,
// réapparitions), fenêtre de saut balayée pas à pas (`fosseWindow`, suite lente) ou bloc central de 0,4 s autour de
// l'instant visé par les copains (`fosseBlock`, CI, ruling R-F17), et le sauteur parfait des courses (`sauteurParfait`).
import { fosseJumpLead, fosseJumpWanted } from '../../src/cars/jump';
import { activateTurbo } from '../../src/cars/turbo';
import { CONFIG, type Config } from '../../src/config';
import { carSpeedMps } from '../../src/physics/car';
import { physToWorld } from '../../src/physics/units';
import { createWorld, type World } from '../../src/physics/world';
import { chassisX, GALAHAD_INDEX, stepRace, type RaceSim } from '../../src/sim/simulate';
import { volcanoFromProfile } from '../../src/track/generate';
import { fosses, nextFosse } from '../../src/track/query';
import { fosse, plat, type SliceProfile } from '../../src/track/slices';
import { mulberry32 } from '../../src/track/rng';
import type { Fosse, Slice, Track, TrackPoint, Volcano } from '../../src/track/types';
import { disposeSolo, launchSolo, soloSim } from './jump-runs';

/** s : suivi après l'atterrissage qui suit le saut (« passe » = aucune réapparition jusque-là). */
export const AFTER_LANDING_SECONDS = 3;
/** s : balayage des fenêtres, chaque pas des 1,6 s qui précèdent la chute du témoin (suite lente). */
export const WINDOW_SWEEP_SECONDS = 1.6;
/**
 * s : si le premier pas balayé passe, le balayage recule par blocs de 0,4 s jusqu'à un pas qui échoue, sans dépasser
 * 2,8 s avant la chute (tour 1 de la 5g : un turbo qui finit dans la fenêtre la fait durer plus de 1,6 s).
 */
export const WINDOW_SWEEP_EXTEND_SECONDS = 0.4;
export const WINDOW_SWEEP_MAX_SECONDS = 2.8;
/** Pas de part et d'autre de k* du bloc central de la CI : 25 appuis, 0,4 s. */
export const BLOCK_HALF_STEPS = 12;

/**
 * Piste faite des profils donnés, bout à bout depuis (0, 0), sans étoile (même pose que `generateTrack` : x = indice ×
 * espacement, volcans par `volcanoFromProfile`). xStart au début, arrivée 60 m avant la fin.
 */
export function trackOf(profiles: SliceProfile[], cfg: Config = CONFIG, seed = 0): Track {
  const s = cfg.TRACK_POINT_SPACING;
  const points: TrackPoint[] = [{ x: 0, y: 0 }];
  const slices: Slice[] = [];
  const volcanoes: Volcano[] = [];
  const exemptPointIndices: number[] = [];
  for (const p of profiles) {
    const first = points.length;
    const xStart = (first - 1) * s;
    p.heights.forEach((h, k) => points.push({ x: (first + k) * s, y: h }));
    for (const e of p.exemptIndices) exemptPointIndices.push(first + e);
    slices.push({ type: p.type, xStart, xEnd: (points.length - 1) * s });
    if (p.volcano) volcanoes.push(volcanoFromProfile(p.volcano, xStart));
  }
  const length = (points.length - 1) * s;
  return {
    seed, targetLength: length, length, points, exemptPointIndices, slices, volcanoes, stars: [], rocks: [],
    xStart: 2, xFinish: length - 60, xWall: length,
  };
}

/**
 * Piste plate à une fosse : plat de 150 m, `before` (tranches avant la fosse, recette de saut §6.2 (a)), la fosse de
 * `cfg` (garde FOSSE_GUARD, approche, FOSSE_WIDTH, réception), plat de 100 m. Sans étoile.
 */
export function fossePiste(opts: { cfg?: Config; before?: SliceProfile[] } = {}): { track: Track; f: Fosse } {
  const cfg = opts.cfg ?? CONFIG;
  const rng = mulberry32(1);
  const track = trackOf([plat(rng, cfg, 150), ...(opts.before ?? []), fosse(cfg), plat(rng, cfg, 100)], cfg);
  return { track, f: fosses(track)[0] };
}

/** Monde de `fossePiste` (configuration par défaut), mis en cache. */
let flatFosse: { world: World; f: Fosse } | null = null;
export function flatFosseWorld(): { world: World; f: Fosse } {
  if (!flatFosse) {
    const { track, f } = fossePiste();
    flatFosse = { world: createWorld(track, CONFIG), f };
  }
  return flatFosse;
}

export interface FosseRunOptions {
  x0: number;
  /** Lancée (m/s, tenue doigt posé par le facteur de la voiture, comme `jumpRun`) ou départ arrêté. */
  v: number | 'arrêt';
  /** Appui de saut : au pas k (une fois), à chaque pas où `fosseJumpWanted` est vrai ('voulu'), ou jamais (null). */
  pressAtStep: number | 'voulu' | null;
  /** Turbo (TURBO_SECONDS) lancé au premier pas où le châssis passe ce x. */
  turboAtX?: number;
  /** Fosse visée ; par défaut la première de la piste. */
  fosse?: Fosse;
  cfg?: Config;
  maxSeconds?: number;
  /** Trace (x du châssis et vitesse au début de chaque pas) : témoin des fenêtres. */
  trace?: boolean;
  /** Arrêt du run (sans lave) quand le châssis dépasse ce x : survol d'une fosse sans saut (`fosses-a`). */
  stopAtX?: number;
  /**
   * Saut préalable (une demande, au premier pas où le châssis passe ce x) : saut d'étoile haute juste avant la fosse.
   * Il ne compte pas comme le saut de la fosse (`jumpStep`, `landX`).
   */
  preJumpAtX?: number;
}

export interface FosseRunResult {
  /** Une pièce a touché la lave (le run s'arrête là). */
  lava: boolean;
  /** Une autre réapparition (le run s'arrête là). */
  respawn: boolean;
  /** Saut, pas de lave ni de réapparition jusqu'à 3 s après l'atterrissage qui suit, voiture entière passée le bord aval. */
  passed: boolean;
  /** x du châssis au saut, null sans saut. */
  jumpX: number | null;
  /** x du châssis au premier atterrissage après le saut (événement 'landing'), null sinon. */
  landX: number | null;
  /** Plus petite garde (m) des roues au-dessus du haut du capteur, roues au-dessus de la lave ; Infinity si aucune. */
  minWheelGap: number;
  /** Pas du saut et de la chute (null sinon). */
  jumpStep: number | null;
  lavaStep: number | null;
  /** Vitesse au saut (m/s). */
  jumpSpeed: number;
  /** Trace (option `trace`) : x et vitesse au début de chaque pas. */
  xs: number[];
  speeds: number[];
  /** x maximal atteint par le châssis (m). */
  xMax: number;
  /** Saut préalable (`preJumpAtX`) : x du châssis au saut et à l'atterrissage qui le suit, null sinon. */
  preJumpX: number | null;
  preLandX: number | null;
}

/**
 * Galahad seul, posé en x0 (lancé à v ou arrêté), doigt posé, turbo forcé à un x, appui au pas k (ou à chaque pas
 * voulu), par le vrai `stepRace`, jusqu'à la lave, une autre réapparition, 3 s après l'atterrissage qui suit le saut,
 * ou `maxSeconds` (défaut 14 s).
 */
export function fosseRun(world: World, opts: FosseRunOptions): FosseRunResult {
  const cfg = opts.cfg ?? CONFIG;
  const f = opts.fosse ?? fosses(world.track)[0];
  const sim: RaceSim = soloSim(world, opts.x0, [], cfg);
  try {
    launchSolo(sim, opts.x0, opts.v === 'arrêt' ? 0 : opts.v, cfg);
    const car = sim.cars[GALAHAD_INDEX];
    const R = cfg.WHEEL_RADIUS;
    const sensorTop = f.rimY + cfg.LAVA_SENSOR_ABOVE_RIM;
    const out: FosseRunResult = {
      lava: false, respawn: false, passed: false, jumpX: null, landX: null, minWheelGap: Infinity,
      jumpStep: null, lavaStep: null, jumpSpeed: NaN, xs: [], speeds: [], xMax: -Infinity, preJumpX: null, preLandX: null,
    };
    let turboArmed = opts.turboAtX !== undefined;
    let preArmed = opts.preJumpAtX !== undefined;
    /** Pas à partir duquel un saut est celui de la fosse (après le saut préalable, s'il y en a un). */
    let fosseFrom = opts.preJumpAtX === undefined ? 0 : Infinity;
    let preJumpAt: number | null = null;
    let stopAt = Infinity;
    let xMax = -Infinity;
    const maxSteps = Math.round((opts.maxSeconds ?? 14) / cfg.PHYSICS_DT);
    for (let i = 0; i < maxSteps && sim.time < stopAt - 1e-9; i++) {
      const x = chassisX(car);
      const v = carSpeedMps(car.body);
      if (opts.trace) { out.xs.push(x); out.speeds.push(v); }
      if (turboArmed && x >= opts.turboAtX!) { turboArmed = false; activateTurbo(car.state, sim.time, cfg); }
      const pre = preArmed && x >= opts.preJumpAtX!;
      if (pre) preArmed = false;
      const press = pre || (opts.pressAtStep === 'voulu'
        ? fosseJumpWanted(world.track, x, v, cfg)
        : opts.pressAtStep === i);
      stepRace(sim, true, press);
      for (const w of car.body.wheels) {
        const c = physToWorld(w.position);
        if (c.x + R >= f.xBord && c.x - R <= f.xReception) out.minWheelGap = Math.min(out.minWheelGap, c.y - R - sensorTop);
      }
      xMax = Math.max(xMax, chassisX(car));
      let stop = false;
      for (const e of sim.events) {
        if (e.type === 'jump' && out.jumpStep === null && i >= fosseFrom) { out.jumpStep = i; out.jumpX = e.x; out.jumpSpeed = v; }
        else if (e.type === 'jump' && fosseFrom === Infinity) { preJumpAt = i; out.preJumpX = e.x; }
        else if (e.type === 'landing' && out.jumpStep !== null && out.landX === null) { out.landX = e.x; stopAt = e.t + AFTER_LANDING_SECONDS; }
        // Retour au sol après le saut préalable : les sauts suivants sont ceux de la fosse.
        else if (e.type === 'landing' && preJumpAt !== null && fosseFrom === Infinity) { fosseFrom = i + 1; out.preLandX = e.x; }
        else if (e.type === 'respawn') {
          if (e.reason === 'lava') { out.lava = true; out.lavaStep = i; } else out.respawn = true;
          stop = true;
        }
      }
      if (stop || (opts.stopAtX !== undefined && chassisX(car) > opts.stopAtX)) break;
    }
    out.xMax = xMax;
    out.passed = out.jumpStep !== null && !out.lava && !out.respawn && out.landX !== null
      && xMax >= f.xReception + cfg.WHEEL_BASE / 2 + R;
    return out;
  } finally {
    disposeSolo(sim);
  }
}

/** Instant (s) avant le bord amont, à la vitesse du moment : (xBord − x) / max(v, 1), comme `fosseJumpLead`. */
const leadOf = (f: Fosse, x: number, v: number): number => (f.xBord - x) / Math.max(v, 1);

/** Départ d'un cas de fenêtre : lancé à v trois secondes et demie avant le bord, ou arrêté au pire point sûr. */
export function fosseStart(f: Fosse, v: number | 'arrêt', cfg: Config = CONFIG): number {
  return v === 'arrêt' ? f.xLancement + cfg.SAFE_LANCEMENT_MARGIN - 0.01 : f.xBord - 3.5 * v;
}

export interface FosseWindow {
  /** Fenêtre principale (le plus long morceau d'appuis qui passent), en s. */
  seconds: number;
  /** Morceaux (pas consécutifs qui passent) du balayage. */
  pieces: number;
  /** Morceaux en s, du plus tôt au plus tard, et leur instant avant le bord (s) au premier et au dernier pas. */
  pieceList: { seconds: number; leadFrom: number; leadTo: number }[];
  /** Distance châssis → bord amont (m) aux deux bouts de la fenêtre principale. */
  sMin: number; sMax: number;
  /** Centre de la fenêtre principale, en s avant le bord (vitesse du témoin). */
  centreLead: number;
  /** Atterrissage le plus loin après le bord aval (m), sauts qui passent. */
  landMax: number;
  runs: number;
  /** Course témoin : saut préalable (x au saut et à l'atterrissage, null sinon) et vitesse au premier pas balayé (m/s). */
  preJumpX: number | null;
  preLandX: number | null;
  sweepSpeed: number;
}

/**
 * Fenêtre de saut d'une fosse (suite lente, ruling R-F17) : course témoin sans saut jusqu'à la chute (pas kFall), puis
 * un appui à chaque pas des WINDOW_SWEEP_SECONDS qui précèdent la chute. Le premier pas balayé doit échouer : sinon le
 * balayage recule par blocs de WINDOW_SWEEP_EXTEND_SECONDS (au plus WINDOW_SWEEP_MAX_SECONDS avant la chute), et s'il
 * passe encore, la fenêtre déborde du balayage et le helper lève. Options : départ `x0` (défaut `fosseStart`), turbo, saut préalable
 * (`preJumpAtX`, saut d'étoile haute juste avant, dans le témoin comme dans chaque run).
 */
export function fosseWindow(
  world: World, f: Fosse, v: number | 'arrêt', opts: { turboAtX?: number; cfg?: Config; x0?: number; preJumpAtX?: number } = {},
): FosseWindow {
  const cfg = opts.cfg ?? CONFIG;
  const x0 = opts.x0 ?? fosseStart(f, v, cfg);
  const base = { x0, v, turboAtX: opts.turboAtX, fosse: f, cfg, preJumpAtX: opts.preJumpAtX, maxSeconds: 14 + (f.xBord - x0) / 10 };
  const witness = fosseRun(world, { ...base, pressAtStep: null, trace: true });
  if (!witness.lava || witness.lavaStep === null) throw new Error(`fosseWindow : le témoin sans saut ne tombe pas (fosse en ${f.xBord.toFixed(1)}, v = ${v})`);
  const kFall = witness.lavaStep;
  const dtSteps = (seconds: number): number => Math.round(seconds / cfg.PHYSICS_DT);
  const kMin = Math.max(0, kFall - dtSteps(WINDOW_SWEEP_MAX_SECONDS));
  let k0 = Math.max(0, kFall - dtSteps(WINDOW_SWEEP_SECONDS));
  const ok: boolean[] = [];
  const lands: number[] = [];
  const sweep = (from: number, to: number): boolean[] => {
    const out: boolean[] = [];
    for (let k = from; k <= to; k++) {
      const r = fosseRun(world, { ...base, pressAtStep: k });
      out.push(r.passed);
      if (r.passed && r.landX !== null) lands.push(r.landX - f.xReception);
    }
    return out;
  };
  ok.push(...sweep(k0, kFall));
  while (ok[0] && k0 > kMin) {
    const from = Math.max(kMin, k0 - dtSteps(WINDOW_SWEEP_EXTEND_SECONDS));
    ok.unshift(...sweep(from, k0 - 1));
    k0 = from;
  }
  if (ok[0]) throw new Error(`fosseWindow : le premier pas balayé passe (fenêtre plus longue que ${WINDOW_SWEEP_MAX_SECONDS} s), fosse en ${f.xBord.toFixed(1)}, v = ${v}`);
  const pieces: { a: number; b: number }[] = [];
  ok.forEach((p, i) => {
    if (!p) return;
    const last = pieces[pieces.length - 1];
    if (last && last.b === i - 1) last.b = i;
    else pieces.push({ a: i, b: i });
  });
  const lead = (i: number): number => leadOf(f, witness.xs[k0 + i], witness.speeds[k0 + i]);
  const main = pieces.reduce<{ a: number; b: number } | null>((best, p) => (best === null || p.b - p.a > best.b - best.a ? p : best), null);
  const dt = cfg.PHYSICS_DT;
  return {
    seconds: main ? (main.b - main.a + 1) * dt : 0,
    pieces: pieces.length,
    pieceList: pieces.map((p) => ({ seconds: (p.b - p.a + 1) * dt, leadFrom: lead(p.a), leadTo: lead(p.b) })),
    sMin: main ? f.xBord - witness.xs[k0 + main.b] : NaN,
    sMax: main ? f.xBord - witness.xs[k0 + main.a] : NaN,
    centreLead: main ? (lead(main.a) + lead(main.b)) / 2 : NaN,
    landMax: lands.length ? Math.max(...lands) : NaN,
    runs: ok.length + 1,
    preJumpX: witness.preJumpX,
    preLandX: witness.preLandX,
    sweepSpeed: witness.speeds[k0],
  };
}

export interface FosseBlock {
  /** Premier pas où `fosseJumpWanted` est vrai sur la course témoin, et son instant avant le bord (s). */
  kStar: number; leadStar: number;
  /** Appuis qui passent, sur `runs − 1` (le témoin compte dans `runs`). */
  passed: number;
  runs: number;
  /** Pas (relatifs à k*) des appuis qui échouent. */
  failed: number[];
  /** Pas de la chute du témoin. */
  kFall: number;
}

/** CI (ruling R-F17) : k* = premier pas où `fosseJumpWanted` est vrai sur la course témoin ; un appui à chaque pas de [k* − 12, k* + 12]. */
export function fosseBlock(world: World, f: Fosse, v: number | 'arrêt', opts: { turboAtX?: number; cfg?: Config } = {}): FosseBlock {
  const cfg = opts.cfg ?? CONFIG;
  const base = { x0: fosseStart(f, v, cfg), v, turboAtX: opts.turboAtX, fosse: f, cfg };
  const witness = fosseRun(world, { ...base, pressAtStep: null, trace: true });
  const kStar = witness.xs.findIndex((x, k) => fosseJumpWanted(world.track, x, witness.speeds[k], cfg));
  if (kStar < 0 || witness.lavaStep === null) throw new Error(`fosseBlock : témoin sans k* ou sans chute (fosse en ${f.xBord.toFixed(1)}, v = ${v})`);
  let passed = 0;
  const failed: number[] = [];
  for (let d = -BLOCK_HALF_STEPS; d <= BLOCK_HALF_STEPS; d++) {
    if (fosseRun(world, { ...base, pressAtStep: kStar + d }).passed) passed++;
    else failed.push(d);
  }
  return {
    kStar, leadStar: leadOf(f, witness.xs[kStar], witness.speeds[kStar]), passed, runs: 2 * BLOCK_HALF_STEPS + 2, failed,
    kFall: witness.lavaStep,
  };
}

/** s : marge prise sur le bord au plus tôt de la fenêtre d'une fosse pour le saut de la dernière chance. */
const EARLY_MARGIN = 0.1;

/**
 * Bord au plus tôt de la fenêtre de saut d'une fosse, en s avant le bord amont, à la vitesse v : (1,96 s × v − W − 1,2 m) / v
 * (saut §6.8, CALCULÉ ; 1,44 s à 17,7 m/s, 1,30 s à 14, 0,81 s à 8).
 */
export const fosseEarliestLead = (v: number, cfg: Config = CONFIG): number => (1.96 * v - cfg.FOSSE_WIDTH - 1.2) / Math.max(v, 1);

/**
 * Option `jump` de `simulateRace` : Galahad demande le saut à chaque pas où `fosseJumpWanted` est vrai (au centre de la
 * fenêtre, sans erreur, comme les copains provisoires de la 5g ; depuis la tâche 6, un copain y ajoute son erreur). Doigt
 * posé avec ce saut : 0 chute attendue. Saut de la dernière chance (tour 1 de la tâche 6, graine 9 : turbo à 20 m/s sur
 * une double-bosse juste avant une fosse, atterrissage sur l'approche et rebond de 1,1 m, la voiture vole pendant tout le
 * centre de la fenêtre) : sur l'approche, en l'air, au dernier pas de la tolérance de sol alors que le centre est plus
 * loin, il saute tout de suite si le bord est déjà à portée d'un saut avancé (au plus `fosseEarliestLead(v)` − 0,1 s).
 */
export function sauteurParfait(track: Track, cfg: Config = CONFIG): (t: number, sim: RaceSim) => boolean {
  return (_t, sim) => {
    const car = sim.cars[GALAHAD_INDEX];
    const x = chassisX(car);
    const v = carSpeedMps(car.body);
    if (fosseJumpWanted(track, x, v, cfg)) return true;
    const f = nextFosse(track, x);
    if (!f || x < f.xLancement || car.grounded || car.lastGroundedAt === null) return false;
    const graceLeft = car.lastGroundedAt + cfg.JUMP_GROUND_GRACE - sim.time;
    const tte = (f.xBord - x) / Math.max(v, 1);
    return graceLeft >= -1e-9 && graceLeft < 1.5 * cfg.PHYSICS_DT && tte - fosseJumpLead(v, cfg) > graceLeft
      && tte <= fosseEarliestLead(v, cfg) - EARLY_MARGIN && tte > cfg.JUMP_BUFFER;
  };
}
