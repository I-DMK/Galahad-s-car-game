// Étoiles : un capteur circulaire statique par étoile. L'état d'une étoile est tenu par voiture (tâche 5d) :
// le masque du capteur est le OU des catégories des voitures pour qui l'étoile est active, 0 si elle ne
// l'est pour aucune. Un capteur ne reste donc jamais actif sans raison : ses paires comptent dans les
// contacts du solveur de matter-js (`totalContacts`, `Resolver.preSolvePosition`), et une seule voiture
// (Galahad seul) garde exactement le filtre d'avant la tâche 5d.
import Matter from 'matter-js';
import type { Config } from '../config';
import { isStarActiveFor, type StarState } from '../cars/stars';
import type { Star } from '../track/types';
import { toPx, worldToPhys } from './units';
import { CAT, MAX_CARS, carCategory, type World } from './world';

const { Bodies, Composite } = Matter;

/** Rayon du capteur d'une étoile (m). */
const STAR_RADIUS = 0.5;
/** Catégories des voitures d'index 0 à MAX_CARS − 1, précalculées (appelé à chaque pas). */
const CAR_BITS: readonly number[] = Array.from({ length: MAX_CARS }, (_, k) => carCategory(k));

/** Capteurs des étoiles, actifs pour toutes les voitures jusqu'au premier `syncStarBodies`. */
export function createStarBodies(world: World, stars: Star[], _cfg: Config): Matter.Body[] {
  const bodies = stars.map((star) => {
    const p = worldToPhys(star);
    const body = Bodies.circle(p.x, p.y, toPx(STAR_RADIUS), {
      isStatic: true,
      isSensor: true,
      label: 'star',
      collisionFilter: { category: CAT.SENSOR, mask: CAT.ALL_CARS },
    });
    // Affecté après création : Body.create copie en profondeur ses options.
    body.plugin = { starId: star.id };
    return body;
  });
  Composite.add(world.engine.world, bodies);
  return bodies;
}

/**
 * Aligne le filtre de chaque capteur (même ordre que `states`) sur l'état de l'étoile à l'instant t :
 * masque = OU des catégories des voitures (une case de `takenAt` chacune) pour qui elle est active ;
 * le masque n'est réécrit que s'il change. Au-delà de MAX_CARS cases : RangeError (`carCategory`).
 */
export function syncStarBodies(bodies: Matter.Body[], states: StarState[], t: number, cfg: Config): void {
  for (let i = 0; i < bodies.length; i++) {
    const state = states[i];
    let mask = 0;
    for (let k = 0; k < state.takenAt.length; k++) {
      if (isStarActiveFor(state, k, t, cfg)) mask |= k < CAR_BITS.length ? CAR_BITS[k] : carCategory(k);
    }
    const filter = bodies[i].collisionFilter;
    if (filter.mask !== mask) filter.mask = mask;
  }
}
