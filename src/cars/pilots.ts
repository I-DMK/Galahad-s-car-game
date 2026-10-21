// Les copains de Galahad : leurs couleurs, leur caractère de pilotage et le tirage de ceux
// qui prennent le départ. Pur (ni DOM, ni matter-js) : la course les consomme (tâche 5b).
import { CONFIG } from '../config';
import { mulberry32 } from '../track/rng';

export interface Pilot {
  readonly id: string;
  readonly name: string;
  /** Carrosserie, accent (bandes et aileron) et casque : 0xRRGGBB. */
  readonly color: number;
  readonly accent: number;
  readonly helmet: number;
  /** Allure de croisière du pilote automatique, en fraction de la vitesse max : [0,85 ; 1]. */
  readonly base: number;
  /** Probabilité de lever le pied avant une rampe-saut ou une double-bosse : [0 ; 0,6]. */
  readonly lift: number;
}

/**
 * Galahad, le pilote humain. Ses `base` et `lift` n'ont pas de sens (c'est l'enfant qui
 * conduit, pas le pilote automatique) : valeurs neutres. Couleurs reprises de CONFIG,
 * source unique ; le casque est rouge comme les bandes (aspect du plan A).
 */
export const GALAHAD: Pilot = Object.freeze({
  id: 'galahad',
  name: 'Galahad',
  color: CONFIG.GALAHAD_COLOR,
  accent: CONFIG.GALAHAD_ACCENT,
  helmet: CONFIG.GALAHAD_ACCENT,
  base: 1,
  lift: 0,
});

/** Fige une entrée de la table : aucun appelant ne doit pouvoir la modifier. */
const pilote = (p: Pilot): Pilot => Object.freeze(p);

/**
 * Les 6 copains, fixés à la main : 2 prudents, 2 moyens, 2 fonceurs.
 *
 * Galahad reste « la voiture bleue » : aucune carrosserie de copain n'est bleue, cyan,
 * turquoise ou violette. Le casque d'un copain est une nuance plus claire ou plus foncée de
 * sa propre carrosserie (casque assorti) ; le casque rouge de Galahad ne compte pas dans
 * cette règle. Carrosserie, casque et bandes doivent rester lisibles sur le ciel quasi noir
 * (0x05081a, contraste WCAG ≥ 3:1) ; le sol, lui, est un gris moyen (0x8b8b8b). Toutes ces
 * contraintes sont vérifiées par tests/pilots.test.ts.
 */
export const PILOTS: readonly Pilot[] = Object.freeze([
  // Fonceur : rouge vif, casque rouge clair, bandes crème dorée.
  pilote({ id: 'pablo', name: 'Pablo', color: 0xc8001e, accent: 0xffdc64, helmet: 0xd64056, base: 0.98, lift: 0.05 }),
  // Moyen : vert, casque vert foncé, bandes crème.
  pilote({ id: 'diego', name: 'Diego', color: 0x2ecc40, accent: 0xfff096, helmet: 0x208f2d, base: 0.92, lift: 0.3 }),
  // Prudent : blanc, casque gris clair, bandes sarcelle.
  pilote({ id: 'timothée', name: 'Timothée', color: 0xf5f5f5, accent: 0x00a8a0, helmet: 0xd0d0d0, base: 0.86, lift: 0.55 }),
  // Fonceur : jaune, casque jaune clair, bandes marron (abeille).
  pilote({ id: 'matthis', name: 'Matthis', color: 0xffff00, accent: 0x965a1e, helmet: 0xffff40, base: 0.96, lift: 0.1 }),
  // Moyen : orange, casque orange clair, bandes turquoise.
  pilote({ id: 'malo', name: 'Malo', color: 0xff8000, accent: 0x3cd2be, helmet: 0xffa040, base: 0.93, lift: 0.25 }),
  // Prudent : rose, casque rose clair, bandes citron vert.
  pilote({ id: 'liam', name: 'Liam', color: 0xff77aa, accent: 0xbee63c, helmet: 0xffa0c4, base: 0.88, lift: 0.5 }),
]);

/**
 * Tire `count` copains distincts, sans jamais Galahad : mélange de Fisher-Yates partiel
 * sur une copie de PILOTS, piloté par mulberry32(pilotSeed). L'index i du tableau renvoyé
 * est le robot de rang i + 1 sur la grille de départ (Galahad = rang 0). Même graine →
 * même tirage.
 * Lève RangeError si `pilotSeed` n'est pas un entier dans [0, 2³²) (mulberry32 le ramènerait
 * modulo 2³² : NaN, les fractions de [0, 1) et 2³² donneraient tous le tirage de la graine 0)
 * ou si `count` n'est pas un entier dans [0, PILOTS.length].
 */
export function drawPilots(pilotSeed: number, count = 4): Pilot[] {
  if (!Number.isInteger(pilotSeed) || pilotSeed < 0 || pilotSeed >= 2 ** 32) {
    throw new RangeError(`drawPilots: pilotSeed doit être un entier dans [0, 2^32) (reçu ${pilotSeed})`);
  }
  if (!Number.isInteger(count) || count < 0 || count > PILOTS.length) {
    throw new RangeError(`drawPilots: count doit être un entier dans [0, ${PILOTS.length}] (reçu ${count})`);
  }
  const rng = mulberry32(pilotSeed);
  const pool = [...PILOTS];
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
