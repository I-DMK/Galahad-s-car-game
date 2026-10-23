// Budget : < 20 min mur (40 courses à 5 voitures ≈ 40 × 13,7 s ≈ 9 min, MESURÉ (relecture), budget v1.6). Objectif de
// course sous élastique (plan B, tâche 7, Step 5 ; spec §7 et §11, addendum §2 ; décisions D7-1, D7-4 et D7-5 du papa) :
// graines 0 à 19, Galahad doigt posé avec le saut parfait à chaque fosse, jamais de saut d'étoile (modèle D7-1), puis la
// variante « sauteur » sur les mêmes graines. Ce sont des courses du rattrapage (étapes « 7 » et « 7-sauteur », mêmes
// graines) : comparaison = contrôle de déterminisme. Exigé dans chaque course : ≤ 3 réapparitions par copain hors
// fosses, ≤ 2 chutes par série, arrivée < 240 s, 0 chute sans tentative, 0 freinage net à l'écran. Au total (D7-4) :
// Galahad 1er ou 2e dans au moins 10 courses, dernier au plus 2 fois, 1er dans 5 à 15 courses, un copain à l'écran au
// moins 30 % du temps en moyenne ; sauteur (D7-5) : place moyenne ≤ celle du modèle. Hors cible : les chiffres vont au
// papa, aucun levier sans lui (R7-14). Sortie : tests/slow/out/race-objective.json.
import {
  OBJECTIVE_TARGETS as T, describeObjective, describeTotals, expectObjectiveRace, objectiveRace, writeObjective, type ObjectiveRow,
} from '../helpers/objective';
import { placeStats } from '../helpers/rattrapage';

const SEEDS = Array.from({ length: 20 }, (_, i) => i);
const modele: ObjectiveRow[] = [];
const sauteur: ObjectiveRow[] = [];

describe('objectif de course sous élastique, graines 0 à 19 : modèle D7-1 (doigt posé, saut parfait aux fosses) et sauteur', () => {
  test.each(SEEDS)('modèle D7-1, graine %i : limites des copains, arrivée, aucun freinage net à l’écran', (seed) => {
    const { row, race } = objectiveRace(seed, 'posé', 'parfait');
    modele.push(row);
    console.log(`${describeObjective(row)}\n  ${race.summary}`);
    expectObjectiveRace(row, race.summary);
  });

  test.each(SEEDS)('sauteur, graine %i : limites des copains, arrivée, aucun freinage net à l’écran', (seed) => {
    const { row, race } = objectiveRace(seed, 'posé', 'sauteur');
    sauteur.push(row);
    console.log(`${describeObjective(row)}\n  ${race.summary}`);
    expectObjectiveRace(row, race.summary);
  });

  afterAll(() => {
    writeObjective('race-objective', [...modele, ...sauteur]);
    console.log(`=== objectif (tâche 7) ===\n${describeTotals('modèle D7-1', modele)}\n${describeTotals('sauteur', sauteur)}\n`
      + `cibles D7-4 : 1er ou 2e ≥ ${T.top2Min}, dernier ≤ ${T.lastMax}, 1er dans ${T.winsMin} à ${T.winsMax}, copain à l'écran ≥ ${100 * T.screenMin} % ; `
      + `D7-5 : place moyenne du sauteur ≤ celle du modèle\n`
      + `places par graine (modèle / sauteur) : ${SEEDS.map((s) => `g${s} ${modele.find((o) => o.seed === s)?.galahadPlace ?? '?'}/${sauteur.find((o) => o.seed === s)?.galahadPlace ?? '?'}`).join(' ')}`);
  });

  test('cibles du modèle D7-1 (D7-4) : 1er ou 2e ≥ 10/20, dernier ≤ 2/20, 1er dans 5 à 15, copain à l’écran ≥ 30 % en moyenne', () => {
    const p = placeStats(modele);
    const screen = modele.reduce((a, o) => a + o.screenShare, 0) / Math.max(1, modele.length);
    const what = describeTotals('modèle D7-1', modele);
    expect(p.n, what).toBe(SEEDS.length);
    expect(p.top2, what).toBeGreaterThanOrEqual(T.top2Min);
    expect(p.last, what).toBeLessThanOrEqual(T.lastMax);
    expect(p.wins, what).toBeGreaterThanOrEqual(T.winsMin);
    expect(p.wins, what).toBeLessThanOrEqual(T.winsMax);
    expect(screen, what).toBeGreaterThanOrEqual(T.screenMin);
  });

  test('sauteur (D7-5) : place moyenne ≤ celle du modèle D7-1 sur les mêmes 20 graines', () => {
    const what = `${describeTotals('modèle D7-1', modele)}\n${describeTotals('sauteur', sauteur)}`;
    expect(sauteur.length, what).toBe(SEEDS.length);
    expect(placeStats(sauteur).mean, what).toBeLessThanOrEqual(placeStats(modele).mean);
  });
});
