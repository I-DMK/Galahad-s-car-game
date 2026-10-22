import type { Config } from '../config';
import { jumpRange } from './ballistics';
import type { SliceType } from './types';

type Rng = () => number;

export interface SliceProfile {
  type: SliceType;
  /** Hauteurs (m) tous les TRACK_POINT_SPACING, premier point exclu (il coïncide avec la fin de la tranche précédente). */
  heights: number[];
  /** Longueur de la tranche (m) = heights.length × TRACK_POINT_SPACING. */
  length: number;
  /** Indices (0-based dans `heights`) dont le segment d'arrivée peut dépasser MAX_SLOPE. */
  exemptIndices: number[];
  /** Rampe-volcan et fosse uniquement ; tous les dx* sont mesurés depuis le début de la tranche. */
  volcano?: VolcanoProfile;
}

/** Champs communs d'un volcan de tranche (ruling R-F1), depuis le début de la tranche. */
interface VolcanoProfileBase {
  dxLancement: number; dxLava: number; lavaWidth: number; rimY: number; dxReception: number; dxEnd: number;
}
/** Volcan d'une tranche : tremplin (`rampe-volcan`) ou fosse (`fosse`, tâche 5g). */
export type VolcanoProfile =
  | (VolcanoProfileBase & { kind: 'tremplin'; dxElanStart: number; dxRampStart: number; dxLip: number; lipY: number })
  | (VolcanoProfileBase & { kind: 'fosse'; dxBord: number });

const EPS = 1e-9;

/** Échantillonne `fn` en x = k × espacement (k = 1..n), n = round(length / espacement) ; dernier point forcé à 0. */
function sample(cfg: Config, length: number, fn: (x: number) => number): { heights: number[]; length: number } {
  const s = cfg.TRACK_POINT_SPACING;
  const n = Math.max(1, Math.round(length / s));
  const heights: number[] = [];
  for (let k = 1; k <= n; k++) heights.push(fn(k * s));
  heights[n - 1] = 0;
  return { heights, length: n * s };
}

/** Demi-sinus de hauteur `h` sur `len` mètres à partir de `x0` (0 hors de [x0, x0 + len]). */
const halfSine = (x: number, x0: number, len: number, h: number): number =>
  x > x0 && x < x0 + len ? h * Math.sin((Math.PI * (x - x0)) / len) : 0;

export function plat(rng: Rng, cfg: Config, length?: number): SliceProfile {
  const len = length ?? 20 + rng() * 20;
  const { heights, length: l } = sample(cfg, len, () => 0);
  return { type: 'plat', heights, length: l, exemptIndices: [] };
}

/**
 * Plat étoile (tâche 5e, saut §6.6) : plat de STAR_FLAT_LENGTH (57 m), sans tirage. Son étoile haute (à
 * STAR_HIGH_BUMP_CLEARANCE + STAR_HIGH_TAKEOFF_ROOM de son début) est posée par `placeStars`.
 */
export function platEtoile(cfg: Config): SliceProfile {
  const { heights, length } = sample(cfg, cfg.STAR_FLAT_LENGTH, () => 0);
  return { type: 'plat-étoile', heights, length, exemptIndices: [] };
}

export function bosses(rng: Rng, cfg: Config): SliceProfile {
  const s = cfg.TRACK_POINT_SPACING;
  const L = Math.round((30 + rng() * 30) / s) * s;
  const lam1 = 8 + rng() * 6;
  const lam2 = 8 + rng() * 6;
  const k = Math.tan(cfg.MAX_SLOPE) / (5 * Math.PI);
  const a1 = rng() * lam1 * k;
  const a2 = rng() * lam2 * k;
  const { heights, length } = sample(cfg, L, (x) => {
    const env = Math.sin((Math.PI * x) / L) ** 2;
    return (a1 * Math.sin((2 * Math.PI * x) / lam1) + a2 * Math.sin((2 * Math.PI * x) / lam2)) * env;
  });
  return { type: 'bosses', heights, length, exemptIndices: [] };
}

