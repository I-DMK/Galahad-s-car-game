// Les copains de Galahad : leurs couleurs, leur caractère de pilotage et le tirage de ceux
// qui prennent le départ. Pur (ni DOM, ni matter-js) : la course les consomme (tâche 5b).
import { CONFIG } from '../config';
import { mulberry32 } from '../track/rng';

export interface Pilot {
  readonly id: string;
  readonly name: string;
  /** Carrosserie, accent (bandes) et casque : 0xRRGGBB. */
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
 * source unique ; le casque est rouge comme les bandes.
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
 * Couleurs gaies et lisibles sur le fond lunaire gris foncé ; les 7 carrosseries (Galahad
 * compris), comme les 7 casques, sont deux à deux distinctes : écart ≥ 120 sur au moins
 * une composante R, V ou B (testé). Le casque tranche aussi avec la carrosserie du pilote.
 */
export const PILOTS: readonly Pilot[] = Object.freeze([
  // Fonceur : rouge vif, ne lève presque jamais le pied.
  pilote({ id: 'pablo', name: 'Pablo', color: 0xe11e32, accent: 0xffffff, helmet: 0x1ee2ec, base: 0.98, lift: 0.05 }),
  // Moyen : vert.
  pilote({ id: 'diego', name: 'Diego', color: 0x32cd5a, accent: 0x14642d, helmet: 0xf5f5f5, base: 0.92, lift: 0.3 }),
  // Prudent : violet, lève souvent le pied avant les sauts.
  pilote({ id: 'timothée', name: 'Timothée', color: 0xa846dc, accent: 0xffe14d, helmet: 0x3cd25a, base: 0.86, lift: 0.55 }),
  // Fonceur : jaune.
  pilote({ id: 'matthis', name: 'Matthis', color: 0xffdc28, accent: 0x3a3a3a, helmet: 0x1446c8, base: 0.96, lift: 0.1 }),
  // Moyen : turquoise.
  pilote({ id: 'malo', name: 'Malo', color: 0x1ee2ec, accent: 0x0a5f73, helmet: 0xffe033, base: 0.93, lift: 0.25 }),
  // Prudent : blanc.
  pilote({ id: 'liam', name: 'Liam', color: 0xf5f5f5, accent: 0x7a3ad1, helmet: 0x9b3fe0, base: 0.88, lift: 0.5 }),
]);

/**
 * Tire `count` copains distincts, sans jamais Galahad : mélange de Fisher-Yates partiel
 * sur une copie de PILOTS, piloté par mulberry32(pilotSeed). L'ordre du tableau renvoyé
 * est le rang sur la grille de départ. Même graine → même tirage.
 * Lève RangeError si `count` n'est pas un entier dans [0, PILOTS.length].
 */
export function drawPilots(pilotSeed: number, count = 4): Pilot[] {
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
