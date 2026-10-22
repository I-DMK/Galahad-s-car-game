// Échantillonnage des phases de suspension au saut des volcans (tâche 5c du plan B). Promesse du jeu : doigt posé depuis le plat de lancement (xLancement), on
// ne tombe jamais dans la lave. L'issue dépend pourtant de la phase de la suspension à l'arrivée au
// pied de la rampe, donc de l'historique de la voiture avant xLancement. Le protocole tire des
// historiques variés et déterministes (mulberry32), puis doigt posé au plus tard à xLancement,
// Galahad seul (aucune autre voiture : toute chute est « propre ») :
//  - « échelonné » : départ arrêté à xLancement − d, d au pas de 0,05 m sur deux fenêtres (d ∈ [0, …[ :
//    départ au bord du plat ; d ∈ [30, …[ : arrivée à V_MAX après le relief de la tranche précédente),
//    doigt posé tout du long ;
//  - « motif » : départ arrêté ≈ 40 m en amont, doigt levé par tranches de 0,25 s (tirage par graine,
//    volcan et échantillon), doigt posé pour de bon dès xOn ∈ [xLancement − 15, xLancement] ;
//  - « turbo » : comme « motif », plus un turbo (étoile) pris en un x tiré de [max(x0, xLancement − 50),
//    xElanStart − STAR_ELAN_OFFSET] (toujours après le départ, voiture déjà en route) : turbo actif, ou
//    qui s'arrête, n'importe où sur l'approche ;
//  - « turbo dense » (tests/slow/phases-dense.test.ts) : lancée à V_MAX en xLancement − d, d ∈
//    DENSE_LAUNCHES, doigt posé tout du long, turbo pris en chaque mètre de [xLancement − DENSE_FROM,
//    xLancement − DENSE_TO] : la fin du turbo balaie la fin du plat de lancement, l'élan, le pied, la rampe
//    et le sommet. C'est le pire cas mesuré : en fin de turbo, applyDrive ramène d'un coup ω à omegaMax,
//    les roues freinent et la voiture arrive au pied à ≈ 11,3 m/s ; lancée en xLancement − 45, turbo
//    pris à xLancement − 26 (fin au pied) : garde 0,63 m (g0 v2 et g8 v3). La garde dépend aussi de
//    l'écart départ–turbo (même turbo, lancée en − 50 : 2,06 m), d'où plusieurs départs.
// Mécanisme mesuré (sonde de la tâche 5c, chutes à 11,18 et 11,31 m/s au sommet) : la roue avant tape
// le pli 0° → 22° du pied de rampe à V_MAX (14 → 12 m/s en deux pas, direction de la vitesse ≈ 29°),
// la voiture décolle dès le pied et survole toute la rampe (écart roue–sol 0,3 à 0,4 m) sans la
// retoucher ; la direction de sa vitesse retombe à ≈ 14° au sommet au lieu de 22°, le saut est trop
// plat et la roue arrière touche le bord aval du capteur de lave. Quand la roue avant retouche la rampe
// avant le sommet, la direction revient à 22° et le saut passe largement. Correctif retenu par le papa
// (phase 2) : congé concave au pied de la rampe (RAMP_FOOT_RADIUS = 10 m, src/track/slices.ts) ; les
// autres candidats de la phase 1 (arête arrondie, LAVA_MARGIN 0,75, SUSPENSION_DAMPING 0,3) sont au
// commit ee58194. Le candidat « pli » (RAMP_FOOT_RADIUS 0) rejoue le pied d'avant, pour la comparaison.
// Monde rogné : les corps statiques hors de la fenêtre du volcan sont retirés du monde Matter
// (`croppedWorld`) ; les runs sont identiques au bit près à ceux du monde complet (sonde : 16 runs sur
// 16) et ≈ 15 fois plus rapides (0,12 ms par pas au lieu de 1,8).
// Un candidat s'évalue par `cfg` surchargé (piste regénérée avec lui).
import Matter from 'matter-js';
import { CONFIG, type Config } from '../../src/config';
import { withAnciennesPistes } from './anciennes-pistes';
import { carAngle, carSpeedMps, wheelsBelowChassis, type CarBody } from '../../src/physics/car';
import { physToWorld } from '../../src/physics/units';
import { createWorld, type World } from '../../src/physics/world';
import { simulateRace } from '../../src/sim/harness';
import { generateTrack } from '../../src/track/generate';
import { heightAt, nearestVolcanoZone, volcanoAhead } from '../../src/track/query';
import { mulberry32 } from '../../src/track/rng';
import type { Track, Volcano } from '../../src/track/types';
import { ALL_CASES, passesVolcano, scenariosFor, type CaseId } from './cases';
import {
  DEG, JumpTracker, LIP_SPEED_THRESHOLD, STEPS_PER_SECOND, TRACK_LENGTH, freshCar, launch, liftedPattern, newContact,
  runFrom, step, type RunOptions, type RunResult, type StepState,
} from './runs';