export function rampeSaut(_rng: Rng, cfg: Config): SliceProfile {
  const s = cfg.TRACK_POINT_SPACING;
  const tanR = Math.tan(cfg.RAMP_ANGLE);
  const rampRun = cfg.RAMP_LENGTH * Math.cos(cfg.RAMP_ANGLE);
  const BREAK = 0.4;
  const tanD = Math.tan((10 * Math.PI) / 180);
  // Le premier échantillon au-delà du sommet porte la cassure : exactement BREAK sous l'échantillon précédent.
  const kBreak = Math.floor(rampRun / s + EPS) + 1;
  const xBreak = kBreak * s;
  const afterY = (kBreak - 1) * s * tanR - BREAK;
  const descentRun = afterY / tanD;
  const total = xBreak + descentRun + 8;
  const fn = (x: number): number =>
    x < xBreak ? x * tanR : Math.max(0, afterY - tanD * (x - xBreak));
  const { heights, length } = sample(cfg, total, fn);
  return { type: 'rampe-saut', heights, length, exemptIndices: [kBreak - 1] };
}

export function doubleBosse(_rng: Rng, cfg: Config): SliceProfile {
  const H = 0.9, W = 6, GAP = 4, TAIL = 6;
  const { heights, length } = sample(cfg, W + GAP + W + TAIL, (x) =>
    halfSine(x, 0, W, H) + halfSine(x, W + GAP, W, H));
  return { type: 'double-bosse', heights, length, exemptIndices: [] };
}

export interface VolcanoGeometry {
  /** Plat de lancement (m) = LANCEMENT_LENGTH. */
  lLancement: number;
  /** Plat d'élan (m) = L_ELAN. */
  lElan: number;
  rampRun: number;
  lipY: number;
  descentRun: number;
  ascentRun: number;
  valleyRun: number;
  /** Centre de la lave, mesuré depuis le sommet de la rampe (lip). */
  dxLava: number;
  /** Début du plat de réception (pied de la descente aval), depuis le début de la tranche. */
  dxReception: number;
  /** Fin de la tranche, depuis le début de la tranche. */
  dxEnd: number;
}

export function volcanoGeometry(cfg: Config): VolcanoGeometry {
  const rampRun = cfg.RAMP_LENGTH * Math.cos(cfg.RAMP_ANGLE);
  const lipY = cfg.RAMP_LENGTH * Math.sin(cfg.RAMP_ANGLE);
  const tanM = Math.tan(cfg.MAX_SLOPE);
  const lLancement = cfg.LANCEMENT_LENGTH;
  const lElan = cfg.L_ELAN;
  const descentRun = lipY / tanM;
  const ascentRun = cfg.RIM_HEIGHT / tanM;
  const dxLava =
    cfg.LAVA_MARGIN * jumpRange(cfg.V_JUMP, cfg.GRAVITY, cfg.RAMP_ANGLE, lipY - cfg.RIM_HEIGHT);
  const valleyRun = dxLava - (descentRun + ascentRun + cfg.LAVA_WIDTH / 2);
  const dxLip = lLancement + lElan + rampRun;
  const dxReception = dxLip + dxLava + cfg.LAVA_WIDTH / 2 + cfg.RIM_HEIGHT / tanM;
  const turboRange = jumpRange(cfg.V_MAX * cfg.TURBO_FACTOR, cfg.GRAVITY, cfg.RAMP_ANGLE, lipY);
  const dxEnd = Math.max(dxReception + 10, dxLip + 1.2 * turboRange);
  return { lLancement, lElan, rampRun, lipY, descentRun, ascentRun, valleyRun, dxLava, dxReception, dxEnd };
}

/**
 * Rampe-volcan. Le pied de la rampe est un congé concave de rayon RAMP_FOOT_RADIUS (tâche 5c) : arc
 * tangent au plat d'élan en xFoot0 = dxRampStart − R tan(θ/2) et à la rampe en xFoot0 + R sin θ
 * (θ = RAMP_ANGLE), au lieu du pli 0° → θ qui faisait décoller la voiture dès le pied. La rampe
 * rectiligne au-delà, le sommet (dxLip, lipY) et tout l'aval ne changent pas ; R = 0 redonne le pli.
 */
