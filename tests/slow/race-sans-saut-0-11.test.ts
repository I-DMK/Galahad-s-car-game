// Budget : < 15 min mur (12 × (Galahad seul sans saut 13 s + seul avec le saut parfait 13 s + 5 voitures 14 s) ≈ 8 min
// CALCULÉ). Courses doigt posé sans saut, graines 0 à 11 : protocole dans tests/helpers/race-sans-saut.ts (tâche 5g).
import { registerRaceSansSaut } from '../helpers/race-sans-saut';

registerRaceSansSaut([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
