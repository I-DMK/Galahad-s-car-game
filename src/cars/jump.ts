// Décision de saut (plan B, tâche 5e ; addendum « bouton saut » §1, amendé [plan]) : pur (ni DOM, ni matter-js).
import type { Config } from '../config';

/** Tolérance (s) des comparaisons de temps : `sim.time` est une somme de PHYSICS_DT. */
const EPS = 1e-9;

/**
 * Une voiture peut-elle sauter à l'instant t ? Tolérance de sol (décision P11) : une roue a touché la piste (sol, mur,
 * écart roue-sol, débouncé ; jamais une autre voiture) au plus JUMP_GROUND_GRACE avant t (`lastGroundedAt`, null :
 * jamais depuis la création ou la dernière téléportation) ; course pas finie pour elle ; JUMP_COOLDOWN écoulé depuis
 * son dernier saut (à EPS près).
 */
export function canJump(
  o: { lastJumpAt: number | null; lastGroundedAt: number | null; finished: boolean; t: number }, cfg: Config,
): boolean {
  if (o.finished || o.lastGroundedAt === null || o.t - o.lastGroundedAt > cfg.JUMP_GROUND_GRACE + EPS) return false;
  return o.lastJumpAt === null || o.t - o.lastJumpAt >= cfg.JUMP_COOLDOWN - EPS;
}

/** Demande valable à t : faite il y a au plus JUMP_BUFFER (à 1e-9 près), décision P2 du papa. */
export function wantsJump(jumpRequestedAt: number | null, t: number, cfg: Config): boolean {
  if (jumpRequestedAt === null) return false;
  const age = t - jumpRequestedAt;
  return age >= -EPS && age <= cfg.JUMP_BUFFER + EPS;
}