export const PHASE_SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Pas des départs échelonnés (m). */
export const STAGGER_STEP = 0.05;
/** Fenêtres des départs échelonnés : d (m en amont de xLancement) = début + k × STAGGER_STEP. */
export const STAGGER_WINDOWS = [0, 30];
/** Départs « motif » et « turbo » : arrêt APPROACH m (+ k × STAGGER_STEP) en amont de xLancement. */
export const APPROACH = 40;
/** Motifs : tranches de doigt de 0,25 s, levé avec la probabilité LIFT_SHARE. */
export const LIFT_SLICE = 0.25;
export const LIFT_SHARE = 0.4;
/** Le doigt est posé pour de bon en xOn, tiré dans [xLancement − ON_BEFORE_MAX, xLancement]. */
export const ON_BEFORE_MAX = 15;
/** Turbo pris en un x tiré de [max(x0, xLancement − TURBO_FROM), xElanStart − STAR_ELAN_OFFSET]. */
export const TURBO_FROM = 50;
/** Turbo dense : départs lancés à V_MAX en xLancement − d (d ∈ DENSE_LAUNCHES), turbo pris en xLancement − DENSE_FROM + j × DENSE_STEP ≤ xLancement − DENSE_TO. */
export const DENSE_LAUNCHES = [40, 45, 50];
export const DENSE_FROM = 40;
export const DENSE_TO = 5;
export const DENSE_STEP = 1;
/** Garde minimale exigée au-dessus du capteur de lave (m), tous historiques (décision du papa, tâche 5c : 0,63 m mesurée, gardée). */
export const MIN_CLEARANCE = 0.3;
/** Taille par défaut de l'échantillon, par volcan. */
export const DEFAULT_SIZES: SampleSizes = { perWindow: 8, motifs: 40, turbos: 12, dense: false };
/** Famille turbo dense seule (tests/slow/phases-dense.test.ts). */
export const DENSE_SIZES: SampleSizes = { perWindow: 0, motifs: 0, turbos: 0, dense: true };
/** Vitesse au sommet au-delà de laquelle une chute est « à grande vitesse » (vérification du protocole). */
export const FAST_FALL_LIP_SPEED = 10.5;
const RUN_SECONDS = 30;
const EPS = 1e-9;
/** Fenêtre du monde rogné autour d'un volcan (m). */
const CROP_BEFORE = Math.max(APPROACH + STAGGER_WINDOWS[1], ...DENSE_LAUNCHES) + 15;
const CROP_AFTER = 15;

/** `dense` : avec ou sans la famille « turbo dense ». */
export interface SampleSizes { perWindow: number; motifs: number; turbos: number; dense: boolean }
export type Family = 'échelonné' | 'motif' | 'turbo' | 'turbo dense';
export const FAMILIES: Family[] = ['échelonné', 'motif', 'turbo', 'turbo dense'];

// ——— Candidats ———

/** Un candidat : configuration (la piste est regénérée avec elle). */
export interface Variant { id: string; label: string; cfg: Config }

/** Pistes d'avant (`withAnciennesPistes`, tâche 5e) : les 43 volcans et les 2 924 + 4 601 historiques restent ceux de la 5c. */
export const REFERENCE: Variant = { id: 'reference', label: 'configuration actuelle (congé au pied de la rampe, R = 10 m)', cfg: withAnciennesPistes(CONFIG) };
/** Pied de rampe d'avant la tâche 5c (pli 0° → 22°) : le protocole doit y retrouver des chutes propres. */
export const SHARP_FOOT: Variant = { id: 'pli', label: 'pied de rampe d\'avant la tâche 5c (pli 0° → 22°, RAMP_FOOT_RADIUS 0)', cfg: { ...withAnciennesPistes(CONFIG), RAMP_FOOT_RADIUS: 0 } };
export const VARIANTS: Variant[] = [REFERENCE, SHARP_FOOT];
export const variantById = (id: string): Variant => {
  const v = VARIANTS.find((x) => x.id === id);
  if (!v) throw new Error(`candidat inconnu : ${id} (connus : ${VARIANTS.map((x) => x.id).join(', ')})`);
  return v;
};

const tracks = new Map<string, Track>();
/** Piste de la graine pour le candidat (mise en cache par id de candidat). */
export function variantTrack(seed: number, variant: Variant): Track {
  const key = `${variant.id}:${seed}`;
  let t = tracks.get(key);
  if (!t) {
    t = generateTrack(seed, TRACK_LENGTH, variant.cfg);
    tracks.set(key, t);
  }
  return t;
}

/**
 * Monde complet de la piste, puis retrait (hors du monde Matter) de tous les corps statiques dont la
 * boîte ne touche pas [x0, x1] : mêmes corps, mêmes ids, même fond des trapèzes, même ordre de tri
 * dans la détection ; seuls manquent les corps lointains, jamais touchés.
 */
export function croppedWorld(track: Track, cfg: Config, x0: number, x1: number): World {
  const world = createWorld(track, cfg);
  const ppm = cfg.PIXELS_PER_METER;
  const far = new Set([...world.ground, ...world.lava, world.wall]
    .filter((b) => b.bounds.max.x < x0 * ppm || b.bounds.min.x > x1 * ppm));
  world.engine.world.bodies = world.engine.world.bodies.filter((b) => !far.has(b));
  // Composite.setModified existe dans Matter 0.20 mais manque à ses types.
  (Matter.Composite as unknown as { setModified(c: Matter.Composite, m: boolean, p: boolean, ch: boolean): void })
    .setModified(world.engine.world, true, true, false);
  return world;
}

const worlds = new Map<string, World>();
/** Monde rogné [x0, x1] de la piste du candidat, mis en cache. */
export function cropFor(seed: number, variant: Variant, x0: number, x1: number): World {
  const key = `${variant.id}:${seed}:${x0.toFixed(2)}:${x1.toFixed(2)}`;
  let w = worlds.get(key);
  if (!w) {
    w = croppedWorld(variantTrack(seed, variant), variant.cfg, x0, x1);
    worlds.set(key, w);
  }
  return w;
}
/** Monde rogné autour du volcan d'indice `vi`. */
export function volcanoWorld(seed: number, vi: number, variant: Variant): World {
  const v = variantTrack(seed, variant).volcanoes[vi];
  return cropFor(seed, variant, v.xLancement - CROP_BEFORE, v.xEnd + CROP_AFTER);
}

// ——— Historiques ———

/** Un historique : départ, doigt, turbo éventuel. */
export interface History { family: Family; k: number; x0: number; label: string; opts: RunOptions }

