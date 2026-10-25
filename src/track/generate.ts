import type { Config } from '../config';
import { mulberry32, pickWeighted } from './rng';
import { placeRocks } from './rocks';
import { placeStars, starFlatStarX } from './stars';
import {
  bosses, doubleBosse, fosse, plat, platEtoile, rampeSaut, rampeVolcan, type SliceProfile, type VolcanoProfile,
} from './slices';
import type { Slice, SliceType, Track, TrackPoint, Volcano } from './types';

type Weights = { item: SliceType; weight: number }[];

/**
 * Poids de tirage des tranches ; celui des volcans est `VOLCANO_WEIGHT` (3 jusqu'à la 5g, 4 depuis le tour 2 de la 5g :
 * décision du papa, ≈ 3,6 volcans par course). Même ordre qu'avant : avec 3, les tirages sont ceux des pistes d'avant.
 */
function sliceWeights(cfg: Config): { all: Weights; noVolcano: Weights } {
  if (!Number.isFinite(cfg.VOLCANO_WEIGHT) || cfg.VOLCANO_WEIGHT < 0) {
    throw new Error(`generateTrack : VOLCANO_WEIGHT ${cfg.VOLCANO_WEIGHT} doit être un nombre ≥ 0`);
  }
  const all: Weights = [
    { item: 'plat', weight: 2 },
    { item: 'bosses', weight: 3 },
    { item: 'rampe-saut', weight: 2 },
    { item: 'double-bosse', weight: 2 },
    { item: 'rampe-volcan', weight: cfg.VOLCANO_WEIGHT },
  ];
  return { all, noVolcano: all.filter((w) => w.item !== 'rampe-volcan') };
}

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

/** Une tranche volcan, tremplin ou fosse (tâche 5g). */
const isVolcanoSlice = (type: SliceType): boolean => type === 'rampe-volcan' || type === 'fosse';

/**
 * Tire une tranche. `previous` est la dernière tranche TIRÉE (un plat étoile intercalé est ignoré, ruling R-F5) :
 * les refus des volcans ne dépendent pas des plats étoile, et la suite des tirages reste celle d'avant. Une fosse est
 * une rampe-volcan tirée puis typée par l'alternance (`buildTrack`) : un volcan ne suit jamais un autre volcan, quel
 * que soit son type (saut §6.3). `nextIsFosse` : le prochain volcan accepté serait une fosse (alternance).
 */