export function rampeVolcan(cfg: Config): SliceProfile {
  const g = volcanoGeometry(cfg);
  if (g.valleyRun < 0) {
    throw new Error(
      `rampe-volcan impossible : la lave est trop proche de la rampe (valleyRun = ${g.valleyRun.toFixed(2)} m < 0)`,
    );
  }
  const s = cfg.TRACK_POINT_SPACING;
  const tanR = Math.tan(cfg.RAMP_ANGLE);
  const tanM = Math.tan(cfg.MAX_SLOPE);
  const dxRampStart = g.lLancement + g.lElan;              // pied nominal de la rampe rectiligne ; le congé relève le plat d'élan dès xFoot0 (≈ 1,94 m avant)
  const dxLip = dxRampStart + g.rampRun;
  const R = cfg.RAMP_FOOT_RADIUS;
  const xFoot0 = dxRampStart - R * Math.tan(cfg.RAMP_ANGLE / 2);   // tangence avec le plat d'élan
  const xFoot1 = xFoot0 + R * Math.sin(cfg.RAMP_ANGLE);            // tangence avec la rampe
  if (xFoot0 < g.lLancement || xFoot1 >= dxLip) {
    throw new Error(
      `rampe-volcan impossible : le congé du pied (R = ${R} m) déborde du plat d'élan ou atteint le sommet `
      + `([${(xFoot0 - dxRampStart).toFixed(2)} ; ${(xFoot1 - dxRampStart).toFixed(2)}] m autour du pied)`,
    );
  }
  const xAscent = dxLip + g.descentRun + g.valleyRun;       // début de la montée
  const xRimA = xAscent + g.ascentRun;                      // bord amont du cratère
  const xRimB = xRimA + cfg.LAVA_WIDTH;                     // bord aval du cratère
  const floorY = cfg.RIM_HEIGHT - cfg.CRATER_DEPTH;
  // Parois verticales : un seul pas d'échantillon chacune (indices k = numéro d'échantillon, 1-based).
  const kWallA = Math.floor(xRimA / s + EPS) + 1;           // premier échantillon au-delà du bord amont
  const kWallB = Math.ceil(xRimB / s - EPS);                // premier échantillon au bord aval ou au-delà
  const { heights, length } = sample(cfg, g.dxEnd, (x) => {
    const k = Math.round(x / s);
    if (k >= kWallA && k < kWallB) return floorY;
    if (x > xFoot0 && x < xFoot1) return R - Math.sqrt(R * R - (x - xFoot0) ** 2);
    if (x <= dxRampStart) return 0;
    if (x <= dxLip) return (x - dxRampStart) * tanR;
    if (x <= xAscent) return Math.max(0, g.lipY - tanM * (x - dxLip));
    if (x <= xRimA) return Math.min(cfg.RIM_HEIGHT, tanM * (x - xAscent));
    // Descente aval de RIM_HEIGHT à 0 (pied en dxReception), puis plat de réception : aucune butée.
    return Math.max(0, cfg.RIM_HEIGHT - tanM * (x - xRimB));
  });
  return {
    type: 'rampe-volcan',
    heights,
    length,
    exemptIndices: [kWallA - 1, kWallB - 1],
    volcano: {
      kind: 'tremplin',
      dxLancement: 0,
      dxElanStart: g.lLancement,
      dxRampStart,
      dxLip,
      lipY: g.lipY,
      dxLava: dxLip + g.dxLava,
      lavaWidth: cfg.LAVA_WIDTH,
      rimY: cfg.RIM_HEIGHT,
      dxReception: g.dxReception,
      dxEnd: length,
    },
  };
}