/** Graine d'un échantillon : (graine de piste, volcan, famille, k) mélangés, entier de [0, 2³²). */
const sampleSeed = (seed: number, vi: number, family: number, k: number): number =>
  (Math.imul(seed + 1, 0x9e3779b1) ^ Math.imul(vi + 1, 0x85ebca77) ^ Math.imul(family + 1, 0xc2b2ae3d) ^ Math.imul(k + 1, 0x27d4eb2f)) >>> 0;

/** Le départ x0 est-il admissible : sur la piste, hors de la zone [xLancement, xReception + 2] d'un autre volcan ? */
function admissible(track: Track, v: Volcano, x0: number): boolean {
  if (x0 < 2) return false;
  return !track.volcanoes.some((o) => o !== v && x0 >= o.xLancement && x0 <= o.xReception + 2);
}

/**
 * Historiques du volcan d'indice `vi` : `perWindow` départs échelonnés par fenêtre, `motifs` motifs de
 * doigt, `turbos` motifs avec turbo, puis la famille « turbo dense » si `dense`. Un départ dans la zone d'un volcan précédent est décalé vers
 * l'aval par pas de 1 m jusqu'à être admissible (écarté s'il dépasse xLancement).
 */
export function historiesFor(seed: number, vi: number, track: Track, cfg: Config, n: SampleSizes): History[] {
  const v = track.volcanoes[vi];
  const out: History[] = [];
  const base = { maxSeconds: RUN_SECONDS, cfg, volcano: v };
  const fix = (x0: number): number | null => {
    let x = x0;
    while (!admissible(track, v, x) && x < v.xLancement) x += 1;
    return x <= v.xLancement ? x : null;
  };
  for (const d0 of STAGGER_WINDOWS) {
    for (let k = 0; k < n.perWindow; k++) {
      const x0 = fix(v.xLancement - d0 - k * STAGGER_STEP);
      if (x0 === null) continue;
      out.push({ family: 'échelonné', k: k + (d0 ? n.perWindow : 0), x0, label: `échelonné : arrêt à xLancement − ${(v.xLancement - x0).toFixed(2)}`, opts: { ...base, throttle: () => true } });
    }
  }
  const patterned = (family: Family, fi: number, count: number) => {
    for (let k = 0; k < count; k++) {
      let rng = mulberry32(sampleSeed(seed, vi, fi, k));
      const x0 = fix(v.xLancement - APPROACH - k * STAGGER_STEP);
      if (x0 === null) continue;
      const xOn = v.xLancement - rng() * ON_BEFORE_MAX;
      const turboFrom = Math.max(x0, v.xLancement - TURBO_FROM);
      const turboAt = family === 'turbo'
        ? turboFrom + rng() * (v.xElanStart - cfg.STAR_ELAN_OFFSET - turboFrom)
        : undefined;
      // Les tranches de doigt sont tirées à la suite de xOn et turboAt ; état remis à zéro au premier pas
      // (t = 0) : l'historique est rejouable à l'identique (tests/observer.test.ts).
      const draws = turboAt === undefined ? 1 : 2;
      let lifted: boolean[] = [];
      let on = false;
      const throttle = (t: number, x: number): boolean => {
        if (t === 0) {
          rng = mulberry32(sampleSeed(seed, vi, fi, k));
          for (let d = 0; d < draws; d++) rng();
          lifted = []; on = false;
        }
        if (on || x >= xOn) { on = true; return true; }
        const slice = Math.floor(t / LIFT_SLICE);
        while (lifted.length <= slice) lifted.push(rng() < LIFT_SHARE);
        return !lifted[slice];
      };
      const label = `${family} ${k} : arrêt à xLancement − ${(v.xLancement - x0).toFixed(2)}, doigt posé dès xLancement − ${(v.xLancement - xOn).toFixed(1)}`
        + (turboAt !== undefined ? `, turbo à xLancement ${turboAt >= v.xLancement ? '+' : '−'} ${Math.abs(turboAt - v.xLancement).toFixed(1)}` : '');
      out.push({ family, k, x0, label, opts: { ...base, throttle, turboAt } });
    }
  };
  patterned('motif', 1, n.motifs);
  patterned('turbo', 2, n.turbos);
  const launches = n.dense ? [...new Set(DENSE_LAUNCHES.map((d) => fix(v.xLancement - d)))] : [];
  let kd = 0;
  for (const xDense of launches) {
    if (xDense === null) continue;
    for (let j = 0; v.xLancement - DENSE_FROM + j * DENSE_STEP <= v.xLancement - DENSE_TO + EPS; j++) {
      const turboAt = v.xLancement - DENSE_FROM + j * DENSE_STEP;
      if (turboAt <= xDense) continue;
      out.push({
        family: 'turbo dense', k: kd++, x0: xDense,
        label: `turbo dense : lancée à V_MAX en xLancement − ${(v.xLancement - xDense).toFixed(2)}, doigt posé, turbo à xLancement − ${(v.xLancement - turboAt).toFixed(0)}`,
        opts: { ...base, throttle: () => true, turboAt, launchSpeed: cfg.V_MAX },
      });
    }
  }
  return out;
}

// ——— Un run mesuré ———

export type Outcome = 'lave' | 'passe' | 'autre';

