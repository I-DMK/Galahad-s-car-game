import Matter from 'matter-js';
import { CONFIG } from '../src/config';
import { normalizeAngle } from '../src/cars/angle';
import {
  applyAirLevel, applyBrake, applyDrive, carAngle, carSpeedMps, clampVelocities, createCar,
  placeCar, setCarInvulnerable, wheelsOnGround, type CarBody,
} from '../src/physics/car';
import { mpsToPxPerStep, physToWorld, speedMps, toPx } from '../src/physics/units';
import { CAT, createWorld, stepWorld, type World } from '../src/physics/world';
import { generateTrack } from '../src/track/generate';
import { heightAt, slopeAt } from '../src/track/query';

const { Body, Composite } = Matter;

const DEG = Math.PI / 180;
const STEPS_PER_SECOND = 60;
const R = CONFIG.WHEEL_RADIUS;

/** Piste plate de 600 m (partagée : les tests ajoutent chacun leur voiture dans un monde neuf). */
const FLAT = generateTrack(1, 600, CONFIG, { onlyPlat: true });

function flatCar(x = 10): { world: World; car: CarBody } {
  const world = createWorld(FLAT, CONFIG);
  const car = createCar(world, 'galahad', 0, x, CONFIG);
  return { world, car };
}

/** Vitesse horizontale du châssis (m/s, monde : positive vers +x). */
const vxMps = (car: CarBody) => (car.chassis.velocity.x * STEPS_PER_SECOND) / CONFIG.PIXELS_PER_METER;
const posM = (b: Matter.Body) => physToWorld(b.position);

/** Lance toutes les parties à v m/s vers +x, roues en roulement sans glissement. */
function launch(car: CarBody, v: number): void {
  for (const p of car.parts) Body.setVelocity(p, { x: mpsToPxPerStep(v), y: 0 });
  for (const w of car.wheels) Body.setAngularVelocity(w, mpsToPxPerStep(v) / toPx(R));
}

/** Boucle de conduite de la tâche : applyDrive → stepWorld → clampVelocities. */
function drive(world: World, car: CarBody, steps: number, throttle: boolean, onStep?: (i: number) => void): void {
  for (let i = 1; i <= steps; i++) {
    applyDrive(car, throttle, 1, CONFIG);
    stepWorld(world);
    clampVelocities(car, CONFIG);
    onStep?.(i);
  }
}

test('normalizeAngle ramène dans (−π, π]', () => {
  expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 12);
  expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI, 12);
  expect(normalizeAngle(-190 * DEG)).toBeCloseTo(170 * DEG, 12);
  expect(normalizeAngle(0.5)).toBeCloseTo(0.5, 12);
  expect(normalizeAngle(-7 * Math.PI + 0.25)).toBeCloseTo(-Math.PI + 0.25, 12);
});

