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
 * Place les étoiles : candidats tous les 12–20 m sur les plats (hors départ) et les plats de réception ;
 * exclusion devant les laves et sur le plat d'arrivée. Plus d'étoile « 1 m avant une rampe-saut »
 * (addendum §1.5 : non admissible ; prise avec un turbo juste avant une rampe-saut qui précède un
 * volcan, elle lançait un saut de ≈ 50 m par-dessus la rampe-saut : atterrissage au bout du plat de
 * lancement, rebond, puis lave — graine 4 : xLancement 1134,2, xElanStart 1166,6, atterrissage 1165,6,
 * lave à 1192).
 */
export function placeStars(track: Track, rng: () => number, cfg: Config): Star[] {
  const candidates: number[] = [];
  track.slices.forEach((sl, i) => {
    if (sl.type === 'plat' && i > 0) walk(rng, sl.xStart, sl.xEnd, candidates);
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
