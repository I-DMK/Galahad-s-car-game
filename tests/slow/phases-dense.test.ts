// Famille « turbo dense » de l'échantillonnage des phases (tâche 5c, relecture adversariale ; protocole
// dans tests/helpers/phases.ts) : lancée à V_MAX en xLancement − 40, − 45 et − 50, doigt posé tout du
// long, turbo pris à chaque mètre de [xLancement − 40, xLancement − 5], sur les 43 volcans des graines
// 0 à 9. La fin du turbo (applyDrive ramène d'un coup ω à omegaMax) tombe ainsi sur l'élan, au pied et
// sur la rampe : c'est là que la garde au-dessus du capteur de lave est la plus basse.
// Assertions : tout passe (ni lave ni « autre »), garde ≥ MIN_CLEARANCE (0,3 m ; décision du papa :
// marge de 0,63 m gardée, fin du turbo non adoucie), et la famille retrouve une garde < 1 m (contrôle
// vivant : sans cela elle ne sonderait plus le pire cas). Mesure : garde minimale 0,63 m, lancée en
// xLancement − 45, turbo à xLancement − 26, g0 v2 et g8 v3 (arrivée au pied 11,3 m/s).
import { DENSE_SIZES, PHASE_SEEDS, REFERENCE, expectAllPass, samplePhases, summarize, type PhaseSample } from '../helpers/phases';

/** La famille doit retrouver le pire cas mesuré (0,63 m) : garde minimale sous ce plafond. */
const WORST_CASE_CEILING = 1;

describe('turbo dense : fin de turbo sur l\'élan, au pied et sur la rampe (configuration actuelle)', () => {
  const samples: PhaseSample[] = [];
  test.each(PHASE_SEEDS)('seed %i', (seed) => {
    samples.push(...samplePhases(seed, REFERENCE, DENSE_SIZES));
  });
  test('tout passe, garde ≥ 0,3 m au-dessus du capteur, et la famille retrouve une garde < 1 m', () => {
    console.log(summarize(samples));
    const worst = expectAllPass(samples, 'turbo dense');
    expect(worst.clearance, 'la famille ne retrouve plus le pire cas (fin de turbo au pied)').toBeLessThan(WORST_CASE_CEILING);
  });
});
