// État des étoiles en course : pur (ni DOM, ni matter-js). L'état est tenu par voiture (plan B, tâche
// 5d ; addendum « bouton saut » §2) : une voiture qui prend une étoile la rend inactive pour elle seule,
// jusqu'à STAR_RESPAWN_SECONDS plus tard ; pour les autres, l'étoile reste prenable.
import type { Config } from '../config';
import type { Star } from '../track/types';

export interface StarState {
  id: number;
  /** Par index de voiture : instant (s) de sa dernière prise, null si jamais. */
  takenAt: (number | null)[];
}

/** Un état par étoile (mêmes ids, même ordre), une case par voiture de la course, aucune prise. */
export function newStarStates(stars: Star[], carCount: number): StarState[] {
  return stars.map((s) => ({ id: s.id, takenAt: Array.from({ length: carCount }, () => null) }));
}

/** L'étoile est-elle prenable par la voiture d'index `carIndex` à l'instant t ? */
export function isStarActiveFor(s: StarState, carIndex: number, t: number, cfg: Config): boolean {
  const taken = s.takenAt[carIndex];
  return taken === null || t >= taken + cfg.STAR_RESPAWN_SECONDS;
}

/** La voiture d'index `carIndex` prend l'étoile à l'instant t (pour elle seule). */
export function takeStarFor(s: StarState, carIndex: number, t: number): void {
  s.takenAt[carIndex] = t;
}
