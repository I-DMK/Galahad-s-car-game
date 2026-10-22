import type { Config } from '../config';
import { mulberry32, pickWeighted } from './rng';
import { placeStars, starFlatStarX } from './stars';
import { bosses, doubleBosse, plat, platEtoile, rampeSaut, rampeVolcan, type SliceProfile } from './slices';
import type { Slice, SliceType, Track, TrackPoint, Volcano } from './types';

const WEIGHTS: { item: SliceType; weight: number }[] = [
  { item: 'plat', weight: 2 },
  { item: 'bosses', weight: 3 },
  { item: 'rampe-saut', weight: 2 },
  { item: 'double-bosse', weight: 2 },
  { item: 'rampe-volcan', weight: 3 },
];
const WEIGHTS_NO_VOLCANO = WEIGHTS.filter((w) => w.item !== 'rampe-volcan');

/** Distance de croisière d'une course : V_CRUISE × RACE_TARGET_SECONDS. */
export function defaultTrackLength(cfg: Config): number {
  return cfg.V_CRUISE * cfg.RACE_TARGET_SECONDS;
}

export interface TrackOptions { seed: number; length: number; debug: boolean }

/** Lit `?seed=&len=&debug=` (`search` = location.search, avec ou sans `?`). */
export function parseTrackOptions(search: string, cfg: Config): TrackOptions {
  const q = new URLSearchParams(search);
  const rawSeed = q.get('seed');
  const seedNum = rawSeed === null || rawSeed.trim() === '' ? NaN : Math.trunc(Number(rawSeed));
  const seed = Number.isFinite(seedNum) && seedNum >= 0 ? seedNum : 1;
  const rawLen = q.get('len');
  const lenNum = rawLen === null || rawLen.trim() === '' ? NaN : Number(rawLen);
  const length = Number.isNaN(lenNum)
    ? defaultTrackLength(cfg)
    : Math.min(cfg.TRACK_MAX_LENGTH, Math.max(cfg.TRACK_MIN_LENGTH, lenNum));
  return { seed, length, debug: q.get('debug') === '1' };
}

/**
 * Tire une tranche. `previous` est la dernière tranche TIRÉE (un plat étoile intercalé est ignoré, ruling R-F5) :
 * les refus des volcans ne dépendent pas des plats étoile, et la suite des tirages reste celle d'avant.
 */
function draw(
  rng: () => number, cfg: Config, x: number, target: number, previous: SliceType, onlyPlat: boolean,
): SliceProfile {
  if (onlyPlat) return plat(rng, cfg);
  let type = pickWeighted(rng, WEIGHTS);
  if (type === 'rampe-volcan') {
    const profile = rampeVolcan(cfg);
    // Jamais après une rampe-saut : abordée avec un turbo, elle lançait la voiture à 19–21 m/s sur l'élan ou la
    // rampe (atterrissage à +32…+38 m de xLancement), rebond, lave (relecture adversariale de la tâche 1).
    const refused = x < 0.15 * target || x + profile.length > 0.9 * target
      || previous === 'rampe-volcan' || previous === 'rampe-saut';
    if (!refused) return profile;
    type = pickWeighted(rng, WEIGHTS_NO_VOLCANO);
  }
  switch (type) {
    case 'plat': return plat(rng, cfg);
    case 'bosses': return bosses(rng, cfg);
    case 'rampe-saut': return rampeSaut(rng, cfg);
    case 'double-bosse': return doubleBosse(rng, cfg);
    default: throw new Error(`type de tranche inattendu : ${type}`);
  }
}

/** Essais de pose des plats étoile (`generateTrack`) : jeu des ancres de 0, puis 1, 2… STAR_FLAT_LENGTH. */
const STAR_FLAT_ATTEMPTS = 12;

/**
 * Piste de `targetLength` m pour la graine `seed`. Plats étoile (tâche 5e, saut §6.6, ruling R-F8) : si la pose
 * régulière n'en met pas autant que prévu (fin de piste atteinte avant le dernier, graine 128), la piste est
 * refaite depuis la même graine avec du jeu sur les ancres (`slack`), qui les rapproche du départ ; la première
 * pose qui les met tous est gardée (graines 0 à 999 : 3 plats étoile à 1 680 m, testé). Une piste posée du premier
 * coup est inchangée.
 */
export function generateTrack(
  seed: number, targetLength: number, cfg: Config, opts: { onlyPlat?: boolean } = {},
): Track {
  const flatLength = cfg.STAR_HIGH_BUMP_CLEARANCE + cfg.STAR_HIGH_TAKEOFF_ROOM + cfg.STAR_HIGH_LANDING_ROOM;
  if (Math.abs(cfg.STAR_FLAT_LENGTH - flatLength) > 1e-9) {
    throw new Error(`generateTrack : STAR_FLAT_LENGTH ${cfg.STAR_FLAT_LENGTH} ≠ STAR_HIGH_BUMP_CLEARANCE + STAR_HIGH_TAKEOFF_ROOM + STAR_HIGH_LANDING_ROOM = ${flatLength} (configuration incohérente)`);
  }
  let built = buildTrack(seed, targetLength, cfg, opts, 0);
  for (let k = 1; k < STAR_FLAT_ATTEMPTS && built.flatsPlaced < built.flatsWanted; k++) {
    built = buildTrack(seed, targetLength, cfg, opts, k * cfg.STAR_FLAT_LENGTH);
  }
  return built.track;
}

