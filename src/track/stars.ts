import type { Config } from '../config';
import { heightAt } from './query';
import type { Star, Track } from './types';

const STAR_HEIGHT = 0.6;

/**
 * Zones admissibles (addendum §1.5, plan B tâche 2), de longueur > 0, dans l'ordre de la piste :
 * chaque `plat` hors plat de départ (indice 0) et hors plat d'arrivée `[xFinish − FINISH_PLAT_BEFORE, xWall]`,
 * chaque plat de lancement `[xLancement, xElanStart − STAR_ELAN_GAP]`, chaque plat de réception `[xReception, xEnd)`.
 * Aucune zone de longueur nulle : elle ne recevrait jamais le curseur.
 */
function admissibleZones(track: Track, cfg: Config): [number, number][] {
  const limit = track.xFinish - cfg.FINISH_PLAT_BEFORE;
  const zones: [number, number][] = [];
  track.slices.forEach((sl, i) => {
    if (sl.type === 'plat' && i > 0) zones.push([sl.xStart, Math.min(sl.xEnd, limit)]);
  });
  for (const v of track.volcanoes) {
    zones.push([v.xLancement, v.xElanStart - cfg.STAR_ELAN_GAP]);
    zones.push([v.xReception, v.xEnd]);
  }
  return zones.filter(([a, b]) => b - a > 0).sort((p, q) => p[0] - q[0]);
}

/**
 * Place les étoiles (déterministe, un seul `rng`) :
 * 1. curseur global : la distance ne s'accumule que sur les zones admissibles ; à chaque pas tiré dans
 *    [STAR_STEP_MIN, STAR_STEP_MAX], une étoile est posée dès que la distance cumulée atteint le pas ;
 * 2. étoile d'élan : un volcan sur deux (tirage), à `xElanStart − STAR_ELAN_OFFSET` ;
 * 3. plancher : tant qu'il y a moins de STAR_MIN_COUNT étoiles, une étoile d'élan est ajoutée au premier volcan
 *    (ordre de la piste) qui n'en a pas ; plus de volcan → on laisse ;
 * 4. tri par x, ids 0, 1, 2…, `y = heightAt + 0,6`.
 * Invariant : aucune étoile dans [xElanStart, xLava], ni sur le plat de départ, ni après xFinish − FINISH_PLAT_BEFORE.
 */
export function placeStars(track: Track, rng: () => number, cfg: Config): Star[] {
  const step = (): number => cfg.STAR_STEP_MIN + rng() * (cfg.STAR_STEP_MAX - cfg.STAR_STEP_MIN);
  const xs: number[] = [];

  // 1. Curseur global.
  let due = step();
  let d = 0;
  for (const [a, b] of admissibleZones(track, cfg)) {
    let x = a;
    while (d + (b - x) >= due) {
      x += due - d;
      xs.push(x);
      d = due;
      due += step();
    }
    d += b - x;
  }

  // 2. Étoiles d'élan tirées, 3. plancher.
  const hasElan = track.volcanoes.map(() => rng() < 0.5);
  for (let i = 0; i < hasElan.length && xs.length + hasElan.filter(Boolean).length < cfg.STAR_MIN_COUNT; i++) {
    if (!hasElan[i]) hasElan[i] = true;
  }
  track.volcanoes.forEach((v, i) => {
    if (hasElan[i]) xs.push(v.xElanStart - cfg.STAR_ELAN_OFFSET);
  });

  // 4. Tri, ids, hauteur.
  return xs
    .sort((p, q) => p - q)
    .map((x, id) => ({ id, x, y: heightAt(track, x) + STAR_HEIGHT }));
}
