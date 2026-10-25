// Rochers (plan C, tâche 11c ; spec « rochers » §1) : un capteur rectangle statique par rocher, sur le modèle des étoiles
// (`physics/stars.ts`). L'état est tenu par voiture : le masque du capteur est le OU des catégories des voitures qui ne
// l'ont pas encore touché, 0 si toutes l'ont touché. Un capteur ne reste jamais actif sans raison.
import Matter from 'matter-js';
import type { Config } from '../config';
import { isRockActiveFor, type RockState } from '../cars/rocks';
import { heightAt } from '../track/query';
import type { Rock } from '../track/types';
import { toPx, worldToPhys } from './units';
import { CAT, MAX_CARS, carCategory, type World } from './world';

const { Bodies, Composite } = Matter;

/** Catégories des voitures d'index 0 à MAX_CARS − 1, précalculées (appelé à chaque pas). */
const CAR_BITS: readonly number[] = Array.from({ length: MAX_CARS }, (_, k) => carCategory(k));

/**
 * Un capteur par rocher, [xStart, xEnd] × [sol, sol + ROCK_HEIGHT] (sol mesuré en xStart : plat sous le rocher par
 * construction), label 'rock', catégorie CAT.SENSOR, actif pour toutes les voitures jusqu'au premier `syncRockBodies` ;
 * `body.plugin = { rockId }`.
 */
export function createRockBodies(world: World, rocks: Rock[], cfg: Config): Matter.Body[] {
  const bodies = rocks.map((rock) => {
    const ground = heightAt(world.track, rock.xStart);
    const c = worldToPhys({ x: (rock.xStart + rock.xEnd) / 2, y: ground + cfg.ROCK_HEIGHT / 2 });
    const body = Bodies.rectangle(c.x, c.y, toPx(rock.xEnd - rock.xStart), toPx(cfg.ROCK_HEIGHT), {
      isStatic: true,
      isSensor: true,
      label: 'rock',
      collisionFilter: { category: CAT.SENSOR, mask: CAT.ALL_CARS },
    });
    // Affecté après création : Body.create copie en profondeur ses options.
    body.plugin = { rockId: rock.id };
    return body;
  });
  Composite.add(world.engine.world, bodies);
  return bodies;
}

/**
 * Aligne le filtre de chaque capteur (même ordre que `states`) sur l'état du rocher : masque = OU des catégories des
 * voitures (une case de `hitAt` chacune) pour qui il est actif ; réécrit seulement s'il change. Au-delà de MAX_CARS
 * cases : RangeError (`carCategory`).
 */
export function syncRockBodies(bodies: Matter.Body[], states: RockState[]): void {
  for (let i = 0; i < bodies.length; i++) {
    const state = states[i];
    let mask = 0;
    for (let k = 0; k < state.hitAt.length; k++) {
      if (isRockActiveFor(state, k)) mask |= k < CAR_BITS.length ? CAR_BITS[k] : carCategory(k);
    }
    const filter = bodies[i].collisionFilter;
    if (filter.mask !== mask) filter.mask = mask;
  }
}
