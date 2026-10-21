import type { Config } from '../config';
import type { Slice, Track, Volcano } from './types';

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

/** Premier volcan (dans l'ordre de la piste) dont la lave est strictement devant x. */
export function volcanoAhead(track: Track, x: number): Volcano | undefined {
  return track.volcanoes.find((v) => v.xLava > x);
}

/** Volcan dont la zone [xLancement, xEnd[ (plat de lancement inclus) contient x. */
export function nearestVolcanoZone(track: Track, x: number): Volcano | undefined {
  return track.volcanoes.find((v) => x >= v.xLancement && x < v.xEnd);
}

/**
 * Vrai si x est sur le plat d'élan ou la rampe d'un volcan, [xElanStart, xLip] bornes incluses
 * (zone de réapparition immédiate d'une voiture retournée, addendum §1.6 ; au-delà du sommet,
 * c'est la lave qui tranche).
 */
export function inElanZone(track: Track, x: number): boolean {
  return track.volcanoes.some((v) => x >= v.xElanStart && x <= v.xLip);
}

/**
 * Vrai si la voiture dont le châssis est en `chassisX` est dans la zone fantôme d'un volcan : du début
 * du plat de lancement (châssis ≥ xLancement) jusqu'à ce que la voiture entière ait passé la réception
 * (roue arrière, WHEEL_BASE/2 + WHEEL_RADIUS derrière le châssis, au-delà de xReception). Les voitures
 * s'y traversent, pour qu'aucun choc ne fasse tomber une voiture dans la lave (décision du papa,
 * tâche 5b) ; partout ailleurs, elles se cognent.
 */
export function inGhostZone(track: Track, chassisX: number, cfg: Pick<Config, 'WHEEL_BASE' | 'WHEEL_RADIUS'>): boolean {
  const rear = cfg.WHEEL_BASE / 2 + cfg.WHEEL_RADIUS;
  return track.volcanoes.some((v) => chassisX >= v.xLancement && chassisX <= v.xReception + rear);
}
