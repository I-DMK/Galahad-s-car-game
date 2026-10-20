// Étoiles : un capteur circulaire statique par étoile ; une étoile inactive (prise, pas encore
// réapparue) ne détecte plus la voiture (mask = 0).
import Matter from 'matter-js';
import type { Config } from '../config';
import { isStarActive, type StarState } from '../cars/stars';
import type { Star } from '../track/types';
import { toPx, worldToPhys } from './units';
import { CAT, type World } from './world';

const { Bodies, Composite } = Matter;

/** Rayon du capteur d'une étoile (m). */
const STAR_RADIUS = 0.5;

export function createStarBodies(world: World, stars: Star[], _cfg: Config): Matter.Body[] {
  const bodies = stars.map((star) => {
    const p = worldToPhys(star);
    const body = Bodies.circle(p.x, p.y, toPx(STAR_RADIUS), {
      isStatic: true,
      isSensor: true,
      label: 'star',
      collisionFilter: { category: CAT.SENSOR, mask: CAT.CAR },
    });
    // Affecté après création : Body.create copie en profondeur ses options.
    body.plugin = { starId: star.id };
    return body;
  });
  Composite.add(world.engine.world, bodies);
  return bodies;
}

/** Aligne le filtre de chaque capteur (même ordre que `states`) sur l'état de l'étoile à l'instant t. */
export function syncStarBodies(bodies: Matter.Body[], states: StarState[], t: number, cfg: Config): void {
  bodies.forEach((body, i) => {
    body.collisionFilter.mask = isStarActive(states[i], t, cfg) ? CAT.CAR : 0;
  });
}
