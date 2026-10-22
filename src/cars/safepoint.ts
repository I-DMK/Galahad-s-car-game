// Points sûrs : où le jeu mémorise la position de réapparition. Pur (ni DOM, ni matter-js).
import type { Config } from '../config';
import { sliceAt } from '../track/query';
import type { Track, Volcano } from '../track/types';
import type { CarState } from './state';

/** Angle maximal du châssis (rad) pour qu'une position soit retenue comme point sûr. */
const SAFE_POINT_MAX_CAR_ANGLE = (20 * Math.PI) / 180;

/** m : marge après la roue arrière d'une voiture posée juste après une fosse (bord de roue à 0,3 m du capteur). */
const FOSSE_EXIT_MARGIN = 0.3;

/**
 * Zone où l'on ne mémorise jamais de point sûr : [xLancement + SAFE_LANCEMENT_MARGIN, xReception[
 * (addendum §1.6). Un point sûr est donc soit dans les 5 premiers mètres du plat de lancement (il
 * reste D_LANCE de plat pour atteindre V_MAX avant l'élan), soit avant, soit sur le plat de réception.
 * Fosse (tour 1 de la 5g) : prolongée jusqu'à xReception + WHEEL_BASE/2 + WHEEL_RADIUS + 0,3 m (≈ 1,5 m) : le bord aval
 * est aussi le bord de la lave, et un châssis posé plus près aurait la roue arrière dans le capteur (boucle de
 * réapparitions, ou chute comptée pour le volcan suivant). Points sûrs, respawn groupé et `rebuildCars` passent par elle.
 */
export function forbiddenZone(v: Volcano, cfg: Config): [number, number] {
  const end = v.kind === 'fosse' ? v.xReception + cfg.WHEEL_BASE / 2 + cfg.WHEEL_RADIUS + FOSSE_EXIT_MARGIN : v.xReception;
  return [v.xLancement + cfg.SAFE_LANCEMENT_MARGIN, end];
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
  return isSafeZone(obs.x, track, cfg);
}

/** x hors de la zone interdite de tout volcan et hors d'une tranche « cratère » (points sûrs, respawn groupé). */
export function isSafeZone(x: number, track: Track, cfg: Config): boolean {
  for (const v of track.volcanoes) {
    const [a, b] = forbiddenZone(v, cfg);
    if (x >= a && x < b) return false;
  }
  return sliceAt(track, x).type !== 'cratère';
}
