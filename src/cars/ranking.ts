// Classement de course (spec §6 « Arrivée ») et place affichée au HUD (tâche 8 : hystérésis, ordinal, position
// sur la barre) : pur (ni DOM, ni matter-js).
import { CONFIG, type Config } from '../config';
import type { Pilot } from './pilots';

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

/** Une place du classement final (podium, tâche 11). */
export interface PodiumPlace {
  /** 1 = première. */
  place: number;
  /** Index de la voiture (rang de grille ; Galahad = 0). */
  index: number;
  id: string;
  name: string;
  /** Le pilote (sa voiture est peinte d'après lui au podium). */
  pilot: Pilot;
  isGalahad: boolean;
}

/** Classement final montré au podium : calculé une fois, à l'entrée au podium (tâche 11). */
export interface PodiumView {
  /** Tout le classement, place 1 d'abord. */
  places: PodiumPlace[];
  /** Place de Galahad (1 à N). */
  galahadPlace: number;
  /** Temps de course de Galahad à l'arrivée (s). */
  galahadTime: number;
}

/**
 * Classement final (spec §6 « Arrivée ») : `rankCars(entries)` (arrivées par temps, puis non arrivées par progression,
 * égalité par index), chaque voiture nommée par `pilots[index]` (ordre de la grille). Lève RangeError sur un index sans pilote.
 */
export function podiumView(entries: readonly RankEntry[], pilots: readonly Pilot[], galahadIndex: number, galahadTime: number): PodiumView {
  const places = rankCars(entries).map((index, k): PodiumPlace => {
    const p = pilots[index];
    if (p === undefined) throw new RangeError(`podiumView : pas de pilote d'index ${index} (${pilots.length} reçus)`);
    return { place: k + 1, index, id: p.id, name: p.name, pilot: p, isGalahad: index === galahadIndex };
  });
  return { places, galahadPlace: places.findIndex((p) => p.isGalahad) + 1, galahadTime };
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

/** Marge (s) sur la durée de tenue : 30 pas de 1/60 s font 0,49999999999999994 en flottant, pas 0,5. */
const HOLD_EPSILON_S = 1e-9;

/** Entrée de la voiture `index` : `cars` est rangé par index (`cars[i].index === i`), sinon erreur explicite. */
function entryOf(cars: readonly RankEntry[], index: number): RankEntry {
  const entry = cars[index];
  if (entry === undefined || entry.index !== index) {
    throw new RangeError(`DisplayedRank : pas d'entrée d'index ${index} (les entrées doivent être rangées par index, ${cars.length} reçues)`);
  }
  return entry;
}

/**
 * Place de Galahad montrée au HUD (spec §7) : le classement brut (`rankCars`) est recalculé à chaque appel, mais un
 * changement de place n'est montré que s'il tient `RANK_HYSTERESIS_S` ou si l'écart de progression avec la voiture
 * échangée dépasse `RANK_HYSTERESIS_M`. La première place calculée est adoptée telle quelle ; une fois la voiture
 * arrivée, sa place est définitive et montrée tout de suite. Places de 1 (première) à N.
 */
export class DisplayedRank {
  private shown: number | null = null;
  /** Place brute qui diffère de `shown`, et instant (s) depuis lequel elle tient ; null si la place brute est `shown`. */
  private candidate: number | null = null;
  private since = 0;

  constructor(private readonly cfg: RankConfig = CONFIG) {}

  /**
   * `cars` : les voitures de la course, rangées par index ; `me` : l'index de la voiture dont on montre la place ;
   * `t` : instant (s). Rend la place à montrer. L'écart (R8-2) est celui à la voiture qui occupe, dans le classement
   * brut, la place montrée jusque-là (celle avec qui `me` vient d'échanger) ; il est ignoré tant que cette place est
   * la place brute de `me`.
   */
  update(cars: readonly RankEntry[], me: number, t: number): number {
    const mine = entryOf(cars, me);
    const order = rankCars(cars);
    const raw = order.indexOf(me) + 1;
    const place = this.shown ?? raw;
    const gap = mine.finishedAt !== null ? Infinity : Math.abs(mine.progress - entryOf(cars, order[place - 1]).progress);
    if (this.shown === null || raw === this.shown || gap > this.cfg.RANK_HYSTERESIS_M) {
      this.candidate = null;
      return (this.shown = raw);
    }
    if (this.candidate !== raw) {
      this.candidate = raw;
      this.since = t;
    } else if (t - this.since >= this.cfg.RANK_HYSTERESIS_S - HOLD_EPSILON_S) {
      this.candidate = null;
      this.shown = raw;
    }
    return this.shown;
  }
}
