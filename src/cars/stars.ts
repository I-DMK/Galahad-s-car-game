// État des étoiles en course : pur (ni DOM, ni matter-js). Une étoile prise réapparaît
// STAR_RESPAWN_SECONDS plus tard.
import type { Config } from '../config';
import type { Star } from '../track/types';

export interface StarState {
  id: number;
  /** Instant (s) de la dernière prise, null si jamais prise. */
  takenAt: number | null;
}

export function newStarStates(stars: Star[]): StarState[] {
  return stars.map((s) => ({ id: s.id, takenAt: null }));
}

export function isStarActive(s: StarState, t: number, cfg: Config): boolean {
  return s.takenAt === null || t >= s.takenAt + cfg.STAR_RESPAWN_SECONDS;
}

export function takeStar(s: StarState, t: number): void {
  s.takenAt = t;
}
