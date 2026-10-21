// Décision de réapparition : chronomètres de blocage et choix de la cible. Pur (ni DOM, ni matter-js).
import type { Config } from '../config';
import { heightAt, slopeAt, volcanoAhead } from '../track/query';
import type { Track } from '../track/types';
import { normalizeAngle } from './angle';
import { isSafeZone } from './safepoint';
import type { CarState, SafePoint } from './state';

export { normalizeAngle } from './angle';

export type RespawnReason = 'lava' | 'flipped' | 'side' | 'stuck' | 'underground' | 'speed';

export interface RespawnObs {
  t: number;
  /** Angle du châssis (rad, tel que renvoyé par la physique ; normalisé ici). */
  angle: number;
  throttle: boolean;
  progress: number;
  y: number;
  groundY: number;
  speedMps: number;
  onLava: boolean;
  /**
   * Vrai si x est dans [xElanStart, xLip] d'un volcan (plat d'élan et rampe ; calculé par le pas de
   * course via `inElanZone` de track/query). Une voiture retournée ('flipped', |angle| > FLIP_ANGLE)
   * ou sur le flanc ('side', |angle| > SIDE_ANGLE) y réapparaît aussitôt, sans les délais
   * FLIP_SECONDS / SIDE_SECONDS, pour ne pas faire obstacle à une voiture lancée (addendum §1.6).
   * Au-delà du sommet, c'est la lave qui tranche.
   */
  inElanZone: boolean;
}

/**
 * Met à jour les chronomètres de l'état et renvoie la raison de réapparition, ou null.
 * Les chronomètres sont tous mis à jour à chaque appel (ils sont indépendants : retourné
 * implique aussi sur le côté) ; la raison renvoyée suit l'ordre de priorité
 * lave > vitesse > sous le sol > retourné / sur le côté (immédiats dans l'élan) > retourné > sur le
 * côté > bloqué.
 */
export function updateRespawnTimers(state: CarState, obs: RespawnObs, cfg: Config): RespawnReason | null {
  const absAngle = Math.abs(normalizeAngle(obs.angle));

  state.flippedSince = absAngle > cfg.FLIP_ANGLE ? (state.flippedSince ?? obs.t) : null;
  state.sideSince = absAngle > cfg.SIDE_ANGLE ? (state.sideSince ?? obs.t) : null;

  if (!obs.throttle) {
    state.stuckSince = null;
    state.stuckRefProgress = obs.progress;
  } else if (obs.progress - state.stuckRefProgress >= cfg.STUCK_DISTANCE) {
    state.stuckSince = null;
    state.stuckRefProgress = obs.progress;
  } else if (state.stuckSince === null) {
    state.stuckSince = obs.t;
  }

  if (obs.onLava) return 'lava';
  if (obs.speedMps > cfg.SPEED_GUARD) return 'speed';
  if (obs.y < obs.groundY - 1) return 'underground';
  if (obs.inElanZone && absAngle > cfg.SIDE_ANGLE) return absAngle > cfg.FLIP_ANGLE ? 'flipped' : 'side';
  if (state.flippedSince !== null && obs.t - state.flippedSince > cfg.FLIP_SECONDS) return 'flipped';
  if (state.sideSince !== null && obs.t - state.sideSince > cfg.SIDE_SECONDS) return 'side';
  if (state.stuckSince !== null && obs.t - state.stuckSince > cfg.STUCK_SECONDS) return 'stuck';
  return null;
}

export interface RespawnTarget {
  point: SafePoint;
  lavaX: number | null;
  consecutive: number;
}

/**
 * Choisit où réapparaître. Seules les chutes dans la lave comptent dans la série « même volcan » :
 * deuxième chute de suite dans la même lave → on passe le volcan, en fin de plat de réception
 * (xEnd − RESPAWN_AFTER_VOLCANO_BACK, hors de la zone d'atterrissage des autres voitures ;
 * addendum §1.6), à la hauteur et à l'angle du sol local, au lieu de reboucler sur le point sûr.
 * Toute autre raison (retournée, sur le flanc, bloquée…) ramène au point sûr et interrompt la série
 * (deux chocs sur le flanc dans l'élan ne doivent pas faire passer le volcan sans l'avoir tenté).
 */
