// Calibration des étoiles hautes (plan B, tâche 5e, Step 8) : jeux candidats (dégagements, élan, atterrissage),
// hauteurs candidates, placement statique recalculé pour chaque jeu, garde hors ligne sur des courses
// enregistrées une fois (`recordRace`, sans étoile haute : STAR_HIGH_PER_RACE 0), sorties JSON pour le Step 9.
// Tâche 5e, Step 10 : tout se joue sur les pistes d'avant (`withAnciennesPistes`), celles de la calibration (4a414c6).
import { CONFIG, type Config } from '../../src/config';
import { withAnciennesPistes } from './anciennes-pistes';
import { generateTrack } from '../../src/track/generate';
import { heightAt } from '../../src/track/query';
import { highStarCandidates } from '../../src/track/stars';
import type { Track } from '../../src/track/types';
import { poseClearance, RECORD_TRACK_LENGTH, SENSOR_MARGIN, type RecordedRace } from './recorded';

/** Hauteurs candidates (m au-dessus du sol local, centre de l'étoile) : 3,60 à 4,05 au pas de 5 cm. */
export const HEIGHTS = Array.from({ length: 10 }, (_, i) => Math.round((3.6 + 0.05 * i) * 100) / 100);

export interface Jeu { ramp: number; bump: number; takeoff: number; landing: number }
export const RAMPS = [50, 60, 70, 80];
export const BUMPS = [8, 12, 16];
export const TAKEOFFS = [10, 15, 20];
export const LANDINGS = [10, 15, 20, 25];
/** 144 jeux : dégagement après rampe-saut × après bosses × élan × atterrissage. */
export const JEUX: Jeu[] = RAMPS.flatMap((ramp) => BUMPS.flatMap((bump) => TAKEOFFS.flatMap((takeoff) =>
  LANDINGS.map((landing) => ({ ramp, bump, takeoff, landing })))));
/** Jeu de départ du plan (valeurs provisoires de 4a414c6), figé : les tableaux de la calibration restent comparables. */
export const DEFAULT_JEU: Jeu = { ramp: 70, bump: 12, takeoff: 15, landing: 15 };
export const jeuKey = (j: Jeu): string => `${j.ramp}/${j.bump}/${j.takeoff}/${j.landing}`;

/** Configuration d'un jeu (hauteur `y` en option), sur les pistes d'avant, avec au plus 3 étoiles hautes. */
export function cfgFor(j: Jeu, y: number = CONFIG.STAR_HIGH_Y): Config {
  return {
    ...withAnciennesPistes(CONFIG), STAR_HIGH_PER_RACE: 3, STAR_HIGH_RAMP_CLEARANCE: j.ramp, STAR_HIGH_BUMP_CLEARANCE: j.bump,
    STAR_HIGH_TAKEOFF_ROOM: j.takeoff, STAR_HIGH_LANDING_ROOM: j.landing, STAR_HIGH_Y: y,
    // Dérivée, comme dans config.ts : `generateTrack` refuse une longueur de plat étoile incohérente (relectures de la
    // 5e) ; sans plat étoile sur les pistes d'avant, elle ne change rien d'autre.
    STAR_FLAT_LENGTH: j.bump + j.takeoff + j.landing,
  };
}

/** Configuration des courses enregistrées : pistes d'avant, sans étoile haute (étoiles basses identiques, voir tests/high-stars.test.ts). */
export const RECORD_CFG: Config = withAnciennesPistes(CONFIG);

/** x des étoiles hautes placées par le jeu (tirage compris, STAR_HIGH_PER_RACE de CONFIG) sur la piste de la graine. */
export function highXs(seed: number, j: Jeu): number[] {
  return generateTrack(seed, RECORD_TRACK_LENGTH, cfgFor(j)).stars.filter((s) => s.high).map((s) => s.x);
}

/** Candidates (avant tirage) du jeu sur `track` (étoiles basses de la piste). */
export function candidatesOf(track: Track, j: Jeu): number[] {
  return highStarCandidates(track, track.stars.filter((s) => !s.high).map((s) => s.x), cfgFor(j));
}

/**
 * Non-vacuité (tâche 5e, Step 10) : chaque jeu a au moins une candidate sur les graines `seeds` ; sinon les tableaux
 * de la calibration se videraient sans faire échouer le test (par exemple si les pistes d'avant changeaient).
 */
export function expectNonVacuous(seeds: readonly number[]): void {
  const tracks = seeds.map((seed) => generateTrack(seed, RECORD_TRACK_LENGTH, RECORD_CFG));
  for (const j of JEUX) {
    const n = tracks.reduce((a, t) => a + candidatesOf(t, j).length, 0);
    expect(n, `jeu ${jeuKey(j)} : aucune candidate sur les graines ${seeds[0]} à ${seeds[seeds.length - 1]}`).toBeGreaterThan(0);
  }
}

