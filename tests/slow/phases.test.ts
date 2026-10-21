// Échantillonnage des phases de suspension au saut des volcans (tâche 5c du plan B). Suite lente
// (npm run test:slow) ; protocole et mesures dans tests/helpers/phases.ts.
// Par défaut : la configuration actuelle sur les volcans des graines 0 à 9 : échantillonnage des
// phases, cas 1 à 5, turbo et (i) de la tâche 4, tableau (b), rampes-saut ; tableaux imprimés.
// Assertion (promesse du jeu, correctif de la tâche 5c) : AUCUNE chute dans la lave, doigt posé depuis
// xLancement au plus tard, sur les 2 924 historiques. Sur le candidat « pli » (pied de rampe d'avant
// la tâche 5c, à la demande), assertion inverse : le protocole y retrouve au moins une chute propre à plus
// de FAST_FALL_LIP_SPEED (10,5 m/s) au sommet (preuve qu'il échantillonne le bon phénomène).
// Mesures (2 924 runs par configuration, 43 volcans) : pied d'avant 4 chutes propres (10,94 à 11,31 m/s au
// sommet, direction 13,5–14,1° au lieu de ≈ 21°), garde minimale −0,03 m au-dessus du capteur ; congé
// R = 10 m : 0 chute, garde minimale 1,72 m (phase 1, commit ee58194, où sont aussi les autres candidats).
// Durée par défaut ≈ 7 min sur un cœur (échantillonnage ≈ 6 min).
// Variables d'environnement (mesure en parallèle sur plusieurs processus) :
//  - PHASES_VARIANTS : ids des candidats séparés par des virgules (reference, pli ; défaut reference) ;
//  - PHASES_SEEDS : graines (défaut 0 à 9) ; PHASES_SIZES : « perWindow,motifs,turbos » par volcan ;
//  - PHASES_PARTS : parties jouées parmi samples, cases, releases, ramps, races (défaut : toutes sauf
//    races ; races = cas 6 graines 0 à 4 et cas 7 graines 0 à 9, monde complet, ≈ 15 s par course) ;
//  - PHASES_OUT : dossier où écrire chaque morceau (JSON) ; PHASES_MERGE : dossier dont les morceaux
//    sont fusionnés et imprimés par candidat (aucune simulation).
// Exemple : 4 processus `PHASES_SEEDS=0,2 PHASES_OUT=test-results/phases npx vitest run -c
// vitest.slow.config.ts tests/slow/phases.test.ts` (graines réparties), puis
// `PHASES_MERGE=test-results/phases npx vitest run -c vitest.slow.config.ts tests/slow/phases.test.ts`.
import {
  DEFAULT_SIZES, FAST_FALL_LIP_SPEED, PHASE_SEEDS, REFERENCE, SHARP_FOOT, describeSample, env, readShards, runCases,
  runRace, runRamps, runReleases, samplePhases, variantById, variantReport, writeShard,
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

/** Configuration actuelle : aucune chute (promesse « doigt posé depuis le plat de lancement »). */
function expectNoFall(samples: PhaseSample[]): void {
  const falls = samples.filter((s) => s.outcome === 'lave');
  console.log(`chutes doigt posé (configuration actuelle) : ${falls.length} sur ${samples.length}${falls.length ? `\n  ${falls.map(describeSample).join('\n  ')}` : ''}`);
  expect(samples.length).toBeGreaterThan(0);
  expect(falls.map(describeSample)).toEqual([]);
}

/** Pied d'avant : le protocole retrouve au moins une chute propre rapide. */
function expectFastFall(samples: PhaseSample[]): void {
  const fast = samples.filter((s) => s.outcome === 'lave' && s.lipSpeed > FAST_FALL_LIP_SPEED);
  console.log(`pied d'avant : chutes propres à plus de ${FAST_FALL_LIP_SPEED} m/s au sommet : ${fast.length}\n  ${fast.map(describeSample).join('\n  ')}`);
  expect(fast.length, `${samples.length} runs`).toBeGreaterThan(0);
}

const ASSERT: Record<string, (samples: PhaseSample[]) => void> = { [REFERENCE.id]: expectNoFall, [SHARP_FOOT.id]: expectFastFall };
const ASSERT_TITLE: Record<string, string> = {
  [REFERENCE.id]: 'promesse : aucune chute doigt posé depuis le plat de lancement',
  [SHARP_FOOT.id]: `protocole : au moins une chute propre à plus de ${FAST_FALL_LIP_SPEED} m/s au sommet sur le pied d'avant`,
};

if (env.PHASES_MERGE) {
  test(`fusion des morceaux de ${env.PHASES_MERGE}`, () => {
    const shards = readShards(env.PHASES_MERGE!);
    const ids = [...new Set(shards.map((s) => s.variant))];
    for (const id of ids) {
      const mine = shards.filter((s) => s.variant === id);
      console.log(variantReport(variantById(id), mine));
      const sampled = new Set(mine.flatMap((s) => (s.samples.length ? s.seeds : [])));
      if (PHASE_SEEDS.every((s) => sampled.has(s))) ASSERT[id](mine.flatMap((s) => s.samples));
    }
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
      if (parts.has('samples') && PHASE_SEEDS.every((s) => seeds.includes(s))) {
        test(ASSERT_TITLE[variant.id], () => ASSERT[variant.id](shard.samples));
      }
      afterAll(() => {
        console.log(variantReport(variant, [shard]));
        if (env.PHASES_OUT) writeShard(env.PHASES_OUT, shard);
      });
    });
  }
}
