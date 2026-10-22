// Mesure du rattrapage à 5 voitures (plan B, tâche 5d), seconde moitié : Galahad doigt posé graines 24 à
// 47, doigt levé 30 % graines 8 à 15. Protocole et sortie : tests/helpers/rattrapage.ts. Budget : < 15 min
// mur ; mesuré 7 min 13 s pour les deux fichiers en parallèle (32 courses à 5 voitures chacun, ≈ 12 s par
// course).
import { registerRattrapage } from '../helpers/rattrapage';

const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

registerRattrapage({ posé: range(24, 47), levé: range(8, 15) });
