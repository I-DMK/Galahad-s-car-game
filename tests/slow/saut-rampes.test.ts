// Budget : < 15 min mur (attendu ≈ 4,6 min : ≈ 38 rampes-saut × 2 arrivées × 28 sauts, ≈ 0,13 s par saut).
// Sauts au sommet des rampes-saut avec la tolérance de sol (plan B, tâche 5e, Step 11 ; addendum « bouton saut »
// §6.2) : graines 0 à 4, lancée à V_MAX ou en turbo (21 m/s tenus) 45 m avant le pied, saut à chaque pas de
// [dernier contact de jeu − 6 pas, dernier contact + 0,35 s]. Angle au contact, retournements et atterrissage
// imprimés, sans assertion : un saut mal placé se paie (saut §0). Voir tests/helpers/sommets.ts.
import { CONFIG } from '../../src/config';
import { trackFor } from '../helpers/runs';
import { isLava, otherRespawn, RAMP_RUN, rampArrivals, sweepSummit, worldAround } from '../helpers/sommets';

const SEEDS = [0, 1, 2, 3, 4];
const DEG = 180 / Math.PI;

test('sauts au sommet des rampes-saut, tolérance de sol, graines 0 à 4 (mesure)', () => {
  const t0 = performance.now();
  const stats = new Map<string, { ramps: number; jumps: number; jumped: number; flipped: number; lava: number; other: number; maxAngle: number; maxLand: number }>();
  for (const seed of SEEDS) {
    const track = trackFor(seed);
    for (const ramp of track.slices.filter((s) => s.type === 'rampe-saut')) {
      const world = worldAround(track, ramp.xStart, ramp.xEnd, 60, 160);
      for (const a of rampArrivals(ramp)) {
        const s = sweepSummit(world, ramp.xStart + RAMP_RUN, a, 12);
        const st = stats.get(a.id) ?? { ramps: 0, jumps: 0, jumped: 0, flipped: 0, lava: 0, other: 0, maxAngle: 0, maxLand: 0 };
        st.ramps++;
        for (const { r } of s.runs) {
          st.jumps++;
          if (r.jumped) st.jumped++;
          if (r.flippedAfterJump) st.flipped++;
          if (isLava(r)) st.lava++;
          if (otherRespawn(r)) st.other++;
          if (Number.isFinite(r.landingAngle)) st.maxAngle = Math.max(st.maxAngle, Math.abs(r.landingAngle) * DEG);
          if (r.landingX !== null) st.maxLand = Math.max(st.maxLand, r.landingX - ramp.xEnd);
        }
        stats.set(a.id, st);
      }
    }
  }
  const lines = [...stats].map(([id, s]) => `${id} : ${s.ramps} rampes-saut, ${s.jumps} sauts (${s.jumped} partis), angle au contact ≤ ${s.maxAngle.toFixed(1)}°, `
    + `retournements ${s.flipped}, lave ${s.lava}, autres réapparitions ${s.other}, atterrissage jusqu'à ${s.maxLand.toFixed(1)} m après la tranche`);
  console.log(`sauts au sommet des rampes-saut, graines ${SEEDS.join(', ')} (${((performance.now() - t0) / 60_000).toFixed(1)} min, FLIP_ANGLE ${(CONFIG.FLIP_ANGLE * DEG).toFixed(0)}°) :\n${lines.join('\n')}`);
  expect([...stats.values()].every((s) => s.jumps > 0)).toBe(true);
});
