// Budget : < 15 min mur (mesuré au Step 14 : 5,1 min, 18 tremplins × 4 arrivées × 28 sauts et les sauts mal placés).
// Tremplins : doigt posé sans saut 0 chute, sauts au sommet avec la tolérance de sol, saut mal placé (plan B, tâche 5e,
// Steps 11 et 14 ; addendum « bouton saut » §4 et §6.2) : graines 5 à 9. Voir tests/helpers/sommets.ts.
import { registerSautVolcan } from '../helpers/sommets';

registerSautVolcan([5, 6, 7, 8, 9]);
