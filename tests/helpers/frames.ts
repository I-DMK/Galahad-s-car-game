// Écrans simulés et rejeu du rendu (plan B, tâche 5f ; tremblement §1, §6) : on rejoue des trajectoires
// enregistrées pas à pas à travers les mêmes `runFrame`, `cameraTarget` et `Camera` que `Game` ; seule la
// source des pas change (poses enregistrées au lieu de `stepRace`). Puis on mesure les épisodes de
// tremblement de Galahad à l'écran.
import type { Config } from '../../src/config';
import { CONFIG } from '../../src/config';
import { cameraTarget, runFrame, type FrameState } from '../../src/loop/frame';
import { PoseHistory, type CarPose } from '../../src/loop/interpolation';
import { Camera } from '../../src/render/camera';
import { createRaceSim, posesOf, stepRace, teleportedOf } from '../../src/sim/simulate';
import { heightAt } from '../../src/track/query';
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
 * `teleported[k]` = voitures réapparues pendant le pas k (vide pour k = 0).
 */
export interface Trajectory { poses: CarPose[][]; teleported: ReadonlySet<number>[] }

/** Course doigt posé de `seconds` sur la piste de 1 680 m de `seed` (`posesOf` après chaque `stepRace`). */
export function recordTrajectory(seed: number, seconds: number, robots: boolean, cfg: Config = CONFIG): Trajectory {
  const sim = createRaceSim(trackFor(seed), cfg, { robots });
  const poses: CarPose[][] = [posesOf(sim)];
  const teleported: ReadonlySet<number>[] = [new Set()];
  for (let i = 0; i < Math.round(seconds / cfg.PHYSICS_DT); i++) {
    stepRace(sim, true);
    poses.push(posesOf(sim));
    teleported.push(teleportedOf(sim));
  }
  return { poses, teleported };
}

/**
 * physique : exactement 1 pas par image ; actuel : cadence de l'écran, sans interpolation
 * (`runFrame(…, interpolate = false)`, le rendu d'avant la tâche 5f) ; interpolé : `runFrame`, comme `Game`.
 */
export type RenderMode = 'physique' | 'actuel' | 'interpolé';

/**
 * Rejoue `traj` sur l'écran `model` : position écran (px CSS, vue 1280 × 800) du châssis de Galahad à
 * chaque image, après la caméra. En mode physique, une image par pas à intervalles de PHYSICS_DT.
 */
export function replayScreenX(
  traj: Trajectory, track: Track, model: ScreenModel, mode: RenderMode, cfg: Config = CONFIG,
): { tMs: number[]; x: number[] } {
  const dt = cfg.PHYSICS_DT;
  const camera = new Camera(cfg);
  const s: FrameState = { acc: 0, history: new PoseHistory() };
  s.history.reset(traj.poses[0]);
  let k = 0;
  const step = () => {
    if (++k >= traj.poses.length) return 'stop' as const;
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
    const elapsed = Math.min(Math.max(0, (now - last) / 1000), 1);
    last = now;
    const r = mode === 'physique'
      ? runFrame(s, dt, cfg, step, false)
      : runFrame(s, elapsed, cfg, step, mode === 'interpolé');
    if (r.stopped) break;
    const target = cameraTarget(r.poses[0], (xx) => heightAt(track, xx));
    camera.update(target.x, target.y, target.speed, mode === 'physique' ? dt : elapsed);
    tMs.push(now);
    x.push(camera.worldToScreen(r.poses[0].chassis, VIEW_W, VIEW_H).x);
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
 * Épisodes de `r` que la trajectoire n'explique pas : aucun à-coup du rejeu `physique` (1 pas par image)
 * à moins de EPISODE_MS de l'épisode. Un choc réel (contact entre voitures) donne 2 à-coups en physique et
 * peut en donner 3 à une autre phase d'échantillonnage : il vient de la trajectoire, pas de la cadence.
 */
export function cadenceEpisodes(
  r: { tMs: number[]; x: number[] }, physique: { tMs: number[]; x: number[] }, excludeMs: readonly number[] = [],
): number {
  const phys = jerkTimes(physique);
  return episodeWindows(r, excludeMs)
    .filter(([a, b]) => !phys.some((t) => t >= a - EPISODE_MS && t <= b + EPISODE_MS)).length;
}
