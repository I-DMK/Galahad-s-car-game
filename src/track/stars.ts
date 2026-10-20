import type { Config } from '../config';
import { heightAt } from './query';
import type { Star, Track } from './types';

const STAR_HEIGHT = 0.6;
const STEP_MIN = 12;
const STEP_MAX = 20;

/** Pose des candidats sur [from, to[ : premier pas puis pas suivants tirés dans [12, 20] m. */
function walk(rng: () => number, from: number, to: number, out: number[]): void {
  let x = from + STEP_MIN + rng() * (STEP_MAX - STEP_MIN);
  while (x < to) {
    out.push(x);
    x += STEP_MIN + rng() * (STEP_MAX - STEP_MIN);
  }
}

/**
 * Place les étoiles : candidats tous les 12–20 m sur les plats (hors départ) et les plats de réception,
 * plus 1 m avant chaque rampe-saut ; exclusion devant les laves et sur le plat d'arrivée.
 */
export function placeStars(track: Track, rng: () => number, cfg: Config): Star[] {
  const candidates: number[] = [];
  track.slices.forEach((sl, i) => {
    if (sl.type === 'plat' && i > 0) walk(rng, sl.xStart, sl.xEnd, candidates);
    else if (sl.type === 'rampe-saut') candidates.push(sl.xStart - 1);
  });
  for (const v of track.volcanoes) walk(rng, v.xReception, v.xEnd, candidates);

  return candidates
    .filter((x) => x > track.xStart)
    .filter((x) => x < track.xFinish - cfg.FINISH_PLAT_BEFORE)
    .filter((x) => track.volcanoes.every(
      (v) => x < v.xLava - cfg.STAR_EXCLUSION_BEFORE_LAVA || x > v.xLava,
    ))
    .sort((a, b) => a - b)
    .map((x, id) => ({ id, x, y: heightAt(track, x) + STAR_HEIGHT }));
}
