// Chocs des copains contre les rochers à 5 voitures (plan C, tâche 11c, Step 18), graines 0 à 23 : bras « fonceurs »
// (traits de saut de Pablo), « prudents » (Timothé) et tirage normal ; invariants de course ; aucune réapparition après un
// choc. Protocole et sortie (tests/slow/out/robots-rochers-0-23.json) : tests/helpers/robots-rochers.ts.
import { registerRobotsRochers } from '../helpers/robots-rochers';

registerRobotsRochers(Array.from({ length: 24 }, (_, i) => i));
