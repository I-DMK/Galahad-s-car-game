export interface TrackPoint { x: number; y: number }
/** `cratère` : défini dès la tâche 1 (addendum §1.4), généré en tâche 15. */
export type SliceType = 'plat' | 'bosses' | 'rampe-saut' | 'double-bosse' | 'rampe-volcan' | 'cratère';
export interface Slice { type: SliceType; xStart: number; xEnd: number }
export interface Volcano {
  /** Début de la tranche = début du plat de lancement (LANCEMENT_LENGTH). */
  xLancement: number;
  /** Début du plat d'élan (L_ELAN) = xLancement + LANCEMENT_LENGTH. */
  xElanStart: number;
  xRampStart: number; xLip: number; lipY: number;
  xLava: number; lavaWidth: number; rimY: number; xReception: number; xEnd: number;
}
export interface Star { id: number; x: number; y: number }
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
