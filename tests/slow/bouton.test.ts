// « Ce que le bouton rend à Galahad » (plan B, tâche 7, Step 6 ; décision D7-5 du papa, ruling Q9) : lecture seule des
// étapes du rattrapage déjà mesurées (tests/slow/out/rattrapage-<étape>.jsonl, `npm run test:slow:rattrapage`), avant et
// après la tâche 7 ; aucune simulation, < 1 s. Étapes : BOUTON_AVANT (défaut « 7-avant,7-avant-sauteur,7-avant-jamais »)
// et BOUTON_APRES (défaut « 7,7-sauteur,7-jamais »), dans l'ordre saut parfait, sauteur, sans saut. Exigé : 64 courses
// par étape au même commit (non-vacuité) ; aucune assertion chiffrée. À la demande : npm run test:slow:bouton, dans
// l'arbre qui a mesuré les étapes (le dossier tests/slow/out est ignoré par git).
import { EXPECTED_RACES, boutonReport, readBoutonStages, stageSizes } from '../helpers/rattrapage';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const stages = (v: string | undefined, d: string): string[] => (v ?? d).split(',').map((x) => x.trim());

test('ce que le bouton rend à Galahad : places avant / après, sans saut, saut parfait, sauteur (mesure seule)', () => {
  const avant = readBoutonStages('avant la tâche 7', stages(env.BOUTON_AVANT, '7-avant,7-avant-sauteur,7-avant-jamais'));
  const apres = readBoutonStages('après la tâche 7', stages(env.BOUTON_APRES, '7,7-sauteur,7-jamais'));
  console.log(boutonReport([avant, apres]));
  for (const b of [avant, apres]) {
    for (const [etape, n] of Object.entries(stageSizes(b))) expect(n, `${b.label} : ${etape}`).toBe(EXPECTED_RACES);
  }
});