export function chooseRespawnTarget(state: CarState, track: Track, cfg: Config, reason: RespawnReason): RespawnTarget {
  if (reason !== 'lava') return { point: state.safePoint, lavaX: null, consecutive: 0 };
  const v = volcanoAhead(track, state.safePoint.x);
  const lavaX: number | null = v?.xLava ?? null;
  const consecutive = lavaX !== null && lavaX === state.lastRespawnLavaX ? state.consecutiveRespawns + 1 : 1;
  if (consecutive >= 2 && v) {
    const x = v.xEnd - cfg.RESPAWN_AFTER_VOLCANO_BACK;
    return { point: { x, y: heightAt(track, x), angle: slopeAt(track, x) }, lavaX: null, consecutive: 0 };
  }
  return { point: state.safePoint, lavaX, consecutive };
}

/** m : tolérance d'arrondi de la distance entre voitures du respawn groupé. */
const GROUP_EPSILON = 1e-6;

/**
 * Respawn groupé (addendum §1.6) : tant qu'un châssis d'une autre voiture (`occupiedXs`, x des châssis)
 * est à moins de RESPAWN_GROUP_SPACING_FACTOR × CAR_LENGTH de la cible, et au plus
 * RESPAWN_GROUP_MAX_SHIFT fois, la cible recule de cette distance, puis remonte vers l'amont par pas
 * de TRACK_POINT_SPACING jusqu'au premier x de pente douce (< SAFE_POINT_MAX_SLOPE), hors zone
 * interdite et hors cratère, posée à la hauteur et à l'angle du sol local. Un recul sans tel x sur
 * RESPAWN_GROUP_MAX_ADJUST mètres, ou qui passerait sous x = CAR_LENGTH (début de la piste), est
 * abandonné. Dans tous les cas la dernière cible valide est gardée : l'invulnérabilité du respawn
 * couvre un éventuel chevauchement. Sans voisin trop proche, `point` est rendu tel quel.
 */
export function shiftTarget(point: SafePoint, occupiedXs: readonly number[], track: Track, cfg: Config): SafePoint {
  const gap = cfg.RESPAWN_GROUP_SPACING_FACTOR * cfg.CAR_LENGTH;
  let target = point;
  // Un recul pose la cible à exactement `gap` de l'occupant qui l'a provoqué : sans tolérance, l'arrondi
  // flottant (3,2999999999999972 < 3,3000000000000003) déclencherait un recul de plus.
  const tooClose = (x: number): boolean => Math.abs(x - target.x) < gap - GROUP_EPSILON;
  const maxSteps = Math.round(cfg.RESPAWN_GROUP_MAX_ADJUST / cfg.TRACK_POINT_SPACING);
  const xMin = track.points[0].x + cfg.CAR_LENGTH;
  for (let shifts = 0; shifts < cfg.RESPAWN_GROUP_MAX_SHIFT; shifts++) {
    if (!occupiedXs.some(tooClose)) break;
    const from = target.x - gap;
    let found: number | null = null;
    for (let k = 0; k <= maxSteps; k++) {
      const x = from - k * cfg.TRACK_POINT_SPACING;
      if (x < xMin) break;
      if (Math.abs(slopeAt(track, x)) < cfg.SAFE_POINT_MAX_SLOPE && isSafeZone(x, track, cfg)) {
        found = x;
        break;
      }
    }
    if (found === null) break;
    target = { x: found, y: heightAt(track, found), angle: slopeAt(track, found) };
  }
  return target;
}

/** Applique la réapparition choisie à l'état de course (la physique est repositionnée ailleurs). */
export function applyRespawnToState(
  state: CarState,
  target: SafePoint,
  lavaX: number | null,
  consecutive: number,
  t: number,
  cfg: Config,
): void {
  state.lastRespawnLavaX = lavaX;
  state.consecutiveRespawns = consecutive;
  state.invulnerableUntil = t + cfg.RESPAWN_INVULN;
  state.flippedSince = null;
  state.sideSince = null;
  state.stuckSince = null;
  state.stuckRefProgress = target.x;
  state.progress = target.x;
  state.safePoint = target;
  state.lastSafePointAt = t;
}
