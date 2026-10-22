// Budget : < 15 min mur (12 × (Galahad seul sans saut 13 s + seul avec le saut parfait 13 s + 5 voitures 14 s) ≈ 8 min
// CALCULÉ). Courses doigt posé sans saut, graines 12 à 23 : protocole dans tests/helpers/race-sans-saut.ts (tâche 5g).
import { registerRaceSansSaut } from '../helpers/race-sans-saut';

registerRaceSansSaut([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
