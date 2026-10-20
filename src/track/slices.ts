import type { Config } from '../config';
import { jumpRange, runUpDistance } from './ballistics';
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
  /** Rampe-volcan uniquement ; tous les dx* sont mesurés depuis le début de la tranche. */
  volcano?: {
    dxRampStart: number; dxLip: number; lipY: number;
    dxLava: number; lavaWidth: number; rimY: number;
    dxReception: number; dxEnd: number;
  };
}

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

/**
 * Emprise de la butée. Un demi-sinus de hauteur h sur L mètres a une pente max h·π/L : 0,3 m sur 1 m
 * donnerait 43° (> MAX_SLOPE). STOP_BUMP_LENGTH est donc la longueur de chaque flanc : la butée
 * s'étale sur 2 × STOP_BUMP_LENGTH, ce qui donne la pente max ≈ 25° annoncée (spec §5).
 */
const stopBumpSpan = (cfg: Config): number => 2 * cfg.STOP_BUMP_LENGTH;

export function plat(rng: Rng, cfg: Config, length?: number): SliceProfile {
  const len = length ?? 20 + rng() * 20;
  const { heights, length: l } = sample(cfg, len, () => 0);
  return { type: 'plat', heights, length: l, exemptIndices: [] };
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
  /** Plat d'élan (m). */
  lElan: number;
  rampRun: number;
  lipY: number;
  descentRun: number;
  ascentRun: number;
  valleyRun: number;
  /** Centre de la lave, mesuré depuis le sommet de la rampe (lip). */
  dxLava: number;
  /** Début du plat de réception (après la butée), depuis le début de la tranche. */
  dxReception: number;
  /** Fin de la tranche, depuis le début de la tranche. */
  dxEnd: number;
}

export function volcanoGeometry(cfg: Config): VolcanoGeometry {
  const rampRun = cfg.RAMP_LENGTH * Math.cos(cfg.RAMP_ANGLE);
  const lipY = cfg.RAMP_LENGTH * Math.sin(cfg.RAMP_ANGLE);
  const tanM = Math.tan(cfg.MAX_SLOPE);
  const vBottom = Math.sqrt(cfg.V_JUMP ** 2 + 2 * cfg.GRAVITY * lipY);
  const lElan = (runUpDistance(vBottom, cfg.DRIVE_ACCEL) * cfg.ELAN_MARGIN) / cfg.ELAN_SAFE_FRACTION;
  const descentRun = lipY / tanM;
  const ascentRun = cfg.RIM_HEIGHT / tanM;
  const dxLava =
    cfg.LAVA_MARGIN * jumpRange(cfg.V_JUMP, cfg.GRAVITY, cfg.RAMP_ANGLE, lipY - cfg.RIM_HEIGHT);
  const valleyRun = dxLava - (descentRun + ascentRun + cfg.LAVA_WIDTH / 2);
  const dxLip = lElan + rampRun;
  const dxReception =
    dxLip + dxLava + cfg.LAVA_WIDTH / 2 + cfg.RIM_HEIGHT / tanM + stopBumpSpan(cfg);
  const turboRange = jumpRange(cfg.V_MAX * cfg.TURBO_FACTOR, cfg.GRAVITY, cfg.RAMP_ANGLE, lipY);
  const dxEnd = Math.max(dxReception + 10, dxLip + 1.2 * turboRange);
  return { lElan, rampRun, lipY, descentRun, ascentRun, valleyRun, dxLava, dxReception, dxEnd };
}

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
  const dxLip = g.lElan + g.rampRun;
  const xAscent = dxLip + g.descentRun + g.valleyRun;       // début de la montée
  const xRimA = xAscent + g.ascentRun;                      // bord amont du cratère
  const xRimB = xRimA + cfg.LAVA_WIDTH;                     // bord aval du cratère
  const xBump = xRimB + cfg.RIM_HEIGHT / tanM;              // pied de la descente aval = début de la butée
  const floorY = cfg.RIM_HEIGHT - cfg.CRATER_DEPTH;
  // Parois verticales : un seul pas d'échantillon chacune (indices k = numéro d'échantillon, 1-based).
  const kWallA = Math.floor(xRimA / s + EPS) + 1;           // premier échantillon au-delà du bord amont
  const kWallB = Math.ceil(xRimB / s - EPS);                // premier échantillon au bord aval ou au-delà
  const { heights, length } = sample(cfg, g.dxEnd, (x) => {
    const k = Math.round(x / s);
    if (k >= kWallA && k < kWallB) return floorY;
    if (x <= g.lElan) return 0;
    if (x <= dxLip) return (x - g.lElan) * tanR;
    if (x <= xAscent) return Math.max(0, g.lipY - tanM * (x - dxLip));
    if (x <= xRimA) return Math.min(cfg.RIM_HEIGHT, tanM * (x - xAscent));
    if (x <= xBump) return Math.max(0, cfg.RIM_HEIGHT - tanM * (x - xRimB));
    return halfSine(x, xBump, stopBumpSpan(cfg), cfg.STOP_BUMP_HEIGHT);
  });
  return {
    type: 'rampe-volcan',
    heights,
    length,
    exemptIndices: [kWallA - 1, kWallB - 1],
    volcano: {
      dxRampStart: g.lElan,
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