function draw(
  rng: () => number, cfg: Config, weights: { all: Weights; noVolcano: Weights }, x: number, target: number,
  previous: SliceType, onlyPlat: boolean, nextIsFosse: boolean,
): SliceProfile {
  if (onlyPlat) return plat(rng, cfg);
  let type = pickWeighted(rng, weights.all);
  if (type === 'rampe-volcan') {
    const profile = rampeVolcan(cfg);
    // Jamais après une rampe-saut : abordée avec un turbo, elle lançait la voiture à 19–21 m/s sur l'élan ou la
    // rampe (atterrissage à +32…+38 m de xLancement), rebond, lave (relecture adversariale de la tâche 1).
    // Pas de tremplin juste après une double-bosse (décision du papa, relectures de la 5g) : un turbo fini pendant le
    // vol de la double-bosse faisait tomber doigt posé ; une fosse y reste permise (sa garde absorbe le vol, R-F4).
    const refused = x < 0.15 * target || x + profile.length > 0.9 * target
      || isVolcanoSlice(previous) || previous === 'rampe-saut'
      || (previous === 'double-bosse' && !nextIsFosse && cfg.TREMPLIN_AFTER_DOUBLE_BOSSE === 0);
    if (!refused) return profile;
    type = pickWeighted(rng, weights.noVolcano);
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
 * coup reste inchangée par les ancres avancées ; mais la règle « rampe-saut → plat court » (`starFlatAllowed`) change
 * environ 48 % des pistes à 1 680 m depuis faba763 (95 sur 200, graines 0 à 199 ; 459 sur 1 000, graines 0 à 999),
 * dont les graines 0 à 2, à partir de 957 à 1 387 m (au-delà des 30 s de l'empreinte, inchangée).
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
    if (p.volcano) volcanoes.push(volcanoFromProfile(p.volcano, xStart));
  };

  // Fosses (tâche 5g, saut §6.3, ruling R-F3) : le volcan de rang r (tous les volcans, dans l'ordre de la piste) est une
  // fosse si (r + phase) mod FOSSE_PERIOD = FOSSE_PERIOD − 1. La phase est tirée une fois par piste sur un mulberry32 à
  // part, et seulement si FOSSE_PERIOD > 0 : le rng de la piste ne voit aucun tirage de plus (FOSSE_PERIOD 0 : pistes
  // d'avant au bit près).
  const period = cfg.FOSSE_PERIOD;
  if (!Number.isInteger(period) || period < 0) throw new Error(`generateTrack : FOSSE_PERIOD ${period} doit être un entier ≥ 0`);
  const phase = period > 0 ? Math.floor(mulberry32((seed ^ 0x6a09e667) >>> 0)() * period) : 0;
  let volcanoRank = 0;
  const weights = sliceWeights(cfg);
  /** Le prochain volcan accepté (rang `volcanoRank`) sera-t-il une fosse ? */
  const nextIsFosse = (): boolean => period > 0 && (volcanoRank + phase) % period === period - 1;
  /** Le volcan tiré (rampe-volcan) devient une fosse selon l'alternance ; même longueur (ruling R-F2). */
  const typed = (p: SliceProfile): SliceProfile => {
    if (p.type !== 'rampe-volcan') return p;
    const isFosse = nextIsFosse();
    volcanoRank++;
    if (!isFosse) return p;
    const f = fosse(cfg);
    if (Math.abs(f.length - p.length) > 1e-9) throw new Error(`generateTrack : fosse de ${f.length} m ≠ rampe-volcan de ${p.length} m`);
    return f;
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
    const drawnProfile = draw(rng, cfg, weights, xNow(), targetLength, lastDrawn, !!opts.onlyPlat, nextIsFosse());
    if (xNow() + drawnProfile.length > limit + 1e-9) break;
    const profile = typed(drawnProfile);
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
    seed, targetLength, length: xWall, points, exemptPointIndices, slices, volcanoes, stars: [], rocks: [],
    xStart: cfg.START_LENGTH - 5, xFinish, xWall,
  };
  track.stars = placeStars(track, rng, cfg);
  // Rochers (tâche 11c, spec « rochers » §3) : tirés après tous les autres tirages, terrain et étoiles inchangés.
  track.rocks = placeRocks(track, rng, cfg);
  return { track, flatsPlaced, flatsWanted: nFlats };
}

/** Volcan de la piste d'un profil de tranche (tremplin ou fosse) posé en `xStart` (dx* depuis le début de la tranche). */
export function volcanoFromProfile(v: VolcanoProfile, xStart: number): Volcano {
  const base = {
    xLancement: xStart + v.dxLancement, xLava: xStart + v.dxLava, lavaWidth: v.lavaWidth, rimY: v.rimY,
    xReception: xStart + v.dxReception, xEnd: xStart + v.dxEnd,
  };
  return v.kind === 'tremplin'
    ? {
      kind: 'tremplin', ...base, xElanStart: xStart + v.dxElanStart, xRampStart: xStart + v.dxRampStart,
      xLip: xStart + v.dxLip, lipY: v.lipY,
    }
    : { kind: 'fosse', ...base, xBord: xStart + v.dxBord };
}

/**
 * Un plat étoile peut-il commencer en `x` (tâche 5e, ruling R-F8) ? Jamais juste après une rampe-saut ni juste après
 * un volcan, tremplin ou fosse (décision du papa : à la sortie d'une réception, les voitures se rattrapent et se cognent ; un choc
 * arrière y a catapulté Galahad à 4,75 m au-dessus de l'étoile, graine 7), et jamais avec l'élan de son étoile
 * ([x★ − STAR_HIGH_TAKEOFF_ROOM, x★]) dans les STAR_HIGH_RAMP_CLEARANCE après la fin de la dernière rampe-saut
 * (rampe-saut puis plat court : la voiture qui en sort vole encore).
 */
function starFlatAllowed(x: number, lastDrawn: SliceType, lastRampSautEnd: number | null, cfg: Config): boolean {
  if (lastDrawn === 'rampe-saut' || isVolcanoSlice(lastDrawn)) return false;
  const takeoff = starFlatStarX({ xStart: x }, cfg) - cfg.STAR_HIGH_TAKEOFF_ROOM;
  return lastRampSautEnd === null || takeoff >= lastRampSautEnd + cfg.STAR_HIGH_RAMP_CLEARANCE - 1e-9;
}
