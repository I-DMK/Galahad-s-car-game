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
  /**
   * Caractère de vitesse du pilote automatique : cible de son élastique quand il est dans la vue de Galahad (tâche 7,
   * `ai/rubberband.ts`), en fraction de la vitesse max : [0,97 ; 1], décision du papa du 2026-10-23 (D7-3).
   */
  readonly base: number;
  /** Probabilité de lever le pied avant une rampe-saut ou une double-bosse : [0 ; 0,6]. */
  readonly lift: number;
  /** Probabilité de tenter une étoile haute encore disponible pour lui : [0 ; 1] (tâche 6, addendum « bouton saut » §3). */
  readonly jumpTry: number;
  /**
   * Écart-type (s) de l'erreur sur l'instant du saut : [0,02 ; 0,25]. Multiplié par FOSSE_SKILL_FACTOR devant une fosse
   * (décision Q-F3 du papa).
   */
  readonly jumpSkill: number;
}

/**
 * Galahad, le pilote humain. Ses `base`, `lift`, `jumpTry` et `jumpSkill` n'ont pas de sens (c'est
 * l'enfant qui conduit et saute, pas le pilote automatique) : valeurs neutres. Couleurs reprises de
 * CONFIG, source unique ; le casque est rouge comme les bandes (aspect du plan A).
 */
export const GALAHAD: Pilot = Object.freeze({
  id: 'galahad',
  name: 'Galahad',
  color: CONFIG.GALAHAD_COLOR,
  accent: CONFIG.GALAHAD_ACCENT,
  helmet: CONFIG.GALAHAD_ACCENT,
  base: 1,
  lift: 0,
  jumpTry: 0,
  jumpSkill: 0,
});

/** Fige une entrée de la table : aucun appelant ne doit pouvoir la modifier. */
const pilote = (p: Pilot): Pilot => Object.freeze(p);

/**
 * Les 6 copains, fixés à la main : 2 prudents, 2 moyens, 2 fonceurs.
 *
 * Galahad reste « la voiture bleue » : aucune carrosserie de copain n'est bleue, cyan,
 * turquoise ou violette. Le casque d'un copain est une nuance plus claire ou plus foncée de
 * sa propre carrosserie (casque assorti) ; le casque rouge de Galahad ne compte pas dans
 * cette règle. Carrosserie, casque et bandes ont un contraste WCAG ≥ 3:1 contre l'arrêt le
 * plus clair du ciel (0x0a1030, dégradé de prerenderSky dans src/render/background.ts). Ces
 * contraintes de couleur sont vérifiées par tests/pilots.test.ts. Le contraste avec le sol
 * (gris moyen 0x8b8b8b) n'est pas testé : certaines carrosseries s'y détachent peu (vert,
 * orange, rose, rouge), il sera jugé au rendu, en 5b.
 *
 * Sauts (tâche 6, décision P4 du papa : tableau des traits gardé) : les fonceurs tentent souvent
 * les étoiles hautes et visent moins bien (`jumpTry` haut, `jumpSkill` grand), les prudents
 * tentent rarement et visent juste.
 *
 * Vitesse (tâche 7, décision D7-3 du papa, 2026-10-23) : caractère de vitesse regroupé près de 1, dans le même ordre
 * qu'au 5a (Pablo 1,00, Matthis 0,995, Malo 0,9875, Diego 0,985, Liam 0,975, Timothé 0,97 ; au 5a : 0,98 à 0,86) ; le
 * caractère est porté par `lift`, `jumpTry` et `jumpSkill`. Avec les `base` d'avant, l'élastique faisait gagner
 * Galahad 19 courses sur 20 (relecture adversariale de la tâche 7).
 */
export const PILOTS: readonly Pilot[] = Object.freeze([
  // Fonceur : rouge vif, casque rouge clair, bandes crème dorée.
  pilote({ id: 'pablo', name: 'Pablo', color: 0xc8001e, accent: 0xffdc64, helmet: 0xd64056, base: 1, lift: 0.05, jumpTry: 0.8, jumpSkill: 0.18 }),
  // Moyen : vert, casque vert foncé, bandes crème.
  pilote({ id: 'diego', name: 'Diego', color: 0x2ecc40, accent: 0xfff096, helmet: 0x208f2d, base: 0.985, lift: 0.3, jumpTry: 0.55, jumpSkill: 0.1 }),
  // Prudent : blanc, casque gris clair, bandes sarcelle.
  pilote({ id: 'timothé', name: 'Timothé', color: 0xf5f5f5, accent: 0x00a8a0, helmet: 0xd0d0d0, base: 0.97, lift: 0.55, jumpTry: 0.3, jumpSkill: 0.04 }),
  // Fonceur : jaune, casque jaune clair, bandes marron (abeille).
  pilote({ id: 'matthis', name: 'Matthis', color: 0xffff00, accent: 0x965a1e, helmet: 0xffff40, base: 0.995, lift: 0.1, jumpTry: 0.75, jumpSkill: 0.15 }),
  // Moyen : orange, casque orange clair, bandes turquoise.
  pilote({ id: 'malo', name: 'Malo', color: 0xff8000, accent: 0x3cd2be, helmet: 0xffa040, base: 0.9875, lift: 0.25, jumpTry: 0.5, jumpSkill: 0.09 }),
  // Prudent : rose, casque rose clair, bandes citron vert.
  pilote({ id: 'liam', name: 'Liam', color: 0xff77aa, accent: 0xbee63c, helmet: 0xffa0c4, base: 0.975, lift: 0.5, jumpTry: 0.3, jumpSkill: 0.05 }),
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