test('construction : 3 parties sans frottement de l’air, masses 60/40/40, groupe négatif, 4 contraintes', () => {
  const { world, car } = flatCar();
  expect(car.id).toBe('galahad');
  expect(car.index).toBe(0);
  expect(car.parts).toEqual([car.chassis, ...car.wheels]);
  expect(car.chassis.label).toBe('chassis');
  for (const w of car.wheels) expect(w.label).toBe('wheel');
  for (const p of car.parts) {
    expect(p.frictionAir).toBe(0);
    expect(p.collisionFilter.group).toBe(-1);
    expect(p.collisionFilter.category).toBe(CAT.CAR);
    expect(p.collisionFilter.mask).toBe(CAT.GROUND | CAT.CAR | CAT.SENSOR);
    expect(p.plugin.carId).toBe('galahad');
  }
  expect(car.chassis.mass).toBeCloseTo(CONFIG.CHASSIS_MASS, 9);
  for (const w of car.wheels) expect(w.mass).toBeCloseTo(CONFIG.WHEEL_MASS, 9);
  // Inertie cohérente avec la masse (au moins celle du disque / du rectangle plein) : sans
  // elle, Matter garde l'inertie d'un corps d'environ 1 kg et les roues tressautent.
  const [L, H, Rpx] = [toPx(CONFIG.CAR_LENGTH), toPx(CONFIG.CAR_HEIGHT), toPx(R)];
  expect(car.chassis.inertia).toBeGreaterThanOrEqual((CONFIG.CHASSIS_MASS * (L * L + H * H)) / 12);
  for (const w of car.wheels) expect(w.inertia).toBeGreaterThanOrEqual((CONFIG.WHEEL_MASS * Rpx * Rpx) / 2);
  expect(car.constraints).toHaveLength(4);
  for (const c of car.constraints) {
    expect(c.bodyA).toBe(car.chassis);
    expect(car.wheels).toContain(c.bodyB);
    expect(c.stiffness).toBe(CONFIG.SUSPENSION_STIFFNESS);
    expect(c.damping).toBe(CONFIG.SUSPENSION_DAMPING);
  }
  // Deux contraintes par roue.
  for (const w of car.wheels) expect(car.constraints.filter((c) => c.bodyB === w)).toHaveLength(2);
  const all = Composite.allBodies(world.engine.world);
  for (const p of car.parts) expect(all).toContain(p);
  expect(Composite.allConstraints(world.engine.world)).toHaveLength(4);
  // Une deuxième voiture a son propre groupe.
  const other = createCar(world, 'b', 1, 20, CONFIG);
  for (const p of other.parts) expect(p.collisionFilter.group).toBe(-2);
  // Posée à angle 0 : roues de part et d'autre, sous le centre du châssis.
  const c = posM(car.chassis);
  const [w0, w1] = car.wheels.map(posM);
  expect(c.x).toBeCloseTo(10, 6);
  expect(c.y).toBeCloseTo(R + CONFIG.WHEEL_DROP, 6);
  expect(w0.x).toBeCloseTo(10 - CONFIG.WHEEL_BASE / 2, 6);
  expect(w1.x).toBeCloseTo(10 + CONFIG.WHEEL_BASE / 2, 6);
  expect(w0.y).toBeCloseTo(R, 6);
  expect(carAngle(car)).toBeCloseTo(0, 12);
});

test('repos : 120 pas sans gaz → immobile, à plat, roues posées', () => {
  const { world, car } = flatCar();
  drive(world, car, 120, false);
  for (const p of car.parts) expect(speedMps(p.velocity)).toBeLessThan(0.05);
  expect(carSpeedMps(car)).toBeLessThan(0.05);
  expect(Math.abs(carAngle(car))).toBeLessThan(2 * DEG);
  for (const w of car.wheels) {
    const p = posM(w);
    expect(Math.abs(p.y - heightAt(FLAT, p.x) - R)).toBeLessThan(0.05);
  }
  expect(wheelsOnGround(world.engine, car)).toEqual([true, true]);
});

test('calibration : accélération moyenne sur 0–2 s = DRIVE_ACCEL (± 10 %), dans [3,5 ; 5] m/s²', () => {
  const { world, car } = flatCar();
  drive(world, car, 2 * STEPS_PER_SECOND, true);
  const accel = carSpeedMps(car) / 2;
  expect(accel).toBeGreaterThanOrEqual(3.5);
  expect(accel).toBeLessThanOrEqual(5);
  expect(Math.abs(accel - CONFIG.DRIVE_ACCEL)).toBeLessThanOrEqual(0.1 * CONFIG.DRIVE_ACCEL);
  expect(vxMps(car)).toBeGreaterThan(0); // le gaz fait avancer vers +x
});

