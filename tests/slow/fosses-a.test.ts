// Budget : < 20 min mur (≈ 2 500 runs à ≈ 0,24 s, puis le mutant FOSSE_GUARD 0 sur les graines 0 à 9 et le témoin
// vivant ; ≈ 14,5 min MESURÉ (relecture) pour 3 400 runs). Contrainte (a) des fosses (plan B, tâche 5g, Step 6 ;
// addendum « bouton saut » §6.2 (a), ruling R-F4) : sans sauter, on tombe toujours, même en arrivant en l'air après des
// bosses ou une double-bosse prises en turbo. Chaque fosse des graines 0 à 19 : Galahad lancé à V_MAX 100 m avant la
// tranche précédente, doigt posé, sans saut, turbo de 3 s pris tous les 2 m de 80 m avant cette tranche jusqu'à
// xLancement : 100 % de lave. Mutant FOSSE_GUARD 0 (graines 0 à 9) mesuré et imprimé. Témoin vivant : sur les pistes
// k = 6 et k = 14 de la recette (saut §6.2 (a)), sans garde et à W = 6, le même balayage retrouve au moins un survol ;
// sinon le balayage ne prouve rien.
import { CONFIG, type Config } from '../../src/config';
import { createWorld } from '../../src/physics/world';
import { generateTrack } from '../../src/track/generate';
import { fosses } from '../../src/track/query';
import { mulberry32 } from '../../src/track/rng';
import { bosses, doubleBosse, type SliceProfile } from '../../src/track/slices';
import type { Fosse, Track } from '../../src/track/types';
import { fossePiste, fosseRun } from '../helpers/fosses';
import { croppedWorld } from '../helpers/phases';
import { trackFor } from '../helpers/runs';

const LAUNCH_BEFORE = 100;
const TURBO_FROM = 80;
const TURBO_STEP = 2;

/** Runs, survols (ni lave ni autre réapparition), autres réapparitions avant la fosse (imprimées), tranches précédentes. */
interface Sweep { runs: number; overflights: string[]; others: string[]; previous: Record<string, number> }

/** Tranche qui précède la fosse (la garde fait partie de la tranche fosse). */
const previousSlice = (track: Track, f: Fosse) => {
  const i = track.slices.findIndex((s) => s.type === 'fosse' && Math.abs(s.xEnd - f.xEnd) < 1e-9);
  return track.slices[i - 1];
};

/** Balayage d'une fosse : lancée à V_MAX en `x0`, turbo tous les 2 m de [tFrom, tTo], sans saut. */
function sweep(track: Track, f: Fosse, x0: number, tFrom: number, tTo: number, label: string, out: Sweep, cfg: Config = CONFIG): void {
  const world = croppedWorld(track, cfg, x0 - 10, f.xEnd + 20);
  for (let t = tFrom; t <= tTo + 1e-9; t += TURBO_STEP) {
    const r = fosseRun(world, { x0, v: CONFIG.V_MAX, pressAtStep: null, turboAtX: t, fosse: f, stopAtX: f.xReception + 5, maxSeconds: 25 });
    out.runs++;
    const what = `${label}, turbo en ${t.toFixed(1)}`;
    if (r.respawn) out.others.push(`${what} : autre réapparition (x max ${r.xMax.toFixed(1)})`);
    else if (!r.lava) out.overflights.push(`${what} : survol (x max ${r.xMax.toFixed(1)})`);
  }
}

/** Départ 100 m avant la tranche précédente, hors de la zone d'un volcan précédent (décalé à sa réception). */
function startOf(track: Track, x: number): number {
  let x0 = Math.max(5, x);
  for (const v of track.volcanoes) if (x0 >= v.xLancement - (v.kind === 'fosse' ? CONFIG.FOSSE_GUARD : 0) && x0 < v.xReception) x0 = v.xReception + 5;
  return x0;
}

function sweepTracks(tracks: Track[], label: string): Sweep {
  const out: Sweep = { runs: 0, overflights: [], others: [], previous: {} };
  for (const track of tracks) {
    fosses(track).forEach((f, fi) => {
      const prev = previousSlice(track, f);
      out.previous[prev.type] = (out.previous[prev.type] ?? 0) + 1;
      const x0 = startOf(track, prev.xStart - LAUNCH_BEFORE);
      sweep(track, f, x0, Math.max(x0, prev.xStart - TURBO_FROM), f.xLancement, `${label} graine ${track.seed}, fosse ${fi} (après ${prev.type})`, out);
    });
  }
  return out;
}

test('(a) chaque fosse des graines 0 à 19, turbo pris tous les 2 m avant et sur la tranche précédente, sans saut : 100 % de lave', () => {
  const t0 = performance.now();
  const s = sweepTracks(Array.from({ length: 20 }, (_, seed) => trackFor(seed)), 'CONFIG');
  console.log(`(a) graines 0 à 19 : ${s.runs} runs, ${Object.entries(s.previous).map(([k, n]) => `${n} après ${k}`).join(', ')} ; `
    + `survols ${s.overflights.length}, autres réapparitions ${s.others.length} (${((performance.now() - t0) / 60_000).toFixed(1)} min)`
    + `${[...s.overflights, ...s.others].length ? `\n  ${[...s.overflights, ...s.others].join('\n  ')}` : ''}`);
  expect(s.runs).toBeGreaterThan(1500);
  expect(s.overflights).toEqual([]);
});

test('mutant FOSSE_GUARD 0 (graines 0 à 9) : survols mesurés et imprimés (consignés au registre)', () => {
  const t0 = performance.now();
  const cfg: Config = { ...CONFIG, FOSSE_GUARD: 0 };
  const s = sweepTracks(Array.from({ length: 10 }, (_, seed) => generateTrack(seed, 1680, cfg)), 'FOSSE_GUARD 0');
  console.log(`mutant FOSSE_GUARD 0, graines 0 à 9 : ${s.runs} runs, survols ${s.overflights.length} (${((performance.now() - t0) / 60_000).toFixed(1)} min)`
    + `${s.overflights.length ? `\n  ${s.overflights.join('\n  ')}` : ''}`);
  expect(s.runs).toBeGreaterThan(500);
});

test('témoin vivant (recette du saut §6.2 (a), sans garde, W = 6) : le balayage retrouve au moins un survol sur k = 6 ou k = 14', () => {
  const cfg: Config = { ...CONFIG, FOSSE_GUARD: 0, FOSSE_WIDTH: 6 };
  const found: string[] = [];
  let runs = 0;
  for (const k of [6, 14]) {
    const rng = mulberry32(500 + k);
    const before: SliceProfile[] = k <= 10 ? [bosses(rng, cfg)] : [bosses(rng, cfg), doubleBosse(rng, cfg)];
    const { track, f } = fossePiste({ cfg, before });
    const start = track.slices[1].xStart;
    const end = track.slices[before.length].xEnd;
    const world = createWorld(track, cfg);
    for (let t = -TURBO_FROM; start + t <= end + 1e-9; t += TURBO_STEP) {
      const r = fosseRun(world, { x0: start - LAUNCH_BEFORE, v: CONFIG.V_MAX, pressAtStep: null, turboAtX: start + t, fosse: f, stopAtX: f.xReception + 5, maxSeconds: 25 });
      runs++;
      if (!r.lava && !r.respawn) found.push(`k = ${k}, t = ${t} m`);
    }
  }
  console.log(`témoin vivant : ${runs} runs, survols ${found.length} (${found.join(' ; ')})`);
  expect(found.length).toBeGreaterThan(0);
});
