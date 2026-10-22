// Écrans simulés et rejeu du rendu (plan B, tâche 5f ; tremblement §1, §6) : on rejoue des trajectoires
// enregistrées pas à pas à travers les mêmes `runFrame`, `presentFrame` et `Camera` que `Game` ; seule la
// source des pas change (poses enregistrées au lieu de `stepRace`). Puis on mesure les épisodes de
// tremblement de Galahad à l'écran.
import type { Config } from '../../src/config';
import { CONFIG } from '../../src/config';
import { runFrame, type FrameState, type StepOutcome } from '../../src/loop/frame';
import { PoseHistory, type CarPose } from '../../src/loop/interpolation';
import { Camera } from '../../src/render/camera';
import { presentFrame, stepOutcome } from '../../src/sim/present';
import { createRaceSim, posesOf, stepRace } from '../../src/sim/simulate';
import { mulberry32 } from '../../src/track/rng';
import type { Track } from '../../src/track/types';
import { trackFor } from './runs';

/** Écran : fréquence (Hz), gigue gaussienne des horodatages (σ, ms), graine (phase et gigue). */
export interface ScreenModel { hz: number; jitterMs: number; seed: number }

/** Vue de référence (px CSS) : 1280 × 800, la tablette. */
export const VIEW_W = 1280;
export const VIEW_H = 800;

/**
 * Horodatages (ms) des images sur `seconds` : phase tirée dans [0, période), puis une image par période
 * avec une gigue gaussienne σ = jitterMs (Box-Muller sur mulberry32(seed)).
 */
export function frameTimesMs(model: ScreenModel, seconds: number): number[] {
  const rng = mulberry32(model.seed);
  const period = 1000 / model.hz;
  const phase = rng() * period;
  const gauss = (): number => {
    const u = 1 - rng(); // (0, 1] : log défini
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };
  const out: number[] = [];
  for (let k = 0; phase + k * period <= seconds * 1000; k++) out.push(phase + k * period + gauss() * model.jitterMs);
  return out;
}

/**
 * Trajectoire enregistrée : `poses[k]` = poses de toutes les voitures après k pas (k = 0 : départ),
 * `teleported[k]` = voitures réapparues pendant le pas k (vide pour k = 0) ; course à 5 voitures si `robots`.
 */
export interface Trajectory { poses: CarPose[][]; teleported: ReadonlySet<number>[]; robots: boolean }

/** Course doigt posé de `seconds` sur la piste de 1 680 m de `seed` (`stepOutcome` après chaque `stepRace`, comme `Game`). */
export function recordTrajectory(seed: number, seconds: number, robots: boolean, cfg: Config = CONFIG): Trajectory {
  const sim = createRaceSim(trackFor(seed, cfg), cfg, { robots });
  const poses: CarPose[][] = [posesOf(sim)];
  const teleported: ReadonlySet<number>[] = [new Set()];
  for (let i = 0; i < Math.round(seconds / cfg.PHYSICS_DT); i++) {
    stepRace(sim, true);
    const out = stepOutcome(sim);
    if (out === 'stop' || 'rebuilt' in out) throw new Error('stepOutcome : issue inattendue');
    poses.push(out.poses);
    teleported.push(out.teleported);
  }
  return { poses, teleported, robots };
}

/**
 * physique : exactement 1 pas par image ; actuel : cadence de l'écran, sans interpolation
 * (`runFrame(…, interpolate = false)`, le rendu d'avant la tâche 5f) ; interpolé : `runFrame`, comme `Game`.
 */
export type RenderMode = 'physique' | 'actuel' | 'interpolé';

/**
 * Rejoue `traj` sur l'écran `model` à travers `runFrame` puis `presentFrame` (caméra et scène, comme
 * `Game.present`) : position écran (px CSS, vue 1280 × 800) de Galahad **dans la scène dessinée** à chaque
 * image. La course n'avance pas : un `RaceSim` neuf sur `track` ne sert qu'à `sceneOf` (couleurs, étoiles) ;
 * les voitures viennent des poses. En mode physique, une image par pas à intervalles de PHYSICS_DT.
 */
export function replayScreenX(
  traj: Trajectory, track: Track, model: ScreenModel, mode: RenderMode, cfg: Config = CONFIG,
): { tMs: number[]; x: number[] } {
  const dt = cfg.PHYSICS_DT;
  const sim = createRaceSim(track, cfg, { robots: traj.robots });
  const camera = new Camera(cfg);
  const s: FrameState = { acc: 0, history: new PoseHistory() };
  s.history.reset(traj.poses[0]);
  let k = 0;
  const step = (): StepOutcome => {
    if (++k >= traj.poses.length) return 'stop';
    return { poses: traj.poses[k], teleported: traj.teleported[k] };
  };
  const seconds = (traj.poses.length - 1) * dt;
  const times = mode === 'physique'
    ? Array.from({ length: traj.poses.length - 1 }, (_, i) => (i + 1) * dt * 1000)
    : frameTimesMs(model, seconds);
  const tMs: number[] = [];
  const x: number[] = [];
  let last = 0;
  for (const now of times) {
    const elapsed = mode === 'physique' ? dt : Math.min(Math.max(0, (now - last) / 1000), 1);
    last = now;
    const r = runFrame(s, elapsed, cfg, step, mode === 'interpolé');
    if (r.stopped) break;
    const scene = presentFrame(sim, r, camera, elapsed);
    // Galahad est dessiné en dernier (au-dessus des copains).
    const galahad = scene.cars[scene.cars.length - 1];
    tMs.push(now);
    x.push(camera.worldToScreen(galahad, VIEW_W, VIEW_H).x);
  }
  return { tMs, x };
}

