import type { Config } from '../config';
import { heightAt } from './query';
import type { Fosse, Star, Track, Volcano } from './types';

const STAR_HEIGHT = 0.6;

/**
 * Zones admissibles (addendum §1.5, plan B tâche 2), intervalles fermés de longueur > 0, dans l'ordre de la piste :
 * chaque `plat` hors plat de départ (indice 0), le plat d'arrivée tronqué à `xFinish − FINISH_PLAT_BEFORE` inclus,
 * chaque plat de lancement d'un tremplin `[xLancement, xElanStart − STAR_ELAN_GAP]`, chaque plat de réception d'un
 * tremplin après la zone d'atterrissage `[xReception + STAR_TREMPLIN_LANDING, xEnd]` (tâche 5g, demande du papa : une
 * étoile au début d'une réception était survolée doigt posé). Fosse (tâche 5g, saut §6.5, ruling R-F6) : sa réception
 * seule (ni garde, ni approche, ni lave), après la zone d'atterrissage (`STAR_FOSSE_LANDING`), moins ± STAR_ELAN_GAP
 * autour de l'étoile de réception (`receptionStarX`), qu'elle soit tirée ou non.
 * Une étoile exactement sur une borne est de mesure nulle et reste sur du plat. Aucune zone de longueur nulle :
 * elle ne recevrait jamais le curseur.
 */
function admissibleZones(track: Track, cfg: Config): [number, number][] {
  const limit = track.xFinish - cfg.FINISH_PLAT_BEFORE;
  const zones: [number, number][] = [];
  track.slices.forEach((sl, i) => {
    if (sl.type === 'plat' && i > 0) zones.push([sl.xStart, Math.min(sl.xEnd, limit)]);
  });
  for (const v of track.volcanoes) {
    if (v.kind === 'tremplin') {
      zones.push([v.xLancement, v.xElanStart - cfg.STAR_ELAN_GAP]);
      zones.push([v.xReception + cfg.STAR_TREMPLIN_LANDING, v.xEnd]);
    } else {
      const xr = receptionStarX(v, cfg);
      const start = v.xReception + cfg.STAR_FOSSE_LANDING;
      zones.push([start, xr - cfg.STAR_ELAN_GAP], [Math.max(start, xr + cfg.STAR_ELAN_GAP), v.xEnd]);
    }
  }
  return zones.filter(([a, b]) => b - a > 0).sort((p, q) => p[0] - q[0]);
}

/** Étoile d'élan d'un tremplin (xElanStart − STAR_ELAN_OFFSET) ou étoile de réception d'une fosse (tâche 5g). */
export function volcanoStarX(v: Volcano, cfg: Config): number {
  return v.kind === 'tremplin' ? v.xElanStart - cfg.STAR_ELAN_OFFSET : receptionStarX(v, cfg);
}

/** Étoile de réception d'une fosse (tâche 5g, saut §6.5) : bord aval + FOSSE_STAR_AFTER. */
export const receptionStarX = (f: Fosse, cfg: Config): number => f.xReception + cfg.FOSSE_STAR_AFTER;

/**
 * Place les étoiles (déterministe, un seul `rng`) :
 * 1. curseur global : la distance ne s'accumule que sur les zones admissibles ; à chaque pas tiré dans
 *    [STAR_STEP_MIN, STAR_STEP_MAX], une étoile est posée dès que la distance cumulée atteint le pas ;
 * 2. étoile d'élan : un volcan sur deux (tirage), à `xElanStart − STAR_ELAN_OFFSET` ; pour une fosse (tâche 5g), étoile
 *    de réception à `xReception + FOSSE_STAR_AFTER` à la place (`volcanoStarX`), même tirage ;
 * 3. plancher : tant qu'il y a moins de STAR_MIN_COUNT étoiles, une étoile d'élan (ou de réception) est ajoutée au
 *    premier volcan (ordre de la piste) qui n'en a pas ; plus de volcan → on laisse ;
 * 4. étoiles basses, `y = heightAt + 0,6` ;
 * 5. étoiles hautes ajoutées (tâche 5e, `chooseHighStars`), tirages après tous les autres : `y = heightAt +
 *    STAR_HIGH_Y`, `high: true` ; puis tri par x de toutes les étoiles, ids 0, 1, 2… Avec STAR_HIGH_PER_RACE = 0,
 *    aucun tirage de plus : les étoiles sont celles d'avant la tâche 5e (x, y, ids), `high: false`.
 * Invariant : aucune étoile dans [xElanStart, xLava] d'un tremplin, ni dans une fosse avant sa réception (garde,
 * approche, lave), ni sur le plat de départ, ni après xFinish − FINISH_PLAT_BEFORE.
 */
