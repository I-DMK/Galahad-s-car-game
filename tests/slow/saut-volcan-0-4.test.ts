// Budget : < 15 min mur (mesuré au Step 14 : 5,5 min, 20 tremplins × 4 arrivées × 28 sauts et les sauts mal placés).
// Tremplins : doigt posé sans saut 0 chute, sauts au sommet avec la tolérance de sol, saut mal placé (plan B, tâche 5e,
// Steps 11 et 14 ; addendum « bouton saut » §4 et §6.2) : graines 0 à 4. Voir tests/helpers/sommets.ts.
import { registerSautVolcan } from '../helpers/sommets';

registerSautVolcan([0, 1, 2, 3, 4]);
