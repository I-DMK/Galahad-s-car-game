// Budget : < 20 min mur (10 courses à 5 voitures ≈ 10 × 13,7 s ≈ 2,5 min). Objectif de course sous élastique, variante
// « doigt levé 30 % » (plan B, tâche 7, Step 5 ; décision D7-5 du papa) : graines 0 à 9, motif du rattrapage
// (`liftedPattern(seed, 0,3)`), saut parfait aux fosses. Places imprimées ; seules les limites des copains sont exigées
// (≤ 3 réapparitions par copain hors fosses, ≤ 2 chutes par série, arrivée < 240 s, 0 chute sans tentative, 0 freinage
// net à l'écran). Sortie : tests/slow/out/race-objective-leve.json.
import { describeObjective, describeTotals, expectObjectiveRace, objectiveRace, writeObjective, type ObjectiveRow } from '../helpers/objective';

const SEEDS = Array.from({ length: 10 }, (_, i) => i);
/** Courses calculées une fois avant les tests (comme race-objective : indépendant de l'ordre et d'un filtre `-t`). */
const leve: ObjectiveRow[] = [];
const summaries = new Map<number, string>();

describe('objectif de course sous élastique, doigt levé 30 %, graines 0 à 9 (places imprimées)', () => {
  beforeAll(() => {
    for (const seed of SEEDS) {
      const { row, race } = objectiveRace(seed, 'levé', 'parfait');
      leve.push(row);
      summaries.set(seed, race.summary);
      console.log(`${describeObjective(row)}\n  ${race.summary}`);
    }
    writeObjective('race-objective-leve', leve);
    console.log(`=== objectif, doigt levé 30 % (tâche 7) ===\n${describeTotals('doigt levé 30 %', leve)}\n`
      + `places par graine : ${leve.map((o) => `g${o.seed} ${o.galahadPlace}`).join(' ')}`);
  }, 1_800_000);

  test.each(SEEDS)('doigt levé 30 %, graine %i : limites des copains, arrivée, aucun freinage net à l’écran', (seed) => {
    expectObjectiveRace(leve.find((o) => o.seed === seed)!, summaries.get(seed)!);
  });
});
