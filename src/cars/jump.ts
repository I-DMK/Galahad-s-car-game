// Décision de saut (plan B, tâche 5e ; addendum « bouton saut » §1, amendé [plan]) : pur (ni DOM, ni matter-js).
import type { Config } from '../config';

/** Tolérance (s) des comparaisons de temps : `sim.time` est une somme de PHYSICS_DT. */
const EPS = 1e-9;

/**
 * Une voiture peut-elle sauter à l'instant t ? Au moins une roue au sol (contact de jeu débouncé), course
 * pas finie pour elle, et JUMP_COOLDOWN écoulé depuis son dernier saut (à EPS près).
 */
export function canJump(
  o: { lastJumpAt: number | null; grounded: boolean; finished: boolean; t: number }, cfg: Config,
): boolean {
  if (!o.grounded || o.finished) return false;
  return o.lastJumpAt === null || o.t - o.lastJumpAt >= cfg.JUMP_COOLDOWN - EPS;
}

/** Demande valable à t : faite il y a au plus JUMP_BUFFER (à 1e-9 près), décision P2 du papa. */
export function wantsJump(jumpRequestedAt: number | null, t: number, cfg: Config): boolean {
  if (jumpRequestedAt === null) return false;
  const age = t - jumpRequestedAt;
  return age >= -EPS && age <= cfg.JUMP_BUFFER + EPS;
}
