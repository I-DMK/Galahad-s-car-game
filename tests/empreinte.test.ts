// Empreinte « au bit près » de Galahad seul (plan B, Global Constraints) : 30 s doigt posé sur les
// pistes de 1 680 m des graines 0, 1 et 2, sha1 cumulé des empreintes par pas (`stepFingerprint`).
// Figée au Step 1 de la tâche 5f sur le commit final de la 5c (0d05f96).
// Si l'empreinte bouge, c'est un défaut, pas une valeur à recapturer.
// Tâche 5e (Step 10) : `FROZEN` se mesure sur les pistes d'avant (`withAnciennesPistes`), celles de e02dcae sans
// étoiles hautes : la preuve que la physique n'a pas bougé quand les pistes de CONFIG changent (décision P10).
import { AP } from './helpers/anciennes-pistes';
import { createRaceSim, stepRace } from '../src/sim/simulate';
import { CumulativeFingerprint } from './helpers/fingerprint';
import { trackFor } from './helpers/runs';

const SECONDS = 30;

const FROZEN: Record<number, string> = {
  0: '74c538168609dad6c9dc088608cdee5e4c80ae75',
  1: '39fbc123033c9efedcc24557b905f8520d883ee5',
  2: '2aa519106b410b39d561eaa1beae14cb55050bd8',
};

test.each([0, 1, 2])('graine %i : Galahad seul, doigt posé 30 s, pistes d’avant, empreinte inchangée', (seed) => {
  const sim = createRaceSim(trackFor(seed, AP), AP);
  const fp = new CumulativeFingerprint();
  for (let i = 0; i < Math.round(SECONDS / AP.PHYSICS_DT); i++) {
    stepRace(sim, true);
    fp.push(sim);
  }
  const got = fp.digest();
  console.log(`empreinte graine ${seed} (${fp.steps} pas) : ${got}`);
  expect(got).toBe(FROZEN[seed]);
});
