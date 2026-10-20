import Matter from 'matter-js';
import { normalizeAngle } from '../cars/angle';
import type { Config } from '../config';
import { heightAt as trackHeightAt } from '../track/query';
import { mpsToPxPerStep, speedMps, toPx, worldToPhys } from './units';
import { CAT, type World } from './world';

const { Bodies, Body, Composite, Constraint } = Matter;

const STEP_MS = 1000 / 60;
const SIDES = [-1, 1] as const;

export interface CarBody {
  id: string;
  index: number;
  chassis: Matter.Body;
  /** [arrière, avant] */
  wheels: [Matter.Body, Matter.Body];
  constraints: Matter.Constraint[];
  composite: Matter.Composite;
  /** [châssis, roue arrière, roue avant] */
  parts: Matter.Body[];
}

/**
 * Matter 0.20 : avec la seule option `mass`, Body.create garde l'inertie calculée pour la
 * densité par défaut (≈ 1 à 2,5 kg) : 25 à 40 fois trop faible pour nos masses, les roues
 * tressautent sur le sol et patinent (voiture qui dérive à l'arrêt, ≈ 0,3 m/s² au lieu de
 * 4 en plein gaz). On passe donc aussi `inertia`, cohérente avec la masse, avec le facteur 4 que Matter
 * applique à toutes ses inerties (Body._inertiaScale).
 */
const INERTIA_SCALE = 4;

const MASK_NORMAL = CAT.GROUND | CAT.CAR | CAT.SENSOR;
const MASK_INVULNERABLE = CAT.GROUND | CAT.SENSOR;

/**
 * Voiture : châssis + deux roues suspendues chacune par deux ressorts. Construite à
 * l'origine puis posée sur la piste à x (angle 0) par `placeCar`.
 */
export function createCar(world: World, id: string, index: number, x: number, cfg: Config): CarBody {
  const filter = () => ({ group: -(index + 1), category: CAT.CAR, mask: MASK_NORMAL });
  const w = toPx(cfg.CAR_LENGTH);
  const h = toPx(cfg.CAR_HEIGHT);
  const r = toPx(cfg.WHEEL_RADIUS);
  const chassis = Bodies.rectangle(0, 0, w, h, {
    label: 'chassis',
    mass: cfg.CHASSIS_MASS,
    inertia: (INERTIA_SCALE * cfg.CHASSIS_MASS * (w * w + h * h)) / 12,
    chamfer: { radius: toPx(0.2) },
    friction: cfg.CHASSIS_FRICTION,
    frictionAir: cfg.AIR_DRAG,
    restitution: cfg.RESTITUTION,
    collisionFilter: filter(),
  });
  const axleX = toPx(cfg.WHEEL_BASE / 2);
  const axleY = toPx(cfg.WHEEL_DROP); // Matter : y vers le bas, donc sous le centre
  const spread = toPx(cfg.SUSPENSION_ANCHOR_SPREAD);
  const constraints: Matter.Constraint[] = [];
  const wheels = SIDES.map((side) => {
    const wheel = Bodies.circle(side * axleX, axleY, r, {
      label: 'wheel',
      mass: cfg.WHEEL_MASS,
      inertia: (INERTIA_SCALE * cfg.WHEEL_MASS * r * r) / 2,
      friction: cfg.WHEEL_FRICTION,
      frictionAir: cfg.AIR_DRAG,
      restitution: cfg.RESTITUTION,
      collisionFilter: filter(),
    });
    for (const s of SIDES) {
      constraints.push(
        Constraint.create({
          bodyA: chassis,
          pointA: { x: side * axleX + s * spread, y: 0 },
          bodyB: wheel,
          pointB: { x: 0, y: 0 },
          stiffness: cfg.SUSPENSION_STIFFNESS,
          damping: cfg.SUSPENSION_DAMPING,
          length: Math.hypot(spread, axleY),
        }),
      );
    }
    return wheel;
  }) as [Matter.Body, Matter.Body];
  const parts = [chassis, ...wheels];
  // Affecté après création : Body.create copie ses options en profondeur.
  for (const p of parts) p.plugin = { carId: id };
  const composite = Composite.create({ label: 'car', bodies: parts, constraints });
  Composite.add(world.engine.world, composite);
  const car: CarBody = { id, index, chassis, wheels, constraints, composite, parts };
  placeCar(car, x, (xx) => trackHeightAt(world.track, xx), 0, cfg);
  return car;
}

/**
 * Pose la voiture à l'arrêt : châssis à (x, heightAt(x) + WHEEL_RADIUS + WHEEL_DROP),
 * tourné de `angle` (monde, positif en montée comme `slopeAt`) ; les axes tournent avec
 * lui, puis chaque roue est posée à heightAt(xRoue) + WHEEL_RADIUS.
 */
