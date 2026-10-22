// Empreinte « au bit près » de Galahad seul (plan B, Global Constraints) : 30 s doigt posé sur les
// pistes de 1 680 m des graines 0, 1 et 2, sha1 cumulé des empreintes par pas (`stepFingerprint`).
// Figée au Step 1 de la tâche 5f sur le commit final de la 5c (0d05f96).
// Si l'empreinte bouge, c'est un défaut, pas une valeur à recapturer.
// Tâche 5e (Step 10) : `FROZEN` se mesure sur les pistes d'avant (`withAnciennesPistes`), celles de e02dcae sans
// étoiles hautes : la preuve que la physique n'a pas bougé quand les pistes de CONFIG changent (décision P10).
// Tâche 5e (Step 15) : `FROZEN_CONFIG`, empreinte sur les pistes de CONFIG (plats étoile), RECAPTURÉE PAR LE RULING
// R-F10 (registre : anciens et nouveaux hash, commit, raison P10, et `FROZEN` resté identique dans le même commit).
// Toute autre variation reste un défaut ; prochaine recapture prévue : tâche 5g (fosses).
import { CONFIG, type Config } from '../src/config';
import { createRaceSim, stepRace } from '../src/sim/simulate';
import { AP } from './helpers/anciennes-pistes';
import { CumulativeFingerprint } from './helpers/fingerprint';
import { trackFor } from './helpers/runs';

const SECONDS = 30;

/** Pistes d'avant : figé sur la 5c (0d05f96), inchangé depuis. */
const FROZEN: Record<number, string> = {
  0: '74c538168609dad6c9dc088608cdee5e4c80ae75',
  1: '39fbc123033c9efedcc24557b905f8520d883ee5',
  2: '2aa519106b410b39d561eaa1beae14cb55050bd8',
};

/**
 * Pistes de CONFIG avec les plats étoile (tâche 5e), recapturé par le ruling R-F10. Avant : les valeurs de `FROZEN`
 * (pistes identiques). Graine 2 inchangée : ses 30 premières secondes ne voient pas encore de terrain changé.
 */
const FROZEN_CONFIG: Record<number, string> = {
  0: '4400cca9369917ccabe13f79d64e059e003b4ac9',
  1: 'e3f486a0285eef7f601a4184e38b29ba9dc7124f',
  2: '2aa519106b410b39d561eaa1beae14cb55050bd8',
};

function fingerprint(seed: number, cfg: Config): { digest: string; steps: number } {
  const sim = createRaceSim(trackFor(seed, cfg), cfg);
  const fp = new CumulativeFingerprint();
  for (let i = 0; i < Math.round(SECONDS / cfg.PHYSICS_DT); i++) {
    stepRace(sim, true);
    fp.push(sim);
  }
  return { digest: fp.digest(), steps: fp.steps };
}

test.each([0, 1, 2])('graine %i : Galahad seul, doigt posé 30 s, pistes d’avant, empreinte inchangée', (seed) => {
  const { digest, steps } = fingerprint(seed, AP);
  console.log(`empreinte graine ${seed} (${steps} pas) : ${digest}`);
  expect(digest).toBe(FROZEN[seed]);
});

test.each([0, 1, 2])('graine %i : Galahad seul, doigt posé 30 s, pistes de CONFIG, empreinte recapturée (R-F10)', (seed) => {
  const { digest, steps } = fingerprint(seed, CONFIG);
  console.log(`empreinte CONFIG graine ${seed} (${steps} pas) : ${digest}`);
  expect(digest).toBe(FROZEN_CONFIG[seed]);
});
