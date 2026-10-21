// Points sûrs : où le jeu mémorise la position de réapparition. Pur (ni DOM, ni matter-js).
import type { Config } from '../config';
import { sliceAt } from '../track/query';
import type { Track, Volcano } from '../track/types';
import type { CarState } from './state';

/** Angle maximal du châssis (rad) pour qu'une position soit retenue comme point sûr. */
const SAFE_POINT_MAX_CAR_ANGLE = (20 * Math.PI) / 180;

/**
 * Zone où l'on ne mémorise jamais de point sûr : [xLancement + SAFE_LANCEMENT_MARGIN, xReception[
 * (addendum §1.6). Un point sûr est donc soit dans les 5 premiers mètres du plat de lancement (il
 * reste D_LANCE de plat pour atteindre V_MAX avant l'élan), soit avant, soit sur le plat de réception.
 */
export function forbiddenZone(v: Volcano, cfg: Config): [number, number] {
  return [v.xLancement + cfg.SAFE_LANCEMENT_MARGIN, v.xReception];
}

export interface SafePointObs {
  x: number;
  t: number;
  bothWheelsOnGround: boolean;
  carAngle: number;
  groundSlope: number;
}

/**
 * Vrai si la position observée peut devenir le nouveau point sûr de la voiture : intervalle
 * SAFE_POINT_INTERVAL écoulé, deux roues au sol, voiture et sol presque horizontaux, hors de la zone
 * interdite de tout volcan et hors d'une tranche « cratère » (addendum §1.4 : exclusion explicite,
 * en plus de la règle de pente).
 */
export function isSafePointCandidate(obs: SafePointObs, state: CarState, track: Track, cfg: Config): boolean {
  if (obs.t - state.lastSafePointAt < cfg.SAFE_POINT_INTERVAL) return false;
  if (!obs.bothWheelsOnGround) return false;
  if (Math.abs(obs.carAngle) >= SAFE_POINT_MAX_CAR_ANGLE) return false;
  if (Math.abs(obs.groundSlope) >= cfg.SAFE_POINT_MAX_SLOPE) return false;
  for (const v of track.volcanoes) {
    const [a, b] = forbiddenZone(v, cfg);
    if (obs.x >= a && obs.x < b) return false;
  }
  if (sliceAt(track, obs.x).type === 'cratère') return false;
  return true;
}
