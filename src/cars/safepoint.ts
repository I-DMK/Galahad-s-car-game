// Points sûrs : où le jeu mémorise la position de réapparition. Pur (ni DOM, ni matter-js).
import type { Config } from '../config';
import type { Track, Volcano } from '../track/types';
import type { CarState } from './state';

/** Angle maximal du châssis (rad) pour qu'une position soit retenue comme point sûr. */
const SAFE_POINT_MAX_CAR_ANGLE = (20 * Math.PI) / 180;

/**
 * Zone où l'on ne mémorise jamais de point sûr : de 25 % après le début du plat de lancement
 * (règle de transition de la tâche 1 : l'ancienne fraction appliquée au plat de lancement, pour
 * qu'aucun point sûr ne tombe sur le plat d'élan de 6 m ; la tâche 3 la remplace par
 * [xLancement + SAFE_LANCEMENT_MARGIN, xReception[) jusqu'à la réception, [début, fin[.
 */
export function forbiddenZone(v: Volcano, cfg: Config): [number, number] {
  return [v.xLancement + (1 - cfg.ELAN_SAFE_FRACTION) * (v.xElanStart - v.xLancement), v.xReception];
}

export interface SafePointObs {
  x: number;
  t: number;
  bothWheelsOnGround: boolean;
  carAngle: number;
  groundSlope: number;
}

/** Vrai si la position observée peut devenir le nouveau point sûr de la voiture. */
export function isSafePointCandidate(obs: SafePointObs, state: CarState, track: Track, cfg: Config): boolean {
  if (obs.t - state.lastSafePointAt < cfg.SAFE_POINT_INTERVAL) return false;
  if (!obs.bothWheelsOnGround) return false;
  if (Math.abs(obs.carAngle) >= SAFE_POINT_MAX_CAR_ANGLE) return false;
  if (Math.abs(obs.groundSlope) >= cfg.SAFE_POINT_MAX_SLOPE) return false;
  for (const v of track.volcanoes) {
    const [a, b] = forbiddenZone(v, cfg);
    if (obs.x >= a && obs.x < b) return false;
  }
  return true;
}
