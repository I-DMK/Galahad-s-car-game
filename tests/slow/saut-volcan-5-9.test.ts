// Budget : < 15 min mur (attendu ≈ 4,9 min : ≈ 20 tremplins × 4 arrivées × 28 sauts, ≈ 0,13 s par saut).
// Sauts au sommet des tremplins avec la tolérance de sol (plan B, tâche 5e, Step 11, complété au Step 14 ; addendum
// « bouton saut » §6.2) : graines 5 à 9. Voir tests/helpers/sommets.ts.
import { registerSautVolcan } from '../helpers/sommets';

registerSautVolcan([5, 6, 7, 8, 9]);
