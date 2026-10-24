// Classement de course (spec §6 « Arrivée ») et place affichée au HUD (tâche 8 : hystérésis, ordinal, position
// sur la barre) : pur (ni DOM, ni matter-js).
import { CONFIG, type Config } from '../config';

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

/**
 * Écart (m) de progression entre la voiture `me` et celle qui occupe la place `place` (1 = première) du classement
 * brut `order` : pour `DisplayedRank`, la voiture avec laquelle `me` vient d'échanger quand `place` est la place
 * encore affichée (ruling R8-2). Nul si `me` occupe cette place.
 */
export function gapToPlace(cars: readonly RankEntry[], order: readonly number[], me: number, place: number): number {
  const other = order[place - 1];
  let mine = NaN;
  let theirs = NaN;
  for (const c of cars) {
    if (c.index === me) mine = c.progress;
    if (c.index === other) theirs = c.progress;
  }
  return Math.abs(mine - theirs);
}

/** Place (1 = première) → « 1er », « 2e », « 3e »… (en français, seul le 1 prend « er »). */
export function ordinal(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`;
}

/**
 * Position d'une voiture sur la barre de progression, de 0 (ligne de départ ou grille, x < xStart) à 1 (ligne
 * d'arrivée ou au-delà) : ruling R8-3.
 */
export function progressFraction(x: number, xStart: number, xFinish: number): number {
  return Math.min(1, Math.max(0, (x - xStart) / (xFinish - xStart)));
}

/** Seuils de l'hystérésis (CONFIG). */
type RankConfig = Pick<Config, 'RANK_HYSTERESIS_S' | 'RANK_HYSTERESIS_M'>;

/**
 * Place montrée au HUD (spec §7) : le classement brut est recalculé chaque image, mais un changement de place n'est
 * montré que s'il tient `RANK_HYSTERESIS_S` ou si l'écart avec la voiture échangée dépasse `RANK_HYSTERESIS_M`
 * (`gapToPlace`). La première place calculée est adoptée telle quelle. Places de 1 (première) à N.
 */
export class DisplayedRank {
  private shown: number | null = null;
  /** Place brute qui diffère de `shown`, et instant (s) depuis lequel elle tient ; null si la place brute est `shown`. */
  private candidate: number | null = null;
  private since = 0;

  constructor(private readonly cfg: RankConfig = CONFIG) {}

  /** Place montrée jusque-là, null avant le premier `update`. */
  get current(): number | null { return this.shown; }

  /**
   * `rawRank` : place du classement brut ; `gapToNeighbourM` : écart (m) à la voiture qui occupe, dans ce classement,
   * la place montrée jusque-là (ignoré tant qu'elle est la place brute) ; `t` : instant (s). Rend la place à montrer.
   */
  update(rawRank: number, gapToNeighbourM: number, t: number): number {
    if (this.shown === null || rawRank === this.shown || gapToNeighbourM > this.cfg.RANK_HYSTERESIS_M) {
      this.candidate = null;
      return (this.shown = rawRank);
    }
    if (this.candidate !== rawRank) {
      this.candidate = rawRank;
      this.since = t;
    } else if (t - this.since >= this.cfg.RANK_HYSTERESIS_S) {
      this.candidate = null;
      this.shown = rawRank;
    }
    return this.shown;
  }
}
