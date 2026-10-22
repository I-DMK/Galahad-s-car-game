// Simulations d'acceptation « arriver lancé » (addendum §1.7, cas 1 à 5 et turbo permanent) sur
// les graines 0 à 2 : un départ arrêté au début du plat d'élan tombe toujours dans la lave ; une
// voiture lancée depuis n'importe quel point sûr (même après un choc, des bosses, ou avec le turbo)
// passe toujours. Tous les cas tournent sur le premier volcan de chaque graine, sauf le cas 3 (relief
// précédent) sur tous (graines 0 à 3) ; les scénarios partis de xLancement (cas 2-lancement, 5, turbo), qui varient
// avec la tranche précédente, tournent sur tous les volcans des graines 3 à 9 dans
// tests/slow/volcans-slow.test.ts (voir helpers/cases.ts) ; dosage de L_ELAN : tests/slow/dosage.test.ts.
import { registerVolcanoCases } from './helpers/cases';

const SEEDS = [0, 1, 2];
/**
 * Cas 3 : graine 3 en plus. Tour 1 de la 5g (pas de tremplin juste après une double-bosse) : les tremplins des graines
 * 0 à 2 suivent un plat ou un plat étoile, plus des bosses ni une double-bosse ; la graine 3 a un tremplin après des bosses.
 */
const CASE3_SEEDS = [...SEEDS, 3];

registerVolcanoCases({ 1: SEEDS, 2: SEEDS, '2-lancement': SEEDS, 3: CASE3_SEEDS, 4: SEEDS, 5: SEEDS, turbo: SEEDS }, [3]);