/** Mesures d'un run de l'échantillonnage. */
export interface PhaseSample {
  seed: number; vi: number; family: Family; k: number; label: string;
  outcome: Outcome;
  /** Vitesse (m/s) au premier pas où le châssis passe xLancement. */
  arrival: number;
  rampSpeed: number; lipSpeed: number;
  /** Direction de la vitesse du châssis (°, + = vers le haut) au pas où il passe xLip. */
  lipDir: number;
  /** Écart vertical roue arrière–sol (m) quand la roue arrière est sur la rampe [xRampStart, xLip] : max et moyenne. */
  rearGapMax: number; rearGapMean: number;
  /** Écart roue arrière–sol au pas où le châssis passe xLip. */
  rearGapAtLip: number;
  /** Premier contact brut de la roue arrière après le passage du châssis à xLip : x de la roue − xLip (m), NaN sans contact. */
  rearStrikeDx: number;
  /** Garde minimale (m) au-dessus du capteur de lave : bas d'une pièce − (rimY + LAVA_SENSOR_ABOVE_RIM), pièces au-dessus du capteur ; ≤ 0 = touché. */
  clearance: number;
  /** Pièce qui a touché la lave ('châssis', 'roue arrière', 'roue avant'), '' sinon. */
  lavaPart: string;
  landX: number | null;
  steps: number;
}

const PART_NAMES = ['châssis', 'roue arrière', 'roue avant'];

/** Joue l'historique `h` sur le monde `world` (volcan `v`) et mesure la phase de la suspension. */
export function phaseRun(world: World, v: Volcano, h: History, seed: number, vi: number, cfg: Config): PhaseSample {
  const R = cfg.WHEEL_RADIUS;
  const lavaBody = world.lava.find((b) => (b.plugin as { volcano?: Volcano }).volcano === v);
  const sensorTop = v.rimY + cfg.LAVA_SENSOR_ABOVE_RIM;
  const sx0 = v.xLava - v.lavaWidth / 2;
  const sx1 = v.xLava + v.lavaWidth / 2;
  let arrival = NaN;
  let gapMax = -Infinity; let gapSum = 0; let gapN = 0;
  let gapAtLip = NaN; let lipDir = NaN;
  let pastLip = false;
  let strike = NaN;
  let clearance = Infinity;
  let lavaPart = '';
  const onStep = (_i: number, s: StepState, car: CarBody): void => {
    if (Number.isNaN(arrival) && s.x >= v.xLancement) arrival = carSpeedMps(car);
    const rear = physToWorld(car.wheels[0].position);
    const gap = rear.y - heightAt(world.track, rear.x) - R;
    if (rear.x >= v.xRampStart && rear.x <= v.xLip) {
      gapSum += gap; gapN++;
      gapMax = Math.max(gapMax, gap);
    }
    if (!pastLip && s.x >= v.xLip) {
      pastLip = true;
      gapAtLip = gap;
      lipDir = Math.atan2(-car.chassis.velocity.y, car.chassis.velocity.x) / DEG;
    }
    if (!pastLip) return;
    if (Number.isNaN(strike) && s.wheels[0] && rear.x <= v.xLip + 1.5) strike = rear.x - v.xLip;
    // Garde au-dessus du capteur : roues (cercles), châssis (sommets).
    for (const w of car.wheels) {
      const c = physToWorld(w.position);
      if (c.x + R >= sx0 && c.x - R <= sx1) clearance = Math.min(clearance, c.y - R - sensorTop);
    }
    let cx0 = Infinity; let cx1 = -Infinity; let cy = Infinity;
    for (const p of car.chassis.vertices) {
      const q = physToWorld(p);
      cx0 = Math.min(cx0, q.x); cx1 = Math.max(cx1, q.x); cy = Math.min(cy, q.y);
    }
    if (cx1 >= sx0 && cx0 <= sx1) clearance = Math.min(clearance, cy - sensorTop);
    if (s.lava && !lavaPart && lavaBody) {
      const touching = car.parts.filter((p) => Matter.Collision.collides(p, lavaBody)?.collided);
      lavaPart = touching.map((p) => PART_NAMES[car.parts.indexOf(p)]).join('+') || '?';
    }
  };
  const r: RunResult = runFrom(world, h.x0, { ...h.opts, onStep });
  return {
    seed, vi, family: h.family, k: h.k, label: h.label,
    outcome: r.lava ? 'lave' : passesVolcano(r, v) ? 'passe' : 'autre',
    arrival, rampSpeed: r.rampSpeed ?? NaN, lipSpeed: r.lipSpeed ?? NaN, lipDir,
    rearGapMax: gapMax, rearGapMean: gapN ? gapSum / gapN : NaN, rearGapAtLip: gapAtLip,
    rearStrikeDx: strike, clearance: Number.isFinite(clearance) ? clearance : NaN, lavaPart,
    landX: r.landX, steps: Math.round(r.seconds / cfg.PHYSICS_DT),
  };
}

/** Échantillonne tous les volcans de la graine pour le candidat. */
export function samplePhases(seed: number, variant: Variant, n: SampleSizes = DEFAULT_SIZES): PhaseSample[] {
  const track = variantTrack(seed, variant);
  const out: PhaseSample[] = [];
  track.volcanoes.forEach((v, vi) => {
    const world = volcanoWorld(seed, vi, variant);
    for (const h of historiesFor(seed, vi, track, variant.cfg, n)) out.push(phaseRun(world, v, h, seed, vi, variant.cfg));
  });
  return out;
}

// ——— Assertions ———

/**
 * Promesse (configuration actuelle) : tout historique passe le volcan et la garde au-dessus du capteur
 * reste ≥ MIN_CLEARANCE. Une issue « autre » (pas d'atterrissage sur la réception, retournement,
 * blocage, retombée sur le flanc ou dans la vallée) échoue aussi : jamais mesurée, elle contredirait la
 * promesse autant qu'une chute. Renvoie l'échantillon de garde minimale.
 */
