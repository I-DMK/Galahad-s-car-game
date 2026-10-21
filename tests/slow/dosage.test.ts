// Balayage de dosage (addendum §1.6, tâche 4) : pour L_ELAN de 3 à 16 m (cfg surchargé, pistes
// regénérées), part des volcans où le cas 1 (arrêt au début du plat d'élan) tombe et où le cas 2
// (pire point sûr) passe, graines 0 à 2 ; bissection du seuil de franchissement au sommet
// (LIP_SPEED_THRESHOLD) par plafonnement de la vitesse jusqu'au sommet. Tableau imprimé.
import { CONFIG, type Config } from '../../src/config';
import { expectPasses, scenariosFor } from '../helpers/cases';
import {
  DEG, LIP_SPEED_THRESHOLD, buildWorld, f2, runFrom, worldFor, type RunResult,
} from '../helpers/runs';
import type { Volcano } from '../../src/track/types';

const SEEDS = [0, 1, 2];
const L_ELANS = Array.from({ length: 14 }, (_, i) => 3 + i);

interface Row { lElan: number; volcanoes: number; falls: number; passes: number; minLipCase1: number; maxLipCase1: number; minLipCase2: number }

/** Conditions du cas 2 sans assertion (pour compter) ; la marge de 1 m/s n'entre pas dans le dosage. */
function passes(r: RunResult, v: Volcano): boolean {
  return !r.lava && r.landX !== null && r.landX >= v.xReception && Math.abs(r.landAngle) < 45 * DEG && !r.flipped && r.wheelsBelow;
}

const rows: Row[] = [];

describe('balayage de L_ELAN (graines 0 à 2)', () => {
  test.each(L_ELANS)('L_ELAN = %i m', (lElan) => {
    const cfg: Config = { ...CONFIG, L_ELAN: lElan };
    const row: Row = { lElan, volcanoes: 0, falls: 0, passes: 0, minLipCase1: Infinity, maxLipCase1: -Infinity, minLipCase2: Infinity };
    for (const seed of SEEDS) {
      const world = buildWorld(seed, cfg);
      for (const v of world.track.volcanoes) {
        row.volcanoes++;
        const [c1] = scenariosFor(1, world.track, v, cfg);
        const r1 = runFrom(world, c1.x0, c1.opts);
        if (r1.lava) row.falls++;
        if (r1.lipSpeed !== null) {
          row.minLipCase1 = Math.min(row.minLipCase1, r1.lipSpeed);
          row.maxLipCase1 = Math.max(row.maxLipCase1, r1.lipSpeed);
        }
        const [c2] = scenariosFor(2, world.track, v, cfg);
        const r2 = runFrom(world, c2.x0, c2.opts);
        if (passes(r2, v)) row.passes++;
        if (r2.lipSpeed !== null) row.minLipCase2 = Math.min(row.minLipCase2, r2.lipSpeed);
        if (lElan === CONFIG.L_ELAN) {
          expect(r1.lava, `cas 1, seed ${seed}, volcan ${v.xLancement.toFixed(1)}`).toBe(true);
          expectPasses(r2, v, `cas 2 (pire point sûr), seed ${seed}, volcan ${v.xLancement.toFixed(1)}`);
        }
      }
    }
    rows.push(row);
    expect(row.volcanoes).toBeGreaterThan(0);
    if (lElan === CONFIG.L_ELAN) {
      expect(row.falls, 'cas 1 à CONFIG.L_ELAN').toBe(row.volcanoes);
      expect(row.passes, 'cas 2 à CONFIG.L_ELAN').toBe(row.volcanoes);
    }
  });

  afterAll(() => {
    rows.sort((a, b) => a.lElan - b.lElan);
    const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(0).padStart(3)} %`;
    const lines = rows.map((r) =>
      `L_ELAN ${String(r.lElan).padStart(2)} m : cas 1 tombe ${pct(r.falls, r.volcanoes)} (${r.falls}/${r.volcanoes}, sommet ${f2(r.minLipCase1)}–${f2(r.maxLipCase1)} m/s) | `
      + `cas 2 passe ${pct(r.passes, r.volcanoes)} (${r.passes}/${r.volcanoes}, sommet min ${f2(r.minLipCase2)} m/s)${r.lElan === CONFIG.L_ELAN ? '  ← CONFIG' : ''}`);
    console.log(`tableau de dosage (graines ${SEEDS.join(', ')})\n${lines.join('\n')}`);
  });
});

describe('bissection du seuil de franchissement au sommet (LIP_SPEED_THRESHOLD)', () => {
  test(`sur le premier volcan des graines ${SEEDS.join(', ')} : la plus grande vitesse qui tombe est ≤ ${LIP_SPEED_THRESHOLD} m/s`, () => {
    let worstFall = -Infinity;
    let bestPass = Infinity;
    const lines: string[] = [];
    for (const seed of SEEDS) {
      const world = worldFor(seed);
      const v = world.track.volcanoes[0];
      if (!v) continue;
      // Vitesse horizontale plafonnée à `cap` jusqu'au sommet ; la vitesse mesurée au sommet (norme) est
      // un peu plus grande (composante verticale sur la rampe). Bissection sur `cap`, lecture de lipSpeed.
      const probe = (cap: number) => {
        const r = runFrom(world, v.xLancement, { throttle: () => true, speedCapUntil: { x: v.xLip, v: cap }, maxSeconds: 20 });
        return { cap, lip: r.lipSpeed ?? NaN, ok: passes(r, v) };
      };
      let lo = probe(7);
      let hi = probe(12);
      expect(lo.ok, `seed ${seed} : plafond 7 m/s devrait tomber (sommet ${f2(lo.lip)})`).toBe(false);
      expect(hi.ok, `seed ${seed} : plafond 12 m/s devrait passer (sommet ${f2(hi.lip)})`).toBe(true);
      for (let k = 0; k < 8; k++) {
        const mid = probe((lo.cap + hi.cap) / 2);
        if (mid.ok) hi = mid; else lo = mid;
      }
      lines.push(`seed ${seed}, volcan ${v.xLancement.toFixed(1)} : tombe à ${f2(lo.lip)} m/s (plafond ${f2(lo.cap)}), passe à ${f2(hi.lip)} m/s (plafond ${f2(hi.cap)})`);
      worstFall = Math.max(worstFall, lo.lip);
      bestPass = Math.min(bestPass, hi.lip);
    }
    console.log(`bissection du seuil (LAVA_MARGIN ${CONFIG.LAVA_MARGIN}, capteur +${CONFIG.LAVA_SENSOR_ABOVE_RIM} m)\n${lines.join('\n')}\n`
      + `→ seuil entre ${f2(worstFall)} (lave) et ${f2(bestPass)} (passe) ; LIP_SPEED_THRESHOLD = ${LIP_SPEED_THRESHOLD}`);
    expect(worstFall).toBeLessThanOrEqual(LIP_SPEED_THRESHOLD);
    expect(bestPass).toBeGreaterThan(worstFall);
  });
});
