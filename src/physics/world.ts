import Matter from 'matter-js';
import type { Config } from '../config';
import type { Track } from '../track/types';

const { Engine, Bodies, Composite, Vertices } = Matter;

/** Catégories de collision. */
export const CAT = { GROUND: 0x0001, CAR: 0x0002, SENSOR: 0x0004 } as const;

export interface World {
  engine: Matter.Engine;
  track: Track;
  ground: Matter.Body[];
  lava: Matter.Body[];
  wall: Matter.Body;
  /** Fond des trapèzes de sol (px, y vers le bas). */
  floorY: number;
}

const STEP_MS = 1000 / 60;

/** Sol : un trapèze statique par segment, du profil jusqu'à floorY (px). */
function buildGround(track: Track, ppm: number, floorY: number): Matter.Body[] {
  const pts = track.points;
  const ground: Matter.Body[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i].x * ppm;
    const x1 = pts[i + 1].x * ppm + 1; // 1 px de recouvrement : pas de fente entre segments
    const verts = [
      { x: x0, y: -pts[i].y * ppm },
      { x: x1, y: -pts[i + 1].y * ppm },
      { x: x1, y: floorY },
      { x: x0, y: floorY },
    ];
    // fromVertices recentre la forme sur son centroïde : on lui passe donc ce centroïde.
    const c = Vertices.centre(verts);
    ground.push(
      Bodies.fromVertices(c.x, c.y, [verts], {
        isStatic: true,
        friction: 1,
        label: 'ground',
        collisionFilter: { category: CAT.GROUND, mask: CAT.CAR },
      }),
    );
  }
  return ground;
}

/**
 * Lave : un capteur par volcan, qui remplit tout le volume du cratère et dépasse le rebord de
 * LAVA_SENSOR_ABOVE_RIM (y monde rimY + LAVA_SENSOR_ABOVE_RIM) jusqu'à floorY, sur
 * [xLava − lavaWidth/2, xLava + lavaWidth/2] : une voiture lente ne peut pas franchir le cratère au
 * pas en s'appuyant sur ses bords, et un rebond sur le flanc amont ne survole pas la lave. Seuil de
 * franchissement au sommet : chutes de 9,75 à 10,14 m/s, passages dès 9,96 (bissection de
 * tests/slow/dosage.test.ts) ; doigt posé depuis le plat de lancement, le point bas de la voiture passe
 * au moins 0,63 m au-dessus du capteur, dans le pire cas mesuré : fin de turbo au pied de la rampe
 * (lancée à V_MAX, turbo pris à xLancement − 26 ; g0 v2 et g8 v3) ; 1,72 m hors fin de turbo (2 924 +
 * 4 601 historiques, congé du pied de rampe, tâche 5c du plan B ; garde ≥ 0,3 m assertée).
 * Le rendu de la lave, lui, s'arrête sous le rebord.
 */
function buildLava(track: Track, cfg: Config, floorY: number): Matter.Body[] {
  const ppm = cfg.PIXELS_PER_METER;
  return track.volcanoes.map((volcano) => {
    const top = -(volcano.rimY + cfg.LAVA_SENSOR_ABOVE_RIM) * ppm;
    const width = volcano.lavaWidth * ppm;
    const body = Bodies.rectangle(volcano.xLava * ppm, (top + floorY) / 2, width, floorY - top, {
      isStatic: true,
      isSensor: true,
      label: 'lava',
      collisionFilter: { category: CAT.SENSOR, mask: CAT.CAR },
    });
    // Affecté après création : Body.create copie en profondeur ses options, ce qui
    // casserait l'identité avec le volcan de la piste.
    body.plugin = { volcano };
    return body;
  });
}

/** Mur de fin : 1 m de large à partir de xWall, de y = −5 m à +10 m. */
function buildWall(track: Track, ppm: number): Matter.Body {
  const yBottom = 5 * ppm; // y monde −5 m
  const yTop = -10 * ppm; // y monde +10 m
  return Bodies.rectangle((track.xWall + 0.5) * ppm, (yTop + yBottom) / 2, ppm, yBottom - yTop, {
    isStatic: true,
    label: 'wall',
    collisionFilter: { category: CAT.GROUND, mask: CAT.CAR },
  });
}

export function createWorld(track: Track, cfg: Config): World {
  const ppm = cfg.PIXELS_PER_METER;
  const engine = Engine.create({ enableSleeping: false });
  engine.gravity.x = 0;
  engine.gravity.y = (cfg.GRAVITY * ppm) / 1000; // gravity.scale par défaut : 0,001
  let minY = Infinity;
  for (const p of track.points) minY = Math.min(minY, p.y);
  const floorY = -minY * ppm + 400;
  const ground = buildGround(track, ppm, floorY);
  const lava = buildLava(track, cfg, floorY);
  const wall = buildWall(track, ppm);
  Composite.add(engine.world, [...ground, ...lava, wall]);
  return { engine, track, ground, lava, wall, floorY };
}

/** Un pas fixe de 1/60 s. */
export function stepWorld(world: World): void {
  Engine.update(world.engine, STEP_MS);
}

/** Capteurs (dédoublonnés) des paires actives de `engine.pairs.list` impliquant l'un des `bodies`. */
export function sensorsTouching(engine: Matter.Engine, bodies: Matter.Body[]): Matter.Body[] {
  const set = new Set(bodies);
  // Les paires portent des parties : on accepte la partie ou son corps parent.
  const mine = (b: Matter.Body) => set.has(b) || set.has(b.parent);
  const found = new Set<Matter.Body>();
  for (const pair of engine.pairs.list) {
    if (!pair.isActive) continue;
    const { bodyA, bodyB } = pair;
    if (mine(bodyA) && bodyB.isSensor) found.add(bodyB.parent);
    else if (mine(bodyB) && bodyA.isSensor) found.add(bodyA.parent);
  }
  return [...found];
}
