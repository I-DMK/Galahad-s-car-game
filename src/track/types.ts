export interface TrackPoint { x: number; y: number }
/**
 * `cratère` : défini dès la tâche 1 (addendum §1.4), généré en tâche 15. `plat-étoile` : plat dédié à une étoile haute
 * (tâche 5e, saut §6.6), posé par le générateur sans tirage. `fosse` : volcan sans tremplin (tâche 5g, saut §6.2), une
 * `rampe-volcan` tirée et typée fosse par l'alternance (`FOSSE_PERIOD`).
 */
export type SliceType = 'plat' | 'plat-étoile' | 'bosses' | 'rampe-saut' | 'double-bosse' | 'rampe-volcan' | 'fosse' | 'cratère';
export interface Slice { type: SliceType; xStart: number; xEnd: number }
/**
 * Champs communs aux deux sortes de volcan (ruling R-F1) : capteur de lave, points sûrs, série de chutes, fantômes et
 * bulles n'utilisent qu'eux.
 */
interface VolcanoBase {
  /**
   * Début du plat de lancement (tremplin : début de la tranche) ou de l'approche (fosse : après le plat de garde) ;
   * il reste LANCEMENT_LENGTH de plat jusqu'à l'élan ou au bord de la fosse.
   */
  xLancement: number;
  /** Centre de la lave. */
  xLava: number;
  lavaWidth: number;
  /** Hauteur du rebord (le capteur dépasse de LAVA_SENSOR_ABOVE_RIM) ; 0 pour une fosse. */
  rimY: number;
  /** Début du plat de réception (tremplin : pied de la descente aval ; fosse : bord aval). */
  xReception: number;
  /** Fin de la tranche. */
  xEnd: number;
}
/** Volcan à tremplin (la `rampe-volcan` des tâches 1 à 5e). */
export interface Tremplin extends VolcanoBase {
  kind: 'tremplin';
  /** Début du plat d'élan (L_ELAN) = xLancement + LANCEMENT_LENGTH. */
  xElanStart: number;
  /**
   * Pied de la rampe rectiligne d'origine (fin nominale du plat d'élan). Avec le congé (RAMP_FOOT_RADIUS,
   * tâche 5c), le sol se relève dès xRampStart − R tan(RAMP_ANGLE / 2) (≈ 1,94 m avant, plat réel
   * L_ELAN − 1,94) et rejoint la rampe rectiligne ≈ 1,80 m après ; en xRampStart il est à ≈ 0,19 m.
   */
  xRampStart: number; xLip: number; lipY: number;
}
/**
 * Fosse (tâche 5g, saut §6.2) : garde, approche [xLancement, xBord[, lave [xBord, xReception] (xReception = bord aval),
 * réception ; rimY = 0 (rebords au ras du sol).
 */
export interface Fosse extends VolcanoBase {
  kind: 'fosse';
  /** Bord amont de la fosse (= xLava − lavaWidth / 2). */
  xBord: number;
}
export type Volcano = Tremplin | Fosse;
/** Étoile : `high` = étoile haute ajoutée (tâche 5e, à STAR_HIGH_Y au-dessus du sol), sinon étoile basse (0,6 m). */
export interface Star { id: number; x: number; y: number; high: boolean }
/**
 * Rocher (plan C, tâche 11c, spec « rochers » §1) : boîte [xStart, xEnd] × [sol, sol + ROCK_HEIGHT], sur du plat ;
 * xEnd = xStart + ROCK_WIDTH ; ids 0, 1, 2… dans l'ordre de la piste.
 */
export interface Rock { id: number; xStart: number; xEnd: number }
export interface Track {
  seed: number;
  targetLength: number;
  length: number;
  points: TrackPoint[];
  /** Indices (dans `points`) exemptés du test de pente : parois de cratère, cassure de rampe-saut. */
  exemptPointIndices: number[];
  slices: Slice[];
  volcanoes: Volcano[];
  stars: Star[];
  /** Rochers (tâche 11c), dans l'ordre de la piste ; vide si ROCKS_PER_RACE = 0. Posés après les étoiles (`placeRocks`). */
  rocks: Rock[];
  xStart: number;
  xFinish: number;
  xWall: number;
}