export function placeCar(
  car: CarBody, x: number, heightAt: (x: number) => number, angle: number, cfg: Config,
): void {
  Body.setPosition(car.chassis, worldToPhys({ x, y: heightAt(x) + cfg.WHEEL_RADIUS + cfg.WHEEL_DROP }));
  Body.setAngle(car.chassis, -angle); // Matter : y vers le bas, angle positif = horaire à l'écran
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  car.wheels.forEach((wheel, i) => {
    // Axe local (±WHEEL_BASE/2, −WHEEL_DROP) en mètres, tourné de angle (sens trigonométrique).
    const xw = x + SIDES[i] * (cfg.WHEEL_BASE / 2) * cos + cfg.WHEEL_DROP * sin;
    Body.setPosition(wheel, worldToPhys({ x: xw, y: heightAt(xw) + cfg.WHEEL_RADIUS }));
  });
  // setPosition conserve la vitesse : on remet tout à zéro.
  for (const p of car.parts) {
    Body.setVelocity(p, { x: 0, y: 0 });
    Body.setAngularVelocity(p, 0);
  }
}

/**
 * Conduite à un doigt, à appeler à chaque pas : gaz → la rotation des roues monte de
 * WHEEL_SPINUP jusqu'à la vitesse de roulement V_MAX × speedFactor ; doigt levé → frein
 * moteur ; jamais de marche arrière (vitesse angulaire positive = avance vers +x).
 */
export function applyDrive(car: CarBody, throttle: boolean, speedFactor: number, cfg: Config): void {
  const omegaMax = mpsToPxPerStep(cfg.V_MAX * speedFactor) / toPx(cfg.WHEEL_RADIUS); // rad/pas
  for (const wheel of car.wheels) {
    let omega = wheel.angularVelocity;
    omega = throttle ? Math.min(omega + cfg.WHEEL_SPINUP, omegaMax) : omega * cfg.ENGINE_BRAKE;
    Body.setAngularVelocity(wheel, Math.max(omega, 0));
  }
}

/** Freinage (après l'arrivée) : rotation des roues × factor. */
export function applyBrake(car: CarBody, factor: number): void {
  for (const wheel of car.wheels) Body.setAngularVelocity(wheel, wheel.angularVelocity * factor);
}

/** Pour chaque roue : en contact actif avec un corps non capteur (sol, mur, autre voiture). */
export function wheelsOnGround(engine: Matter.Engine, car: CarBody): [boolean, boolean] {
  const on: [boolean, boolean] = [false, false];
  for (const pair of engine.pairs.list) {
    if (!pair.isActive) continue;
    const a = pair.bodyA.parent;
    const b = pair.bodyB.parent;
    car.wheels.forEach((wheel, i) => {
      if ((a === wheel && !pair.bodyB.isSensor) || (b === wheel && !pair.bodyA.isSensor)) on[i] = true;
    });
  }
  return on;
}

/**
 * En l'air (aucune roue au sol) : couple ressort-amortisseur qui ramène le châssis à plat.
 * K et D sont des accélérations angulaires (rad/pas² par rad, et par rad/pas).
 */
export function applyAirLevel(car: CarBody, onGround: [boolean, boolean], cfg: Config): void {
  if (onGround[0] || onGround[1]) return;
  const { chassis } = car;
  const accel = -normalizeAngle(chassis.angle) * cfg.AIR_LEVEL_K - chassis.angularVelocity * cfg.AIR_LEVEL_D;
  chassis.torque = (accel * chassis.inertia) / (STEP_MS * STEP_MS);
}

/** Borne |vy| de chaque partie à VERTICAL_SPEED_CAP, sans toucher à vx. */
export function clampVelocities(car: CarBody, cfg: Config): void {
  const cap = mpsToPxPerStep(cfg.VERTICAL_SPEED_CAP);
  for (const p of car.parts) {
    const { x, y } = p.velocity;
    if (Math.abs(y) > cap) Body.setVelocity(p, { x, y: Math.sign(y) * cap });
  }
}

/** Invulnérable : la voiture ne heurte plus les autres voitures (sol et capteurs restent). */
export function setCarInvulnerable(car: CarBody, on: boolean): void {
  for (const p of car.parts) p.collisionFilter.mask = on ? MASK_INVULNERABLE : MASK_NORMAL;
}

/** Vitesse du châssis (m/s). */
export function carSpeedMps(car: CarBody): number {
  return speedMps(car.chassis.velocity);
}

/** Angle du châssis dans (−π, π], repère monde : positif nez levé vers +x (comme `slopeAt`). */
export function carAngle(car: CarBody): number {
  return normalizeAngle(-car.chassis.angle);
}
