// Simulations d'acceptation « arriver lancé » (addendum §1.7, cas 1 à 5 et turbo permanent) sur
// les graines 0 à 2 : un départ arrêté au début du plat d'élan tombe toujours dans la lave ; une
// voiture lancée depuis n'importe quel point sûr (même après un choc, des bosses, ou avec le turbo)
// passe toujours. Tous les cas tournent sur le premier volcan de chaque graine, sauf le cas 3 (relief
// précédent) sur tous ; les scénarios partis de xLancement (cas 2-lancement, 5, turbo), qui varient
// avec la tranche précédente, tournent sur tous les volcans des graines 3 à 9 dans
// tests/slow/volcans-slow.test.ts (voir helpers/cases.ts) ; dosage de L_ELAN : tests/slow/dosage.test.ts.
import { registerVolcanoCases } from './helpers/cases';

const SEEDS = [0, 1, 2];

registerVolcanoCases({ 1: SEEDS, 2: SEEDS, '2-lancement': SEEDS, 3: SEEDS, 4: SEEDS, 5: SEEDS, turbo: SEEDS }, [3]);
