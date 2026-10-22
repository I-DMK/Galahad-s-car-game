// Budget : < 15 min mur (attendu ≈ 5,6 min : 23 tremplins × 4 arrivées × 28 sauts, ≈ 0,13 s par saut).
// Sauts au sommet des tremplins avec la tolérance de sol (plan B, tâche 5e, Step 11, complété au Step 14 ; addendum
// « bouton saut » §6.2) : graines 0 à 4. Voir tests/helpers/sommets.ts.
import { registerSautVolcan } from '../helpers/sommets';

registerSautVolcan([0, 1, 2, 3, 4]);
