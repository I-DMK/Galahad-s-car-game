import type { Config } from '../config';
import type { Fosse, Rock, Slice, Track, Tremplin, Volcano } from './types';

/** Indice i (1 ≤ i ≤ n − 1) du premier point d'abscisse ≥ x (x supposé dans l'intervalle des points). */
function upperIndex(track: Track, x: number): number {
  const pts = track.points;
  let lo = 1;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].x < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Hauteur du sol en x (interpolation linéaire, clampée aux extrémités). */
export function heightAt(track: Track, x: number): number {
  const pts = track.points;
  if (x <= pts[0].x) return pts[0].y;
  const last = pts[pts.length - 1];
  if (x >= last.x) return last.y;
  const i = upperIndex(track, x);
  const a = pts[i - 1];
  const b = pts[i];
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

/** Pente (radians, positive en montée) du segment contenant x ; clampée aux extrémités. */
export function slopeAt(track: Track, x: number): number {
  const pts = track.points;
  const i = x <= pts[0].x ? 1 : x >= pts[pts.length - 1].x ? pts.length - 1 : upperIndex(track, x);
  const a = pts[i - 1];
  const b = pts[i];
  return Math.atan((b.y - a.y) / (b.x - a.x));
}

/** Tranche contenant x ([xStart, xEnd[) ; clampée aux extrémités. */
export function sliceAt(track: Track, x: number): Slice {
  const sl = track.slices;
  let lo = 0;
  let hi = sl.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sl[mid].xStart <= x) lo = mid;
    else hi = mid - 1;
  }
  return sl[lo];
}

/** Volcans à tremplin de la piste, dans l'ordre (tâche 5g : les champs du tremplin ne valent que pour eux). */
export function tremplins(track: Track): Tremplin[] {
  return track.volcanoes.filter((v): v is Tremplin => v.kind === 'tremplin');
}

/** Fosses de la piste, dans l'ordre (tâche 5g). */
export function fosses(track: Track): Fosse[] {
  return track.volcanoes.filter((v): v is Fosse => v.kind === 'fosse');
}

/** Première fosse (dans l'ordre de la piste) dont le bord amont est strictement devant x (tâche 5g) ; sans allocation. */
export function nextFosse(track: Track, x: number): Fosse | undefined {
  for (const v of track.volcanoes) if (v.kind === 'fosse' && v.xBord > x) return v;
  return undefined;
}

/** Premier rocher (dans l'ordre de la piste) dont xStart est strictement devant x, undefined sinon (tâche 11c) ; sans allocation. */
export function nextRock(track: Track, x: number): Rock | undefined {
  for (const r of track.rocks) if (r.xStart > x) return r;
  return undefined;
}

/**
 * Vrai si x est dans [xLancement, xReception] d'un volcan à tremplin, bornes incluses : jamais de saut de copain là
 * (addendum « bouton saut » §3, tâche 6 ; garde du driver et de `stepRace`). Toujours faux sur une fosse, devant
 * laquelle le copain saute (saut §6.8). Sans allocation : appelé à chaque pas pour chaque copain.
 */
export function inNoJumpZone(track: Track, x: number): boolean {
  for (const v of track.volcanoes) if (v.kind === 'tremplin' && x >= v.xLancement && x <= v.xReception) return true;
  return false;
}

/**
 * Zone volcan en x, en un seul balayage (tâche 7, ruling R7-13 : une seule définition de la zone, pour le driver et
 * l'élastique) : 2 si x est dans [xLancement, xLava] d'un volcan (tremplin ou fosse), bornes incluses ; 1 s'il est
 * seulement dans les `before` m qui précèdent xLancement d'un volcan ([xLancement − before, xLancement[ : pré-zone de
 * l'élastique, addendum §1.8) ; 0 sinon. Pour une fosse, xLancement est le début de l'approche : le plat de garde n'est
 * pas dans la zone (il est dans la pré-zone, ruling R7-4). Sans allocation : appelé à chaque pas pour chaque copain.
 */
export function volcanoZoneLevel(track: Track, x: number, before = 0): 0 | 1 | 2 {
  let level: 0 | 1 | 2 = 0;
  for (const v of track.volcanoes) {
    if (x < v.xLancement - before || x > v.xLava) continue;
    if (x >= v.xLancement) return 2;
    level = 1;
  }
  return level;
}

/**
 * Vrai si x est dans [xLancement, xLava] d'un volcan (tremplin ou fosse), bornes incluses : le copain y garde le doigt
 * posé (driver, tâche 6) et son élastique y vaut au moins 1 (clamp de zone, tâche 7, addendum §1.8). Voir
 * `volcanoZoneLevel`, la définition.
 */