export function expectAllPass(samples: PhaseSample[], what: string): PhaseSample {
  const bad = samples.filter((s) => s.outcome !== 'passe');
  const finite = samples.filter((s) => Number.isFinite(s.clearance));
  const worst = finite.reduce((a, s) => (s.clearance < a.clearance ? s : a), finite[0]);
  console.log(`${what} : ${samples.length} runs, lave ${bad.filter((s) => s.outcome === 'lave').length}, autre ${bad.filter((s) => s.outcome === 'autre').length}`
    + `${bad.length ? `\n  ${bad.map(describeSample).join('\n  ')}` : ''}\n  garde minimale : ${worst ? describeSample(worst) : '—'}`);
  expect(samples.length).toBeGreaterThan(0);
  expect(bad.map(describeSample)).toEqual([]);
  // Une garde NaN = aucune pièce au-dessus du capteur après le sommet : impossible pour un run qui passe.
  expect(samples.filter((s) => !Number.isFinite(s.clearance)).map(describeSample)).toEqual([]);
  expect(worst.clearance, describeSample(worst)).toBeGreaterThanOrEqual(MIN_CLEARANCE);
  return worst;
}

// ——— Outillage de mesure, à la demande (PHASES_PARTS) : rien n'y est asserté ———
// Cas 1 à 7 de la tâche 4, tableau (b), rampes-saut, sous un candidat. Les assertions de ces cas sont
// dans tests/volcans.test.ts, tests/slow/volcans-slow.test.ts, tests/rampes.test.ts et
// tests/slow/finish.test.ts ; ici, seulement des tableaux imprimés pour comparer des candidats.

export interface CaseRow { caseId: CaseId | 'i'; seed: number; vi: number; ok: boolean; lipSpeed: number; lava: boolean; detail: string; steps: number }

/**
 * Cas 1 à 5 et turbo permanent (helpers/cases.ts) sur tous les volcans de la graine, plus le scénario
 * (i) (rampe-saut → plat → volcan, turbo 20 à 60 m avant la rampe-saut) ; mondes rognés. `ok` : cas 1 →
 * lave (et pas d'atterrissage sur la réception) ; autres → `passesVolcano` (et atterrissage avant xEnd
 * pour 5, turbo et (i)). La marge « sommet ≥ LIP_SPEED_THRESHOLD + 1 » des cas 2 à 5 est lue à part.
 */
export function runCases(seed: number, variant: Variant): CaseRow[] {
  const track = variantTrack(seed, variant);
  const rows: CaseRow[] = [];
  track.volcanoes.forEach((v, vi) => {
    const world = volcanoWorld(seed, vi, variant);
    for (const caseId of ALL_CASES) {
      for (const sc of scenariosFor(caseId, track, v, variant.cfg)) {
        const r = runFrom(world, sc.x0, sc.opts);
        const ok = caseId === 1
          ? r.lava && (r.landX === null || r.landX < v.xReception)
          : passesVolcano(r, v) && ((caseId !== 5 && caseId !== 'turbo') || r.landX! < v.xEnd);
        rows.push({ caseId, seed, vi, ok, lipSpeed: r.lipSpeed ?? NaN, lava: r.lava, detail: sc.name, steps: Math.round(r.seconds * STEPS_PER_SECOND) });
      }
    }
  });
  // Scénario (i), comme tests/slow/volcans-slow.test.ts.
  const { slices } = track;
  for (let i = 0; i + 2 < slices.length; i++) {
    if (slices[i].type !== 'rampe-saut' || slices[i + 1].type !== 'plat' || slices[i + 2].type !== 'rampe-volcan') continue;
    const vi = track.volcanoes.findIndex((vv) => vv.xLancement === slices[i + 2].xStart);
    const v = track.volcanoes[vi];
    for (const before of [20, 40, 60]) {
      const turboAt = slices[i].xStart - before;
      let x0 = Math.max(1, turboAt - 40);
      for (const vv of track.volcanoes) if (x0 >= vv.xLancement && x0 < vv.xReception) x0 = vv.xReception;
      const world = cropFor(seed, variant, x0 - 10, v.xEnd + CROP_AFTER);
      const r = runFrom(world, x0, { throttle: () => true, turboAt, maxSeconds: 40, volcano: v, cfg: variant.cfg });
      const ok = !r.lava && r.landX !== null && r.landX >= v.xReception && r.landX < v.xEnd && !r.flipped && r.wheelsBelow;
      rows.push({ caseId: 'i', seed, vi, ok, lipSpeed: r.lipSpeed ?? NaN, lava: r.lava, detail: `turbo à −${before} m`, steps: Math.round(r.seconds * STEPS_PER_SECOND) });
    }
  }
  return rows;
}

/**
 * Tableau (b) de la tâche 4 : lancée à V_MAX en xLancement, doigt levé T s à partir de xElanStart − 10,
 * puis gaz ; T de 0 à 2,5 s au pas de 0,05 s (la grille au pas de 0,25 s de la phase 1 donnait une
 * médiane de 1,5 s qui n'était qu'un artefact : relecture adversariale de la tâche 5c).
 */
export const RELEASE_STEP = 0.05;
export const RELEASE_SECONDS = Array.from({ length: Math.round(2.5 / RELEASE_STEP) + 1 }, (_, i) => Math.round(i * RELEASE_STEP * 100) / 100);
export interface ReleaseRow { seed: number; vi: number; T: number; ok: boolean; lava: boolean; lipSpeed: number }
export function runReleases(seed: number, variant: Variant): ReleaseRow[] {
  const track = variantTrack(seed, variant);
  const rows: ReleaseRow[] = [];
  track.volcanoes.forEach((v, vi) => {
    const world = volcanoWorld(seed, vi, variant);
    for (const T of RELEASE_SECONDS) {
      const xRelease = v.xElanStart - 10;
      let releasedAt: number | null = null;
      const throttle = (t: number, x: number): boolean => {
        if (releasedAt === null && x >= xRelease) releasedAt = t;
        return releasedAt === null || t >= releasedAt + T;
      };
      const r = runFrom(world, v.xLancement, { throttle, launchSpeed: variant.cfg.V_MAX, maxSeconds: 20, volcano: v, cfg: variant.cfg });
      rows.push({ seed, vi, T, ok: passesVolcano(r, v), lava: r.lava, lipSpeed: r.lipSpeed ?? NaN });
    }
  });
  return rows;
}

