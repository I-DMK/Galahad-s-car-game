// Mesure du rattrapage à 5 voitures (plan B, tâche 5d), seconde moitié : Galahad doigt posé graines 24 à
// 47, doigt levé 30 % graines 8 à 15. Protocole, sortie et rapport : tests/helpers/rattrapage.ts. Budget :
// < 15 min mur ; mesuré 7 min 13 s pour les deux fichiers en parallèle (32 courses à 5 voitures chacun,
// ≈ 12 s par course). Lancement : npm run test:slow:rattrapage (voir tests/slow/rattrapage-0-23.test.ts).
import { LEVE_SEEDS, POSE_SEEDS, registerRattrapage } from '../helpers/rattrapage';

registerRattrapage({ posé: POSE_SEEDS.slice(24), levé: LEVE_SEEDS.slice(8) });
