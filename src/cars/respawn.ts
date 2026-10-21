// Décision de réapparition : chronomètres de blocage et choix de la cible. Pur (ni DOM, ni matter-js).
import type { Config } from '../config';
import { heightAt, slopeAt, volcanoAhead } from '../track/query';
import type { Track } from '../track/types';
import { normalizeAngle } from './angle';
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
 * Choisit où réapparaître. Deuxième réapparition de suite devant la même lave : on passe le volcan,
 * en fin de plat de réception (xEnd − RESPAWN_AFTER_VOLCANO_BACK, hors de la zone d'atterrissage
 * des autres voitures ; addendum §1.6), à la hauteur et à l'angle du sol local, au lieu de
 * reboucler sur le point sûr.
 */
export function chooseRespawnTarget(state: CarState, track: Track, cfg: Config): RespawnTarget {
  const v = volcanoAhead(track, state.safePoint.x);
  const lavaX: number | null = v?.xLava ?? null;
  const consecutive = lavaX !== null && lavaX === state.lastRespawnLavaX ? state.consecutiveRespawns + 1 : 1;
  if (consecutive >= 2 && v) {
    const x = v.xEnd - cfg.RESPAWN_AFTER_VOLCANO_BACK;
    return { point: { x, y: heightAt(track, x), angle: slopeAt(track, x) }, lavaX: null, consecutive: 0 };
  }
  return { point: state.safePoint, lavaX, consecutive };
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