export function placeStars(track: Track, rng: () => number, cfg: Config): Star[] {
  if (!(cfg.STAR_STEP_MIN > 0) || !(cfg.STAR_STEP_MAX >= cfg.STAR_STEP_MIN)) {
    throw new Error(`placeStars : pas invalide [${cfg.STAR_STEP_MIN}, ${cfg.STAR_STEP_MAX}] (STAR_STEP_MIN > 0 et STAR_STEP_MAX ≥ STAR_STEP_MIN exigés)`);
  }
  if (!Number.isInteger(cfg.STAR_HIGH_PER_RACE) || cfg.STAR_HIGH_PER_RACE < 0) {
    throw new Error(`placeStars : STAR_HIGH_PER_RACE ${cfg.STAR_HIGH_PER_RACE} doit être un entier ≥ 0`);
  }
  if (!(cfg.STAR_TREMPLIN_LANDING >= 0) || !(cfg.STAR_FOSSE_LANDING >= 0) || !(cfg.FOSSE_STAR_AFTER >= cfg.STAR_FOSSE_LANDING)) {
    throw new Error(`placeStars : dégagements d'atterrissage invalides (STAR_TREMPLIN_LANDING ${cfg.STAR_TREMPLIN_LANDING}, STAR_FOSSE_LANDING ${cfg.STAR_FOSSE_LANDING} ≥ 0, et FOSSE_STAR_AFTER ${cfg.FOSSE_STAR_AFTER} ≥ STAR_FOSSE_LANDING : l'étoile de réception d'une fosse doit être au-delà de l'atterrissage)`);
  }
  if (!(cfg.STAR_ELAN_OFFSET > 0) || !(cfg.STAR_ELAN_GAP > cfg.STAR_ELAN_OFFSET)) {
    throw new Error(`placeStars : STAR_ELAN_GAP ${cfg.STAR_ELAN_GAP} doit dépasser STAR_ELAN_OFFSET ${cfg.STAR_ELAN_OFFSET} > 0 (sinon l'étoile d'élan tombe sur l'élan — à 0 exactement sur xElanStart — ou colle une étoile du curseur)`);
  }
  // Le pas calculé est contrôlé à chaque tirage : un rng hors [0, 1) ou NaN donnerait un pas ≤ 0 et une boucle sans fin.
  const step = (): number => {
    const s = cfg.STAR_STEP_MIN + rng() * (cfg.STAR_STEP_MAX - cfg.STAR_STEP_MIN);
    if (!(s > 0)) throw new Error(`placeStars : pas calculé invalide ${s} (rng hors [0, 1) ?)`);
    return s;
  };
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
  let n = xs.length + hasElan.filter(Boolean).length;
  for (let i = 0; i < hasElan.length && n < cfg.STAR_MIN_COUNT; i++) {
    if (!hasElan[i]) { hasElan[i] = true; n++; }
  }
  track.volcanoes.forEach((v, i) => {
    if (hasElan[i]) xs.push(volcanoStarX(v, cfg));
  });

  // 4. Étoiles basses ; 5. étoiles hautes (tirages après tous les autres) ; tri, ids.
  xs.sort((p, q) => p - q);
  const high = chooseHighStars(track, xs, rng, cfg);
  return [...xs.map((x) => ({ x, high: false })), ...high.map((x) => ({ x, high: true }))]
    .sort((p, q) => p.x - q.x)
    .map(({ x, high: h }, id) => ({ id, x, y: heightAt(track, x) + (h ? cfg.STAR_HIGH_Y : STAR_HEIGHT), high: h }));
}

/**
 * Étoile haute d'un plat étoile (tâche 5e, saut §6.6) : à STAR_HIGH_BUMP_CLEARANCE (dégagement d'entrée) +
 * STAR_HIGH_TAKEOFF_ROOM (élan) de son début, soit 32 m ; il reste STAR_HIGH_LANDING_ROOM (25 m) d'atterrissage.
 */