/** Géométrie d'une fosse (tâche 5g, saut §6.2), en m depuis le début de la tranche ; bords sur la maille. */
export interface FosseGeometry {
  /** Plat de garde (FOSSE_GUARD) : de 0 au début de l'approche (xLancement). */
  guard: number;
  /** Plat d'approche, de xLancement au bord amont : LANCEMENT_LENGTH arrondi à la maille supérieure. */
  approach: number;
  /** Largeur de lave (FOSSE_WIDTH à la maille). */
  width: number;
  /** Plat de réception, du bord aval à la fin de la tranche. */
  reception: number;
  /** Longueur de la tranche = celle de la rampe-volcan (ruling R-F2). */
  length: number;
}

/** m : réception minimale d'une fosse (saut §6.2) : atterrissage en turbo ≈ 32 m, plus `xEnd − 10` et une marge. */
const FOSSE_MIN_RECEPTION = 60;

/** Indices de maille (k × TRACK_POINT_SPACING) du début de l'approche, du bord amont, du bord aval et de la fin. */
function fosseGrid(cfg: Config): { kLancement: number; kBord: number; kAval: number; n: number } {
  const s = cfg.TRACK_POINT_SPACING;
  // Même nombre d'échantillons que `rampeVolcan` (`sample` sur dxEnd), sans recalculer son profil.
  const n = Math.max(1, Math.round(volcanoGeometry(cfg).dxEnd / s));
  const kLancement = Math.ceil(cfg.FOSSE_GUARD / s - EPS);
  const kBord = kLancement + Math.ceil(cfg.LANCEMENT_LENGTH / s - EPS);
  const kAval = kBord + Math.round(cfg.FOSSE_WIDTH / s);
  return { kLancement, kBord, kAval, n };
}

/**
 * Géométrie d'une fosse : garde, approche, lave, réception ; longueur de la rampe-volcan (le terrain ne change que par
 * le type, ruling R-F2), bords sur la maille. Lance si la réception fait moins de 60 m ou si la lave est vide.
 */
export function fosseGeometry(cfg: Config): FosseGeometry {
  const s = cfg.TRACK_POINT_SPACING;
  const { kLancement, kBord, kAval, n } = fosseGrid(cfg);
  const g: FosseGeometry = {
    guard: kLancement * s, approach: (kBord - kLancement) * s, width: (kAval - kBord) * s,
    reception: (n - kAval) * s, length: n * s,
  };
  if (!(g.width > 0) || g.reception < FOSSE_MIN_RECEPTION - EPS) {
    throw new Error(
      `fosse impossible : lave de ${g.width.toFixed(2)} m, réception de ${g.reception.toFixed(2)} m (au moins ${FOSSE_MIN_RECEPTION} m exigés)`,
    );
  }
  return g;
}

/**
 * Fosse (tâche 5g, saut §6.2) : hauteur 0 partout (garde, approche, réception : rebords au ras du sol, ni lèvre ni
 * pente, pour qu'une voiture qui roule ne décolle jamais du bord), sauf ]xBord, xBord + W[ à −CRATER_DEPTH ; deux
 * parois verticales d'un pas, exemptées du test de pente. Pas de tirage.
 */
export function fosse(cfg: Config): SliceProfile {
  const g = fosseGeometry(cfg);
  const s = cfg.TRACK_POINT_SPACING;
  const { kBord, kAval } = fosseGrid(cfg);
  const { heights, length } = sample(cfg, g.length, (x) => {
    const k = Math.round(x / s);
    return k > kBord && k < kAval ? -cfg.CRATER_DEPTH : 0;
  });
  const xBord = kBord * s;
  return {
    type: 'fosse',
    heights,
    length,
    // Paroi amont : segment qui arrive au premier échantillon au fond (k = kBord + 1) ; aval : segment qui arrive au bord aval (k = kAval).
    exemptIndices: [kBord, kAval - 1],
    volcano: {
      kind: 'fosse',
      dxLancement: g.guard,
      dxBord: xBord,
      dxLava: xBord + g.width / 2,
      lavaWidth: g.width,
      rimY: 0,
      dxReception: kAval * s,
      dxEnd: length,
    },
  };
}
