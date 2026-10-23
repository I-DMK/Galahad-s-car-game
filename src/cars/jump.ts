// Décision de saut (plan B, tâche 5e ; addendum « bouton saut » §1, amendé [plan]) et saut voulu devant une fosse
// (tâche 5g, saut §6.8) : pur (ni DOM, ni matter-js).
import type { Config } from '../config';
import { nextFosse } from '../track/query';
import type { Track } from '../track/types';

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

/**
 * Centre de la fenêtre de saut d'une fosse, en s avant le bord amont, à la vitesse v (m/s) : FOSSE_JUMP_AIM −
 * FOSSE_WIDTH / (2 max(v, 1)) (saut §6.8, CALCULÉ : milieu du bord au plus tard ≈ 1,2 m + 0,06 s × v et du bord au plus
 * tôt ≈ 1,96 s × v − W − 1,2 m, divisé par v). 0,50 s à 8 m/s, 0,64 s à 11,2, 0,71 s à 14, 0,81 s à 21. Plancher
 * en distance (tour 1 de la 5g) : au moins FOSSE_JUMP_MIN_DISTANCE (2 m) avant le bord, soit 2 / v : sous ≈ 6 m/s la
 * formule visait plus près du bord que la lave ne reprend la voiture (châssis à ≈ 1,15 m) et un robot lent ne tentait
 * jamais son saut (≤ 0 sous 4 m/s) ; il le tente (sans succès : sous ≈ 6 m/s, aucun saut ne passe).
 */
export function fosseJumpLead(v: number, cfg: Config): number {
  const speed = Math.max(v, 1);
  return Math.max(cfg.FOSSE_JUMP_MIN_DISTANCE / speed, cfg.FOSSE_JUMP_AIM - cfg.FOSSE_WIDTH / (2 * speed));
}

/**
 * Bord au plus tard de la fenêtre de saut d'une fosse, en s avant le bord amont, à la vitesse v :
 * FOSSE_JUMP_LATE_DISTANCE / max(v, 1) + FOSSE_JUMP_LATE_TIME (saut §6.2, CALCULÉ : la roue avant doit avoir quitté le
 * sol avant de toucher le coin du capteur, s ≥ ≈ 1,2 m + 0,06 s × v). 0,21 s à 8 m/s, 0,17 à 11,2, 0,15 à 14, 0,12 à 21.
 * Prudent : les bords mesurés (s min 1,45 à 2,10 m, §6.2) sont plus près de la lave. Toujours sous `fosseJumpLead(v)`
 * (au moins 0,07 s d'écart, à 6 m/s) : le sauteur sans erreur n'est jamais en retard.
 */
export function fosseLatestLead(v: number, cfg: Config): number {
  return cfg.FOSSE_JUMP_LATE_DISTANCE / Math.max(v, 1) + cfg.FOSSE_JUMP_LATE_TIME;
}

/**
 * Fenêtre de demande du saut d'une fosse dont le bord amont est en `xBord` (une seule formule, tour 3 de la tâche 6 :
 * `fosseJumpWanted` et le driver des copains, qui lit sa fosse dans son contexte) : le bord est à au plus `visé`
 * secondes à la vitesse v, mais à plus de JUMP_BUFFER : une demande gardée en mémoire (0,1 s) partirait sinon au-dessus
 * de la lave (tour 1 de la 5g).
 * - `visé` = `fosseJumpLead(v)` + `error` (centre de la fenêtre, plus l'erreur du copain) ;
 * - erreur trop tardive (décision du papa, tour 2 de la tâche 6) : si `fosseJumpLead(v)` + `error` <
 *   `fosseLatestLead(v)` (bord au plus tard CALCULÉ), le saut partirait si près de la lave qu'elle reprendrait la
 *   voiture au pas du saut (raté invisible, re-relecture du tour 1) ; il devient un saut trop tôt du même écart :
 *   `visé` = `fosseJumpLead(v)` − `error`. Le copain décolle, vole et retombe dans la fosse (ou avant) : le raté se voit.
 *   Un saut basculé de justesse vise le bord au plus tôt CALCULÉ (le milieu des deux bords est `fosseJumpLead`) ;
 * - filet : jamais moins de JUMP_BUFFER + PHYSICS_DT (dernier pas permis).
 * Sans erreur, rien ne bascule (`fosseJumpLead` ≥ `fosseLatestLead` + 0,07 s) et le filet ne joue jamais
 * (`fosseJumpLead` ≥ 0,33 s). L'appelant vérifie que le châssis est sur l'approche, [xLancement, xBord[.
 */
export function inFosseJumpWindow(xBord: number, x: number, v: number, cfg: Config, error = 0): boolean {
  const tte = (xBord - x) / Math.max(v, 1);
  const centre = fosseJumpLead(v, cfg);
  const aim = centre + error < fosseLatestLead(v, cfg) ? centre - error : centre + error;
  const lead = Math.max(aim, cfg.JUMP_BUFFER + cfg.PHYSICS_DT);
  return tte <= lead + EPS && tte > cfg.JUMP_BUFFER + EPS;
}

/**
 * Saut voulu devant une fosse (tâche 5g ; erreur des copains, tâche 6) : le châssis (x) est sur l'approche de la
 * prochaine fosse, [xLancement, xBord[, et dans sa fenêtre de demande (`inFosseJumpWindow`). Vrai à chaque pas de cette
 * fenêtre : le demandeur redemande tant qu'il ne s'est pas envolé (`sauteurParfait` des tests). Parcourt les volcans
 * sans allouer.
 */
export function fosseJumpWanted(track: Track, x: number, v: number, cfg: Config, error = 0): boolean {
  const f = nextFosse(track, x);
  if (!f || x < f.xLancement) return false;
  return inFosseJumpWindow(f.xBord, x, v, cfg, error);
}