export const starFlatStarX = (sl: { xStart: number }, cfg: Config): number =>
  sl.xStart + cfg.STAR_HIGH_BUMP_CLEARANCE + cfg.STAR_HIGH_TAKEOFF_ROOM;

/**
 * Étoiles hautes d'une piste (x), au plus STAR_HIGH_PER_RACE (0 : aucune, et aucun tirage) :
 * 1. d'abord celle de chaque plat étoile (ruling R-F8), dans l'ordre de la piste, sans tirage ;
 * 2. s'il reste de la place, les candidates des plats ordinaires (`highStarCandidates`), chacune à au moins
 *    STAR_HIGH_TAKEOFF_ROOM + STAR_HIGH_LANDING_ROOM (élan + atterrissage) de toute étoile haute déjà retenue
 *    (plat étoile ou candidate) : dans l'ordre de la piste si elles sont au plus `place`, sinon tirées sans remise
 *    par `rng` (Fisher-Yates partiel), une candidate trop proche d'une étoile déjà retenue étant écartée.
 * Résultat dans l'ordre de la piste.
 */
export function chooseHighStars(track: Track, lowXs: readonly number[], rng: () => number, cfg: Config): number[] {
  const n = cfg.STAR_HIGH_PER_RACE;
  if (n <= 0) return [];
  const flats = track.slices.filter((sl) => sl.type === 'plat-étoile').map((sl) => starFlatStarX(sl, cfg)).slice(0, n);
  const room = n - flats.length;
  if (room <= 0) return flats;
  const away = cfg.STAR_HIGH_TAKEOFF_ROOM + cfg.STAR_HIGH_LANDING_ROOM;
  const cands = highStarCandidates(track, lowXs, cfg);
  const chosen = [...flats];
  const draw = cands.length > room;
  for (let i = 0; i < cands.length && chosen.length < n; i++) {
    if (draw) {
      const j = i + Math.floor(rng() * (cands.length - i));
      [cands[i], cands[j]] = [cands[j], cands[i]];
    }
    if (chosen.every((x) => Math.abs(cands[i] - x) >= away - 1e-9)) chosen.push(cands[i]);
  }
  return chosen.sort((p, q) => p - q);
}

// ——— Étoiles hautes (plan B, tâche 5e ; addendum « bouton saut » §2, amendé [plan], décision P1 du papa) ———

type Interval = [number, number];

/** Retire de chaque intervalle les zones `cuts` (intervalles quelconques) ; garde les morceaux de longueur > 0. */
function subtract(intervals: Interval[], cuts: Interval[]): Interval[] {
  let out = intervals;
  for (const [c0, c1] of cuts) {
    const next: Interval[] = [];
    for (const [a, b] of out) {
      if (c1 <= a || c0 >= b) { next.push([a, b]); continue; }
      if (c0 > a) next.push([a, c0]);
      if (c1 < b) next.push([c1, b]);
    }
    out = next;
  }
  return out.filter(([a, b]) => b - a > 0);
}

/**
 * Dégagements interdits aux étoiles hautes (et à leur élan et atterrissage) : STAR_HIGH_RAMP_CLEARANCE après la
 * fin de chaque rampe-saut, STAR_HIGH_BUMP_CLEARANCE après la fin de chaque bosses, double-bosse ou cratère. Une
 * voiture qui vole doigt posé après ces tranches ne doit jamais toucher une étoile haute.
 */
export function highStarClearances(track: Track, cfg: Config): Interval[] {
  const out: Interval[] = [];
  for (const sl of track.slices) {
    if (sl.type === 'rampe-saut') out.push([sl.xEnd, sl.xEnd + cfg.STAR_HIGH_RAMP_CLEARANCE]);
    else if (sl.type === 'bosses' || sl.type === 'double-bosse' || sl.type === 'cratère') out.push([sl.xEnd, sl.xEnd + cfg.STAR_HIGH_BUMP_CLEARANCE]);
  }
  return out;
}

