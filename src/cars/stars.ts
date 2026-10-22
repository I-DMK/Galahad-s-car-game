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

/** RangeError si `carIndex` n'a pas de case dans `s.takenAt` (sinon : réponse fausse en silence, ou case ajoutée). */
function checkCarIndex(s: StarState, carIndex: number): void {
  if (!Number.isInteger(carIndex) || carIndex < 0 || carIndex >= s.takenAt.length) {
    throw new RangeError(`étoile ${s.id} : index de voiture ${carIndex} hors de [0, ${s.takenAt.length})`);
  }
}

/** L'étoile est-elle prenable par la voiture d'index `carIndex` à l'instant t ? RangeError hors de `takenAt`. */
export function isStarActiveFor(s: StarState, carIndex: number, t: number, cfg: Config): boolean {
  checkCarIndex(s, carIndex);
  const taken = s.takenAt[carIndex];
  return taken === null || t >= taken + cfg.STAR_RESPAWN_SECONDS;
}

/** La voiture d'index `carIndex` prend l'étoile à l'instant t (pour elle seule). RangeError hors de `takenAt`. */
export function takeStarFor(s: StarState, carIndex: number, t: number): void {
  checkCarIndex(s, carIndex);
  s.takenAt[carIndex] = t;
}
