export interface TrackPoint { x: number; y: number }
/** `cratère` : défini dès la tâche 1 (addendum §1.4), généré en tâche 15. */
export type SliceType = 'plat' | 'bosses' | 'rampe-saut' | 'double-bosse' | 'rampe-volcan' | 'cratère';
export interface Slice { type: SliceType; xStart: number; xEnd: number }
export interface Volcano {
  /** Début de la tranche = début du plat de lancement (LANCEMENT_LENGTH). */
  xLancement: number;
  /** Début du plat d'élan (L_ELAN) = xLancement + LANCEMENT_LENGTH. */
  xElanStart: number;
  /**
   * Pied de la rampe rectiligne d'origine (fin nominale du plat d'élan). Avec le congé (RAMP_FOOT_RADIUS,
   * tâche 5c), le sol se relève dès xRampStart − R tan(RAMP_ANGLE / 2) (≈ 1,94 m avant, plat réel
   * L_ELAN − 1,94) et rejoint la rampe rectiligne ≈ 1,80 m après ; en xRampStart il est à ≈ 0,19 m.
   */
  xRampStart: number; xLip: number; lipY: number;
  xLava: number; lavaWidth: number; rimY: number; xReception: number; xEnd: number;
}
/** Étoile : `high` = étoile haute ajoutée (tâche 5e, à STAR_HIGH_Y au-dessus du sol), sinon étoile basse (0,6 m). */
export interface Star { id: number; x: number; y: number; high: boolean }
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
  xStart: number;
  xFinish: number;
  xWall: number;
}