test('vitesse max : plein gaz 10 s → [0,9 ; 1,02] × V_MAX', () => {
  const { world, car } = flatCar();
  let peak = 0;
  drive(world, car, 10 * STEPS_PER_SECOND, true, () => { peak = Math.max(peak, carSpeedMps(car)); });
  expect(carSpeedMps(car)).toBeGreaterThanOrEqual(0.9 * CONFIG.V_MAX);
  expect(peak).toBeLessThanOrEqual(1.02 * CONFIG.V_MAX);
  // Les roues sont bornées à la vitesse de roulement V_MAX × facteur ; le turbo relève la limite.
  const omegaMax = mpsToPxPerStep(CONFIG.V_MAX) / toPx(R);
  applyDrive(car, true, 1, CONFIG);
  for (const w of car.wheels) expect(w.angularVelocity).toBeCloseTo(omegaMax, 12);
  applyDrive(car, true, CONFIG.TURBO_FACTOR, CONFIG);
  for (const w of car.wheels) expect(w.angularVelocity).toBeGreaterThan(omegaMax);
});

test('doigt levé : de 14 m/s, ralentit sans jamais reculer, encore > 8 m/s après 2 s', () => {
  const { world, car } = flatCar();
  launch(car, 14);
  let minVx = Infinity;
  let at2s = 0;
  drive(world, car, 10 * STEPS_PER_SECOND, false, (i) => {
    minVx = Math.min(minVx, vxMps(car));
    for (const w of car.wheels) expect(w.angularVelocity).toBeGreaterThanOrEqual(0);
    if (i === 2 * STEPS_PER_SECOND) at2s = carSpeedMps(car);
  });
  expect(at2s).toBeGreaterThan(8);
  expect(at2s).toBeLessThan(14);
  expect(carSpeedMps(car)).toBeLessThan(at2s);
  expect(minVx).toBeGreaterThanOrEqual(0);
});

test('applyBrake(FINISH_BRAKE) : de 14 m/s à < 1 m/s en moins de 6 s', () => {
  const { world, car } = flatCar();
  launch(car, 14);
  let stoppedAt = Infinity;
  for (let i = 1; i <= 6 * STEPS_PER_SECOND && stoppedAt === Infinity; i++) {
    applyBrake(car, CONFIG.FINISH_BRAKE);
    stepWorld(world);
    clampVelocities(car, CONFIG);
    if (carSpeedMps(car) < 1) stoppedAt = i;
  }
  expect(stoppedAt).toBeLessThanOrEqual(6 * STEPS_PER_SECOND);
  expect(vxMps(car)).toBeGreaterThanOrEqual(0);
});

test('air-level sur la voiture complète : lâchée à 40° → < 10° après 90 pas, sans dépasser −15°', () => {
  const world = createWorld(FLAT, CONFIG);
  Composite.remove(world.engine.world, [...world.ground, world.wall]);
  const car = createCar(world, 'galahad', 0, 10, CONFIG);
  placeCar(car, 10, () => 30, 40 * DEG, CONFIG);
  expect(carAngle(car)).toBeCloseTo(40 * DEG, 9);
  let minAngle = Infinity;
  for (let i = 0; i < 90; i++) {
    const onGround = wheelsOnGround(world.engine, car);
    expect(onGround).toEqual([false, false]);
    applyAirLevel(car, onGround, CONFIG);
    stepWorld(world);
    clampVelocities(car, CONFIG);
    minAngle = Math.min(minAngle, carAngle(car));
  }
  expect(Math.abs(carAngle(car))).toBeLessThan(10 * DEG);
  expect(minAngle).toBeGreaterThan(-15 * DEG);
  expect(posM(car.chassis).y).toBeGreaterThan(20); // toujours en l'air, rien touché
});

test('air-level inactif dès qu’une roue touche le sol', () => {
  const { car } = flatCar();
  placeCar(car, 10, () => 0, 20 * DEG, CONFIG);
  applyAirLevel(car, [true, false], CONFIG);
  expect(car.chassis.torque).toBe(0);
  applyAirLevel(car, [false, false], CONFIG);
  expect(car.chassis.torque).not.toBe(0);
});

