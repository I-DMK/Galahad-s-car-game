// Une image de la boucle de jeu (plan B, tâche 5f) : pas fixes de l'accumulateur, puis poses dessinées
// interpolées entre les deux derniers pas. Pur calcul (ni DOM, ni matter-js), partagé par `Game` et par
// le rejeu des tests (tests/helpers/frames.ts) : seule la source des pas change.
import type { Config } from '../config';
import { advanceAccumulator } from './accumulator';
import type { CarPose, PoseHistory } from './interpolation';

/**
 * Résultat d'un pas, fourni par l'appelant : poses après le pas et index des voitures téléportées
 * pendant ce pas ; `{ rebuilt }` après `rebuildCars` (l'image s'arrête là) ; 'stop' = abandon.
 */
export type StepOutcome = { poses: CarPose[]; teleported: ReadonlySet<number> } | { rebuilt: CarPose[] } | 'stop';

/** État de la boucle d'une image à l'autre : reste de l'accumulateur (s) et poses des deux derniers pas. */
export interface FrameState { acc: number; history: PoseHistory }

/**
 * `steps` : pas faits (ceux de l'accumulateur, moins ceux qu'un `{ rebuilt }` ou un 'stop' a coupés ; le pas
 * qui a renvoyé l'un des deux ne compte pas) ; `alpha` : fraction de pas dessinée (1 sans interpolation) ;
 * `poses` : poses dessinées ; `stopped` : un pas a renvoyé 'stop'.
 */
export interface FrameResult { steps: number; alpha: number; poses: CarPose[]; stopped: boolean }

/**
 * `advanceAccumulator`, puis `step(i)` pour chaque pas (i = 0 pour le premier) ; `{ rebuilt }` remet
 * l'historique à zéro et termine les pas de l'image, 'stop' les interrompt. Poses dessinées :
 * `history.at(acc / dt)`, ou les poses du dernier pas si `interpolate` est faux.
 */
export function runFrame(
  s: FrameState, elapsed: number, cfg: Config, step: (i: number) => StepOutcome, interpolate = true,
): FrameResult {
  const { steps: wanted, acc } = advanceAccumulator(s.acc, elapsed, cfg.PHYSICS_DT, cfg.MAX_STEPS_PER_FRAME);
  s.acc = acc;
  let steps = 0;
  for (let i = 0; i < wanted; i++) {
    const out = step(i);
    if (out === 'stop') return { steps, alpha: 1, poses: s.history.at(1), stopped: true };
    if ('rebuilt' in out) {
      s.history.reset(out.rebuilt);
      break;
    }
    s.history.push(out.poses, out.teleported);
    steps++;
  }
  const alpha = interpolate ? Math.min(1, s.acc / cfg.PHYSICS_DT) : 1;
  return { steps, alpha, poses: s.history.at(alpha), stopped: false };
}

/** m : la caméra vise au moins cette hauteur au-dessus du sol sous la voiture (sol dans le bas de l'écran). */
const CAMERA_ABOVE_GROUND = 3;

/** Cible de caméra pour la pose de Galahad : x, max(y, sol + 3), vitesse. */
export function cameraTarget(pose: CarPose, groundAt: (x: number) => number): { x: number; y: number; speed: number } {
  const { x, y } = pose.chassis;
  return { x, y: Math.max(y, groundAt(x) + CAMERA_ABOVE_GROUND), speed: pose.speed };
}