/** Rampes-saut (scénarios de tests/rampes.test.ts) : atterrissage < 45°, jamais retournée, roues sous le châssis. */
export interface RampRow { seed: number; x: number; factor: number; scenario: string; ok: boolean; touchAngle: number; maxAngle: number; steps: number }
export function runRamps(seed: number, variant: Variant): RampRow[] {
  const { cfg } = variant;
  const track = variantTrack(seed, variant);
  const rows: RampRow[] = [];
  const lipDx = cfg.RAMP_LENGTH * Math.cos(cfg.RAMP_ANGLE);
  const after = 3 * STEPS_PER_SECOND;
  for (const ramp of track.slices.filter((s) => s.type === 'rampe-saut')) {
    let restX = ramp.xStart - 40;
    for (const v of track.volcanoes) if (restX >= v.xLancement && restX < v.xReception) restX = v.xReception;
    const world = cropFor(seed, variant, restX - 10, ramp.xEnd + 80);
    for (const factor of [1, cfg.TURBO_FACTOR]) {
      const target = cfg.V_MAX * factor;
      for (const [name, x0, v0] of [['arrêt 40 m avant', restX, 0], ['lancée 3 m avant', ramp.xStart - 3, target]] as [string, number, number][]) {
        const car = freshCar(world, x0, cfg);
        if (v0 > 0) launch(world, car, x0, v0, cfg);
        const contact = newContact();
        const jump = new JumpTracker(ramp.xStart + lipDx);
        let rampSpeed = NaN; let flight = NaN; let touchAngle = NaN; let maxAngle = 0; let stepsAfter = 0; let i = 1;
        for (; i <= 15 * STEPS_PER_SECOND; i++) {
          const s = step(world, car, true, factor, contact, (i - 1) * cfg.PHYSICS_DT, cfg);
          if (Number.isNaN(rampSpeed) && s.x >= ramp.xStart) rampSpeed = carSpeedMps(car);
          jump.update(i, s);
          if (!jump.touchStep) continue;
          const angle = carAngle(car);
          if (jump.touchStep === i) { flight = (i - jump.flightStart) / STEPS_PER_SECOND; touchAngle = angle; }
          maxAngle = Math.max(maxAngle, Math.abs(angle));
          stepsAfter = i - jump.touchStep;
          if (stepsAfter >= after) break;
        }
        const ok = (v0 === 0 || rampSpeed > 0.7 * target) && flight > 0 && stepsAfter === after
          && Math.abs(touchAngle) < 45 * DEG && maxAngle <= cfg.FLIP_ANGLE && wheelsBelowChassis(car);
        rows.push({ seed, x: ramp.xStart, factor, scenario: name, ok, touchAngle: touchAngle / DEG, maxAngle: maxAngle / DEG, steps: i });
      }
    }
  }
  return rows;
}

/** Cas 6 (doigt posé, Galahad seul) et cas 7 (doigt levé 30 %), courses complètes (monde complet). */
export interface RaceRow { caseId: 6 | 7; seed: number; ok: boolean; finishedAt: number | null; respawns: number; lava: number; maxPerVolcano: number; maxStuck: number; stars: number }
export function runRace(caseId: 6 | 7, seed: number, variant: Variant): RaceRow {
  const track = variantTrack(seed, variant);
  const throttle = caseId === 6 ? () => true : liftedPattern(seed, 0.3);
  const r = simulateRace(track, { throttle, maxSeconds: 240, cfg: variant.cfg });
  const perVolcano = new Map<string, number>();
  let lava = 0;
  for (const e of r.respawns) {
    if (e.type !== 'respawn') continue;
    if (e.reason === 'lava') lava++;
    const v = nearestVolcanoZone(track, e.x) ?? volcanoAhead(track, e.x);
    const key = v ? v.xLava.toFixed(1) : 'none';
    perVolcano.set(key, (perVolcano.get(key) ?? 0) + 1);
  }
  const maxPerVolcano = Math.max(0, ...perVolcano.values());
  const ok = caseId === 6
    ? r.respawns.length === 0 && r.finishedAt !== null && r.finishedAt >= 110 && r.finishedAt <= 170 && r.maxStuckSeconds <= 2.1
      && r.starsTaken.length >= 6 && r.starsTaken.length <= 14
    : maxPerVolcano <= 2 && r.maxStuckSeconds <= 2.1 && r.finishedAt !== null && r.finishedAt < 240;
  return { caseId, seed, ok, finishedAt: r.finishedAt, respawns: r.respawns.length, lava, maxPerVolcano, maxStuck: r.maxStuckSeconds, stars: r.starsTaken.length };
}

// ——— Statistiques, impression, fichiers de résultats ———

export const pct = (a: number, b: number): string => (b ? `${((100 * a) / b).toFixed(2)} %` : '—');
const quantile = (xs: number[], p: number): number => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};
export const g2 = (n: number | null): string => (n !== null && Number.isFinite(n) ? n.toFixed(2) : '—');
/** min / p1 / p10 / médiane / p90 / max. */
export const dist = (xs: number[]): string =>
  [0, 0.01, 0.1, 0.5, 0.9, 1].map((p) => g2(quantile(xs, p))).join(' / ');

