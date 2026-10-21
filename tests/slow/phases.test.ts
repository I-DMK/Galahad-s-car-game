// Échantillonnage des phases de suspension au saut des volcans (tâche 5c du plan B). Suite lente
// (npm run test:slow) ; protocole et mesures dans tests/helpers/phases.ts.
// Par défaut : la configuration actuelle sur les volcans des graines 0 à 9 (familles échelonné, motif
// et turbo ; la famille turbo dense est dans tests/slow/phases-dense.test.ts, fichier à part pour
// tourner en parallèle), puis le témoin « pli » (pied d'avant la tâche 5c) sur les graines WITNESS_SEEDS.
// Assertions (promesse du jeu, correctif de la tâche 5c) : TOUS les historiques passent le volcan (ni
// lave, ni issue « autre » : atterrissage hors réception, retournement, blocage), doigt posé depuis
// xLancement au plus tard, et la garde au-dessus du capteur de lave reste ≥ MIN_CLEARANCE (0,3 m) ;
// sur le témoin « pli », au moins une chute propre à plus de FAST_FALL_LIP_SPEED (10,5 m/s) au sommet :
// le protocole voit encore le phénomène, l'assertion « 0 chute » a un contrôle vivant.
// Mesures (43 volcans) : pied d'avant 4 chutes propres sur 2 924 historiques en phase 1 (ee58194, ancien tirage de turboAt), 3 avec le tirage du tour 1 (10,94 à 11,31 m/s au
// sommet, direction 13,5–14,1° au lieu de ≈ 21°), garde minimale −0,03 m ; congé R = 10 m : 0 chute,
// garde minimale 1,72 m sur ces familles ; mais 0,63 m en fin de turbo au pied (famille turbo dense).
// Variables d'environnement (mesure en parallèle sur plusieurs processus) :
//  - PHASES_VARIANTS : ids des candidats séparés par des virgules (reference, pli ; défaut reference,
//    sans témoin) ; PHASES_SEEDS : graines (défaut 0 à 9) ;
//  - PHASES_SIZES : « perWindow,motifs,turbos[,dense 0|1] » par volcan (dense : défaut 0) ;
//  - PHASES_PARTS : parties jouées parmi samples, cases, releases, ramps, races (défaut : samples seul).
//    cases, releases, ramps et races sont de l'outillage de mesure (aucune assertion) : cas 1 à 5,
//    turbo et (i) de la tâche 4, tableau (b) au pas de 0,05 s, rampes-saut, courses des cas 6 et 7 ;
//  - PHASES_OUT : dossier où écrire chaque morceau (JSON) ; PHASES_MERGE : dossier dont les morceaux
//    sont fusionnés et imprimés par candidat (aucune simulation ; échoue si l'échantillonnage d'un
//    candidat ne couvre pas les graines 0 à 9).
// Exemple : 4 processus `PHASES_SEEDS=0,2 PHASES_OUT=test-results/phases npx vitest run -c
// vitest.slow.config.ts tests/slow/phases.test.ts` (graines réparties), puis
// `PHASES_MERGE=test-results/phases npx vitest run -c vitest.slow.config.ts tests/slow/phases.test.ts`.
import {
  DEFAULT_SIZES, FAST_FALL_LIP_SPEED, MIN_CLEARANCE, PHASE_SEEDS, expectAllPass, REFERENCE, SHARP_FOOT, describeSample, env, readShards, runCases,
  runRace, runRamps, runReleases, samplePhases, variantById, variantReport, writeShard,
  type PhaseSample, type SampleSizes, type Shard,
} from '../helpers/phases';

const list = (s: string | undefined): string[] | null => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : null);
const variants = (list(env.PHASES_VARIANTS) ?? ['reference']).map(variantById);
/** Témoin « pli » joué par défaut (PHASES_VARIANTS absent) : graines où le pied d'avant fait tomber (tirage de turboAt du tour 1 : g0 v3, g0 v4, g6 v2). */
const WITNESS_SEEDS = [0, 6];
const seeds = list(env.PHASES_SEEDS)?.map(Number) ?? PHASE_SEEDS;
const parts = new Set(list(env.PHASES_PARTS) ?? ['samples']);
const sizes: SampleSizes = (() => {
  const s = list(env.PHASES_SIZES)?.map(Number);
  return s ? { perWindow: s[0], motifs: s[1], turbos: s[2], dense: s[3] !== 0 } : DEFAULT_SIZES;
})();
const RACE6_SEEDS = [0, 1, 2, 3, 4];

/** Configuration actuelle : tout passe, garde ≥ MIN_CLEARANCE (expectAllPass). */
const expectNoFall = (samples: PhaseSample[]): void => { expectAllPass(samples, 'doigt posé (configuration actuelle)'); };

/** Pied d'avant : le protocole retrouve au moins une chute propre rapide. */
function expectFastFall(samples: PhaseSample[]): void {
  const fast = samples.filter((s) => s.outcome === 'lave' && s.lipSpeed > FAST_FALL_LIP_SPEED);
  console.log(`pied d'avant : chutes propres à plus de ${FAST_FALL_LIP_SPEED} m/s au sommet : ${fast.length}\n  ${fast.map(describeSample).join('\n  ')}`);
  expect(fast.length, `${samples.length} runs`).toBeGreaterThan(0);
}

const ASSERT: Record<string, (samples: PhaseSample[]) => void> = { [REFERENCE.id]: expectNoFall, [SHARP_FOOT.id]: expectFastFall };
const ASSERT_TITLE: Record<string, string> = {
  [REFERENCE.id]: `promesse : doigt posé depuis le plat de lancement, tout passe, garde ≥ ${MIN_CLEARANCE} m au-dessus du capteur`,
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
      if (!sampled.size) continue; // morceaux sans échantillonnage (cases, releases, …) : rien à asserter
      const missing = PHASE_SEEDS.filter((s) => !sampled.has(s));
      if (missing.length) console.warn(`${id} : échantillonnage incomplet, graines manquantes ${missing.join(', ')}`);
      expect(missing, `${id} : les morceaux fusionnés ne couvrent pas toutes les graines de l'échantillonnage`).toEqual([]);
      ASSERT[id](mine.flatMap((s) => s.samples));
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
  if (!env.PHASES_VARIANTS) {
    test(`témoin : sans congé (pli), graines ${WITNESS_SEEDS.join(', ')}, le protocole retrouve une chute propre à plus de ${FAST_FALL_LIP_SPEED} m/s au sommet`, () => {
      const samples = WITNESS_SEEDS.flatMap((seed) => samplePhases(seed, SHARP_FOOT, { ...DEFAULT_SIZES, dense: false }));
      expectFastFall(samples);
    });
  }
}
