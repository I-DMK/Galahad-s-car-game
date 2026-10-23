// Budget : < 30 min mur (24 graines × 3 courses à 5 voitures ≈ 72 × 14 s ≈ 17 min CALCULÉ). Sauts des copains à 5
// voitures (plan B, tâche 6, Step 3), graines 24 à 47 : bras « fonceurs » (traits de saut de Pablo), « prudents »
// (Timothé) et tirage normal ; invariants de course. Protocole et sortie (tests/slow/out/robots-sauts-24-47.json) :
// tests/helpers/robots-sauts.ts.
import { registerRobotsSauts } from '../helpers/robots-sauts';

registerRobotsSauts(Array.from({ length: 24 }, (_, i) => 24 + i));