/** px : à-coup = image où |Δ²x| dépasse ce seuil. */
export const JERK_PX = 4;
/** Épisode : au moins EPISODE_JERKS à-coups en EPISODE_MS. */
export const EPISODE_JERKS = 3;
export const EPISODE_MS = 500;
/** Téléportation à l'écran (|Δx| > TELEPORT_PX) : à-coups exclus à ± TELEPORT_GUARD_MS. */
export const TELEPORT_PX = 60;
export const TELEPORT_GUARD_MS = 1000;

/** Instants (ms) des à-coups, hors ± TELEPORT_GUARD_MS d'une téléportation à l'écran et des instants `excludeMs`. */
export function jerkTimes(r: { tMs: number[]; x: number[] }, excludeMs: readonly number[] = []): number[] {
  const { tMs, x } = r;
  const guards = [...excludeMs];
  for (let i = 1; i < x.length; i++) if (Math.abs(x[i] - x[i - 1]) > TELEPORT_PX) guards.push(tMs[i]);
  const out: number[] = [];
  for (let i = 2; i < x.length; i++) {
    if (Math.abs(x[i] - 2 * x[i - 1] + x[i - 2]) <= JERK_PX) continue;
    if (guards.some((g) => Math.abs(tMs[i] - g) <= TELEPORT_GUARD_MS)) continue;
    out.push(tMs[i]);
  }
  return out;
}

/**
 * Épisodes de tremblement (tremblement §1) : au moins 3 à-coups (|Δ²x| > 4 px) en 0,5 s ; un épisode
 * dure tant que les à-coups suivants arrivent à moins de 0,5 s. Téléportations exclues (`jerkTimes`).
 * Renvoie [début, fin] (ms) de chaque épisode.
 */
export function episodeWindows(r: { tMs: number[]; x: number[] }, excludeMs: readonly number[] = []): [number, number][] {
  const j = jerkTimes(r, excludeMs);
  const out: [number, number][] = [];
  let i = 0;
  while (i + EPISODE_JERKS - 1 < j.length) {
    if (j[i + EPISODE_JERKS - 1] - j[i] <= EPISODE_MS) {
      let e = i + EPISODE_JERKS - 1;
      while (e + 1 < j.length && j[e + 1] - j[e] <= EPISODE_MS) e++;
      out.push([j[i], j[e]]);
      i = e + 1;
    } else {
      i++;
    }
  }
  return out;
}

/** Nombre d'épisodes de tremblement (`episodeWindows`). */
export function shakeEpisodes(r: { tMs: number[]; x: number[] }, excludeMs: readonly number[] = []): number {
  return episodeWindows(r, excludeMs).length;
}

/**
 * Épisodes de `r` (`episodeWindows`), dont ceux que la trajectoire explique (`masked`) : le rejeu
 * `physique` (1 pas par image) a au moins un à-coup dans la fenêtre de l'épisode élargie de EPISODE_MS, et
 * l'épisode n'a **au plus qu'un** à-coup de plus que lui dans cette fenêtre. Un choc réel entre voitures
 * donne 2 à-coups en physique et peut en donner 3 à une autre phase d'échantillonnage (graine 0, 60,000 Hz,
 * 49,8 s) : 1 épisode en interpolé pour 0 en physique, qui vient de la trajectoire, pas de la cadence.
 * `cadence` = total − masked.
 */
export function classifyEpisodes(
  r: { tMs: number[]; x: number[] }, physique: { tMs: number[]; x: number[] }, excludeMs: readonly number[] = [],
): { total: number; masked: number; cadence: number } {
  const own = jerkTimes(r, excludeMs);
  const phys = jerkTimes(physique, excludeMs);
  const windows = episodeWindows(r, excludeMs);
  const inside = (ts: number[], a: number, b: number) => ts.filter((t) => t >= a && t <= b).length;
  const masked = windows.filter(([a, b]) => {
    const p = inside(phys, a - EPISODE_MS, b + EPISODE_MS);
    return p >= 1 && inside(own, a - EPISODE_MS, b + EPISODE_MS) <= p + 1;
  }).length;
  return { total: windows.length, masked, cadence: windows.length - masked };
}
