// Course à 5 voitures, doigt posé, graines 12 à 17 (suite lente, npm run test:slow ; graines 0 à 23 en
// quatre fichiers parallèles race-invariants-*.test.ts) : mêmes invariants que la CI
// (tests/race-smoke.test.ts, graines 1 et 2) : ≤ 3 respawns par voiture, aucun garde-fou de vitesse,
// personne bloqué > 2 s, Galahad arrive avant 240 s sans tomber dans la lave (tâche 5c) ; chutes de toutes
// les voitures imprimées avec leur cause (choc ou propre).
import { registerRaceInvariants } from '../helpers/race';

registerRaceInvariants([12, 13, 14, 15, 16, 17]);
