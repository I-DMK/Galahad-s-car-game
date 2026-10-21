// Poses de rendu et interpolation entre deux pas fixes (plan B, tâche 5f) : pur calcul (ni DOM, ni matter-js).
import { normalizeAngle } from '../cars/angle';

/** Pose d'une pièce (monde : m, y vers le haut, angle anti-horaire). */
export interface PartPose { x: number; y: number; angle: number }

/** Pose d'une voiture : châssis, roues [arrière, avant] (angle cumulé), vitesse du châssis (m/s, avance de caméra). */
export interface CarPose { chassis: PartPose; wheels: PartPose[]; speed: number }

/** a + normalizeAngle(b − a) × alpha : chemin le plus court (un pas fait toujours moins d'un demi-tour). */
export function lerpAngle(a: number, b: number, alpha: number): number {
  return a + normalizeAngle(b - a) * alpha;
}

const lerp = (a: number, b: number, alpha: number): number => a + (b - a) * alpha;

function lerpPart(prev: PartPose, cur: PartPose, alpha: number): PartPose {
  return { x: lerp(prev.x, cur.x, alpha), y: lerp(prev.y, cur.y, alpha), angle: lerpAngle(prev.angle, cur.angle, alpha) };
}

/** Pose interpolée (neuve) : positions et vitesse linéaires, angles par `lerpAngle` ; alpha 0 → prev, 1 → cur. */
export function lerpCarPose(prev: CarPose, cur: CarPose, alpha: number): CarPose {
  return {
    chassis: lerpPart(prev.chassis, cur.chassis, alpha),
    wheels: cur.wheels.map((w, i) => lerpPart(prev.wheels[i] ?? w, w, alpha)),
    speed: lerp(prev.speed, cur.speed, alpha),
  };
}

const clonePart = (p: PartPose): PartPose => ({ x: p.x, y: p.y, angle: p.angle });
const clonePose = (p: CarPose): CarPose => ({ chassis: clonePart(p.chassis), wheels: p.wheels.map(clonePart), speed: p.speed });

/**
 * Poses des deux derniers pas, pour dessiner entre les deux (un pas de latence). Une voiture téléportée
 * pendant le dernier pas (réapparition) est dessinée à sa nouvelle pose, sans traînée depuis l'ancienne.
 */
export class PoseHistory {
  private prev: CarPose[] = [];
  private cur: CarPose[] = [];

  /** prev = cur = poses (départ, `rebuildCars`). */
  reset(poses: CarPose[]): void {
    this.prev = poses;
    this.cur = poses;
  }

  /** Après un pas : prev ← cur, cur ← poses ; prev[i] ← cur[i] si la voiture i a été téléportée. */
  push(poses: CarPose[], teleported: ReadonlySet<number>): void {
    const prev = this.cur;
    this.prev = teleported.size === 0 ? prev : poses.map((p, i) => (teleported.has(i) ? p : prev[i] ?? p));
    this.cur = poses;
  }

  /**
   * Poses dessinées pour alpha (borné à [0, 1]) : neuves, l'historique n'est jamais modifié. Une voiture
   * sans pose précédente distincte (départ, reset, téléportation) est dessinée exactement à sa pose courante.
   */
  at(alpha: number): CarPose[] {
    const a = Math.min(1, Math.max(0, alpha));
    return this.cur.map((c, i) => {
      const p = this.prev[i] ?? c;
      return p === c ? clonePose(c) : lerpCarPose(p, c, a);
    });
  }
}