/**
 * Terrain permis pour l'élan et l'atterrissage d'un saut vers une étoile haute : la piste à partir de xStart +
 * D_LANCE, jusqu'à xWall, sauf les tranches rampe-saut, rampe-volcan et fosse (plats de lancement, de garde,
 * d'approche et de réception compris ; tâche 5g, saut §6.5) et les dégagements. Un plat étoile est du terrain permis (mais pas un segment éligible, `highStarSegments`). Zone de départ exclue (ruling de la tâche 5e) : l'élan commence là où une voiture partie
 * arrêtée de la grille a atteint V_MAX (D_LANCE), comme pour la fenêtre calibrée à 11,2 et 14 m/s ; sans elle,
 * une étoile haute pouvait se trouver 10 m devant la pole (graine 7, x = 29,7 m).
 */
export function highStarTerrain(track: Track, cfg: Config): Interval[] {
  const forbidden: Interval[] = track.slices
    .filter((sl) => sl.type === 'rampe-saut' || sl.type === 'rampe-volcan' || sl.type === 'fosse')
    .map((sl): Interval => [sl.xStart, sl.xEnd]);
  return subtract([[track.xStart + cfg.D_LANCE, track.xWall]], [...forbidden, ...highStarClearances(track, cfg)]);
}

/**
 * Segments éligibles (où une étoile haute peut se trouver) : tranches `plat` hors plat de départ (indice 0), hors
 * plat d'arrivée (et d'après l'arrivée) et hors plat juste après un volcan, tremplin ou fosse (décision du papa, comme les plats étoile :
 * à la sortie d'une réception, les voitures se cognent), les plats voisins fusionnés, moins les dégagements.
 */
export function highStarSegments(track: Track, cfg: Config): Interval[] {
  const merged: Interval[] = [];
  track.slices.forEach((sl, i) => {
    if (sl.type !== 'plat' || i === 0 || sl.xEnd > track.xFinish - 1e-9) return;
    if (track.slices[i - 1].type === 'rampe-volcan' || track.slices[i - 1].type === 'fosse') return;
    const last = merged[merged.length - 1];
    if (last && Math.abs(last[1] - sl.xStart) < 1e-9) last[1] = sl.xEnd;
    else merged.push([sl.xStart, sl.xEnd]);
  });
  return subtract(merged, highStarClearances(track, cfg));
}

/**
 * Candidates d'étoiles hautes, une au plus par segment éligible, dans l'ordre de la piste. Intervalle admissible
 * d'un segment : ses x tels que [x − STAR_HIGH_TAKEOFF_ROOM, x + STAR_HIGH_LANDING_ROOM] soit du terrain permis
 * (`highStarTerrain`). Candidate : son centre ; s'il est à moins de STAR_HIGH_GAP d'une étoile basse (`lowXs`),
 * le point admissible le plus proche du centre qui en est à STAR_HIGH_GAP au moins ; sinon aucune.
 */
export function highStarCandidates(track: Track, lowXs: readonly number[], cfg: Config): number[] {
  const terrain = highStarTerrain(track, cfg);
  const out: number[] = [];
  for (const [a, b] of highStarSegments(track, cfg)) {
    const room = terrain.find(([p0, p1]) => p0 <= a + 1e-9 && b <= p1 + 1e-9);
    if (!room) continue;
    const lo = Math.max(a, room[0] + cfg.STAR_HIGH_TAKEOFF_ROOM);
    const hi = Math.min(b, room[1] - cfg.STAR_HIGH_LANDING_ROOM);
    if (!(hi >= lo)) continue;
    const centre = (lo + hi) / 2;
    const free = subtract([[lo, hi]], lowXs.map((x): Interval => [x - cfg.STAR_HIGH_GAP, x + cfg.STAR_HIGH_GAP]));
    const nearOk = lowXs.every((x) => Math.abs(x - centre) >= cfg.STAR_HIGH_GAP);
    if (nearOk) { out.push(centre); continue; }
    // Point admissible le plus proche du centre (bords des morceaux libres ; un morceau de longueur nulle n'existe pas).
    let best: number | null = null;
    for (const [f0, f1] of free) {
      const p = Math.min(f1, Math.max(f0, centre));
      if (best === null || Math.abs(p - centre) < Math.abs(best - centre)) best = p;
    }
    if (best !== null) out.push(best);
  }
  return out;
}

