// Classement de course (spec §6 « Arrivée ») : pur (ni DOM, ni matter-js). L'affichage de la
// position (hystérésis, ordinal) arrive en tâche 8.

export interface RankEntry {
  /** Index de la voiture (Galahad = 0). */
  index: number;
  /** x du châssis (m). */
  progress: number;
  /** Instant d'arrivée (s), null si pas encore arrivée. */
  finishedAt: number | null;
}

/**
 * Index des voitures du premier au dernier : arrivées par temps croissant, puis non arrivées par
 * progression décroissante ; égalité tranchée par l'index croissant.
 */
export function rankCars(cars: readonly RankEntry[]): number[] {
  return [...cars]
    .sort((a, b) => {
      if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt || a.index - b.index;
      if (a.finishedAt !== null) return -1;
      if (b.finishedAt !== null) return 1;
      return b.progress - a.progress || a.index - b.index;
    })
    .map((c) => c.index);
}
