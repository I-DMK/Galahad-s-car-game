// Course à 5 voitures, doigt posé, graines 0 à 9 (suite lente, npm run test:slow) : mêmes invariants
// que la CI (tests/race-smoke.test.ts, graines 1 et 2) : ≤ 3 respawns par voiture, aucun garde-fou
// de vitesse, personne bloqué > 2 s, Galahad arrive avant 240 s ; tableau des mesures imprimé.
import { expectRaceInvariants, fiveCarRace } from '../helpers/race';

const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('course à 5 voitures, doigt posé (robots : driver provisoire)', () => {
  test.each(SEEDS)('seed %i : ≤ 3 respawns par voiture, aucun garde-fou de vitesse, personne bloqué > 2 s, Galahad arrive', (seed) => {
    const race = fiveCarRace(seed);
    console.log(`course à 5 ${race.summary}`);
    expectRaceInvariants(race);
  });
});