export function inVolcanoZone(track: Track, x: number): boolean {
  return volcanoZoneLevel(track, x) === 2;
}

/** Premier volcan (tremplin ou fosse, dans l'ordre de la piste) dont la lave est strictement devant x. */
export function volcanoAhead(track: Track, x: number): Volcano | undefined {
  return track.volcanoes.find((v) => v.xLava > x);
}

/**
 * Vrai si x est au-dessus de la lave d'un volcan (tremplin ou fosse), [xLava − lavaWidth/2 − margin, xLava + lavaWidth/2 +
 * margin] bornes incluses : `heightAt` y donne le fond du cratère ou de la fosse, sous la lave dessinée. Une seule
 * définition pour le rendu (plots lumineux, `margin` 0,3 m ; ombre des voitures, `margin` 0). Sans allocation.
 */
export function overLava(track: Track, x: number, margin = 0): boolean {
  for (const v of track.volcanoes) if (Math.abs(x - v.xLava) <= v.lavaWidth / 2 + margin) return true;
  return false;
}

/** Volcan dont la zone [xLancement, xEnd[ (plat de lancement inclus) contient x. */
export function nearestVolcanoZone(track: Track, x: number): Volcano | undefined {
  return track.volcanoes.find((v) => x >= v.xLancement && x < v.xEnd);
}

/**
 * Vrai si x est sur le plat d'élan ou la rampe d'un volcan à tremplin, [xElanStart, xLip] bornes incluses
 * (zone de réapparition immédiate d'une voiture retournée, addendum §1.6 ; au-delà du sommet,
 * c'est la lave qui tranche). Jamais sur une fosse (tâche 5g, saut §6.4) : sur son approche plate, les délais
 * FLIP_SECONDS et SIDE_SECONDS s'appliquent.
 */
export function inElanZone(track: Track, x: number): boolean {
  // Sans allocation : appelé à chaque pas pour chaque voiture.
  for (const v of track.volcanoes) if (v.kind === 'tremplin' && x >= v.xElanStart && x <= v.xLip) return true;
  return false;
}

/**
 * Vrai si la voiture dont le châssis est en `chassisX` est dans la zone fantôme d'un volcan. Tremplin : du début
 * du plat de lancement (châssis ≥ xLancement) jusqu'à ce que la voiture entière ait passé la réception
 * (roue arrière, WHEEL_BASE/2 + WHEEL_RADIUS derrière le châssis, au-delà de xReception). Fosse (tâche 5g, ruling
 * R-F16, amendé au tour 1 de la tâche 6) : du début du plat de garde (xLancement − FOSSE_GUARD) jusqu'au bord aval +
 * FOSSE_GHOST_AFTER (les sauteurs atterrissent jusqu'à ≈ 32 m, et une voiture posée à bord aval + FOSSE_RESPAWN_AFTER y
 * attend). La garde en fait partie depuis la tâche 6 : Galahad en turbo qui percute un copain plus lent (ou reposé au
 * point sûr) juste avant l'approche était catapulté par-dessus et tombait dans la lave (graines 33 et 36, à 2–4 m de
 * xLancement). Les voitures s'y traversent, pour qu'aucun choc ne fasse tomber une voiture dans la lave (décision du
 * papa, tâche 5b). Rocher (tâche 11c, ruling R-11c-1) : [xStart − ROCK_GHOST_BEFORE, xEnd + ROCK_GHOST_AFTER] : les
 * voitures qui sautent ensemble ne se font plus retomber sur le rocher. Partout ailleurs, elles se cognent.
 */
export function inGhostZone(
  track: Track, chassisX: number,
  cfg: Pick<Config, 'WHEEL_BASE' | 'WHEEL_RADIUS' | 'FOSSE_GHOST_AFTER' | 'FOSSE_GUARD' | 'ROCK_GHOST_BEFORE' | 'ROCK_GHOST_AFTER'>,
): boolean {
  const rear = cfg.WHEEL_BASE / 2 + cfg.WHEEL_RADIUS;
  for (const r of track.rocks) {
    if (chassisX >= r.xStart - cfg.ROCK_GHOST_BEFORE && chassisX <= r.xEnd + cfg.ROCK_GHOST_AFTER) return true;
  }
  return track.volcanoes.some((v) => (v.kind === 'fosse'
    ? chassisX >= v.xLancement - cfg.FOSSE_GUARD && chassisX <= v.xReception + cfg.FOSSE_GHOST_AFTER
    : chassisX >= v.xLancement && chassisX <= v.xReception + rear));
}
