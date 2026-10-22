// Mesure du rattrapage à 5 voitures (plan B, tâche 5d), première moitié : Galahad doigt posé graines 0 à
// 23, doigt levé 30 % graines 0 à 7. Protocole, sortie et rapport : tests/helpers/rattrapage.ts. Budget :
// < 15 min mur ; mesuré 7 min 13 s pour les deux fichiers en parallèle (32 courses à 5 voitures chacun,
// ≈ 12 s par course). À la demande, hors de npm run test:slow :
// RATTRAPAGE_ETAPE=<étape> npm run test:slow:rattrapage (comparaison avec RATTRAPAGE_REF, défaut « avant »).
import { LEVE_SEEDS, POSE_SEEDS, registerRattrapage } from '../helpers/rattrapage';

registerRattrapage({ posé: POSE_SEEDS.slice(0, 24), levé: LEVE_SEEDS.slice(0, 8) });
