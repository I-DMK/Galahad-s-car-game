// Courses enregistrées (plan B, tâche 5e, Step 6) : une course simulée une seule fois, poses de toutes les pièces
// de toutes les voitures à chaque pas, puis évaluation hors ligne des capteurs d'étoiles candidats (`sensorHits`).
// Les capteurs d'étoiles n'agissent pas sur la trajectoire d'une voiture qui ne les touche pas : une étoile
// haute ajoutée après coup est jugée sur la course enregistrée sans elle. Géométrie hors ligne : châssis
// rectangle CAR_LENGTH × CAR_HEIGHT (le chanfrein de Matter le rend plus petit), roues disques de rayon
// WHEEL_RADIUS (les 48-gones de Matter y sont inscrits), capteur disque de rayon STAR_SENSOR_RADIUS (le polygone
// de Matter y est inscrit) : l'évaluation est prudente, et la marge (5 cm par défaut) couvre le reste (les
// paires de Matter sont détectées avant la résolution des positions, au mm près).
import { activateTurbo } from '../../src/cars/turbo';
import { CONFIG, type Config } from '../../src/config';
import type { CarPose } from '../../src/loop/interpolation';
import { createRaceSim, posesOf, stepRace } from '../../src/sim/simulate';
import { generateTrack } from '../../src/track/generate';
import type { Track } from '../../src/track/types';

/** Rayon (m) du capteur d'une étoile (`STAR_RADIUS` de src/physics/stars.ts). */
export const STAR_SENSOR_RADIUS = 0.5;
/** Marge (m) par défaut de l'évaluation hors ligne. */
export const SENSOR_MARGIN = 0.05;
export const RECORD_TRACK_LENGTH = 1680;

type Dims = Pick<Config, 'CAR_LENGTH' | 'CAR_HEIGHT' | 'WHEEL_RADIUS'>;

/**
 * Distance (m) entre le bord du capteur d'étoile centré en `star` et la pièce de la pose la plus proche
 * (négative si elles se chevauchent) : châssis rectangle tourné de l'angle de la pose, roues disques.
 */
export function poseClearance(pose: CarPose, star: { x: number; y: number }, cfg: Dims = CONFIG): number {
  const { x, y, angle } = pose.chassis;
  const dx = star.x - x;
  const dy = star.y - y;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // Repère du châssis (angle monde anti-horaire) : rotation de −angle.
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  const hx = cfg.CAR_LENGTH / 2;
  const hy = cfg.CAR_HEIGHT / 2;
  const ox = Math.max(0, Math.abs(lx) - hx);
  const oy = Math.max(0, Math.abs(ly) - hy);
  let d = Math.hypot(ox, oy);
  for (const w of pose.wheels) d = Math.min(d, Math.hypot(star.x - w.x, star.y - w.y) - cfg.WHEEL_RADIUS);
  return d - STAR_SENSOR_RADIUS;
}

export interface RecordedRace {
  track: Track;
  /** poses[pas][index de voiture], après chaque pas (Galahad = index 0). */
  poses: CarPose[][];
  /** Chassis x de chaque voiture à chaque pas : xs[index de voiture][pas]. */
  xs: Float64Array[];
}

/**
 * Une course enregistrée : piste de la graine (1 680 m, `cfg`), Galahad doigt posé sans jamais sauter, copains
 * au driver de la course si `robots` ; turbo forcé de Galahad au premier pas où son châssis passe chaque x de
 * `turboBefore`. Jusqu'à l'arrivée de toutes les voitures + 1 s, ou `maxSeconds`.
 */
export function recordRace(
  seed: number, opts: { robots: boolean; turboBefore?: number[]; cfg?: Config; maxSeconds?: number },
): RecordedRace {
  const cfg = opts.cfg ?? CONFIG;
  const track = generateTrack(seed, RECORD_TRACK_LENGTH, cfg);
  const sim = createRaceSim(track, cfg, { robots: opts.robots });
  const pending = [...(opts.turboBefore ?? [])].sort((a, b) => a - b);
  const steps = Math.round((opts.maxSeconds ?? 240) / cfg.PHYSICS_DT);
  const poses: CarPose[][] = [];
  const xs = sim.cars.map(() => new Float64Array(steps));
  let allDoneAt: number | null = null;
  for (let i = 0; i < steps; i++) {
    const g = sim.cars[0];
    while (pending.length > 0 && g.state.progress >= pending[0]) {
      pending.shift();
      activateTurbo(g.state, sim.time, cfg);
    }
    stepRace(sim, true);
    const p = posesOf(sim);
    poses.push(p);
    p.forEach((pose, k) => { xs[k][i] = pose.chassis.x; });
    if (allDoneAt === null && sim.cars.every((c) => c.state.finishedAt !== null)) allDoneAt = sim.time;
    if (allDoneAt !== null && sim.time >= allDoneAt + 1) break;
  }
  return { track, poses, xs: xs.map((a) => a.slice(0, poses.length)) };
}

/** Plus petite distance (m) capteur–pièce sur la course, par voiture, aux pas où son châssis est à moins de `reach` m de l'étoile. */
export function minClearanceByCar(rec: RecordedRace, star: { x: number; y: number }, cfg: Dims = CONFIG, reach = 3): number[] {
  return rec.xs.map((xsCar, k) => {
    let best = Infinity;
    for (let i = 0; i < xsCar.length; i++) {
      if (Math.abs(xsCar[i] - star.x) > reach) continue;
      best = Math.min(best, poseClearance(rec.poses[i][k], star, cfg));
    }
    return best;
  });
}

/**
 * Hors ligne : pas et voitures dont une pièce (châssis rectangle, roues disques) touche le disque du capteur
 * (rayon 0,5 m) à `margin` près (5 cm par défaut).
 */
export function sensorHits(
  rec: { poses: CarPose[][] }, star: { x: number; y: number }, cfg: Dims = CONFIG, margin = SENSOR_MARGIN,
): { step: number; carIndex: number }[] {
  const hits: { step: number; carIndex: number }[] = [];
  rec.poses.forEach((cars, step) => {
    cars.forEach((pose, carIndex) => {
      if (Math.abs(pose.chassis.x - star.x) > 3) return;
      if (poseClearance(pose, star, cfg) <= margin) hits.push({ step, carIndex });
    });
  });
  return hits;
}
