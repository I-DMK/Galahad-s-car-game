// Élastique des copains (plan B, tâche 7 ; spec §7, addendum §1.8 et §2 ; décisions D7-2 et D7-3 du papa, 2026-10-23) :
// un facteur par copain, appliqué au plafond de vitesse ET au couple de ses roues (`applyDrive`), qui le ralentit loin
// devant Galahad (jusqu'à 0,6) et le pousse loin derrière (jusqu'à 1,3), à 0,15 par seconde au plus. Galahad n'en a pas.
// Pur (ni DOM, ni matter-js) : `sim/simulate.ts` l'appelle à chaque pas, avant la conduite. Arguments positionnels :
// aucune allocation par pas.
import type { Config } from '../config';
import { inVolcanoZone } from '../track/query';
import type { Track } from '../track/types';

/**
 * Cible de l'élastique selon l'écart `gap` = x(copain) − x(Galahad) (m) : `base` (caractère de vitesse du pilote) sur
 * [−RUBBER_WINDOW_BEHIND_M, RUBBER_WINDOW_AHEAD_M] (la vue : 3 m derrière, 20 m devant, décision D7-2) ; de `base` à
 * RUBBER_MIN, linéaire, sur les RUBBER_RAMP_M qui suivent devant ; de `base` à RUBBER_MAX sur les RUBBER_RAMP_M qui
 * précèdent derrière ; constante au-delà (ruling R7-15 : la rampe part de `base`, pas de 1). Non croissante en `gap`.
 */
export function targetFactor(gap: number, base: number, cfg: Config): number {
  if (gap > cfg.RUBBER_WINDOW_AHEAD_M) {
    return base + (cfg.RUBBER_MIN - base) * Math.min(1, (gap - cfg.RUBBER_WINDOW_AHEAD_M) / cfg.RUBBER_RAMP_M);
  }
  if (gap < -cfg.RUBBER_WINDOW_BEHIND_M) {
    return base + (cfg.RUBBER_MAX - base) * Math.min(1, (-gap - cfg.RUBBER_WINDOW_BEHIND_M) / cfg.RUBBER_RAMP_M);
  }
  return base;
}

/** Rampe : de `prev` vers `target`, d'au plus RUBBER_RATE_PER_S × dt, sans dépasser la cible (spec §7). */
export function rampFactor(prev: number, target: number, dt: number, cfg: Config): number {
  const d = cfg.RUBBER_RATE_PER_S * dt;
  return target > prev ? Math.min(target, prev + d) : Math.max(target, prev - d);
}

/**
 * Plancher de la cible (addendum §1.8) : 1 dans [xLancement − RUBBER_PREZONE_M, xLava] d'un volcan (tremplin ou fosse ;
 * xLancement d'une fosse est le début de l'approche, sa garde est dans la pré-zone, ruling R7-4), 0 ailleurs. Un copain
 * freiné à 0,6 remonte à 1 en ≈ 2,7 s avant d'aborder le volcan. Sans allocation.
 */
export function zoneFloor(track: Track, x: number, cfg: Config): number {
  for (const v of track.volcanoes) if (x >= v.xLancement - cfg.RUBBER_PREZONE_M && x <= v.xLava) return 1;
  return 0;
}

/**
 * Vue de référence (ruling R7-16) : écran de 1 280 × 800 (demi-largeur SCREEN_REF_HALF_WIDTH_M), caméra en avance de
 * CAMERA_LEAD_SECONDS × vGalahad (vitesse du châssis de Galahad au début du pas, comme `cameraTarget`), plus
 * SCREEN_EDGE_MARGIN_M pour qu'un copain « hors écran » le soit en entier. Une seule définition, partagée par le plafond
 * du turbo (`finalFactor`) et par les mesures (« copain à l'écran », « freinage net »). Bord avant : 21,2 m à 14 m/s.
 */
export function screenAheadEdge(vGalahad: number, cfg: Config): number {
  return cfg.SCREEN_REF_HALF_WIDTH_M + cfg.CAMERA_LEAD_SECONDS * vGalahad + cfg.SCREEN_EDGE_MARGIN_M;
}

/** Bord arrière de la vue de référence (écart, m) : −4,4 m à 14 m/s (voir `screenAheadEdge`). */
export function screenBehindEdge(vGalahad: number, cfg: Config): number {
  return cfg.CAMERA_LEAD_SECONDS * vGalahad - cfg.SCREEN_REF_HALF_WIDTH_M - cfg.SCREEN_EDGE_MARGIN_M;
}

/** Copain à l'écran : screenBehindEdge ≤ gap ≤ screenAheadEdge (ruling R7-16). */
export function onScreen(gap: number, vGalahad: number, cfg: Config): boolean {
  return gap >= screenBehindEdge(vGalahad, cfg) && gap <= screenAheadEdge(vGalahad, cfg);
}

/**
 * Facteur appliqué au copain (plafond et couple) : min(RUBBER_MAX, rubber × turbo) (spec §7 : turbo plafonné à 1,3 au
 * total, R7-1) ; hors écran devant Galahad (gap > screenAheadEdge), au plus 1 : il garde les flammes sans gagner de
 * vitesse (spec §7, R7-16). La marche de ce plafond tombe au bord de la vue, jamais à l'écran.
 */
export function finalFactor(rubber: number, turbo: number, gap: number, vGalahad: number, cfg: Config): number {
  const f = Math.min(cfg.RUBBER_MAX, rubber * turbo);
  return gap > screenAheadEdge(vGalahad, cfg) ? Math.min(f, 1) : f;
}

/**
 * Un pas de l'élastique d'un copain (règles 1 à 4 de la tâche 7, dans cet ordre) : (1) cible 1 tant que
 * t < RUBBER_NEUTRAL_SECONDS (spec §6), sinon `targetFactor(gap, base)` ; (2) plancher `zoneFloor` ; (3) rampe depuis
 * `prev` ; (4) clamp de zone : dans [xLancement, xLava] (`inVolcanoZone`), au moins 1, immédiat et stocké (ruling R7-5 :
 * en sortant, la baisse part de 1 à 0,15/s). `x` : x du châssis du copain, `gap` : x(copain) − x(Galahad), au début du pas.
 */
export function stepRubber(prev: number, t: number, gap: number, base: number, x: number, track: Track, cfg: Config): number {
  const target = Math.max(t < cfg.RUBBER_NEUTRAL_SECONDS ? 1 : targetFactor(gap, base, cfg), zoneFloor(track, x, cfg));
  const r = rampFactor(prev, target, cfg.PHYSICS_DT, cfg);
  return inVolcanoZone(track, x) ? Math.max(r, 1) : r;
}