/** Union (dédoublonnée au µm) des candidates de tous les jeux, triée. */
export function candidateUnion(track: Track): number[] {
  const set = new Map<string, number>();
  for (const j of JEUX) for (const x of candidatesOf(track, j)) set.set(x.toFixed(6), x);
  return [...set.values()].sort((a, b) => a - b);
}

/**
 * Garde hors ligne d'une étoile en x sur une course enregistrée : pour chaque hauteur de `heights`, plus petite
 * distance (m) entre le bord du capteur (rayon 0,5) et une pièce d'une voiture (châssis rectangle, roues disques),
 * et la voiture qui l'atteint. Une garde ≤ SENSOR_MARGIN est une prise sans saut.
 */
export function clearanceProfile(
  rec: RecordedRace, x: number, heights: readonly number[] = HEIGHTS,
): { min: number[]; car: number[] } {
  const ground = heightAt(rec.track, x);
  const min = heights.map(() => Infinity);
  const car = heights.map(() => -1);
  rec.xs.forEach((xsCar, k) => {
    for (let i = 0; i < xsCar.length; i++) {
      if (Math.abs(xsCar[i] - x) > 3) continue;
      const pose = rec.poses[i][k];
      heights.forEach((h, n) => {
        const d = poseClearance(pose, { x, y: ground + h }, CONFIG);
        if (d < min[n]) { min[n] = d; car[n] = k; }
      });
    }
  });
  return { min, car };
}

export const isTaken = (clearance: number): boolean => clearance <= SENSOR_MARGIN;

interface NodeFs { mkdirSync(p: string, o: { recursive: boolean }): void; writeFileSync(p: string, d: string): void }
const fs = (): NodeFs => (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): NodeFs } })
  .process.getBuiltinModule('node:fs');

/** Écrit `data` en JSON dans tests/slow/out/<name>.json (dossier ignoré par git). */
export function writeOut(name: string, data: unknown): void {
  fs().mkdirSync('tests/slow/out', { recursive: true });
  fs().writeFileSync(`tests/slow/out/${name}.json`, JSON.stringify(data, null, 1));
}

export const f2 = (n: number): string => (Number.isFinite(n) ? n.toFixed(2) : '—');
export const f3 = (n: number): string => (Number.isFinite(n) ? n.toFixed(3) : '—');

export interface VolsSeed {
  seed: number;
  /** Garde par x d'étoile haute (clé x.toFixed(6)) : par hauteur, garde minimale (m) et index de la voiture. */
  profiles: Record<string, { x: number; min: number[]; car: number[] }>;
  /** Par jeu (`jeuKey`) : clés des étoiles hautes placées (tirage compris). */
  jeux: Record<string, string[]>;
  /** Arrivée de chaque voiture (s), réapparitions et chutes dans la lave de la course enregistrée. */
  finishedAt: (number | null)[];
  respawns: number[];
  lava: number[];
}

/**
 * (c) Vols : pour chaque graine, une course enregistrée à 5 voitures (Galahad doigt posé, copains au driver de
 * la course), sans étoile haute ni saut ; puis, pour chacun des 144 jeux, placement statique recalculé et garde
 * hors ligne de chaque étoile haute placée, à chaque hauteur.
 */
export function volsForSeeds(seeds: readonly number[], recordRaceFn: (seed: number) => RecordedRace): VolsSeed[] {
  return seeds.map((seed) => {
    const rec = recordRaceFn(seed);
    const profiles: VolsSeed['profiles'] = {};
    const jeux: VolsSeed['jeux'] = {};
    for (const j of JEUX) {
      const keys = highXs(seed, j).map((x) => {
        const key = x.toFixed(6);
        if (!profiles[key]) profiles[key] = { x, ...clearanceProfile(rec, x) };
        return key;
      });
      jeux[jeuKey(j)] = keys;
    }
    return { seed, profiles, jeux, finishedAt: rec.finishedAt, respawns: rec.respawns, lava: rec.lava };
  });
}

/** Résumé imprimable des vols d'un lot de graines, pour le jeu de départ et à chaque hauteur. */
export function describeVols(rows: VolsSeed[]): string {
  const key = jeuKey(DEFAULT_JEU);
  return HEIGHTS.map((h, n) => {
    let min = Infinity;
    let taken = 0;
    let stars = 0;
    for (const r of rows) {
      for (const k of r.jeux[key]) {
        stars++;
        const d = r.profiles[k].min[n];
        min = Math.min(min, d);
        if (isTaken(d)) taken++;
      }
    }
    const allJeux = rows.flatMap((r) => Object.values(r.profiles).map((p) => p.min[n]));
    return `${h.toFixed(2)} m : jeu de départ ${stars} étoiles, garde min ${f3(min)} m, prises ${taken} ; `
      + `toutes positions (144 jeux) garde min ${f3(Math.min(...allJeux))} m, prises ${allJeux.filter(isTaken).length}/${allJeux.length}`;
  }).join('\n');
}