function buildTrack(
  seed: number, targetLength: number, cfg: Config, opts: { onlyPlat?: boolean }, slack: number,
): { track: Track; flatsPlaced: number; flatsWanted: number } {
  const rng = mulberry32(seed);
  const s = cfg.TRACK_POINT_SPACING;
  const points: TrackPoint[] = [{ x: 0, y: 0 }];
  const slices: Slice[] = [];
  const volcanoes: Volcano[] = [];
  const exemptPointIndices: number[] = [];
  /** x = indice × espacement : pas de dérive cumulée. */
  const xNow = (): number => (points.length - 1) * s;

  const append = (p: SliceProfile): void => {
    const first = points.length;
    const xStart = xNow();
    for (let k = 0; k < p.heights.length; k++) points.push({ x: (first + k) * s, y: p.heights[k] });
    for (const e of p.exemptIndices) exemptPointIndices.push(first + e);
    slices.push({ type: p.type, xStart, xEnd: xNow() });
    if (p.volcano) {
      const v = p.volcano;
      volcanoes.push({
        xLancement: xStart, xElanStart: xStart + v.dxElanStart, xRampStart: xStart + v.dxRampStart,
        xLip: xStart + v.dxLip, lipY: v.lipY,
        xLava: xStart + v.dxLava, lavaWidth: v.lavaWidth, rimY: v.rimY,
        xReception: xStart + v.dxReception, xEnd: xStart + v.dxEnd,
      });
    }
  };

  append(plat(rng, cfg, cfg.START_LENGTH));
  const limit = targetLength - cfg.FINISH_PLAT_BEFORE - cfg.AFTER_FINISH;
  // Plats étoile (tâche 5e, saut §6.6, ruling R-F8) : N ancres régulières entre la fin du plat de départ et la limite
  // moins `slack` ; avant chaque tirage, si x a passé l'ancre suivante et si le plat étoile est permis ici
  // (`starFlatAllowed`) et tient avant la limite, il est posé (sans tirage). S'il ne tient plus, les suivants sont
  // abandonnés (`generateTrack` refait alors la piste avec plus de jeu).
  const x0 = xNow();
  const nFlats = opts.onlyPlat ? 0 : Math.max(0, Math.min(cfg.STAR_FLATS_PER_RACE, Math.floor((limit - x0) / cfg.STAR_FLAT_SPACING)));
  const span = Math.max(0, limit - slack - x0);
  const anchors = Array.from({ length: nFlats }, (_, k) => x0 + ((k + 0.5) * span) / nFlats);
  let nextFlat = 0;
  let flatsPlaced = 0;
  let lastDrawn: SliceType = slices[slices.length - 1].type;
  let lastRampSautEnd: number | null = null;
  for (;;) {
    if (nextFlat < anchors.length && xNow() >= anchors[nextFlat] - 1e-9 && starFlatAllowed(xNow(), lastDrawn, lastRampSautEnd, cfg)) {
      const flat = platEtoile(cfg);
      if (xNow() + flat.length <= limit + 1e-9) {
        append(flat);
        nextFlat++;
        flatsPlaced++;
        continue;
      }
      nextFlat = anchors.length;
    }
    const profile = draw(rng, cfg, xNow(), targetLength, lastDrawn, !!opts.onlyPlat);
    if (xNow() + profile.length > limit + 1e-9) break;
    append(profile);
    lastDrawn = profile.type;
    if (profile.type === 'rampe-saut') lastRampSautEnd = xNow();
  }

  const finalLength = targetLength - cfg.AFTER_FINISH - xNow();
  if (finalLength < cfg.FINISH_PLAT_BEFORE - 1e-9) {
    throw new Error(`plat d'arrivée trop court : ${finalLength.toFixed(2)} m < ${cfg.FINISH_PLAT_BEFORE} m`);
  }
  append(plat(rng, cfg, finalLength));
  const xFinish = xNow();
  append(plat(rng, cfg, cfg.AFTER_FINISH));
  const xWall = xNow();

  const track: Track = {
    seed, targetLength, length: xWall, points, exemptPointIndices, slices, volcanoes, stars: [],
    xStart: cfg.START_LENGTH - 5, xFinish, xWall,
  };
  track.stars = placeStars(track, rng, cfg);
  return { track, flatsPlaced, flatsWanted: nFlats };
}

/**
 * Un plat étoile peut-il commencer en `x` (tâche 5e, ruling R-F8) ? Jamais juste après une rampe-saut ni juste après
 * un volcan (décision du papa : à la sortie d'une réception, les voitures se rattrapent et se cognent ; un choc
 * arrière y a catapulté Galahad à 4,75 m au-dessus de l'étoile, graine 7), et jamais avec l'élan de son étoile
 * ([x★ − STAR_HIGH_TAKEOFF_ROOM, x★]) dans les STAR_HIGH_RAMP_CLEARANCE après la fin de la dernière rampe-saut
 * (rampe-saut puis plat court : la voiture qui en sort vole encore).
 */
function starFlatAllowed(x: number, lastDrawn: SliceType, lastRampSautEnd: number | null, cfg: Config): boolean {
  if (lastDrawn === 'rampe-saut' || lastDrawn === 'rampe-volcan') return false;
  const takeoff = starFlatStarX({ xStart: x }, cfg) - cfg.STAR_HIGH_TAKEOFF_ROOM;
  return lastRampSautEnd === null || takeoff >= lastRampSautEnd + cfg.STAR_HIGH_RAMP_CLEARANCE - 1e-9;
}