/** Résumé d'un lot d'échantillons (taux de chute, distributions par issue). */
export function summarize(samples: PhaseSample[]): string {
  const lines: string[] = [];
  const by = (o: Outcome) => samples.filter((s) => s.outcome === o);
  const falls = by('lave');
  const volcanoes = new Set(samples.map((s) => `${s.seed}:${s.vi}`)).size;
  lines.push(`${samples.length} runs sur ${volcanoes} volcans : lave ${falls.length} (${pct(falls.length, samples.length)}), autre ${by('autre').length}, passe ${by('passe').length} ; `
    + `chutes à plus de ${FAST_FALL_LIP_SPEED} m/s au sommet : ${falls.filter((s) => s.lipSpeed > FAST_FALL_LIP_SPEED).length}`);
  for (const f of FAMILIES) {
    const fs = samples.filter((s) => s.family === f);
    const ff = fs.filter((s) => s.outcome === 'lave').length;
    if (!fs.length) continue;
    lines.push(`  ${f.padEnd(11)} : ${String(fs.length).padStart(5)} runs, lave ${String(ff).padStart(3)} (${pct(ff, fs.length)}), arrivée à xLancement ${dist(fs.map((s) => s.arrival))} m/s, garde ${dist(fs.map((s) => s.clearance))} m`);
  }
  lines.push(`  volcans avec au moins une chute : ${new Set(falls.map((s) => `${s.seed}:${s.vi}`)).size} / ${volcanoes}`);
  lines.push(`  garde au-dessus du capteur de lave (m), tous runs : ${dist(samples.map((s) => s.clearance))}`);
  const low = samples.filter((s) => Number.isFinite(s.clearance)).sort((a, b) => a.clearance - b.clearance).slice(0, 5);
  if (low.length) lines.push(`  gardes les plus basses :\n    ${low.map(describeSample).join('\n    ')}`);
  lines.push('  par issue (min / p1 / p10 / médiane / p90 / max) :');
  for (const o of ['passe', 'lave', 'autre'] as Outcome[]) {
    const set = by(o);
    if (!set.length) continue;
    lines.push(`  ${o.padEnd(5)} (${set.length}) : sommet ${dist(set.map((s) => s.lipSpeed))} m/s ; direction au sommet ${dist(set.map((s) => s.lipDir))}° ; `
      + `écart roue arrière–sol sur la rampe, max ${dist(set.map((s) => s.rearGapMax))} m, moyen ${dist(set.map((s) => s.rearGapMean))} m`);
  }
  return lines.join('\n');
}

/** Une ligne par run (chutes et autres issues). */
export function describeSample(s: PhaseSample): string {
  return `seed ${s.seed} volcan ${s.vi} [${s.label}] → ${s.outcome}${s.lavaPart ? ` (${s.lavaPart})` : ''} : arrivée ${g2(s.arrival)}, pied ${g2(s.rampSpeed)}, `
    + `sommet ${g2(s.lipSpeed)} m/s à ${g2(s.lipDir)}° ; écart roue arrière max ${g2(s.rearGapMax)} m, moyen ${g2(s.rearGapMean)}, au sommet ${g2(s.rearGapAtLip)} ; `
    + `frappe ${Number.isFinite(s.rearStrikeDx) ? `à xLip ${s.rearStrikeDx >= 0 ? '+' : '−'} ${Math.abs(s.rearStrikeDx).toFixed(2)} m` : 'aucune'} ; `
    + `garde ${g2(s.clearance)} m ; atterrissage ${s.landX === null ? '—' : s.landX.toFixed(1)}`;
}

/**
 * Accès à node (le projet n'a pas @types/node) : variables d'environnement et fichiers des morceaux,
 * par `process.getBuiltinModule` (Node ≥ 22.3), typés au strict nécessaire.
 */
interface NodeFs {
  mkdirSync(path: string, opts: { recursive: boolean }): void;
  writeFileSync(path: string, data: string): void;
  readFileSync(path: string, encoding: 'utf8'): string;
  readdirSync(path: string): string[];
}
const nodeProcess = (globalThis as unknown as {
  process: { env: Record<string, string | undefined>; getBuiltinModule(id: 'node:fs'): NodeFs };
}).process;
export const env = nodeProcess.env;
const fs = (): NodeFs => nodeProcess.getBuiltinModule('node:fs');

/** Résultats d'un morceau (candidat × graines) écrits en JSON (dossier `dir`), relus pour la fusion. */
export interface Shard {
  variant: string; seeds: number[]; samples: PhaseSample[]; cases: CaseRow[]; releases: ReleaseRow[]; ramps: RampRow[]; races: RaceRow[];
  seconds: { samples: number; cases: number; releases: number; ramps: number; races: number };
}
export function writeShard(dir: string, shard: Shard): void {
  fs().mkdirSync(dir, { recursive: true });
  fs().writeFileSync(`${dir}/${shard.variant}-${shard.seeds.join('_')}.json`, JSON.stringify(shard));
}
export function readShards(dir: string): Shard[] {
  return fs().readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs().readFileSync(`${dir}/${f}`, 'utf8')) as Shard);
}

