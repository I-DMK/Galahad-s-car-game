// Rochers sur les vraies pistes et recette du survol (plan C, tâche 11c, Step 25 ; spec « rochers » §6) : Galahad seul,
// doigt posé sans saut, graines 5 à 9 (0 à 4 en CI, tests/rochers.test.ts) : chaque rocher touché, aucune réapparition
// dans les 3 s ; puis rocher posé à exactement ROCK_RAMP_CLEARANCE après une rampe-saut, et à 12 m après une double-bosse,
// Galahad lancé à 21 m/s tenus (5 phases de départ) : touché ou passé derrière, jamais une réapparition.
import { CONFIG } from '../../src/config';
import { createWorld } from '../../src/physics/world';
import { mulberry32 } from '../../src/track/rng';
import { doubleBosse, plat, rampeSaut, type SliceProfile } from '../../src/track/slices';
import type { Track } from '../../src/track/types';
import { trackOf } from '../helpers/fosses';
import { realTrackRun, rockRun } from '../helpers/rochers';
import { f1, f2 } from '../helpers/runs';

test.each([5, 6, 7, 8, 9])('graine %i : chaque rocher donne exactement un « rock » de Galahad ; aucune réapparition dans les 3 s après ; arrivée avant 240 s', (seed) => {
  const r = realTrackRun(seed);
  console.log(`graine ${seed} : ${r.rocks} rochers, chocs ${r.hits.join(', ')}, arrivée ${r.finishedAt?.toFixed(1)} s${r.missed.length ? `, SURVOLS ${r.missed.join(' ; ')}` : ''}`);
  expect(r.missed).toEqual([]);
  expect([...r.hits].sort((a, b) => a - b)).toEqual(Array.from({ length: r.rocks }, (_, k) => k));
  expect(r.rockRespawns).toEqual([]);
  expect(r.finishedAt!).toBeLessThan(240);
});

/** Piste plate avec la tranche `slice` en 150 m, et un rocher `after` m après sa fin. */
function recipe(slice: SliceProfile, after: number): { track: Track; xs: number; slStart: number } {
  const rng = mulberry32(1);
  const base = trackOf([plat(rng, CONFIG, 150), slice, plat(rng, CONFIG, 150)]);
  const sl = base.slices[1];
  const xStart = sl.xEnd + after;
  return { track: { ...base, rocks: [{ id: 0, xStart, xEnd: xStart + CONFIG.ROCK_WIDTH }] }, xs: xStart, slStart: sl.xStart };
}

test.each([
  ['rampe-saut, rocher à ROCK_RAMP_CLEARANCE', () => recipe(rampeSaut(mulberry32(2), CONFIG), CONFIG.ROCK_RAMP_CLEARANCE)],
  ['double-bosse, rocher à 12 m', () => recipe(doubleBosse(mulberry32(2), CONFIG), 12)],
] as const)('recette du survol, %s, lancée à 21 m/s (5 phases) : touché ou passé derrière, jamais une réapparition', (label, make) => {
  const { track, slStart } = make();
  const world = createWorld(track, CONFIG);
  const rock = track.rocks[0];
  const rows: string[] = [];
  for (let k = 0; k < 5; k++) {
    const x0 = slStart - 40 - 0.7 * k;
    const r = rockRun(world, rock, { x0, v: 21, pressAtStep: null, maxSeconds: 10 });
    rows.push(`x0 ${f1(x0)} : ${r.hit ? `touché à ${f2(r.hitSpeed)} m/s, châssis à ${f2(r.hitHeight)} m` : r.xMax >= rock.xEnd + CONFIG.CAR_LENGTH ? 'passé derrière (survol)' : 'ni l’un ni l’autre'}`);
    expect(r.respawn, `${label}, x0 = ${x0}`).toBe(false);
    expect(r.hit || r.xMax >= rock.xEnd + CONFIG.CAR_LENGTH, `${label}, x0 = ${x0}`).toBe(true);
  }
  console.log(`${label} : ${rows.join(' ; ')}`);
});