test('clampVelocities : −80 m/s vertical → −31,5 m/s, horizontale inchangée', () => {
  const { car } = flatCar();
  const vx = mpsToPxPerStep(5);
  Body.setVelocity(car.chassis, { x: vx, y: mpsToPxPerStep(80) }); // Matter : y vers le bas
  Body.setVelocity(car.wheels[0], { x: -vx, y: -mpsToPxPerStep(80) });
  Body.setVelocity(car.wheels[1], { x: vx, y: mpsToPxPerStep(10) });
  clampVelocities(car, CONFIG);
  const worldVy = (b: Matter.Body) => (-b.velocity.y * STEPS_PER_SECOND) / CONFIG.PIXELS_PER_METER;
  expect(worldVy(car.chassis)).toBeCloseTo(-CONFIG.VERTICAL_SPEED_CAP, 9);
  expect(car.chassis.velocity.x).toBeCloseTo(vx, 12);
  expect(worldVy(car.wheels[0])).toBeCloseTo(CONFIG.VERTICAL_SPEED_CAP, 9);
  expect(car.wheels[0].velocity.x).toBeCloseTo(-vx, 12);
  expect(worldVy(car.wheels[1])).toBeCloseTo(-10, 9);
  expect(car.wheels[1].velocity.x).toBeCloseTo(vx, 12);
});

test('placeCar sur une pente de 8° (seed 1) : 30 pas sans gaz → immobile, sans saut', () => {
  const track = generateTrack(1, 1680, CONFIG);
  // Montée de 7 à 9° sous le châssis, régulière sous les deux roues (6 à 10°).
  const inRange = (x: number, lo: number, hi: number) => slopeAt(track, x) >= lo * DEG && slopeAt(track, x) <= hi * DEG;
  let x = NaN;
  for (const s of track.slices.filter((sl) => sl.type === 'bosses')) {
    for (let xx = s.xStart + 2; xx < s.xEnd - 2 && Number.isNaN(x); xx += 0.1) {
      const h = CONFIG.WHEEL_BASE / 2;
      if (inRange(xx, 7, 9) && inRange(xx - h, 6, 10) && inRange(xx + h, 6, 10)) x = xx;
    }
    if (!Number.isNaN(x)) break;
  }
  expect(Number.isNaN(x)).toBe(false);
  const world = createWorld(track, CONFIG);
  const car = createCar(world, 'galahad', 0, x, CONFIG);
  placeCar(car, x, (xx) => heightAt(track, xx), slopeAt(track, x), CONFIG);
  expect(carAngle(car)).toBeCloseTo(slopeAt(track, x), 9);
  for (const p of car.parts) {
    expect(p.velocity).toEqual({ x: 0, y: 0 });
    expect(p.angularVelocity).toBe(0);
  }
  const y0 = posM(car.chassis).y;
  drive(world, car, 30, false);
  expect(carSpeedMps(car)).toBeLessThan(0.05);
  expect(Math.abs(posM(car.chassis).y - y0)).toBeLessThan(0.05);
  expect(Math.abs(carAngle(car) - slopeAt(track, x))).toBeLessThan(2 * DEG);
});

test('placeCar remet à zéro les vitesses de toutes les parties', () => {
  const { car } = flatCar();
  launch(car, 14);
  placeCar(car, 50, () => 0, 0, CONFIG);
  for (const p of car.parts) {
    expect(p.velocity).toEqual({ x: 0, y: 0 });
    expect(p.angularVelocity).toBe(0);
  }
  expect(posM(car.chassis).x).toBeCloseTo(50, 6);
});

test('invulnérable : mask sans CAT.CAR, puis rétabli', () => {
  const { car } = flatCar();
  setCarInvulnerable(car, true);
  for (const p of car.parts) {
    expect(p.collisionFilter.mask).toBe(CAT.GROUND | CAT.SENSOR);
    expect((p.collisionFilter.mask ?? 0) & CAT.CAR).toBe(0);
    expect(p.collisionFilter.category).toBe(CAT.CAR);
    expect(p.collisionFilter.group).toBe(-1);
  }
  setCarInvulnerable(car, false);
  for (const p of car.parts) expect(p.collisionFilter.mask).toBe(CAT.GROUND | CAT.CAR | CAT.SENSOR);
});
