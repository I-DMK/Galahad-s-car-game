// Chocs des copains contre les rochers à 5 voitures (plan C, tâche 11c, Step 18), graines 24 à 47 : voir
// tests/slow/robots-rochers-0-23.test.ts et tests/helpers/robots-rochers.ts.
import { registerRobotsRochers } from '../helpers/robots-rochers';

registerRobotsRochers(Array.from({ length: 24 }, (_, i) => 24 + i));
