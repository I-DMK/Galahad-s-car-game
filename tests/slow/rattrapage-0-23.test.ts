// Mesure du rattrapage à 5 voitures (plan B, tâche 5d), première moitié : Galahad doigt posé graines 0 à
// 23, doigt levé 30 % graines 0 à 7. Protocole et sortie : tests/helpers/rattrapage.ts. Budget : < 15 min
// mur ; mesuré 7 min 13 s pour les deux fichiers en parallèle (32 courses à 5 voitures chacun, ≈ 12 s par
// course).
// Lancement : RATTRAPAGE_ETAPE=<étape> npx vitest run -c vitest.slow.config.ts tests/slow/rattrapage-0-23.test.ts
// tests/slow/rattrapage-24-47.test.ts (comparaison avec RATTRAPAGE_REF, défaut « avant »).
import { registerRattrapage } from '../helpers/rattrapage';

const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

registerRattrapage({ posé: range(0, 23), levé: range(0, 7) });