/** Tableau d'un candidat à partir de ses morceaux fusionnés. */
export function variantReport(variant: Variant, shards: Shard[]): string {
  const samples = shards.flatMap((s) => s.samples);
  const cases = shards.flatMap((s) => s.cases);
  const releases = shards.flatMap((s) => s.releases);
  const ramps = shards.flatMap((s) => s.ramps);
  const races = shards.flatMap((s) => s.races);
  const seeds = [...new Set(shards.flatMap((s) => s.seeds))].sort((a, b) => a - b);
  const sec = (k: keyof Shard['seconds']) => shards.reduce((a, s) => a + s.seconds[k], 0);
  const lines = [`=== ${variant.label} (graines ${seeds.join(',')}) ===`];
  if (samples.length) {
    lines.push(summarize(samples));
    const bad = samples.filter((s) => s.outcome !== 'passe');
    if (bad.length) lines.push(`  runs qui ne passent pas :\n    ${bad.map(describeSample).join('\n    ')}`);
  }
  if (cases.length) {
    const ids: (CaseId | 'i')[] = [...ALL_CASES, 'i'];
    lines.push('  cas de la tâche 4 (tous les volcans des graines) :');
    for (const id of ids) {
      const rs = cases.filter((c) => c.caseId === id);
      if (!rs.length) continue;
      const ko = rs.filter((c) => !c.ok);
      const margin = id === 1 || id === 'i' ? '' : `, sommet ≥ seuil + 1 : ${rs.filter((c) => c.lipSpeed >= LIP_SPEED_THRESHOLD + 1).length}/${rs.length}`;
      // Les morceaux relus en JSON ont NaN et ±Infinity changés en null : on ne garde que les nombres finis.
      const speeds = rs.map((c) => c.lipSpeed).filter(Number.isFinite);
      const lo = Math.min(...speeds);
      const hi = Math.max(...speeds);
      lines.push(`    cas ${String(id).padEnd(11)} : ${rs.length - ko.length}/${rs.length} tenus, sommet ${lo.toFixed(4)}–${hi.toFixed(4)} m/s (écart ${(hi - lo).toPrecision(2)})${margin}`
        + (ko.length ? ` ; NON TENUS : ${ko.map((c) => `g${c.seed} v${c.vi} ${c.detail} (sommet ${g2(c.lipSpeed)}, lave ${c.lava})`).join(' ; ')}` : ''));
    }
    const ci = cases.filter((c) => seeds.includes(c.seed) && [0, 1, 2].includes(c.seed) && (c.vi === 0 || c.caseId === 3) && c.caseId !== 'i');
    lines.push(`    pas simulés des cas joués en CI (premier volcan des graines 0 à 2, cas 3 sur tous) : ${ci.reduce((a, c) => a + c.steps, 0)}`);
  }
  if (releases.length) {
    lines.push('  tableau (b) : lancée à V_MAX, doigt levé T s depuis xElanStart − 10 (volcans passés / volcans) :');
    const volcanoes = [...new Set(releases.map((r) => `${r.seed}:${r.vi}`))];
    lines.push(`    ${RELEASE_SECONDS.map((T) => { const rs = releases.filter((r) => r.T === T); return `T ${T} s : ${rs.filter((r) => r.ok).length}/${rs.length}`; }).join(' ; ')}`);
    const Ts = [...new Set(releases.map((r) => r.T))].sort((a, b) => a - b);
    const per = volcanoes.map((key) => {
      const rs = Ts.map((T) => releases.find((x) => `${x.seed}:${x.vi}` === key && x.T === T)!);
      const firstKo = rs.findIndex((r) => !r.ok);
      const strict = firstKo < 0 ? Ts[Ts.length - 1] : firstKo === 0 ? -1 : Ts[firstKo - 1];
      const lastOk = Math.max(-1, ...rs.filter((r) => r.ok).map((r) => r.T));
      return { key, strict, lastOk };
    });
    const strict = per.map((p) => p.strict);
    const lastOk = per.map((p) => p.lastOk);
    const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
    lines.push(`    doigt levé toléré au sens strict (plus grand T dont tous les T' ≤ T passent), par volcan : min ${g2(Math.min(...strict))} / médiane ${g2(quantile(strict, 0.5))} / moyenne ${g2(mean(strict))} / max ${g2(Math.max(...strict))} s`);
    lines.push(`    plus grand T qui passe (trous compris) : min ${g2(Math.min(...lastOk))} / médiane ${g2(quantile(lastOk, 0.5))} / moyenne ${g2(mean(lastOk))} / max ${g2(Math.max(...lastOk))} s ; `
      + `volcans avec un trou (un T qui tombe sous un T qui passe) : ${per.filter((p) => p.lastOk > p.strict).map((p) => `${p.key} (${g2(p.strict)} → ${g2(p.lastOk)})`).join(', ') || 'aucun'}`);
  }
  if (ramps.length) {
    const ko = ramps.filter((r) => !r.ok);
    const finiteMax = (xs: number[]) => Math.max(...xs.filter(Number.isFinite));
    lines.push(`  rampes-saut (scénarios de tests/rampes.test.ts) : ${ramps.length - ko.length}/${ramps.length} tenus, angle au contact max ${g2(finiteMax(ramps.map((r) => Math.abs(r.touchAngle))))}°, `
      + `angle max après ${g2(finiteMax(ramps.map((r) => r.maxAngle)))}°, pas simulés ${ramps.reduce((a, r) => a + r.steps, 0)}`
      + (ko.length ? ` ; NON TENUS : ${ko.map((r) => `g${r.seed} x ${r.x.toFixed(1)} ×${r.factor} ${r.scenario}`).join(' ; ')}` : ''));
  }
  if (races.length) {
    for (const id of [6, 7] as const) {
      const rs = races.filter((r) => r.caseId === id).sort((a, b) => a.seed - b.seed);
      if (!rs.length) continue;
      lines.push(`  cas ${id} (course ${id === 6 ? 'doigt posé' : 'doigt levé 30 %'}, Galahad seul) : ${rs.filter((r) => r.ok).length}/${rs.length} tenus ; `
        + rs.map((r) => `g${r.seed} ${g2(r.finishedAt)} s, ${r.respawns} resp. (lave ${r.lava}, max ${r.maxPerVolcano}/volcan), ${r.stars} ét.${r.ok ? '' : ' NON TENU'}`).join(' ; '));
    }
  }
  lines.push(`  durées (s, cumul des morceaux) : échantillonnage ${sec('samples').toFixed(0)}, cas ${sec('cases').toFixed(0)}, (b) ${sec('releases').toFixed(0)}, rampes ${sec('ramps').toFixed(0)}, courses ${sec('races').toFixed(0)}`);
  return lines.join('\n');
}
