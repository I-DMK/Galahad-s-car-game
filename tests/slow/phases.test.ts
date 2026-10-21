// Échantillonnage des phases de suspension au saut des volcans (tâche 5c du plan B, phase 1). Suite
// lente (npm run test:slow) ; protocole, candidats et mesures dans tests/helpers/phases.ts.
// Par défaut : la configuration actuelle (référence) sur les volcans des graines 0 à 9 : échantillonnage
// des phases, cas 1 à 5, turbo et (i) de la tâche 4, tableau (b), rampes-saut ; tableaux imprimés.
// Assertion (vraie aujourd'hui) : le protocole retrouve au moins une chute propre, doigt posé depuis
// xLancement au plus tard, à plus de FAST_FALL_LIP_SPEED (10,5 m/s) au sommet. Les correctifs ne sont
// pas assertés : ils sont mesurés et imprimés (choix du papa).
// Variables d'environnement (mesure des candidats, en parallèle sur plusieurs processus) :
//  - PHASES_VARIANTS : ids des candidats séparés par des virgules (reference, arete, marge,
//    amortissement, pied ; défaut reference) ;
//  - PHASES_SEEDS : graines (défaut 0 à 9) ; PHASES_SIZES : « perWindow,motifs,turbos » par volcan ;
//  - PHASES_PARTS : parties jouées parmi samples, cases, releases, ramps, races (défaut : toutes sauf
//    races ; races = cas 6 graines 0 à 4 et cas 7 graines 0 à 9, monde complet, ≈ 15 s par course) ;
//  - PHASES_OUT : dossier où écrire chaque morceau (JSON) ; PHASES_MERGE : dossier dont les morceaux
//    sont fusionnés et imprimés par candidat (aucune simulation).
// Mesures de la phase 1 (2 924 runs par configuration, 43 volcans, rapport de la tâche 5c) : référence
// 4 chutes propres (10,94 à 11,31 m/s au sommet, direction 13,5–14,1° au lieu de ≈ 21°), garde min
// au-dessus du capteur −0,03 m ; (a) arête arrondie 2 ; (b) LAVA_MARGIN 0,75 2 ; (c) SUSPENSION_DAMPING
// 0,3 150 (et cas 4 0/43) ; (d) congé au pied R = 10 m 0, garde min 1,72 m. Durée par défaut ≈ 7 min
// sur un cœur (échantillonnage ≈ 6 min).
// Exemple : 4 processus `PHASES_VARIANTS=marge PHASES_SEEDS=0,4,8 PHASES_OUT=test-results/phases npx
// vitest run -c vitest.slow.config.ts tests/slow/phases.test.ts` (graines réparties), puis
// `PHASES_MERGE=test-results/phases npx vitest run -c vitest.slow.config.ts tests/slow/phases.test.ts`.
import { CONFIG } from '../../src/config';
import {
  DEFAULT_SIZES, FAST_FALL_LIP_SPEED, env, PHASE_SEEDS, REFERENCE, describeSample, profileCheck, readShards, runCases,
  runRace, runRamps, runReleases, samplePhases, variantById, variantReport, variantTrack, writeShard,
  type PhaseSample, type SampleSizes, type Shard,
} from '../helpers/phases';

const list = (s: string | undefined): string[] | null => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : null);
const variants = (list(env.PHASES_VARIANTS) ?? ['reference']).map(variantById);
const seeds = list(env.PHASES_SEEDS)?.map(Number) ?? PHASE_SEEDS;
const parts = new Set(list(env.PHASES_PARTS) ?? ['samples', 'cases', 'releases', 'ramps']);
const sizes: SampleSizes = (() => {
  const s = list(env.PHASES_SIZES)?.map(Number);
  return s ? { perWindow: s[0], motifs: s[1], turbos: s[2] } : DEFAULT_SIZES;
})();
const RACE6_SEEDS = [0, 1, 2, 3, 4];

/** Le protocole retrouve-t-il une chute propre rapide ? (vrai aujourd'hui sur la référence, graines 0 à 9.) */
function expectFastFall(samples: PhaseSample[]): void {
  const fast = samples.filter((s) => s.outcome === 'lave' && s.lipSpeed > FAST_FALL_LIP_SPEED);
  console.log(`chutes propres à plus de ${FAST_FALL_LIP_SPEED} m/s au sommet : ${fast.length}\n  ${fast.map(describeSample).join('\n  ')}`);
  expect(fast.length, `${samples.length} runs`).toBeGreaterThan(0);
}

if (env.PHASES_MERGE) {
  test(`fusion des morceaux de ${env.PHASES_MERGE}`, () => {
    const shards = readShards(env.PHASES_MERGE!);
    const ids = [...new Set(shards.map((s) => s.variant))];
    for (const id of ids) console.log(variantReport(variantById(id), shards.filter((s) => s.variant === id)));
    const ref = shards.filter((s) => s.variant === REFERENCE.id);
    const refSeeds = new Set(ref.flatMap((s) => (s.samples.length ? s.seeds : [])));
    if (PHASE_SEEDS.every((s) => refSeeds.has(s))) expectFastFall(ref.flatMap((s) => s.samples));
  });
} else {
  for (const variant of variants) {
    describe(variant.label, () => {
      const shard: Shard = {
        variant: variant.id, seeds, samples: [], cases: [], releases: [], ramps: [], races: [],
        seconds: { samples: 0, cases: 0, releases: 0, ramps: 0, races: 0 },
      };
      const timed = <T>(key: keyof Shard['seconds'], fn: () => T): T => {
        const t0 = performance.now();
        const r = fn();
        shard.seconds[key] += (performance.now() - t0) / 1000;
        return r;
      };
      if (variant.reshape) {
        test.each(seeds)('seed %i : profil retouché, pente ≤ MAX_SLOPE hors parois, sommet inchangé', (seed) => {
          const c = profileCheck(variantTrack(seed, variant), variantTrack(seed, REFERENCE));
          console.log(`${variant.id} seed ${seed} : pente max ${c.maxSlope.toFixed(2)}°, ${c.changed}, sommet inchangé ${c.lipKept}`);
          expect(c.maxSlope).toBeLessThanOrEqual(CONFIG.MAX_SLOPE * 180 / Math.PI + 1e-6);
          expect(c.lipKept).toBe(true);
        });
      }
      test.each(seeds)('seed %i', (seed) => {
        if (parts.has('samples')) shard.samples.push(...timed('samples', () => samplePhases(seed, variant, sizes)));
        if (parts.has('cases')) shard.cases.push(...timed('cases', () => runCases(seed, variant)));
        if (parts.has('releases')) shard.releases.push(...timed('releases', () => runReleases(seed, variant)));
        if (parts.has('ramps') && seed <= 4) shard.ramps.push(...timed('ramps', () => runRamps(seed, variant)));
        if (parts.has('races')) {
          if (RACE6_SEEDS.includes(seed)) shard.races.push(timed('races', () => runRace(6, seed, variant)));
          shard.races.push(timed('races', () => runRace(7, seed, variant)));
        }
      });
      if (variant.id === REFERENCE.id && parts.has('samples') && PHASE_SEEDS.every((s) => seeds.includes(s))) {
        test(`protocole : au moins une chute propre doigt posé à plus de ${FAST_FALL_LIP_SPEED} m/s au sommet`, () => expectFastFall(shard.samples));
      }
      afterAll(() => {
        console.log(variantReport(variant, [shard]));
        if (env.PHASES_OUT) writeShard(env.PHASES_OUT, shard);
      });
    });
  }
}
