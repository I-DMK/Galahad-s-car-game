// État des rochers en course (plan C, tâche 11c ; spec « rochers » §1) : pur (ni DOM, ni matter-js). L'état est tenu par
// voiture, comme les étoiles (tâche 5d) : un rocher touché par une voiture ne l'est que pour elle, une seule fois, jamais
// réarmé (après le choc elle est de l'autre côté ; ENCORE recrée la course).
import type { Rock } from '../track/types';

export interface RockState {
  id: number;
  /** Par index de voiture : instant (s) de son choc, null si jamais. */
  hitAt: (number | null)[];
}

/** Un état par rocher (mêmes ids, même ordre), une case par voiture de la course, aucun choc. */
export function newRockStates(rocks: Rock[], carCount: number): RockState[] {
  return rocks.map((r) => ({ id: r.id, hitAt: Array.from({ length: carCount }, () => null) }));
}

/** RangeError si `carIndex` n'a pas de case dans `s.hitAt` (sinon : réponse fausse en silence, ou case ajoutée). */
function checkCarIndex(s: RockState, carIndex: number): void {
  if (!Number.isInteger(carIndex) || carIndex < 0 || carIndex >= s.hitAt.length) {
    throw new RangeError(`rocher ${s.id} : index de voiture ${carIndex} hors de [0, ${s.hitAt.length})`);
  }
}

/** Le rocher est-il encore actif pour la voiture d'index `carIndex` (jamais touché par elle) ? RangeError hors de `hitAt`. */
export function isRockActiveFor(s: RockState, carIndex: number): boolean {
  checkCarIndex(s, carIndex);
  return s.hitAt[carIndex] === null;
}

/** La voiture d'index `carIndex` touche le rocher à l'instant t (pour elle seule). RangeError hors de `hitAt`. */
export function hitRockFor(s: RockState, carIndex: number, t: number): void {
  checkCarIndex(s, carIndex);
  s.hitAt[carIndex] = t;
}
